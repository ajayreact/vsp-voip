import 'package:vsp_voip_mobile/core/network/response_parser.dart';



class PhoneNumberOption {

  const PhoneNumberOption({required this.id, required this.number});



  final String id;

  final String number;



  factory PhoneNumberOption.fromJson(Map<String, dynamic> json) {

    return PhoneNumberOption(

      id: json['id'] as String,

      number: json['number'] as String,

    );

  }

}



class InboundRoutingStatus {

  const InboundRoutingStatus({

    required this.ringGroupEnabled,

    required this.inAppRingGroup,

    required this.ready,

    required this.pushTokenRegistered,

    this.pushPlatform,

    this.message,

  });



  final bool ringGroupEnabled;

  final bool inAppRingGroup;

  final bool ready;

  final bool pushTokenRegistered;

  final String? pushPlatform;

  final String? message;



  factory InboundRoutingStatus.fromJson(Map<String, dynamic> json) {

    return InboundRoutingStatus(

      ringGroupEnabled: json['ringGroupEnabled'] as bool? ?? false,

      inAppRingGroup: json['inAppRingGroup'] as bool? ?? false,

      ready: json['ready'] as bool? ?? false,

      pushTokenRegistered: json['pushTokenRegistered'] as bool? ?? false,

      pushPlatform: json['pushPlatform'] as String?,

      message: json['message'] as String?,

    );

  }

}



class SoftphoneConfig {

  const SoftphoneConfig({

    required this.configured,

    required this.numbers,

    required this.defaultCallerId,

    required this.callRecordingEnabled,

    required this.voiceWebhookUrl,

    this.setupMessage,

    this.webhooksReachable = false,

    this.inboundRouting,

  });



  final bool configured;

  final List<PhoneNumberOption> numbers;

  final String? defaultCallerId;

  final bool callRecordingEnabled;

  final String voiceWebhookUrl;

  final String? setupMessage;

  final bool webhooksReachable;

  final InboundRoutingStatus? inboundRouting;



  factory SoftphoneConfig.fromJson(Map<String, dynamic> json) {

    final setup = json['callControlSetup'];

    final inbound = json['inboundRouting'];

    return SoftphoneConfig(

      configured: json['configured'] as bool? ?? false,

      numbers: parseList(json['numbers'], PhoneNumberOption.fromJson),

      defaultCallerId: json['defaultCallerId'] as String?,

      callRecordingEnabled: json['callRecordingEnabled'] as bool? ?? true,

      voiceWebhookUrl: json['voiceWebhookUrl'] as String? ?? '',

      setupMessage: setup is Map ? setup['message'] as String? : null,

      webhooksReachable:

          setup is Map ? setup['webhooksReachable'] as bool? ?? false : false,

      inboundRouting: inbound is Map

          ? InboundRoutingStatus.fromJson(Map<String, dynamic>.from(inbound))

          : null,

    );

  }

}



class SoftphoneTokenResponse {

  const SoftphoneTokenResponse({

    required this.loginToken,

    required this.expiresInSeconds,

    this.sipUsername,

  });



  final String loginToken;

  final int expiresInSeconds;

  final String? sipUsername;



  factory SoftphoneTokenResponse.fromJson(Map<String, dynamic> json) {

    return SoftphoneTokenResponse(

      loginToken: json['loginToken'] as String,

      expiresInSeconds: json['expiresInSeconds'] as int? ?? 86400,

      sipUsername: json['sipUsername'] as String?,

    );

  }

}


