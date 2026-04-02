const supabase = require('../config/supabase');
const logger = require('../utils/appLogger');
const { sendMetaTextMessage, sendWhatsAppTextMessage } = require('./metaChannelService');

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4.1-mini';
const OPENAI_API_URL = 'https://api.openai.com/v1/responses';
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

async function getTenantIndustry(tenantId) {
    const { data, error } = await supabase
        .from('tenants')
        .select('industry,business_name')
        .eq('id', tenantId)
        .maybeSingle();

    if (error) {
        if (error.code === 'PGRST205') return { industry: '', business_name: '' };
        throw error;
    }

    return {
        industry: String(data?.industry || '').trim(),
        business_name: String(data?.business_name || '').trim()
    };
}

function normalizeProfessionKey(value) {
    const text = String(value || '').trim().toLowerCase();
    if (!text) return 'default';
    if (text.includes('hotel') || text.includes('resort') || text.includes('lodge')) return 'hotel';
    if (text.includes('restaurant') || text.includes('cafe') || text.includes('food') || text.includes('bakery')) return 'restaurant';
    return 'default';
}

function looksLikeTableBookingRequest(text) {
    const t = normalizeText(text);
    if (!t) return false;
    return (
        t.includes('book') ||
        t.includes('booking') ||
        t.includes('reserve') ||
        t.includes('reservation') ||
        t.includes('table') ||
        t.includes('dinner') ||
        t.includes('lunch') ||
        t.includes('breakfast')
    );
}

function buildHotelTableBookingReply({ businessName }) {
    const nameLine = businessName ? `Thank you for contacting ${businessName}.` : 'Thank you for reaching out.';
    return [
        `${nameLine} We’d be happy to help with your table booking.`,
        '',
        'To confirm your reservation, please share:',
        '1) Table number',
        '2) Date',
        '3) Time',
        '4) Number of guests',
        '5) Your name',
        '',
        'Once we have these details, we’ll confirm availability right away.'
    ].join('\n');
}

function parseFirstInt(value) {
    const match = String(value || '').match(/(\d{1,6})/);
    return match ? Number(match[1]) : null;
}

function parseTableNumber(text) {
    const match = String(text || '').match(/table\s*(?:no\.?|number|#)?\s*[:\-]?\s*(\d{1,4})/i);
    if (match) return Number(match[1]);
    return null;
}

function parseGuests(text) {
    const match = String(text || '').match(/(?:guest|guests|people|persons|pax)\s*[:\-]?\s*(\d{1,3})/i);
    if (match) return Number(match[1]);
    return null;
}

function parseDateIso(text) {
    const t = String(text || '');
    const iso = t.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/);
    if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

    const dmy = t.match(/\b(\d{1,2})[\/\-](\d{1,2})[\/\-](20\d{2}|\d{2})\b/);
    if (dmy) {
        const dd = String(dmy[1]).padStart(2, '0');
        const mm = String(dmy[2]).padStart(2, '0');
        const yy = dmy[3].length === 2 ? `20${dmy[3]}` : dmy[3];
        return `${yy}-${mm}-${dd}`;
    }

    return null;
}

function parseTimeText(text) {
    const t = String(text || '');
    const match = t.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i);
    if (!match) return null;
    const hh = String(match[1]).padStart(2, '0');
    const mm = String(match[2] || '00').padStart(2, '0');
    const ampm = match[3] ? match[3].toUpperCase() : '';
    return `${hh}:${mm}${ampm ? ` ${ampm}` : ''}`.trim();
}

async function getLastConversationState({ tenantId, channel, senderId }) {
    if (!tenantId || !channel || !senderId) return null;

    const { data, error } = await supabase
        .from('conversations')
        .select('state,direction,created_at')
        .eq('tenant_id', tenantId)
        .eq('channel', channel)
        .eq('sender_id', senderId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (error) {
        if (error.code === 'PGRST205') return null;
        throw error;
    }

    return data?.state || null;
}

async function createTableBookingAppointment({ tenantId, customerId, dateIso, timeText, notes }) {
    const { data, error } = await supabase
        .from('appointments')
        .insert({
            tenant_id: tenantId,
            customer_id: customerId || null,
            service_id: null,
            appointment_date: dateIso || null,
            appointment_time: timeText || null,
            status: 'scheduled',
            booking_source: 'whatsapp',
            notes: notes || null
        })
        .select('id,appointment_date,appointment_time,status,notes,created_at')
        .single();

    if (error) {
        if (error.code === 'PGRST205') return null;
        throw error;
    }

    return data || null;
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

async function getKnowledgeBaseContext(tenantId) {
    const { data, error } = await supabase
        .from('knowledge_base')
        .select('question,answer')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: true });

    if (error) {
        if (error.code === 'PGRST205') return [];
        throw error;
    }

    return (data || [])
        .map((entry) => ({
            question: String(entry.question || '').trim(),
            answer: String(entry.answer || '').trim()
        }))
        .filter((entry) => entry.question && entry.answer);
}

