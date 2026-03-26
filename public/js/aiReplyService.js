const OpenAI = require('openai');
const { createClient } = require('@supabase/supabase-js');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

// ─── Rule-based matching (runs before AI to save cost) ───────────────────────
const DEFAULT_RULES = [
  { pattern: /\b(price|cost|pricing|how much)\b/i, reply: "Thanks for your interest! Our team will share pricing details shortly." },
  { pattern: /\b(hours|open|timing|schedule)\b/i, reply: "We're open Mon–Sat 9am–6pm. Feel free to reach out anytime!" },
  { pattern: /\b(location|address|where are you)\b/i, reply: "Please check our website for our latest location details." },
  { pattern: /\b(thank|thanks|thank you)\b/i, reply: "You're welcome! Let us know if there's anything else we can help with." },
  { pattern: /\b(hi|hello|hey|good morning|good evening)\b/i, reply: "Hi there! 👋 How can we help you today?" },
];

// ─── Check rule-based matches first ──────────────────────────────────────────
function matchRule(text, customRules = []) {
  const rules = [...customRules, ...DEFAULT_RULES];
  for (const rule of rules) {
    const pattern = rule.pattern instanceof RegExp ? rule.pattern : new RegExp(rule.pattern, 'i');
    if (pattern.test(text)) return rule.reply;
  }
  return null;
}

// ─── Load tenant AI config + custom rules ────────────────────────────────────
async function getTenantAIConfig(tenantId) {
  const { data } = await supabase
    .from('ai_configs')
    .select('*')
    .eq('tenant_id', tenantId)
    .maybeSingle();
  return data || {};
}

// ─── Load recent conversation history for context ────────────────────────────
async function getRecentHistory(conversationId, limit = 10) {
  const { data } = await supabase
    .from('messages')
    .select('direction, text')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(limit);
  return (data || []).reverse();
}

// ─── Build system prompt from tenant config ───────────────────────────────────
function buildSystemPrompt(config) {
  const businessName = config.business_name || 'our business';
  const tone = config.tone || 'friendly and professional';
  const customInstructions = config.custom_instructions || '';

  return `You are a helpful customer support assistant for ${businessName}. 
Your tone should be ${tone}.
Keep replies concise (under 3 sentences when possible).
Do not make up specific prices, dates, or policies you don't know.
If you cannot answer something, politely ask the customer to wait for a human agent.
${customInstructions}`.trim();
}

// ─── Main: generate AI reply ─────────────────────────────────────────────────
async function generateReply({ tenantId, conversationId, inboundText }) {
  // 1. Load tenant config
  const config = await getTenantAIConfig(tenantId);

  // 2. Try rule-based match first (fast + free)
  const customRules = config.rules || [];
  const ruleMatch = matchRule(inboundText, customRules);
  if (ruleMatch) {
    return { text: ruleMatch, source: 'rule' };
  }

  // 3. Skip AI if disabled for tenant
  if (config.ai_enabled === false) {
    return null; // No auto-reply — human agent required
  }

  // 4. Load conversation history
  const history = await getRecentHistory(conversationId);
  const messages = history.map((m) => ({
    role: m.direction === 'inbound' ? 'user' : 'assistant',
    content: m.text,
  }));

  // Ensure current message is last
  if (!messages.length || messages[messages.length - 1].content !== inboundText) {
    messages.push({ role: 'user', content: inboundText });
  }

  // 5. Call OpenAI
  const completion = await openai.chat.completions.create({
    model: config.model || 'gpt-4o-mini',
    messages: [
      { role: 'system', content: buildSystemPrompt(config) },
      ...messages,
    ],
    max_tokens: 200,
    temperature: 0.7,
  });

  const text = completion.choices[0]?.message?.content?.trim();
  if (!text) return null;

  return { text, source: 'ai', model: completion.model };
}

// ─── Fallback menu flow ───────────────────────────────────────────────────────
// Returns a structured menu reply if the user sends a number/keyword
function handleMenuFlow(text, menuConfig) {
  if (!menuConfig || !menuConfig.options) return null;

  const input = text.trim().toLowerCase();
  for (const option of menuConfig.options) {
    const triggers = [String(option.number), option.keyword?.toLowerCase()].filter(Boolean);
    if (triggers.includes(input)) return option.reply;
  }

  // Show the menu if input doesn't match
  if (menuConfig.trigger_on_unrecognized) {
    const menuText = menuConfig.options
      .map((o) => `${o.number}. ${o.label}`)
      .join('\n');
    return `${menuConfig.header || 'How can we help?'}\n\n${menuText}`;
  }

  return null;
}

module.exports = { generateReply, matchRule, handleMenuFlow };
