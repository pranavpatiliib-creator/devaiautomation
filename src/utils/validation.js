function isNonEmptyString(value) {
    return typeof value === 'string' && value.trim().length > 0;
}
// Converts any value to a trimmed string, ensuring it does not exceed a specified maximum length. This is useful for sanitizing inputs before logging or storing them, preventing issues with excessively long strings or non-string values.
function asTrimmedString(value, maxLength = 2000) {
    if (value === null || value === undefined) return '';
    return String(value).trim().slice(0, maxLength);
}
// Converts a value to an ISO date string if it's a valid date, or returns null if the value is falsy or not a valid date. This is useful for normalizing date inputs before storing them in a database or using them in comparisons.
function asNullableIsoDate(value) {
    if (value === null || value === undefined || value === '') return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date.toISOString();
}
// Converts a value to an integer, applying optional minimum and maximum bounds. If the value cannot be parsed as a finite number, it returns a specified fallback value. This is useful for normalizing numeric inputs and ensuring they fall within expected ranges.
function asInt(value, fallback = 0, { min = Number.MIN_SAFE_INTEGER, max = Number.MAX_SAFE_INTEGER } = {}) {
    const parsed = Number.parseInt(String(value), 10);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.min(max, Math.max(min, parsed));
}
// Converts a value to a boolean, interpreting common string representations of true and false. If the value is falsy (undefined, null, empty string), it returns a specified fallback value. This is useful for normalizing boolean inputs from various sources (e.g., query parameters, form data) before using them in application logic.
function asBoolean(value, fallback = false) {
    if (value === undefined || value === null || value === '') return fallback;
    if (typeof value === 'boolean') return value;
    const normalized = String(value).trim().toLowerCase();
    if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
    if (['false', '0', 'no', 'off'].includes(normalized)) return false;
    return Boolean(value);
}
// Utility function to check for required fields in a request body. It returns an array of missing field names, which can be used to generate error messages for API responses.
function requireFields(body, fields = []) {
    const missing = [];
    for (const field of fields) {
        if (body[field] === undefined || body[field] === null || body[field] === '') {
            missing.push(field);
        }
    }
    return missing;
}
// Mark a post as successfully posted by updating its status to 'posted' and clearing any error or retry information.
module.exports = {
    isNonEmptyString,
    asTrimmedString,
    asNullableIsoDate,
    asInt,
    asBoolean,
    requireFields
};

