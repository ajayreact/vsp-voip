---
title: "Republish a port-out event"
source_url: "https://developers.telnyx.com/api-reference/number-portout/republish-a-port-out-event.md"
category: "phone-numbers"
synced_at: "2026-06-25T18:43:32.727Z"
content_hash: "e198b096b10ab8cea62afcc7d66cc4c6cf6e7c57cf7132d71e1f524371717c61"
---
> ## Documentation Index
> Fetch the complete documentation index at: https://developers.telnyx.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Republish a port-out event

> Republish a specific port-out event.



## OpenAPI

````yaml https://telnyx-openapi-ng.s3.us-east-1.amazonaws.com/numbers-identity/portout.yml post /portouts/events/{id}/republish
openapi: 3.1.0
info:
  title: Telnyx Number Portout API
  version: 2.0.0
  description: API for Number portout.
  contact:
    email: support@telnyx.com
servers:
  - url: https://api.telnyx.com/v2
security:
  - bearerAuth: []
paths:
  /portouts/events/{id}/republish:
    post:
      tags:
        - Number Portout
      summary: Republish a port-out event
      description: Republish a specific port-out event.
      operationId: republishPortoutEvent
      parameters:
        - name: id
          description: Identifies the port-out event.
          in: path
          required: true
          schema:
            type: string
            format: uuid
      responses:
        '204':
          description: No content
        '404':
          description: Not found
        '500':
          description: Internal server error
      x-codeSamples:
        - lang: JavaScript
          source: >-
            import Telnyx from 'telnyx';


            const client = new Telnyx({
              apiKey: process.env['TELNYX_API_KEY'], // This is the default and can be omitted
            });


            await
            client.portouts.events.republish('182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e');
        - lang: Python
          source: |-
            import os
            from telnyx import Telnyx

            client = Telnyx(
                api_key=os.environ.get("TELNYX_API_KEY"),  # This is the default and can be omitted
            )
            client.portouts.events.republish(
                "182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e",
            )
        - lang: Go
          source: "package main\n\nimport (\n\t\"context\"\n\n\t\"github.com/team-telnyx/telnyx-go\"\n\t\"github.com/team-telnyx/telnyx-go/option\"\n)\n\nfunc main() {\n\tclient := telnyx.NewClient(\n\t\toption.WithAPIKey(\"My API Key\"),\n\t)\n\terr := client.Portouts.Events.Republish(context.TODO(), \"182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e\")\n\tif err != nil {\n\t\tpanic(err.Error())\n\t}\n}\n"
        - lang: Java
          source: |-
            package com.telnyx.sdk.example;

            import com.telnyx.sdk.client.TelnyxClient;
            import com.telnyx.sdk.client.okhttp.TelnyxOkHttpClient;
            import com.telnyx.sdk.models.portouts.events.EventRepublishParams;

            public final class Main {
                private Main() {}

                public static void main(String[] args) {
                    TelnyxClient client = TelnyxOkHttpClient.fromEnv();

                    client.portouts().events().republish("182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e");
                }
            }
        - lang: Ruby
          source: >-
            require "telnyx"


            telnyx = Telnyx::Client.new(api_key: "My API Key")


            result =
            telnyx.portouts.events.republish("182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e")


            puts(result)
        - lang: PHP
          source: >-
            <?php


            require_once dirname(__DIR__) . '/vendor/autoload.php';


            use Telnyx\Client;

            use Telnyx\Core\Exceptions\APIException;


            $client = new Client(apiKey: getenv('TELNYX_API_KEY') ?: 'My API
            Key');


            try {
              $result = $client->portouts->events->republish(
                '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e'
              );

              var_dump($result);
            } catch (APIException $e) {
              echo $e->getMessage();
            }
        - lang: CLI
          source: |-
            telnyx portouts:events republish \
              --api-key 'My API Key' \
              --id 182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e
components:
  securitySchemes:
    bearerAuth:
      scheme: bearer
      type: http

````
