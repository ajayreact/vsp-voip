---
title: "Concurrent Call Limits"
source_url: "https://developers.telnyx.com/docs/voice/sip-trunking/configuration/concurrent-limits.md"
category: "sip"
synced_at: "2026-06-25T18:43:17.959Z"
content_hash: "c032363258e43e88d9dd22edc9f1fe1feb3fc861ca2f8f9625fb3c22f3b1ba7e"
---
> ## Documentation Index
> Fetch the complete documentation index at: https://developers.telnyx.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Concurrent Call Limits

> Set concurrent call limits on Telnyx SIP Trunking connections. Cap inbound and outbound channels per connection to protect capacity and control spend.

Concurrent call limits control the maximum number of simultaneous outbound calls allowed on an account. This limit applies globally across all outbound voice profiles.

## Default limits

New accounts start with a default concurrent call limit that increases based on account verification:

| Verification level             | Concurrent calls |
| ------------------------------ | ---------------- |
| Initial setup                  | 2                |
| Level 2 verification completed | 10               |
| Custom limit (contact support) | 10+              |

## Error handling

When the application attempts to establish a call that exceeds the configured limit, Telnyx returns a SIP 403 error:

```
403 User channel limit exceeded D1
```

This response indicates that the global account concurrent call limit has been reached.

### Implementing retry logic

Implement exponential backoff when handling limit errors:

```
on 403 "channel limit exceeded":
    wait 2^attempt seconds (1s, 2s, 4s, ...)
    retry up to max_retries
```

## Monitoring

Track concurrent call usage to prevent limit errors:

### Via API

Use [GET /v2/calls](/api-reference/call-information/list-all-active-calls-for-given-connection) and filter for `status: active` to get the current concurrent call count.

### Webhook monitoring

Track call lifecycle events using [Voice API webhooks](/api-reference/call-commands/dial):

* `call.initiated` - Increment counter
* `call.hangup` - Decrement counter

Maintain an in-memory or database counter to track real-time concurrent usage.

## Best practices

1. **Set alerts** - Configure monitoring to alert when usage reaches 80% of the limit
2. **Implement queueing** - Queue calls when approaching limits rather than failing immediately
3. **Monitor trends** - Track peak usage patterns to anticipate when limit increases are needed
4. **Test error handling** - Verify the application handles 403 limit errors gracefully

## Requesting limit increases

For concurrent call limits exceeding 10 channels, contact [support@telnyx.com](mailto:support@telnyx.com). Include the following information in the request:

* Current concurrent call requirement
* Expected growth trajectory
* Use case description (required for limits exceeding 100 channels)
