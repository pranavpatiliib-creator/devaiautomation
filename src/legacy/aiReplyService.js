const OpenAI = require('openai');

const supabase = require('../config/supabase');

function getOpenAIClient() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return null;
    return new OpenAI({ apiKey });
}

// Legacy AI reply helper kept server-side (was incorrectly placed under public/).
// Not currently wired into main app routes; use via require('src/legacy/...') if needed.

// ─── Rule-based matching (runs before AI to save cost) ───────────────────────
const DEFAULT_RULES = [
    { pattern: /\b(price|cost|pricing|how much)\b/i, reply: "Thanks for your interest! Our team will share pricing details shortly." },
    { pattern: /\b(hours|open|timing|schedule)\b/i, reply: "We're open Mon–Sat 9am–6pm. Feel free to reach out anytime!" },
    { pattern: /\b(location|address|where are you)\b/i, reply: "Please check our website for our latest location details." },
    { pattern: /\b(thank|thanks|thank you)\b/i, reply: "You're welcome! Let us know if there's anything else we can help with." },
    { pattern: /\b(hi|hello|hey|good morning|good evening)\b/i, reply: "Hi there! How can we help you today?" }
];

function matchRule(text, customRules = []) {
    const rules = [...customRules, ...DEFAULT_RULES];
    for (const rule of rules) {
        const pattern = rule.pattern instanceof RegExp ? rule.pattern : new RegExp(rule.pattern, 'i');
        if (pattern.test(String(text || ''))) return rule.reply;
    }
    return null;
}

function handleMenuFlow(text, menuConfig) {
    if (!menuConfig) return null;
    const t = String(text || '').trim().toLowerCase();
    const items = Array.isArray(menuConfig.items) ? menuConfig.items : [];
    const match = items.find((item) => String(item.keyword || '').trim().toLowerCase() === t);
    return match?.reply || null;
}

async function generateReply({ tenantId, conversationId, inboundText }) {
    const openai = getOpenAIClient();
    if (!openai) return null;

    const { data: cfg } = await supabase
        .from('ai_configs')
        .select('system_prompt, model, enabled')
        .eq('tenant_id', tenantId)
        .maybeSingle();

    if (cfg && cfg.enabled === false) return null;

    const model = cfg?.model || process.env.OPENAI_MODEL || 'gpt-4.1-mini';
    const systemPrompt = cfg?.system_prompt || 'You are a helpful assistant responding to customer inquiries.';

    const response = await openai.chat.completions.create({
        model,
        messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: String(inboundText || '') }
        ],
        temperature: 0.4
    });

    const text = response?.choices?.[0]?.message?.content?.trim();
    if (!text) return null;
    return { text, conversationId };
}

module.exports = {
    matchRule,
    handleMenuFlow,
    generateReply
};
