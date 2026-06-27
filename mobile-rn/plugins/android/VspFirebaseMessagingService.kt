package com.vspphone.mobile

import com.telnyx.react_voice_commons.TelnyxFirebaseMessagingService

/**
 * FCM entry point for Telnyx VoIP push (ConnectionService).
 * Do not register a JS background message handler — native layer owns call pushes.
 */
class VspFirebaseMessagingService : TelnyxFirebaseMessagingService() {
    override fun handleTokenRefresh(token: String) {
        super.handleTokenRefresh(token)
    }
}
