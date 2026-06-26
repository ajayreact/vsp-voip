function getMessagingProfileId(platform) {
  return platform?.telnyxMessagingProfileId
    || process.env.TELNYX_MESSAGING_PROFILE_ID?.trim()
    || null;
}

function getSmsWebhookUrl() {
  return `${process.env.API_PUBLIC_URL || `http://localhost:${process.env.PORT || 3000}`}/webhook/sms`;
}

function isSmsWebhookReachable() {
  const publicUrl = process.env.API_PUBLIC_URL?.trim();
  return Boolean(publicUrl && !/localhost|127\.0\.0\.1/i.test(publicUrl));
}

module.exports = {
  getMessagingProfileId,
  getSmsWebhookUrl,
  isSmsWebhookReachable,
};
