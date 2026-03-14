require('dotenv').config();

module.exports = {
  appId: process.env.META_APP_ID,
  appSecret: process.env.META_APP_SECRET,
  verifyToken: process.env.META_VERIFY_TOKEN,
  whatsappPhoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
  facebookGraphUrl: 'https://graph.facebook.com/v21.0',
  oauthRedirectUri: process.env.META_OAUTH_REDIRECT_URI || 'http://localhost:5000/api/inbox/auth/meta/callback'
};