async function getServicesContext(tenantId) {
    const { data, error } = await supabase
        .from('services')
        .select('service_name,description,price,discount')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(20);

    if (error) {
        if (error.code === 'PGRST205') return [];
        throw error;
    }

    return data || [];
}

async function getOffersContext(tenantId) {
    const { data, error } = await supabase
        .from('offers')
        .select('title,description,discount,valid_until,is_active')
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(10);

    if (error) {
        if (error.code === 'PGRST205') return [];
        throw error;
    }

    return data || [];
}

async function getProductsContext(tenantId) {
    const { data, error } = await supabase
        .from('products')
        .select('product_name,category,description,price,stock_quantity,is_active')
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(20);

    if (error) {
        if (error.code === 'PGRST205') return [];
        throw error;
    }

    return data || [];
}

async function getAppointmentsContext(tenantId) {
    const today = new Date().toISOString().slice(0, 10);
    const { data, error } = await supabase
        .from('appointments')
        .select('appointment_date,appointment_time,status,notes,service_id')
        .eq('tenant_id', tenantId)
        .gte('appointment_date', today)
        .order('appointment_date', { ascending: true })
        .order('appointment_time', { ascending: true })
        .limit(10);

    if (error) {
        if (error.code === 'PGRST205') return [];
        throw error;
    }

    return data || [];
}

async function getRecentConversationContext(tenantId, senderId) {
    if (!senderId) return [];

    const { data, error } = await supabase
        .from('conversations')
        .select('message,direction,created_at')
        .eq('tenant_id', tenantId)
        .eq('sender_id', senderId)
        .order('created_at', { ascending: false })
        .limit(8);

    if (error) {
        if (error.code === 'PGRST205') return [];
        throw error;
    }

    return (data || []).reverse();
}

function formatListBlock(title, rows, formatter) {
    if (!rows.length) return `${title}: none`;
    return `${title}:\n${rows.map((row, index) => `${index + 1}. ${formatter(row)}`).join('\n')}`;
}

function extractOutputText(payload) {
    if (typeof payload?.output_text === 'string' && payload.output_text.trim()) {
        return payload.output_text.trim();
    }

    const textParts = [];
    for (const item of payload?.output || []) {
        for (const content of item?.content || []) {
            if (content?.type === 'output_text' && content?.text) {
                textParts.push(content.text);
            }
        }
    }

    return textParts.join('\n').trim();
}

