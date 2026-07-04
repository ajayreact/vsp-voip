---
title: "Noise Suppression"
source_url: "https://developers.telnyx.com/docs/voice/programmable-voice/noise-suppression.md"
category: "call-control"
synced_at: "2026-06-25T18:43:04.867Z"
content_hash: "965180f5328ac48c99b99dcf200ca53b14df119ce5d7649ca05ebe0c07553315"
---
> ## Documentation Index
> Fetch the complete documentation index at: https://developers.telnyx.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Noise Suppression

> Enable AI noise suppression on Telnyx Programmable Voice calls to remove background noise from inbound and outbound audio for clearer conversations.

In this tutorial, you'll learn how to enable noise suppression for the Voice API and TeXML calls.

Noise suppression works for both AI-powered calls (like AI Assistants and Gather Using AI) and regular voice calls. While it improves audio quality across all call types by reducing background noise, **the biggest value comes from enhanced AI performance**—cleaner audio leads to more accurate speech recognition and better AI responses. This makes noise suppression especially valuable for AI use cases where audio quality directly impacts user experience.

## Voice API

The noise suppression can be enabled for the Voice API calls in the following way:

<Callout type="info">
  *Don't forget to update `YOUR_API_KEY` here.*
</Callout>

The only parameter required for the request is `direction` which can have one of the following options: `inbound` | `outbound` | `both`.

Please be aware that the charge is applied for each direction separately.

```bash theme={null}
    curl --request POST \
    --url https://api.telnyx.com/v2/calls/${call_control_id}/actions/suppression_start \
    --header 'Accept: application/json' \
    --header 'Authorization: Bearer ***' \
    --header 'Content-Type: application/json' \
    --data '{
        "direction": "inbound"
    }'
```

The noise suppression can be stopped at any time in the following way:

```bash theme={null}
    curl --request POST \
    --url https://api.telnyx.com/v2/calls/${call_control_id}/actions/suppression_stop \
    --header 'Accept: application/json' \
    --header 'Authorization: Bearer ***' \
    --header 'Content-Type: application/json' \
    --data '{}'
```

## Supported engines

Telnyx offers four noise suppression engines, each optimized for different use cases:

| Engine            | Value           | Description                                                                                                                  | Best for                            |
| ----------------- | --------------- | ---------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| **Denoiser**      | `Denoiser`      | Built-in, general-purpose noise reduction                                                                                    | Default option for most calls       |
| **DeepFilterNet** | `DeepFilterNet` | Open-source, full-band 48 kHz processing                                                                                     | Telephony and WebRTC                |
| **Krisp**         | `Krisp`         | Telephony noise suppression with speaker isolation; supports multiple sub-models via `noise_suppression_engine_config.model` | Telephony with speaker isolation    |
| **AiCoustics**    | `AiCoustics`    | STT-optimized noise suppression                                                                                              | AI and speech recognition workloads |

### Choosing an engine

* For **standard telephony**, use `Denoiser` (default) or `Krisp` for speaker isolation.
* For **WebRTC calls**, use `DeepFilterNet` for full-band processing.
* For **AI-powered calls** (AI Assistants, Gather Using AI), consider `AiCoustics` for the best speech recognition accuracy.

Set the engine using the `noise_suppression_engine` parameter:

```bash theme={null}
    curl --request POST \
    --url https://api.telnyx.com/v2/calls/${call_control_id}/actions/suppression_start \
    --header 'Accept: application/json' \
    --header 'Authorization: Bearer ***' \
    --header 'Content-Type: application/json' \
    --data '{
        "direction": "inbound",
        "noise_suppression_engine": "AiCoustics"
    }'
```

## Engine configuration

Some engines support additional tuning via `noise_suppression_engine_config`. Parameters are engine-specific and ignored by other engines.

### Krisp models

The `Krisp` engine supports three sub-models optimized for different telephony scenarios. Select a model using `noise_suppression_engine_config.model`:

| Model value                | Best for                                       |
| -------------------------- | ---------------------------------------------- |
| `krisp-nlsv-f4t-v2.4ef`    | General telephony (default-quality model)      |
| `krisp-nlsv-f4t-12k-v1.ef` | Narrowband telephony (12 kHz)                  |
| `krisp-nlsv-b1-v1.4ef`     | Lightweight model for constrained environments |

You can also set the suppression intensity with `suppression_lev` (0–100):

```bash theme={null}
    curl --request POST \
    --url https://api.telnyx.com/v2/calls/${call_control_id}/actions/suppression_start \
    --header 'Accept: application/json' \
    --header 'Authorization: Bearer ***' \
    --header 'Content-Type: application/json' \
    --data '{
        "direction": "inbound",
        "noise_suppression_engine": "Krisp",
        "noise_suppression_engine_config": {
            "model": "krisp-nlsv-f4t-12k-v1.ef",
            "suppression_lev": 80
        }
    }'
```

### DeepFilterNet configuration

The `DeepFilterNet` engine supports two tuning parameters:

| Parameter         | Type                     | Default | Description                          |
| ----------------- | ------------------------ | ------- | ------------------------------------ |
| `attenuation_lim` | integer (0–100)          | `100`   | Maximum attenuation applied to noise |
| `mode`            | `standard` \| `advanced` | —       | Processing mode                      |

### AiCoustics configuration

The `AiCoustics` engine exposes enhancement and gain controls:

| Parameter         | Type   | Range | Description           |
| ----------------- | ------ | ----- | --------------------- |
| `enhancement_lev` | number | 0–1   | Enhancement intensity |
| `voice_gain`      | number | 0.1–4 | Voice gain multiplier |

## TeXML

In TeXML there is a dedicated verb for enabling the noise suppression on the call.

```xml theme={null}
<Response>
    <Start>
        <Suppression direction="inbound" noise_suppression_engine="Krisp"/>
    </Start>
...
    <Stop>
        <Suppression/>
    </Stop>
</Response>
```
