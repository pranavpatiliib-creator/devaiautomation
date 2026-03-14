const supabase = require('../utils/supabaseClient');

class Conversation {
  /**
   * Find or Create a Conversation based on platform and customer ID
   */
  static async findOrCreate({ userId, platform, customerId, customerName }) {
    // Try to find the existing conversation
    let { data: conversation, error: findError } = await supabase
      .from('conversations')
      .select('*')
      .eq('user_id', userId)
      .eq('platform', platform)
      .eq('customer_id', customerId)
      .single();

    if (findError && findError.code !== 'PGRST116') {
      console.error('[INBOX] Error finding conversation:', findError);
      throw findError;
    }

    // If conversation doesn't exist, create it
    if (!conversation) {
      const { data: newConversation, error: createError } = await supabase
        .from('conversations')
        .insert([{
          user_id: userId,
          platform,
          customer_id: customerId,
          customer_name: customerName || 'Unknown User',
          updated_at: new Date()
        }])
        .select()
        .single();
        
      if (createError) {
        console.error('[INBOX] Error creating conversation:', createError);
        throw createError;
      }
      
      console.log('[INBOX] Conversation created:', newConversation.id);
      conversation = newConversation;
    }

    return conversation;
  }

  /**
   * Update the last message text and updated_at timestamp
   */
  static async updateLastMessage(conversationId, text) {
    const { data: updatedConversation, error } = await supabase
      .from('conversations')
      .update({
        last_message: text,
        updated_at: new Date()
      })
      .eq('id', conversationId)
      .select()
      .single();
      
    if (error) {
      console.error('[INBOX] Error updating conversation last message:', error);
      throw error;
    }
    
    return updatedConversation;
  }

  /**
   * Get all conversations sorted by last message time for a given user
   */
  static async getAllForUser(userId) {
    const { data, error } = await supabase
      .from('conversations')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false });
      
    if (error) {
      console.error('[INBOX] Error getting conversations:', error);
      throw error;
    }
    
    return data;
  }
}

module.exports = Conversation;
