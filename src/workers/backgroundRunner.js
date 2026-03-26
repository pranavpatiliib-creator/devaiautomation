const postService = require('../services/postService');
const autoReplyService = require('../services/autoReplyService');
const logger = require('../utils/appLogger');

let started = false;
let timer = null;
// The background runner is responsible for periodically processing due posts and auto-replies. It uses an exponential backoff strategy to handle failures gracefully, ensuring that transient issues do not cause excessive load or log noise. The runner can be started with a specified interval, and it will continue to run indefinitely, adjusting its behavior based on success or failure of the processing tasks.
function startBackgroundRunner({ intervalMs = 5000 } = {}) {
    if (started) return;
    started = true;
    let consecutiveFailures = 0;
    let lastFailureLogAt = 0;
    let currentDelay = intervalMs;
// The tick function is the core of the background runner. It attempts to process due posts and auto-replies, and implements an exponential backoff strategy in case of failures. If processing succeeds, it resets the failure count and delay. If it fails, it increases the failure count and calculates a new delay for the next attempt. To avoid log noise, it only logs errors after 3 consecutive failures and then throttles subsequent logs to at most once per minute until recovery.
    async function tick() {
        try {
            await Promise.all([
                postService.processDuePosts({ limit: 10 }),
                autoReplyService.processDueAutoReplies({ limit: 10 })
            ]);

            if (consecutiveFailures > 0) {
                logger.info('Background runner recovered and resumed normal processing');
            }

            consecutiveFailures = 0;
            currentDelay = intervalMs;
        } catch (error) {
            consecutiveFailures += 1;
            currentDelay = Math.min(intervalMs * Math.pow(2, consecutiveFailures), 60000);

            const now = Date.now();
            // Log only after repeated failures and then throttle to avoid noise.
            if (consecutiveFailures >= 3 && (now - lastFailureLogAt > 60000 || consecutiveFailures === 3)) {
                logger.error('Background runner tick failed', error?.message || error);
                lastFailureLogAt = now;
            }
        }finally {
            timer = setTimeout(tick, currentDelay);
            timer.unref?.();
        }
    }

    tick();
}

module.exports = {
    startBackgroundRunner
};
