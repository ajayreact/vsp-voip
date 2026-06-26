---
title: "Answering Machine Detection"
source_url: "https://developers.telnyx.com/docs/voice/programmable-voice/answering-machine-detection.md"
category: "call-control"
synced_at: "2026-06-25T18:43:03.207Z"
content_hash: "5489d5156ba024f81d5624120695d2c3301ec583db25cb512bf286e96b0f28ca"
---
> ## Documentation Index
> Fetch the complete documentation index at: https://developers.telnyx.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Answering Machine Detection

> Telnyx's Programmable Voice lets you build custom answering machine detection features into your voice applications.

Outbound calls placed with the Telnyx Voice API can be enabled with Answering Machine Detection (AMD, Voicemail Detection).

When a call is answered, Telnyx runs real-time detection to determine if it was picked up by a human or a machine and sends webhooks with the analysis result.

## AMD settings

The `answering_machine_detection` value when creating an outbound call or transferring an inbound call can be set to one of the following:

<table class="table">
  <tbody>
    <tr>
      <td>Setting</td>
      <td>Description</td>
      <td>Webhooks Sent</td>
    </tr>

    <tr>
      <td><code>detect</code></td>
      <td><em>Only</em> detect if answering machine or human.</td>
      <td><code>call.machine.detection.ended</code></td>
    </tr>

    <tr>
      <td><code>detect\_beep</code></td>
      <td>Listens for a <em>final</em> "beep" sound after detecting a <code>machine</code></td>
      <td><code>call.machine.detection.ended</code> and <code>call.machine.greeting.ended</code> <strong>only</strong> if a beep is detected</td>
    </tr>

    <tr>
      <td><code>detect\_words</code></td>
      <td>After a <code>machine</code> is detected, a 30 second long beep detection will begin. Note the answering machine may still be playing it's greeting while the 30 seconds is counting down.</td>
      <td><code>call.machine.detection.ended</code> and <code>call.machine.greeting.ended</code> when the beep is detected or at the end of 30 seconds.</td>
    </tr>

    <tr>
      <td><code>greeting\_end</code></td>
      <td>Listens for extended periods of silence or a beep in the greeting to determine if a greeting has ended.</td>
      <td><code>call.machine.detection.ended</code> and <code>call.machine.greeting.ended</code></td>
    </tr>

    <tr>
      <td><code>premium</code></td>
      <td><strong>RECOMMENDED</strong> Premium AMD uses advanced speech recognition technology and machine learning to achieve exceptional accuracy in determining whether a call has been connected to a live person or a machine.</td>
      <td><code>call.machine.premium.detection.ended</code> with one of <code>human\_residence</code> or <code>human\_business</code> or <code>machine</code> or <code>silence</code> or <code>fax\_detected</code> or <code>not\_sure</code>. If a beep is detected a <code>call.machine.premium.greeting.ended</code> webhook with <code>beep\_detected</code> is also sent. If a beep is detected before <code>call.machine.premium.detection.ended</code>, <code>call.machine.premium.greeting.ended</code> is sent. If a beep is detected after <code>call.machine.premium.detection.ended</code>, both webhooks will be sent.</td>
    </tr>

    <tr>
      <td><code>premium\_ios\_call\_screening\_detection</code></td>
      <td>Premium AMD with iOS Call Screening support. Use this when calls may be answered by Apple Call Screening and you need to detect the screening prompt before continuing AMD.</td>
      <td><code>call.machine.premium.detection.ended</code>, <code>call.machine.premium.greeting.ended</code> with <code>result=prompt\_ended</code> when the screening prompt ends without a beep, and <code>call.machine.premium.call\_screening.detected</code> with <code>result=screening</code> when an Apple Call Screening tone is detected.</td>
    </tr>
  </tbody>
</table>

### Sample dial request

```
POST https://api.telnyx.com/v2/calls HTTP/1.1
Content-Type: application/json; charset=utf-8
Authorization: Bearer YOUR_API_KEY

{
  "connection_id" : "1494404757140276705",
  "to"            : "+19198675309",
  "from"          : "+19842550944",
  "webhook_url"   : "https://webhook_url.com/outbound_call_events",
  "answering_machine_detection" : "detect_words"
}
```

<Callout type="info">
  After pasting the above content, Kindly check and remove any new line added
</Callout>

### iOS Call Screening Detection

