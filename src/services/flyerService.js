const path = require('path');
const fs = require('fs/promises');
const crypto = require('crypto');

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_FLYER_MODEL = process.env.OPENAI_FLYER_MODEL || process.env.OPENAI_MODEL || 'gpt-4.1-mini';
const OPENAI_API_URL = 'https://api.openai.com/v1/responses';

function safeTrim(value, maxLen) {
    const text = String(value || '').trim();
    if (!text) return '';
    return text.length > maxLen ? text.slice(0, maxLen) : text;
}

function extractOutputText(payload) {
    if (typeof payload?.output_text === 'string' && payload.output_text.trim()) {
        return payload.output_text.trim();
    }

    const parts = [];
    for (const item of payload?.output || []) {
        for (const content of item?.content || []) {
            if (content?.type === 'output_text' && content?.text) {
                parts.push(content.text);
            }
        }
    }

    return parts.join('\n').trim();
}

function extractImageBase64(payload) {
    for (const item of payload?.output || []) {
        if (item?.type === 'image_generation_call' && typeof item?.result === 'string' && item.result.trim()) {
            return item.result.trim();
        }
    }
    return null;
}

function resolveId() {
    if (typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }
    return crypto.randomBytes(16).toString('hex');
}

async function generateFlyerAndSave({ tenant, flyer }) {
    if (!OPENAI_API_KEY) {
        const error = new Error('Missing OPENAI_API_KEY in environment');
        error.status = 503;
        throw error;
    }

    const businessName = safeTrim(tenant?.business_name, 80) || 'Business';
    const industry = safeTrim(tenant?.industry, 80);
    const instagramId = safeTrim(tenant?.instagram_id, 80);
    const whatsappNumber = safeTrim(tenant?.whatsapp_number, 40);
    const headline = safeTrim(flyer?.headline, 90);
    const subheadline = safeTrim(flyer?.subheadline, 140);
    const offer = safeTrim(flyer?.offer, 220);
    const cta = safeTrim(flyer?.cta, 80) || (whatsappNumber ? `WhatsApp: ${whatsappNumber}` : 'DM to book now');
    const extraNotes = safeTrim(flyer?.notes, 300);
    const theme = safeTrim(flyer?.theme, 60);
    
    const prompt = [
        'Create a clean, modern promotional flyer image (vertical) suitable for Instagram feed.',
        'Design requirements:',
        `- Brand/business name: "${businessName}"`,
        industry ? `- Industry: "${industry}"` : null,
        headline ? `- Headline: "${headline}"` : null,
        subheadline ? `- Subheadline: "${subheadline}"` : null,
        offer ? `- Offer/details: "${offer}"` : null,
        `- Call-to-action: "${cta}"`,
        instagramId ? `- Include Instagram handle text: "${instagramId}"` : null,
        whatsappNumber ? `- Include WhatsApp number text: "${whatsappNumber}"` : null,
        theme ? `- Theme/style: "${theme}"` : '- Theme/style: premium, minimal, high-contrast typography',
        '- Avoid tiny unreadable text. Keep layout balanced with generous whitespace.',
        '- Do not include copyrighted logos (unless provided). No watermarks.',
        extraNotes ? `Extra notes: ${extraNotes}` : null,
        '',
        'Also write a short post caption (2-4 lines) that matches the flyer and includes a simple CTA. Return the caption as plain text.'
    ].filter(Boolean).join('\n');

    const response = await fetch(OPENAI_API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${OPENAI_API_KEY}`
        },
        body: JSON.stringify({
            model: OPENAI_FLYER_MODEL,
            input: prompt,
            tools: [
                {
                    type: 'image_generation',
                    size: '1024x1536',
                    quality: 'high',
                    background: 'opaque',
                    format: 'png'
                }
            ],
            tool_choice: { type: 'image_generation' }
        })
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok) {
        const message = payload?.error?.message || `OpenAI request failed (${response.status})`;
        const error = new Error(message);
        error.status = response.status;
        error.payload = payload;
        throw error;
    }

    const imageBase64 = extractImageBase64(payload);
    if (!imageBase64) {
        throw new Error('OpenAI did not return an image');
    }

    const caption = extractOutputText(payload);

    const tenantId = String(tenant?.id || 'unknown');
    const fileId = resolveId();
    const relDir = path.join('generated', 'flyers', tenantId);
    const absDir = path.join(process.cwd(), 'public', relDir);
    await fs.mkdir(absDir, { recursive: true });

    const relPath = path.join(relDir, `${fileId}.png`).replace(/\\/g, '/');
    const absPath = path.join(process.cwd(), 'public', relPath);
    await fs.writeFile(absPath, Buffer.from(imageBase64, 'base64'));

    return {
        image_url: `/${relPath}`,
        caption,
        revised_prompt: (payload?.output || []).find((item) => item?.type === 'image_generation_call')?.revised_prompt || null
    };
}

module.exports = {
    generateFlyerAndSave
};

