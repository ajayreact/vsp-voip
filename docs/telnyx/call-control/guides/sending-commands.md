---
title: "Sending Commands"
source_url: "https://developers.telnyx.com/docs/voice/programmable-voice/sending-commands.md"
category: "call-control"
synced_at: "2026-06-25T18:43:01.513Z"
content_hash: "22725b752a18fa73a512ef12adc32d3f8fbce1f80a834d5c905fbc50240c8c65"
---
> ## Documentation Index
> Fetch the complete documentation index at: https://developers.telnyx.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Sending Commands for Programmable Voice

> Send voice commands to Telnyx Programmable Voice — answer, hangup, transfer, play audio, gather DTMF — with code examples and parameter reference.

A Voice API command is sent with a `call_control_id`. The `call_control_id` allows a user to communicate to Telnyx the `call_leg` the user wants to control.  It also helps Telnyx route the call to the location where the call is being managed, resulting in the lowest possible latency for Call Control interactions.

## Authenticating your Voice API command request

Like all other Telnyx API V2 requests, you must authenticate your Voice API command requests by sending the Authorization header with a value of an API Key. You can read more about API Keys [here](/development/api-fundamentals/authentication).

<table class="table">
  <tbody>
    <tr>
      <td>Credential Type</td>
      <td>HTTP Header Format</td>
    </tr>

    <tr>
      <td>API Key</td>
      <td>Authorization: Bearer YOUR\_API\_KEY</td>
    </tr>
  </tbody>
</table>

## Example: Sending commands with a key + secret

To answer the call, send a POST request to the `/actions/answer` endpoint as shown in the example below.

<Callout type="info">
  *Don't forget to update `YOUR_API_KEY` here.*
</Callout>

```bash theme={null}
curl -X POST \
  --header "Content-Type: application/json" \
  --header "Accept: application/json" \
  --header "Authorization: Bearer YOUR_API_KEY" \
  https://api.telnyx.com/v2/calls/428c31b6-7af4-4bcb-b7f5-5013ef9657c1/actions/answer
```

<Callout type="info">
  After pasting the above content, Kindly check and remove any new line added
</Callout>

## Available commands and their expected Webhooks

Telnyx offers a broad range of commands to enable granular control of your call flows.  Below are a list of those commands, and the webhooks the Telnyx Voice API platform will always send in response.  When multiple webhooks are listed, you can expect to often, though not always, receive webhooks in the order provided.

<table class="table">
  <tbody>
    <tr>
      <td>Command</td>
      <td>Expected Webhooks</td>
    </tr>

    <tr>
      <td><a href="/api-reference/call-commands/answer-call">Answer call</a></td>
      <td><code>call.answered</code></td>
    </tr>

    <tr>
      <td><a href="/api-reference/call-commands/bridge-calls">Bridge call</a></td>

      <td>
        <code>call.bridged</code> for Leg A
        <code>call.bridged</code> for Leg B
      </td>
    </tr>

    <tr>
      <td><a href="/api-reference/call-commands/dial">Dial</a></td>

      <td>
        <code>call.initiated</code>
        <code>call.answered</code> or <code>call.hangup</code>
        <code>call.machine.detection.ended</code> - if <code>answering\_machine\_detection</code> was requested
        <code>call.machine.greeting.ended</code> - if <code>answering\_machine\_detection</code> was requested to detect the end of machine greeting
      </td>
    </tr>

    <tr>
      <td><a href="/api-reference/call-commands/forking-start">Forking start</a></td>

      <td>
        <code>call.fork.started</code>
        <code>call.fork.stopped</code>
      </td>
    </tr>

    <tr>
      <td><a href="/api-reference/call-commands/forking-stop">Forking stop</a></td>
      <td><code>call.fork.stopped</code></td>
    </tr>

    <tr>
      <td><a href="/api-reference/call-commands/gather-using-audio">Gather using audio</a></td>

      <td>
        <code>call.playback.started</code>
        <code>call.playback.ended</code>
        <code>call.dtmf.received</code> - you may receive many of these webhooks
        <code>call.gather.ended</code>
      </td>
    </tr>

    <tr>
      <td><a href="/api-reference/call-commands/gather-using-speak">Gather using speak</a></td>

      <td>
        <code>call.dtmf.received</code> - you may receive many of these webhooks
        <code>call.gather.ended</code>
      </td>
    </tr>

    <tr>
      <td><a href="https://developers.telnyx.com/docs/voice/programmable-voice/texml-verbs/hangup/index#hangup">Hangup</a></td>

      <td>
        <code>call.hangup</code>
        <code>call.recording.saved</code> - if the call is being recorded
      </td>
    </tr>

    <tr>
      <td><a href="/api-reference/call-commands/play-audio-url">Play audio url</a></td>

      <td>
        <code>call.playback.started</code>
        <code>call.playback.ended</code>
      </td>
    </tr>

    <tr>
      <td><a href="/api-reference/call-commands/stop-audio-playback">Playback stop command</a></td>
      <td><code>call.playback.ended</code> or <code>call.speak.ended</code></td>
    </tr>

    <tr>
      <td><a href="/api-reference/call-commands/recording-start">Recording start</a></td>
      <td>no webhooks</td>
    </tr>

    <tr>
      <td><a href="/api-reference/call-commands/recording-stop">Recording stop</a></td>
      <td><code>call.recording.saved</code></td>
    </tr>

    <tr>
      <td><a href="/api-reference/call-commands/reject-a-call">Reject call</a></td>
      <td><code>call.hangup</code></td>
    </tr>

    <tr>
      <td><a href="/api-reference/call-commands/send-dtmf">Send DTMF</a></td>
      <td>no webhooks</td>
    </tr>

    <tr>
      <td><a href="/api-reference/call-commands/speak-text">Speak text</a></td>

      <td>
        <code>call.speak.started</code>
        <code>call.speak.ended</code>
      </td>
    </tr>

    <tr>
      <td><a href="/api-reference/call-commands/transfer-call">Transfer call</a></td>

      <td>
        <code>call.initiated</code>
        <code>call.bridged</code> to Leg B
        <code>call.answered</code> or <code>call.hangup</code>
      </td>
    </tr>
  </tbody>
</table>

## Response when sending Voice API commands

When you send a Voice API Command, you will immediately receive an http response. Responses include, but are not limited to:

<table class="table">
  <tbody>
    <tr>
      <td>HTTP Status Code</td>
      <td>Message</td>
      <td>Description</td>
    </tr>

    <tr>
      <td>200</td>
      <td>OK</td>
      <td>The request succeeded.</td>
    </tr>

    <tr>
      <td>403</td>
      <td>Forbidden</td>
      <td>The request was valid, however the user is not authorized to perform this action.</td>
    </tr>

    <tr>
      <td>404</td>
      <td>Not Found</td>
      <td>The requested resource could not be found.</td>
    </tr>

    <tr>
      <td>422</td>
      <td>Invalid Parameters</td>
      <td>The request has invalid parameters or the call is no longer active.</td>
    </tr>
  </tbody>
</table>
