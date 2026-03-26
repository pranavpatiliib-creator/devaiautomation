const { createClient } = require('@supabase/supabase-js');
const messageDispatchService = require('./messageDispatchService');
const { broadcast } = require('./realtime/inboxEvents');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

// List conversations for a tenant with optional status filter + pagination
async function listConversations(tenantId, { page = 1, limit = 20, status } = {}) {
  const offset = (page - 1) * limit;
  let query = supabase
    .from('conversations')
    .select(`
      id, status, channel, contact_name, contact_id,
      last_message_text, last_message_at, unread_count,
      assigned_agent_id, created_at
    `)
    .eq('tenant_id', tenantId)
    .order('last_message_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (status) query = query.eq('status', status);

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

// List messages for a conversation (cursor-based pagination via `before`)
async function listMessages(tenantId, conversationId, { before, limit = 30 } = {}) {
  // Verify conversation belongs to tenant
  const { data: conv, error: convErr } = await supabase
    .from('conversations')
    .select('id')
    .eq('id', conversationId)
    .eq('tenant_id', tenantId)
    .single();
  if (convErr || !conv) throw new Error('Conversation not found');

  let query = supabase
    .from('messages')
    .select('id, direction, text, channel, status, created_at, agent_id, meta')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (before) query = query.lt('created_at', before);

  const { data, error } = await query;
  if (error) throw error;

  // Mark conversation as read
  await supabase
    .from('conversations')
    .update({ unread_count: 0 })
    .eq('id', conversationId)
    .eq('tenant_id', tenantId);

  return data.reverse(); // Return oldest-first for chat UI
}

// Send a reply from agent
async function sendReply(tenantId, conversationId, { text, agentId }) {
  // Get conversation details for dispatch
  const { data: conv, error: convErr } = await supabase
    .from('conversations')
    .select('*')
    .eq('id', conversationId)
    .eq('tenant_id', tenantId)
    .single();
  if (convErr || !conv) throw new Error('Conversation not found');

  // Dispatch message via channel (Meta, Twilio, etc.)
  await messageDispatchService.dispatch({
    tenantId,
    channel: conv.channel,
    contactId: conv.contact_id,
    text,
  });

  // Persist outbound message
  const { data: message, error: msgErr } = await supabase
    .from('messages')
    .insert({
      conversation_id: conversationId,
      tenant_id: tenantId,
      direction: 'outbound',
      text,
      channel: conv.channel,
      status: 'sent',
      agent_id: agentId,
    })
    .select()
    .single();
  if (msgErr) throw msgErr;

  // Update conversation last message
  await supabase
    .from('conversations')
    .update({ last_message_text: text, last_message_at: message.created_at })
    .eq('id', conversationId);

  // Broadcast to WebSocket clients
  broadcast(tenantId, { type: 'new_message', conversationId, message });

  return message;
}

// Inbound message handler — called from webhook
async function handleInbound({ tenantId, channel, contactId, contactName, text, externalMessageId }) {
  // Upsert conversation
  let { data: conv } = await supabase
    .from('conversations')
    .select('id, unread_count')
    .eq('tenant_id', tenantId)
    .eq('contact_id', contactId)
    .eq('channel', channel)
    .maybeSingle();

  if (!conv) {
    const { data: newConv, error } = await supabase
      .from('conversations')
      .insert({ tenant_id: tenantId, channel, contact_id: contactId, contact_name: contactName, status: 'open', unread_count: 1, last_message_text: text, last_message_at: new Date().toISOString() })
      .select()
      .single();
    if (error) throw error;
    conv = newConv;
  } else {
    await supabase
      .from('conversations')
      .update({ unread_count: (conv.unread_count || 0) + 1, last_message_text: text, last_message_at: new Date().toISOString(), status: 'open' })
      .eq('id', conv.id);
  }

  // Persist inbound message
  const { data: message, error: msgErr } = await supabase
    .from('messages')
    .insert({
      conversation_id: conv.id,
      tenant_id: tenantId,
      direction: 'inbound',
      text,
      channel,
      status: 'received',
      meta: { external_id: externalMessageId },
    })
    .select()
    .single();
  if (msgErr) throw msgErr;

  // Broadcast to WebSocket clients
  broadcast(tenantId, { type: 'new_message', conversationId: conv.id, message });
  broadcast(tenantId, { type: 'conversation_updated', conversationId: conv.id });

  return { conversation: conv, message };
}

async function updateConversationStatus(tenantId, conversationId, status) {
  const { data, error } = await supabase
    .from('conversations')
    .update({ status })
    .eq('id', conversationId)
    .eq('tenant_id', tenantId)
    .select()
    .single();
  if (error) throw error;
  broadcast(tenantId, { type: 'conversation_updated', conversationId, status });
  return data;
}

async function assignConversation(tenantId, conversationId, agentId) {
  const { data, error } = await supabase
    .from('conversations')
    .update({ assigned_agent_id: agentId })
    .eq('id', conversationId)
    .eq('tenant_id', tenantId)
    .select()
    .single();
  if (error) throw error;
  broadcast(tenantId, { type: 'conversation_updated', conversationId, assignedAgentId: agentId });
  return data;
}

module.exports = { listConversations, listMessages, sendReply, handleInbound, updateConversationStatus, assignConversation };
