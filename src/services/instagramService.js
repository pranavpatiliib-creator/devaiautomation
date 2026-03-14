const axios = require('axios');
const metaConfig = require('../config/meta');

/**
 * Send a message via Instagram DM
 * @param {string} instagramBusinessId - The IG account ID of the business
 * @param {string} recipientId - The customer's IG scoped ID
 * @param {string} messageText - The text to send
 * @param {string} pageAccessToken - Access token for the business
 */
const sendMessage = async (instagramBusinessId, recipientId, messageText, pageAccessToken) => {
  try {
    const url = `${metaConfig.facebookGraphUrl}/${instagramBusinessId}/messages`;
    const payload = {
      recipient: { id: recipientId },
      message: { text: messageText }
    };

    const response = await axios.post(url, payload, {
      headers: {
        'Authorization': `Bearer ${pageAccessToken}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('[INBOX] Reply sent via Instagram DM');
    return response.data;
  } catch (error) {
    console.error('[IG_SERVICE] Error sending message:', error.response?.data || error.message);
    throw error;
  }
};

module.exports = {
  sendMessage
};