async function generateAiReply(tenantId, incomingText, senderId) {
    const text = String(incomingText || '').trim();
    if (!text) return null;

    if (!OPENAI_API_KEY) return null;

    const [knowledge, services, offers, products, appointments, recentConversation] = await Promise.all([
        getKnowledgeBaseContext(tenantId),
        getServicesContext(tenantId),
        getOffersContext(tenantId),
        getProductsContext(tenantId),
        getAppointmentsContext(tenantId),
        getRecentConversationContext(tenantId, senderId)
    ]);

    if (!knowledge.length && !services.length && !offers.length && !products.length && !appointments.length) {
        return null;
    }

    const knowledgeBlock = knowledge
        .map((entry) => `Q: ${entry.question}\nA: ${entry.answer}`)
        .join('\n\n');

    const servicesBlock = formatListBlock('Services', services, (entry) => {
        const price = entry.price !== null && entry.price !== undefined ? `price ${entry.price}` : 'price on request';
        const discount = entry.discount ? `, discount ${entry.discount}%` : '';
        const description = entry.description ? `, ${entry.description}` : '';
        return `${entry.service_name || 'Service'} (${price}${discount})${description}`;
    });

    const offersBlock = formatListBlock('Active offers', offers, (entry) => {
        const discount = entry.discount ? `${entry.discount}% off` : 'offer available';
        const validity = entry.valid_until ? ` valid until ${entry.valid_until}` : '';
        const description = entry.description ? `, ${entry.description}` : '';
        return `${entry.title || 'Offer'} (${discount}${validity})${description}`;
    });

    const productsBlock = formatListBlock('Products', products, (entry) => {
        const category = entry.category ? `${entry.category}, ` : '';
        const price = entry.price !== null && entry.price !== undefined ? `price ${entry.price}` : 'price on request';
        const stock = entry.stock_quantity !== null && entry.stock_quantity !== undefined ? `, stock ${entry.stock_quantity}` : '';
        const description = entry.description ? `, ${entry.description}` : '';
        return `${entry.product_name || 'Product'} (${category}${price}${stock})${description}`;
    });

    const appointmentsBlock = formatListBlock('Upcoming appointments', appointments, (entry) => {
        const time = entry.appointment_time ? ` at ${entry.appointment_time}` : '';
        const notes = entry.notes ? `, notes: ${entry.notes}` : '';
        return `${entry.appointment_date || 'Date TBD'}${time}, status ${entry.status || 'scheduled'}${notes}`;
    });

    const conversationBlock = recentConversation.length
        ? `Recent conversation:\n${recentConversation.map((entry) => `${entry.direction || 'message'}: ${entry.message || ''}`).join('\n')}`
        : 'Recent conversation: none';

    const response = await fetch(OPENAI_API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${OPENAI_API_KEY}`
        },
        body: JSON.stringify({
            model: OPENAI_MODEL,
            input: [
                {
                    role: 'system',
                    content: [
                        {
                            type: 'input_text',
                            text: [
                                'You are an auto-reply assistant for a small business.',
                                'Answer using only the business context provided below.',
                                'Prefer exact details from the knowledge base, services, offers, products, appointments, and recent conversation.',
                                'If the context does not contain the answer, say you will share the request with the team and ask one short follow-up question.',
                                'Keep the reply concise, practical, and customer-friendly.',
                                '',
                                'Business knowledge:',
                                knowledgeBlock || 'Knowledge base: none',
                                '',
                                servicesBlock,
                                '',
                                offersBlock,
                                '',
                                productsBlock,
                                '',
                                appointmentsBlock,
                                '',
                                conversationBlock
                            ].join('\n')
                        }
                    ]
                },
                {
                    role: 'user',
                    content: [
                        {
                            type: 'input_text',
                            text
                        }
                    ]
                }
            ]
        })
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
        const message = payload?.error?.message || `OpenAI request failed (${response.status})`;
        throw new Error(message);
    }

    return extractOutputText(payload) || null;
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

    let replyText = null;
    const tenant = await getTenantIndustry(tenantId);
    const professionKey = normalizeProfessionKey(tenant.industry);

    let conversationState = null;
    const lastState = await getLastConversationState({ tenantId, channel, senderId });

    if (professionKey === 'hotel' && lastState === 'awaiting_table_booking_details') {
        const tableNumber = parseTableNumber(incomingMessage) ?? parseFirstInt(incomingMessage);
        const dateIso = parseDateIso(incomingMessage);
        const timeText = parseTimeText(incomingMessage);
        const guests = parseGuests(incomingMessage);

        if (!tableNumber) {
            replyText = 'Sure — please share the *table number* to proceed with the reservation.';
            conversationState = 'awaiting_table_booking_details';
        } else if (!dateIso || !timeText || !guests) {
            const missing = [];
            if (!dateIso) missing.push('date');
            if (!timeText) missing.push('time');
            if (!guests) missing.push('number of guests');
            replyText = [
                `Thank you. Table number noted: ${tableNumber}.`,
                `Please share the ${missing.join(', ')} to confirm your booking.`,
                '',
                'Example: 2026-04-01, 8:30 PM, 4 guests'
            ].join('\n');
            conversationState = 'awaiting_table_booking_details';
        } else {
            const notes = [
                `Table: ${tableNumber}`,
                `Guests: ${guests}`,
                `Customer message: ${String(incomingMessage || '').trim().slice(0, 800)}`
            ].join(' | ');

            await createTableBookingAppointment({
                tenantId,
                customerId,
                dateIso,
                timeText,
                notes
            });

            replyText = [
                'Thank you — your table booking request has been created.',
                `Table: ${tableNumber}`,
                `Date: ${dateIso}`,
                `Time: ${timeText}`,
                `Guests: ${guests}`,
                '',
                'We will confirm availability shortly.'
            ].join('\n');
            conversationState = 'table_booking_created';
        }
    } else if (professionKey === 'hotel' && looksLikeTableBookingRequest(incomingMessage)) {
        replyText = buildHotelTableBookingReply({ businessName: tenant.business_name });
        conversationState = 'awaiting_table_booking_details';
    } else {
        replyText = settings.ai_enabled ? await generateAiReply(tenantId, incomingMessage, senderId) : null;
        conversationState = null;
    }
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
            conversation_state: conversationState,
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
async function dispatchReply(job) {
    const channel = String(job?.channel || '').toLowerCase();

    if (channel === 'facebook' || channel === 'instagram') {
        return sendMetaTextMessage({
            tenantId: job.tenant_id,
            channel,
            recipientId: job.sender_id,
            text: job.reply_text
        });
    }

    if (channel === 'whatsapp') {
        return sendWhatsAppTextMessage({
            tenantId: job.tenant_id,
            recipientId: job.sender_id,
            text: job.reply_text
        });
    }

    throw new Error(`Auto-reply dispatch is not implemented for channel: ${channel || 'unknown'}`);
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
                state: job.conversation_state || 'auto_reply',
                message_id: result.external_id || null
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
