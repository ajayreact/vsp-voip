import Flutter
import UIKit
import PushKit
import CallKit
import AVFAudio
import WebRTC
import flutter_callkit_incoming

@main
@objc class AppDelegate: FlutterAppDelegate, PKPushRegistryDelegate, CallkitIncomingAppDelegate {
  override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
  ) -> Bool {
    GeneratedPluginRegistrant.register(with: self)

    // Telnyx + WebRTC + CallKit: manual audio session (prevents no-audio on iOS).
    RTCAudioSession.sharedInstance().useManualAudio = true
    RTCAudioSession.sharedInstance().isAudioEnabled = false

    if #available(iOS 10.0, *) {
      UNUserNotificationCenter.current().delegate = self as UNUserNotificationCenterDelegate
    }

    let mainQueue = DispatchQueue.main
    let voipRegistry = PKPushRegistry(queue: mainQueue)
    voipRegistry.delegate = self
    voipRegistry.desiredPushTypes = [PKPushType.voIP]

    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }

  // MARK: - PushKit

  func pushRegistry(_ registry: PKPushRegistry, didUpdate credentials: PKPushCredentials, for type: PKPushType) {
    let deviceToken = credentials.token.map { String(format: "%02x", $0) }.joined()
    SwiftFlutterCallkitIncomingPlugin.sharedInstance?.setDevicePushTokenVoIP(deviceToken)
  }

  func pushRegistry(_ registry: PKPushRegistry, didInvalidatePushTokenFor type: PKPushType) {
    SwiftFlutterCallkitIncomingPlugin.sharedInstance?.setDevicePushTokenVoIP("")
  }

  func pushRegistry(
    _ registry: PKPushRegistry,
    didReceiveIncomingPushWith payload: PKPushPayload,
    for type: PKPushType,
    completion: @escaping () -> Void
  ) {
    guard type == .voIP else {
      completion()
      return
    }

    var metadata = payload.dictionaryPayload
    if let nested = metadata["metadata"] as? String,
       let data = nested.data(using: .utf8),
       let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
      metadata = json
    } else if let nested = metadata["metadata"] as? [String: Any] {
      metadata = nested
    }

    let callId = (metadata["call_id"] as? String) ?? UUID().uuidString
    let callerName = (metadata["caller_name"] as? String) ?? ""
    let callerNumber = (metadata["caller_number"] as? String) ?? "Unknown"
    let displayName = callerName.isEmpty ? callerNumber : callerName

    var info = [String: Any?]()
    info["id"] = callId
    info["nameCaller"] = displayName
    info["handle"] = callerNumber
    info["type"] = 0
    info["extra"] = payload.dictionaryPayload
    info["duration"] = 45000

    // Telnyx: call completion after CallKit is shown to avoid iOS terminating the app.
    SwiftFlutterCallkitIncomingPlugin.sharedInstance?.showCallkitIncoming(
      flutter_callkit_incoming.Data(args: info),
      fromPushKit: true,
      completion: completion
    )
  }

  // MARK: - CallkitIncomingAppDelegate

  func onAccept(_ call: Call, _ action: CXAnswerCallAction) {
    action.fulfill()
  }

  func onDecline(_ call: Call, _ action: CXEndCallAction) {
    action.fulfill()
  }

  func onEnd(_ call: Call, _ action: CXEndCallAction) {
    action.fulfill()
  }

  func onTimeOut(_ call: Call) {
    // Dart softphone controller handles timeout via FlutterCallkitIncoming.onEvent.
  }

  func didActivateAudioSession(_ audioSession: AVAudioSession) {
    RTCAudioSession.sharedInstance().audioSessionDidActivate(audioSession)
    RTCAudioSession.sharedInstance().isAudioEnabled = true
  }

  func didDeactivateAudioSession(_ audioSession: AVAudioSession) {
    RTCAudioSession.sharedInstance().audioSessionDidDeactivate(audioSession)
    RTCAudioSession.sharedInstance().isAudioEnabled = false
  }
}