Set `answering_machine_detection` to `premium_ios_call_screening_detection` to run Premium AMD with support for Apple Call Screening. In this mode, Telnyx uses Premium AMD first. If the initial Premium AMD result is `machine`, Telnyx listens for the iOS call-screening prompt to complete or for an Apple Call Screening tone.

When an Apple Call Screening tone is detected, Telnyx sends `call.machine.premium.call_screening.detected` with `result=screening` and then restarts Premium AMD on the screened call. If the screening prompt ends without a beep, Telnyx sends `call.machine.premium.greeting.ended` with `result=prompt_ended`. Use this webhook as the signal that your application can provide the response to the iOS screening prompt, such as who is calling and why.

Use `answering_machine_detection_config.prompt_end_timeout_millis` to control the maximum amount of time Telnyx waits for the iOS call-screening prompt to end after Premium AMD initially detects a `machine`. The default is `30000` milliseconds. The minimum value is `1000` milliseconds and the maximum value is `120000` milliseconds.

#### Sample dial request with iOS Call Screening Detection

```json theme={null}
{
  "connection_id": "1494404757140276705",
  "to": "+19198675309",
  "from": "+19842550944",
  "webhook_url": "https://webhook_url.com/outbound_call_events",
  "answering_machine_detection": "premium_ios_call_screening_detection",
  "answering_machine_detection_config": {
    "total_analysis_time_millis": 30000,
    "greeting_duration_millis": 2000,
    "prompt_end_timeout_millis": 30000
  }
}
```

#### iOS Call Screening Detection order of operations

1. Create an outbound call or transfer an inbound call with `answering_machine_detection` set to `premium_ios_call_screening_detection`.
2. Receive `call.initiated` webhook.
3. Receive `call.answered` webhook when the call is answered.
4. Receive `call.machine.premium.detection.ended` with the initial Premium AMD result.
5. If the initial result is `machine`, Telnyx waits for the call-screening prompt to end or for an Apple Call Screening tone.
6. If the prompt ends without a beep, receive `call.machine.premium.greeting.ended` with `result=prompt_ended`. After receiving this webhook, your application can provide the response to the iOS screening prompt, such as who is calling and why.
7. If an Apple Call Screening tone is detected, receive `call.machine.premium.call_screening.detected` with `result=screening`.
8. After the screening tone is detected, Telnyx restarts Premium AMD on the screened call. Expect another `call.machine.premium.detection.ended` webhook with the post-screening classification.
9. If the restarted Premium AMD detects a machine and later detects a beep, expect `call.machine.premium.greeting.ended` with `result=beep_detected`.

### General order of operations

1. Create outbound call.
2. Receive `call.initiated` webhook.
3. Receive `call.answered` webhook when the call is answered either by human or machine.
4. Receive `call.machine.detection.ended` webhook with human/machine status.
5. Receive `call.machine.greeting.ended` webhook when beep detected or 30 second timeout.

x. **Important** at any point, the callee could hangup generating a `call.hangup` webhook.

## Webhooks

### call.machine.detection.ended

The `call.machine.detection.ended` is sent when Telnyx can make a determination on human or machine.

The `data.payload.result` will contain the information about the answering machine:

<table class="table">
  <tbody>
    <tr>
      <td>Result</td>
      <td>Description</td>
    </tr>

    <tr>
      <td><code>human</code></td>
      <td>Human answered call</td>
    </tr>

    <tr>
      <td><code>machine</code></td>
      <td>Machine answered call</td>
    </tr>

    <tr>
      <td><code>not\_sure</code></td>
      <td><em>Recommended</em> to treat as if human answered.</td>
    </tr>
  </tbody>
</table>

#### Sample Webhook

```json theme={null}
{
  "data": {
    "event_type": "call.machine.detection.ended",
    "id": "0ccc7b54-4df3-4bca-a65a-3da1ecc777f0",
    "occurred_at": "2018-02-02T22:25:27.521992Z",
    "payload": {
      "call_control_id": "v2:T02llQxIyaRkhfRKxgAP8nY511EhFLizdvdUKJiSw8d6A9BborherQ",
      "call_leg_id": "428c31b6-7af4-4bcb-b7f5-5013ef9657c1",
      "call_session_id": "428c31b6-abf3-3bc1-b7f4-5013ef9657c1",
      "client_state": "aGF2ZSBhIG5pY2UgZGF5ID1d",
      "connection_id": "7267xxxxxxxxxxxxxx",
      "from": "+35319605860",
      "result": "machine",
      "to": "+13129457420"
    },
    "record_type": "event"
  }
}
```

