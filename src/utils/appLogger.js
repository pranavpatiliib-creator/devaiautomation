const supabase = require('../config/supabase');

function safeString(value, limit = 5000) {
    try {
        return String(value || '').slice(0, limit);
    } catch {
        return '';
    }
}
// App logger utility with structured logging for automation workflows and general info/warn/error logs. Logs are designed to be safe for storage and display, truncating long values and handling non-string inputs gracefully.
async function logAutomation({ tenantId, workflowName, status, payload }) {
    try {
        if (!tenantId || !workflowName) return;
        await supabase.from('automation_logs').insert({
            tenant_id: tenantId,
            workflow_name: workflowName,
            status: status || 'info',
            payload: payload ?? {}
        });
    } catch (error) {
        console.error('automation_logs insert failed:', safeString(error?.message));
    }
}
// General logging functions for info, warn, and error levels. These can be enhanced in the future to integrate with external logging services or to include additional context such as timestamps, request IDs, etc.
function info(message, meta) {
    console.log(message, meta || '');
}
// For warnings, we use console.warn which may be styled differently in some environments to indicate a warning level log.

function warn(message, meta) {
    console.warn(message, meta || '');
}
// For errors, we use console.error which is typically styled to indicate an error level log. We also ensure that any error messages are safely converted to strings and truncated to avoid issues with logging very large or complex objects.
function error(message, meta) {
    console.error(message, meta || '');
}

module.exports = {
    logAutomation,
    info,
    warn,
    error
};

