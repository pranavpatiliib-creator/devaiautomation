const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
// This module provides utility functions for encrypting and decrypting secrets using AES-256-GCM. It also includes a function to mask secrets for safe display in logs or UIs. The encryption key is derived from an environment variable, which can be either a 64-character hex string or any other string (which will be hashed to create a 32-byte key). The encryptSecret function generates a random IV and auth tag for each encryption to ensure security, while the decryptSecret function handles decryption and returns the original input if decryption fails (e.g., due to tampering).    
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
// Encrypts a secret using AES-256-GCM. The output is a string in the format "iv:authTag:encryptedData". The IV and auth tag are generated randomly for each encryption to ensure security. The function returns null if the input is falsy.
function encryptSecret(plainText) {
    if (!plainText) return null;

    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);

    let encrypted = cipher.update(String(plainText), 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag().toString('hex');

    return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}
// Decrypts a secret that was encrypted with the encryptSecret function. It expects the input to be in the format "iv:authTag:encryptedData". If the input is not in the expected format or if decryption fails (e.g., due to tampering), it returns the original input as a fallback.
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
// Utility function to mask secrets for safe display in logs or UIs. It shows the first 2 and last 2 characters, masking the rest with asterisks. If the value is very short, it simply returns '****' to avoid revealing too much.
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
