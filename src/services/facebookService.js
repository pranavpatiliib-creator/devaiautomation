const axios = require('axios');
const metaConfig = require('../config/meta');

/**
 * Send a message via Facebook Messenger
 * @param {string} recipientId - The customer's Facebook profile ID
 * @param {string} messageText - The message to send
 * @param {string} pageAccessToken - Formatted token for this specific business page
 */
const sendMessage = async (recipientId, messageText, pageAccessToken) => {
  try {
    const url = `${metaConfig.facebookGraphUrl}/me/messages`;
    const payload = {
      recipient: { id: recipientId },
      message: { text: messageText },
      messaging_type: 'RESPONSE'
    };

    const response = await axios.post(url, payload, {
      headers: {
        'Authorization': `Bearer ${pageAccessToken}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('[INBOX] Reply sent via FB Messenger');
    return response.data;
  } catch (error) {
    console.error('[FB_SERVICE] Error sending message:', error.response?.data || error.message);
    throw error;
  }
};

module.exports = {
  sendMessage
};
