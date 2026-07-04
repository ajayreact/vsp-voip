---
title: "Gather Using AI"
source_url: "https://developers.telnyx.com/docs/voice/programmable-voice/gather-using-ai.md"
category: "call-control"
synced_at: "2026-06-25T18:43:04.405Z"
content_hash: "204a99c2c658559c522c62b34f0544121395cf145c22fcdaa47e125fc3486e0e"
---
> ## Documentation Index
> Fetch the complete documentation index at: https://developers.telnyx.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Gather using AI

> Capture caller input with AI on Telnyx Programmable Voice. Use Gather using AI to transcribe speech, classify intent, and branch your IVR dynamically.

## Introduction

Gather using AI is a powerful functionality that allows you to efficiently collect specific information from call participants. By leveraging AI, this feature can gather details such as names, addresses, or other relevant information based on a list you provided. The collected data is then sent back in a structured format. This new AI-driven feature offers a much easier user experience compared to the previous gather functionality, simplifying the process and reducing the time needed to collect information. This guide will walk you through the process of using the 'Gather Using AI' feature effectively.

## Prerequisites

The feature can be used for Voice API or TeXML calls similar to regular gather functionality. Please follow the user guides to set up your environment:

* [Voice API](https://developers.telnyx.com/docs/voice/programmable-voice/get-started)
* [TeXML](https://developers.telnyx.com/docs/voice/programmable-voice/texml-setup)

## Voice API

Gather using AI can be enabled for any call by sending the following curl request:

```bash theme={null}
curl --location 'https://api.telnyx.com/v2/calls/{{call_control_id}}/actions/gather_using_ai' \
--header 'Accept: application/json' \
--header 'Content-Type: application/json' \
--header 'Authorization: Bearer ••••••' \
--data '{
    “greeting”: “Can you tell me your age and where you live?“,
    “parameters”: {
      “properties”: {
        “age”: {
          “description”: “The age of the customer.“,
          “type”: “integer”
        },
        “location”: {
          “description”: “The location of the customer.“,
          “type”: “string”
        }
      },
      “required”: [
        “age”,
        “location”
      ],
      “type”: “object”
    },
    “voice”: “Polly.Brian”
   }'
```

The `parameters` section contains all the data that you want to gather during the call. Please use the [json schema](https://json-schema.org/) to define them.
The `required` section specifies when the `gather` process should end. A webhook will be sent when all values from this list are gathered. If no values are provided, the process will end as soon as the first value is retrieved.

## Message history

It is possible to provide the history of the conversation in the `message_history` section, allowing the bot to continue the conversation without losing context

```bash theme={null}
curl --location 'https://api.telnyx.com/v2/calls/{{call_control_id}}/actions/gather_using_ai' \
--header 'Accept: application/json' \
--header 'Content-Type: application/json' \
--header 'Authorization: Bearer ••••••' \
--data '{
    “greeting”: “Can you tell me your age and where you live?“,
    “parameters”: {
      “properties”: {
        “age”: {
          “description”: “The age of the customer.“,
          “type”: “integer”
        },
        “location”: {
          “description”: “The location of the customer.“,
          “type”: “string”
        }
      },
      “required”: [
        “age”,
        “location”
      ],
      “type”: “object”
    },
    “voice”: “Polly.Brian”,
    “message_history”: [
      {
        “role”: “assistant”,
        “content”: “Hello what’s your name?”
      },
      {
        “role”: “user”,
        “content”: “My name is Enzo.”
      }
    ]
  }'
```

## TeXML

In the similar, the gather using AI can be enabled from TeXML. There is a dedicated verb `<AIGather>` that can be used for that purpose:

```xml theme={null}
<Response>
    <AIGather action="https://example.com/aigather">
        <Greeting>Hello, please provide your age and location.</Greeting>
        <Voice name="Polly.Joanna"/>
        <Parameters>
            <![CDATA[
                {
                    "type": "object",
                    "properties": {
                        "location": {
                            "type": "string",
                            "description": "The location of the user"
                        },
                        "age": {
                            "type": "number",
                            "description": "The age of the user"
                        }
                    },
                    "required": ["location", "age"]
                }
            ]]>
        </Parameters>
        <MessageHistory>
            <Message role="assistant">Hello, what's your name?</Message>
            <Message role="user">Hi, I'm Enzo.</Message>
        </MessageHistory>
    </AIGather>
</Response>
```

## Noise suppression

The crucial part of the gathering process is to have an accurate transcription of what was said during the call.

To improve the quality of the transcription, it is recommended to enable noise suppression for the call. This can be done in the following way for Voice API calls:

```bash theme={null}
 curl --request POST \
    --url https://api.telnyx.com/v2/calls/${call_control_id}/actions/suppression_start \
    --header 'Accept: application/json' \
    --header 'Authorization: Bearer YOUR_API_KEY \
    --header 'Content-Type: application/json' \
    --data '{
        "direction": "inbound"
    }'
```

and in TeXML:

```xml theme={null}
<Response>
    <Start>
        <Suppression direction="inbound"/>
    </Start>
...
    <Stop>
        <Suppression/>
    </Stop>
</Response>
```

## Need more assistance?

If you need some help, [reach out](https://telnyx.com/contact-us) to a member of our team through our form or [the portal](https://portal.telnyx.com/).
