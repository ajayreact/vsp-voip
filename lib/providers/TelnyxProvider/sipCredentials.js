/**
 * TelnyxProvider/sipCredentials — thin re-export wrapper.
 *
 * No new logic: every function here delegates directly to the existing,
 * already-production Telnyx modules. This file exists only to give the
 * ProviderInterface a single, discoverable import path per provider.
 */

const softphone = require('../../softphone');
const telnyxCallControl = require('../../telnyxCallControl');
const telnyxSipProfile = require('../../telnyxSipProfile');
const { buildTelnyxSipBlock } = require('../../employeeProvisioningProfile');

module.exports = {
  getOrCreateUserTelephonyCredential: softphone.getOrCreateUserTelephonyCredential,
  resetUserTelephonyCredential: softphone.resetUserTelephonyCredential,
  createSoftphoneLoginToken: softphone.createSoftphoneLoginToken,
  setSoftphonePresence: softphone.setSoftphonePresence,
  getTelephonyCredential: telnyxCallControl.getTelephonyCredential,
  createTelephonyCredential: telnyxCallControl.createTelephonyCredential,
  createExtensionTelephonyCredential: telnyxCallControl.createExtensionTelephonyCredential,
  deleteTelephonyCredential: telnyxCallControl.deleteTelephonyCredential,
  createTelephonyCredentialToken: telnyxCallControl.createTelephonyCredentialToken,
  buildSipEndpointProfile: telnyxSipProfile.buildSipEndpointProfile,
  loadTelnyxConnectionContext: telnyxSipProfile.loadTelnyxConnectionContext,
  loadCredentialConnectionId: telnyxSipProfile.loadCredentialConnectionId,
  buildTelnyxSipBlock,
  DEFAULT_SIP_SERVER: telnyxSipProfile.DEFAULT_SIP_SERVER,
  DEFAULT_SIP_PORT: telnyxSipProfile.DEFAULT_SIP_PORT,
  DEFAULT_SIP_PORT_TLS: telnyxSipProfile.DEFAULT_SIP_PORT_TLS,
};