<Callout type="info">
  After pasting the above content, Kindly check and remove any new line added
</Callout>

### call.machine.greeting.ended

If the `answering_machine_detection` was set to `detect_beep`, `detect_words`, `greeting_end` you could receive a final webhook when the prompt (or beep detection) has finished.

The `data.payload.result` will contain the information about the answering machine:

<table class="table">
  <tbody>
    <tr>
      <td>Result</td>
      <td>Description</td>
      <td>AMD Setting</td>
    </tr>

    <tr>
      <td><code>ended</code></td>
      <td>Greeting is over.</td>
      <td><strong>ONLY</strong> sent when setting is <code>greeting\_end</code></td>
    </tr>

    <tr>
      <td><code>beep\_detected</code></td>
      <td>Beep has been detected</td>
      <td><code>detect\_beep</code> and <code>detect\_words</code></td>
    </tr>

    <tr>
      <td><code>not\_sure</code></td>
      <td>30 second beep detection timeout fired after detecting a <code>machine</code></td>
      <td><code>detect\_beep</code> and <code>detect\_words</code></td>
    </tr>
  </tbody>
</table>

#### Sample Webhook

```json theme={null}
{
  "data": {
    "event_type": "call.machine.greeting.ended",
    "id": "0ccc7b54-4df3-4bca-a65a-3da1ecc777f0",
    "occurred_at": "2018-02-02T22:25:27.521992Z",
    "payload": {
      "call_control_id": "v2:T02llQxIyaRkhfRKxgAP8nY511EhFLizdvdUKJiSw8d6A9BborherQ",
      "call_leg_id": "428c31b6-7af4-4bcb-b7f5-5013ef9657c1",
      "call_session_id": "428c31b6-abf3-3bc1-b7f4-5013ef9657c1",
      "client_state": "aGF2ZSBhIG5pY2UgZGF5ID1d",
      "connection_id": "7267xxxxxxxxxxxxxx",
      "from": "+35319605860",
      "result": "ended",
      "to": "+13129457420"
    },
    "record_type": "event"
  }
}
```

<Callout type="info">
  After pasting the above content, Kindly check and remove any new line added
</Callout>

## AMD premium Webhooks

### call.machine.premium.detection.ended

The `call.machine.premium.detection.ended` webhook is sent when the AMD process can determine whether the call was answered by a `human` or a `machine`. It is possible to specify the number of milliseconds that Telnyx should attempt to perform the detection via the `total_analysis_time_millis` setting. By default, the timeout is set to 30 seconds. If the timeout is reached before the detection is finished, the result in the webhook will be `not_sure`.

The `data.payload.result` will contain the information about the answering machine:

<table class="table">
  <tbody>
    <tr>
      <td>Result</td>
      <td>Description</td>
    </tr>

    <tr>
      <td><code>human\_residence</code></td>
      <td>A human answered the call</td>
    </tr>

    <tr>
      <td><code>human\_business</code></td>
      <td>A human answered call</td>
    </tr>

    <tr>
      <td><code>machine</code></td>
      <td>A machine answered the call</td>
    </tr>

    <tr>
      <td><code>silence</code></td>
      <td>No sound was detected</td>
    </tr>

    <tr>
      <td><code>fax\_detected</code></td>
      <td>A Fax machine answered the call</td>
    </tr>

    <tr>
      <td><code>not\_sure</code></td>
      <td>Not identifiable, or the configured AMD timeout was reached before the result was available.</td>
    </tr>
  </tbody>
</table>

#### Sample Webhook

```json theme={null}
{
  "data": {
    "event_type": "call.machine.premium.detection.ended",
    "id": "0ccc7b54-4df3-4bca-a65a-3da1ecc777f0",
    "occurred_at": "2018-02-02T22:25:27.521992Z",
    "payload": {
      "call_control_id": "v2:T02llQxIyaRkhfRKxgAP8nY511EhFLizdvdUKJiSw8d6A9BborherQ",
      "call_leg_id": "428c31b6-7af4-4bcb-b7f5-5013ef9657c1",
      "call_session_id": "428c31b6-abf3-3bc1-b7f4-5013ef9657c1",
      "client_state": "aGF2ZSBhIG5pY2UgZGF5ID1d",
      "connection_id": "7267xxxxxxxxxxxxxx",
      "from": "+35319605860",
      "result": "machine",
      "to": "+13129457420"
    },
    "record_type": "event"
  }
}
```

