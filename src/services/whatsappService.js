const axios = require('axios');
const metaConfig = require('../config/meta');

/**
 * Send a message via WhatsApp Cloud API
 * @param {string} phoneNumberId - The specific WhatsApp phone number ID
 * @param {string} recipientId - The customer's WhatsApp phone number
 * @param {string} messageText - The text to send
 * @param {string} accessToken - Access token for the business or App Token
 */
const sendMessage = async (phoneNumberId, recipientId, messageText, accessToken) => {
  try {
    const fromPhoneNumberId = phoneNumberId || metaConfig.whatsappPhoneNumberId;
    const url = `${metaConfig.facebookGraphUrl}/${fromPhoneNumberId}/messages`;
    
    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: recipientId,
      type: 'text',
      text: { body: messageText }
    };

    const response = await axios.post(url, payload, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('[INBOX] Reply sent via WhatsApp Cloud API');
    return response.data;
  } catch (error) {
    console.error('[WA_SERVICE] Error sending message:', error.response?.data || error.message);
    throw error;
  }
};

module.exports = {
  sendMessage
};
