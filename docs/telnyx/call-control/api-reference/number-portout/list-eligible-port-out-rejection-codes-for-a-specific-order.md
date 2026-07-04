---
title: "List eligible port-out rejection codes for a specific order"
source_url: "https://developers.telnyx.com/api-reference/number-portout/list-eligible-port-out-rejection-codes-for-a-specific-order.md"
category: "phone-numbers"
synced_at: "2026-06-25T18:43:32.969Z"
content_hash: "3c315fb8e729ec53fd0623e82803c833745c0ece54fefd5cc483a59b7347d6ce"
---
> ## Documentation Index
> Fetch the complete documentation index at: https://developers.telnyx.com/llms.txt
> Use this file to discover all available pages before exploring further.

# List eligible port-out rejection codes for a specific order

> Given a port-out ID, list rejection codes that are eligible for that port-out



## OpenAPI

````yaml https://telnyx-openapi-ng.s3.us-east-1.amazonaws.com/numbers-identity/portout.yml get /portouts/rejections/{portout_id}
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
  /portouts/rejections/{portout_id}:
    get:
      tags:
        - Number Portout
      summary: List eligible port-out rejection codes for a specific order
      description: >-
        Given a port-out ID, list rejection codes that are eligible for that
        port-out
      operationId: ListPortoutRejections
      parameters:
        - name: portout_id
          description: Identifies a port out order.
          in: path
          required: true
          schema:
            type: string
            example: 329d6658-8f93-405d-862f-648776e8afd7
        - name: filter
          in: query
          style: deepObject
          explode: true
          description: >-
            Consolidated filter parameter (deepObject style). Originally:
            filter[code], filter[code][in]
          schema:
            type: object
            properties:
              code:
                oneOf:
                  - type: integer
                    example: 1002
                    description: Filter rejections of a specific code
                  - type: array
                    items:
                      type: integer
                    example:
                      - 1002
                      - 1003
                    description: Filter rejections in a list of codes
      responses:
        '200':
          description: Successful response
          content:
            application/json:
              schema:
                type: object
                properties:
                  data:
                    type: array
                    items:
                      $ref: '#/components/schemas/PortoutRejection'
        '404':
          description: Resource not found
        '422':
          description: Unprocessable entity. Check message field in response for details.
        '500':
          description: Internal server error
      x-codeSamples:
        - lang: JavaScript
          source: >-
            import Telnyx from 'telnyx';


            const client = new Telnyx({
              apiKey: process.env['TELNYX_API_KEY'], // This is the default and can be omitted
            });


            const response = await
            client.portouts.listRejectionCodes('329d6658-8f93-405d-862f-648776e8afd7');


            console.log(response.data);
        - lang: Python
          source: |-
            import os
            from telnyx import Telnyx

            client = Telnyx(
                api_key=os.environ.get("TELNYX_API_KEY"),  # This is the default and can be omitted
            )
            response = client.portouts.list_rejection_codes(
                portout_id="329d6658-8f93-405d-862f-648776e8afd7",
            )
            print(response.data)
        - lang: Go
          source: "package main\n\nimport (\n\t\"context\"\n\t\"fmt\"\n\n\t\"github.com/team-telnyx/telnyx-go\"\n\t\"github.com/team-telnyx/telnyx-go/option\"\n)\n\nfunc main() {\n\tclient := telnyx.NewClient(\n\t\toption.WithAPIKey(\"My API Key\"),\n\t)\n\tresponse, err := client.Portouts.ListRejectionCodes(\n\t\tcontext.TODO(),\n\t\t\"329d6658-8f93-405d-862f-648776e8afd7\",\n\t\ttelnyx.PortoutListRejectionCodesParams{},\n\t)\n\tif err != nil {\n\t\tpanic(err.Error())\n\t}\n\tfmt.Printf(\"%+v\\n\", response.Data)\n}\n"
        - lang: Java
          source: >-
            package com.telnyx.sdk.example;


            import com.telnyx.sdk.client.TelnyxClient;

            import com.telnyx.sdk.client.okhttp.TelnyxOkHttpClient;

            import
            com.telnyx.sdk.models.portouts.PortoutListRejectionCodesParams;

            import
            com.telnyx.sdk.models.portouts.PortoutListRejectionCodesResponse;


            public final class Main {
                private Main() {}

                public static void main(String[] args) {
                    TelnyxClient client = TelnyxOkHttpClient.fromEnv();

                    PortoutListRejectionCodesResponse response = client.portouts().listRejectionCodes("329d6658-8f93-405d-862f-648776e8afd7");
                }
            }
        - lang: Ruby
          source: >-
            require "telnyx"


            telnyx = Telnyx::Client.new(api_key: "My API Key")


            response =
            telnyx.portouts.list_rejection_codes("329d6658-8f93-405d-862f-648776e8afd7")


            puts(response)
        - lang: PHP
          source: >-
            <?php


            require_once dirname(__DIR__) . '/vendor/autoload.php';


            use Telnyx\Client;

            use Telnyx\Core\Exceptions\APIException;


            $client = new Client(apiKey: getenv('TELNYX_API_KEY') ?: 'My API
            Key');


            try {
              $response = $client->portouts->listRejectionCodes(
                '329d6658-8f93-405d-862f-648776e8afd7', filter: ['code' => 1002]
              );

              var_dump($response);
            } catch (APIException $e) {
              echo $e->getMessage();
            }
        - lang: CLI
          source: |-
            telnyx portouts list-rejection-codes \
              --api-key 'My API Key' \
              --portout-id 329d6658-8f93-405d-862f-648776e8afd7
components:
  schemas:
    PortoutRejection:
      type: object
      properties:
        code:
          type: integer
          example: 1002
        description:
          type: string
          example: Invalid PIN
        reason_required:
          type: boolean
          example: false
  securitySchemes:
    bearerAuth:
      scheme: bearer
      type: http

````