<Callout type="info">
  After pasting the above content, Kindly check and remove any new line added
</Callout>

### call.machine.premium.greeting.ended

If a <code>machine</code> answered the call, you may receive a final webhook when the beep detection has finished. This webhook is <em>optional</em> and will only be sent if one of two happens:

* a beep is detected. In this case, the result is `beep_detected`.
* the optional AMD timeout is reached after the call was answered by a <code>machine</code>, but no beep was heard. For this case, the result is `no_beep_detected`.
* the iOS call-screening prompt ends without a beep when using `premium_ios_call_screening_detection`. For this case, the result is `prompt_ended`. After receiving this result, your application can provide the response to the iOS screening prompt, such as who is calling and why.

The `data.payload.result` will contain the information about the answering machine:

<table class="table">
  <tbody>
    <tr>
      <td>Result</td>
      <td>Description</td>
      <td>AMD Setting</td>
    </tr>

    <tr>
      <td><code>beep\_detected</code></td>
      <td>Greeting is over.</td>
      <td><strong>ONLY</strong> sent when a <code>machine</code> answered the call, and a beep was heard.</td>
    </tr>

    <tr>
      <td><code>no\_beep\_detected</code></td>
      <td><strong>ONLY</strong> sent when a <code>machine</code> answered the call, and the AMD timeout was reached before a beep was heard.</td>

      <td />
    </tr>

    <tr>
      <td><code>prompt\_ended</code></td>
      <td>The iOS call-screening prompt ended without a beep. After receiving this result, your application can provide the response to the iOS screening prompt, such as who is calling and why.</td>
      <td><strong>ONLY</strong> sent when using <code>premium\_ios\_call\_screening\_detection</code>.</td>
    </tr>
  </tbody>
</table>

#### Sample Webhook

```json theme={null}
{
  "data": {
    "event_type": "call.machine.premium.greeting.ended",
    "id": "0ccc7b54-4df3-4bca-a65a-3da1ecc777f0",
    "occurred_at": "2018-02-02T22:25:27.521992Z",
    "payload": {
      "call_control_id": "v2:T02llQxIyaRkhfRKxgAP8nY511EhFLizdvdUKJiSw8d6A9BborherQ",
      "call_leg_id": "428c31b6-7af4-4bcb-b7f5-5013ef9657c1",
      "call_session_id": "428c31b6-abf3-3bc1-b7f4-5013ef9657c1",
      "client_state": "aGF2ZSBhIG5pY2UgZGF5ID1d",
      "connection_id": "7267xxxxxxxxxxxxxx",
      "from": "+35319605860",
      "result": "beep_detected",
      "to": "+13129457420"
    },
    "record_type": "event"
  }
}
```

<Callout type="info">
  After pasting the above content, Kindly check and remove any new line added
</Callout>

### call.machine.premium.call\_screening.detected

The `call.machine.premium.call_screening.detected` webhook is sent when `premium_ios_call_screening_detection` detects an Apple Call Screening tone. The `data.payload.result` value is `screening`.

After this webhook is sent, Telnyx restarts Premium AMD on the screened call. This webhook is not terminal; expect another `call.machine.premium.detection.ended` webhook with the post-screening classification, and possibly `call.machine.premium.greeting.ended` if a beep is detected after the restart.

#### Sample Webhook

```json theme={null}
{
  "data": {
    "event_type": "call.machine.premium.call_screening.detected",
    "id": "0ccc7b54-4df3-4bca-a65a-3da1ecc777f0",
    "occurred_at": "2018-02-02T22:25:27.521992Z",
    "payload": {
      "call_control_id": "v2:T02llQxIyaRkhfRKxgAP8nY511EhFLizdvdUKJiSw8d6A9BborherQ",
      "call_leg_id": "428c31b6-7af4-4bcb-b7f5-5013ef9657c1",
      "call_session_id": "428c31b6-abf3-3bc1-b7f4-5013ef9657c1",
      "client_state": "aGF2ZSBhIG5pY2UgZGF5ID1d",
      "connection_id": "7267xxxxxxxxxxxxxx",
      "from": "+35319605860",
      "result": "screening",
      "to": "+13129457420"
    },
    "record_type": "event"
  }
}
```

<Callout type="info">
  After pasting the above content, Kindly check and remove any new line added
</Callout>
