function getTelnyxConnectionConfig(platform) {
  const connectionId = platform?.telnyxConnectionId
    || process.env.TELNYX_CONNECTION_ID?.trim()
    || null;
  const connectionName = platform?.telnyxConnectionName
    || process.env.TELNYX_CONNECTION_NAME?.trim()
    || 'VSP-VOIP Voice App';

  return { connectionId, connectionName };
}

function getCredentialConnectionId(platform) {
  return platform?.telnyxCredentialConnectionId
    || process.env.TELNYX_CREDENTIAL_CONNECTION_ID?.trim()
    || null;
}

module.exports = { getTelnyxConnectionConfig, getCredentialConnectionId };
