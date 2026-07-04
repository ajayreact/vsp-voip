---
title: "Noise Suppression"
source_url: "https://developers.telnyx.com/docs/voice/sip-trunking/features/noise-suppression.md"
category: "sip"
synced_at: "2026-06-25T18:31:33.466Z"
content_hash: "39677cf06f7d672f66ee7e490d34dd02b091b76d53ea10e234d36466908314ad"
---
> ## Documentation Index
> Fetch the complete documentation index at: https://developers.telnyx.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Noise suppression for SIP Trunking

> Enable AI noise suppression on Telnyx SIP Trunking calls. Remove background noise from inbound or outbound audio for clearer phone conversations.

Noise suppression enhances call quality by removing background noise from audio streams. Configure this feature at the connection level or individual phone number level to reduce unwanted ambient sounds during calls.

## Configuration scope

Noise suppression can be configured at two levels:

* **Connection level**: Applied to all phone numbers associated with the SIP connection. This setting overrides individual number configurations.
* **Number level**: Applied to specific phone numbers for granular control.

<Callout type="info">
  Connection-level settings take precedence over number-level configurations, simplifying management and ensuring consistent audio quality across all calls.
</Callout>

## Configuration via API

### Configure at connection level

[PATCH /v2/ip\_connections/{id}](/api-reference/ip-connections/update-an-ip-connection) with the `noise_suppression` object:

```json theme={null}
{
  "noise_suppression": {
    "direction": "both",
    "noise_suppression_engine": "Denoiser"
  }
}
```

### Configure at number level

[PATCH /v2/phone\_numbers/{id}/voice](/api-reference/phone-number-configurations/update-a-phone-number-with-voice-settings) with the `noise_suppression` object:

```json theme={null}
{
  "noise_suppression": {
    "direction": "inbound",
    "noise_suppression_engine": "Krisp Viva Tel Lite"
  }
}
```

## Supported engines

Use the `noise_suppression_engine` parameter to select an engine. If omitted, `Denoiser` is used.

| Engine                  | Value                 | Description                                      | Best for                                 |
| ----------------------- | --------------------- | ------------------------------------------------ | ---------------------------------------- |
| **Denoiser**            | `Denoiser`            | Built-in, general-purpose noise reduction        | Default option for most calls            |
| **DeepFilterNet**       | `DeepFilterNet`       | Open-source, full-band 48 kHz processing         | Telephony and WebRTC                     |
| **Krisp Viva Tel Lite** | `Krisp Viva Tel Lite` | Telephony up to 16 kHz, isolates primary speaker | Telephony with speaker isolation         |
| **Krisp Viva Pro**      | `Krisp Viva Pro`      | WebRTC 16–32 kHz, full voice isolation           | Close-microphone WebRTC calls            |
| **Krisp Viva SS**       | `Krisp Viva SS`       | WebRTC 16–32 kHz, far-field optimized            | Smart speakers and far-field microphones |
| **AI-coustics Quail**   | `AI-coustics Quail`   | STT-optimized, up to 43% WER reduction           | AI and speech recognition workloads      |

For SIP trunking, **Denoiser** and **Krisp Viva Tel Lite** are the most common choices. Use `Krisp Viva Tel Lite` when you need to isolate the primary speaker from background voices.

## Direction options

The `direction` parameter controls which audio streams are processed:

| Value      | Description                                  | Use case                                                       |
| ---------- | -------------------------------------------- | -------------------------------------------------------------- |
| `inbound`  | Processes audio from the PSTN to your system | Clean up audio received by your users or applications          |
| `outbound` | Processes audio from your system to the PSTN | Reduce background noise from your users or applications        |
| `both`     | Processes audio in both directions           | Maximum call clarity when both sides may have background noise |
| `disabled` | Turns off noise suppression                  | Preserve natural ambient sounds when needed                    |

## Codec compatibility

Noise suppression works with standard SIP trunking codecs including:

* G.711 (μ-law and A-law)
* G.722
* Opus

## Performance considerations

* Each direction (inbound/outbound) is processed and billed independently
* Processing adds minimal latency (typically \< 20ms)
* Noise suppression is applied in real-time during the call
* Connection-level configuration provides consistent behavior across all numbers

## Best practices

1. **Use connection-level configuration** for consistent audio quality across all phone numbers
2. **Enable bidirectional suppression** (`both`) for optimal results in noisy environments
3. **Test with your specific use case** to balance noise reduction with audio naturalness
4. **Monitor call quality metrics** to validate the impact on your application
