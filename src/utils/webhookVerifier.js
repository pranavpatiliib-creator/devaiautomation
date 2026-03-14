const metaConfig = require('../config/meta');

/**
 * Validates the Webhook Verification request sent by Meta.
 * Webhooks must be verified by echoing back the hub.challenge if the hub.verify_token matches.
 */
const verifyWebhook = (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode && token) {
    if (mode === 'subscribe' && token === metaConfig.verifyToken) {
      console.log('WEBHOOK_VERIFIED');
      return res.status(200).send(challenge);
    } else {
      console.error('WEBHOOK_VERIFICATION_FAILED');
      return res.sendStatus(403);
    }
  }
  return res.sendStatus(400);
};

module.exports = {
  verifyWebhook
};
