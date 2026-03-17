const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';

function buildKey() {
    const envKey = process.env.CHANNEL_TOKEN_SECRET || process.env.JWT_SECRET;

    if (!envKey) {
        throw new Error('Missing CHANNEL_TOKEN_SECRET or JWT_SECRET in environment');
    }

    if (/^[0-9a-fA-F]{64}$/.test(envKey)) {
        return Buffer.from(envKey, 'hex');
    }

    return crypto.createHash('sha256').update(envKey).digest();
}

const KEY = buildKey();

function encryptSecret(plainText) {
    if (!plainText) return null;

    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);

    let encrypted = cipher.update(String(plainText), 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag().toString('hex');

    return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

function decryptSecret(payload) {
    if (!payload) return null;

    const parts = String(payload).split(':');
    if (parts.length !== 3) {
        return payload;
    }

    const [ivHex, authTagHex, encryptedHex] = parts;

    try {
        const decipher = crypto.createDecipheriv(
            ALGORITHM,
            KEY,
            Buffer.from(ivHex, 'hex')
        );

        decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));

        let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
        decrypted += decipher.final('utf8');

        return decrypted;
    } catch (error) {
        return payload;
    }
}

function maskSecret(value) {
    if (!value) return '';

    const text = String(value);
    if (text.length <= 4) return '****';

    return `${text.slice(0, 2)}****${text.slice(-2)}`;
}

module.exports = {
    encryptSecret,
    decryptSecret,
    maskSecret
};
