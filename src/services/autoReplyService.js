const supabase = require('../config/supabase');
const logger = require('../utils/appLogger');
// Service layer for auto-reply functionality, including settings management, rule matching, job queuing, and processing.
function computeBackoffSeconds(attempt) {
    const base = Math.min(60 * 10, 3 * Math.pow(2, Math.max(0, attempt))); // cap 10m
    const jitter = Math.floor(Math.random() * 5);
    return base + jitter;
}
// Utility function to safely convert values to strings for logging or storage.
function normalizeText(value) {
    return String(value || '').trim().toLowerCase();
}
// Get current auto-reply settings for a tenant. If no settings exist, defaults will be returned.
async function getSettings(tenantId) {
    const { data, error } = await supabase
        .from('auto_reply_settings')
        .select('enabled,delay_seconds,ai_enabled')
        .eq('tenant_id', tenantId)
        .maybeSingle();

    if (error) {
        if (error.code === 'PGRST205') return { enabled: false, delay_seconds: 0, ai_enabled: false };
        throw error;
    }

    return data || { enabled: true, delay_seconds: 0, ai_enabled: false };
}
// Upsert auto-reply settings for a tenant. If settings already exist, they will be updated; otherwise, a new record will be created.
async function upsertSettings(tenantId, settings) {
    const payload = {
        tenant_id: tenantId,
        enabled: settings.enabled,
        delay_seconds: settings.delay_seconds,
        ai_enabled: settings.ai_enabled,
        updated_at: new Date().toISOString()
    };

    const { error } = await supabase.from('auto_reply_settings').upsert(payload, {
        onConflict: 'tenant_id'
    });

    if (error) throw error;
}
// Find a matching automation rule reply based on the incoming message and tenant's rules.
async function findRuleReply(tenantId, message) {
    const text = normalizeText(message);
    if (!text) return null;

    const { data, error } = await supabase
        .from('automation_rules')
        .select('id,trigger_type,trigger_value,reply,priority')
        .eq('tenant_id', tenantId)
        .order('priority', { ascending: false })
        .limit(50);

    if (error) {
        if (error.code === 'PGRST205') return null;
        throw error;
    }

    for (const rule of data || []) {
        const triggerValue = normalizeText(rule.trigger_value);
        if (!triggerValue) continue;

        const triggerType = normalizeText(rule.trigger_type || 'keyword');
        const matched =
            triggerType === 'contains'
                ? text.includes(triggerValue)
                : triggerType === 'starts_with'
                    ? text.startsWith(triggerValue)
                    : triggerType === 'equals'
                        ? text === triggerValue
                        : text.includes(triggerValue);

        if (matched) {
            return String(rule.reply || '').trim() || null;
        }
    }

    return null;
}
// Placeholder AI reply generator - in real implementation, this would call an external AI service.
async function generateAiReply(_tenantId, incomingText) {
    const text = String(incomingText || '').trim();
    if (!text) return null;
    return "Thanks for reaching out! Our team will get back to you shortly. If you'd like to book an appointment, please share your preferred date and time.";
}
// Resolve channel-specific configuration needed for dispatching a reply, such as API credentials or from numbers.
async function enqueueAutoReplyJob({
    tenantId,
    customerId,
    channel,
    senderId,
    incomingMessageId,
    incomingMessage,
    incomingConversationId
}) {
    const settings = await getSettings(tenantId);
    if (!settings.enabled) return { enqueued: false, reason: 'disabled' };

    const delaySeconds = Math.max(0, Number(settings.delay_seconds || 0));
    const runAt = new Date(Date.now() + delaySeconds * 1000).toISOString();

    const ruleReply = await findRuleReply(tenantId, incomingMessage);
    const replyText = ruleReply || (settings.ai_enabled ? await generateAiReply(tenantId, incomingMessage) : null);
    if (!replyText) return { enqueued: false, reason: 'no_reply' };

    const { error } = await supabase.from('auto_reply_jobs').upsert(
        {
            tenant_id: tenantId,
            customer_id: customerId || null,
            incoming_conversation_id: incomingConversationId || null,
            channel: channel || null,
            sender_id: senderId || null,
            incoming_message_id: incomingMessageId || null,
            incoming_message: incomingMessage || null,
            reply_text: replyText,
            run_at: runAt,
            status: 'pending',
            updated_at: new Date().toISOString()
        },
        { onConflict: 'tenant_id,channel,sender_id,incoming_message_id' }
    );

    if (error) throw error;

    await logger.logAutomation({
        tenantId,
        workflowName: 'auto_reply',
        status: 'queued',
        payload: { channel, sender_id: senderId, run_at: runAt }
    });

    return { enqueued: true, run_at: runAt };
}
// Placeholder dispatch function - in real implementation, this would call the appropriate platform API to send the message.
async function dispatchReply(_job) {
    // Platform-specific dispatch goes here. For now we only persist the outgoing conversation row.
    return { success: true, external_id: null };
}
// Background job processor to be called by a scheduler (e.g. every minute) to process due auto-replies.
async function processDueAutoReplies({ limit = 10 } = {}) {
    const nowIso = new Date().toISOString();
    const { data: due, error } = await supabase
        .from('auto_reply_jobs')
        .select('*')
        .in('status', ['pending', 'retrying'])
        .or(`run_at.lte.${nowIso},next_retry_at.lte.${nowIso}`)
        .order('run_at', { ascending: true })
        .limit(limit);

    if (error) {
        if (error.code === 'PGRST205') return { processed: 0 };
        throw error;
    }

    let processed = 0;
    for (const job of due || []) {
        processed += 1;
        const attempts = (job.attempts || 0) + 1;
        const maxAttempts = job.max_attempts || 5;

        try {
            const { error: lockError } = await supabase
                .from('auto_reply_jobs')
                .update({ attempts, updated_at: new Date().toISOString() })
                .eq('id', job.id)
                .eq('tenant_id', job.tenant_id)
                .in('status', ['pending', 'retrying']);
            if (lockError) throw lockError;

            const result = await dispatchReply(job);
            if (!result?.success) {
                throw new Error(result?.error || 'Reply dispatch failed');
            }

             const { error: convError } = await supabase.from('conversations').insert({
                tenant_id: job.tenant_id,
                customer_id: job.customer_id,
                channel: job.channel,
                sender_id: job.sender_id,
                message: job.reply_text,
                direction: 'outgoing',
                intent: 'auto_reply',
                state: 'auto_reply',
                message_id: null
            });
            if (convError && convError.code !== 'PGRST205') throw convError;

            const { error: doneError } = await supabase
                .from('auto_reply_jobs')
                .update({
                    status: 'sent',
                    last_error: null,
                    next_retry_at: null,
                    updated_at: new Date().toISOString()
                })
                .eq('id', job.id)
                .eq('tenant_id', job.tenant_id);
            if (doneError) throw doneError;

            await logger.logAutomation({
                tenantId: job.tenant_id,
                workflowName: 'auto_reply',
                status: 'sent',
                payload: { job_id: job.id, channel: job.channel, sender_id: job.sender_id }
            });
        } catch (err) {
            const now = new Date();
            const reachedMax = attempts >= maxAttempts;
            const nextRetryAt = reachedMax
                ? null
                : new Date(now.getTime() + computeBackoffSeconds(attempts) * 1000).toISOString();

            await supabase
                .from('auto_reply_jobs')
                .update({
                    status: reachedMax ? 'failed' : 'retrying',
                    attempts,
                    next_retry_at: nextRetryAt,
                    last_error: String(err?.message || err).slice(0, 2000),
                    updated_at: now.toISOString()
                })
                .eq('id', job.id)
                .eq('tenant_id', job.tenant_id);

            await logger.logAutomation({
                tenantId: job.tenant_id,
                workflowName: 'auto_reply',
                status: 'failure',
                payload: { job_id: job.id, error: err?.message || String(err) }
            });
        }
    }

    return { processed };
}

module.exports = {
    getSettings,
    upsertSettings,
    enqueueAutoReplyJob,
    processDueAutoReplies
};

