---
title: "Get detailed messaging profile metrics"
source_url: "https://developers.telnyx.com/api-reference/messaging/get-detailed-messaging-profile-metrics.md"
category: "messaging"
synced_at: "2026-06-25T18:43:34.506Z"
content_hash: "500e8460c478ca07e1e4460fe05187f2eeac849d16c59a1a0556788825f7d0d7"
---
> ## Documentation Index
> Fetch the complete documentation index at: https://developers.telnyx.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Get detailed messaging profile metrics

> Get detailed metrics for a specific messaging profile, broken down by time interval.



## OpenAPI

````yaml https://telnyx-openapi-ng.s3.us-east-1.amazonaws.com/messaging/profiles.yml get /messaging/profiles/{id}/metrics
openapi: 3.1.0
info:
  title: Telnyx Messaging Profiles API
  version: 2.0.0
  description: API for messaging profiles and auto-response configurations.
  contact:
    email: support@telnyx.com
servers:
  - url: https://api.telnyx.com/v2
security:
  - bearerAuth: []
paths:
  /messaging/profiles/{id}/metrics:
    get:
      tags:
        - Messaging
      summary: Get detailed messaging profile metrics
      description: >-
        Get detailed metrics for a specific messaging profile, broken down by
        time interval.
      operationId: GetDetailedProfileMetrics
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
            format: uuid
          description: The identifier of the messaging profile.
        - name: time_frame
          in: query
          required: false
          schema:
            $ref: '#/components/schemas/MessagingMetricsTimeFrame'
          description: The time frame for metrics.
      responses:
        '200':
          description: Successful response with detailed profile metrics.
          content:
            application/json:
              schema:
                type: object
                properties:
                  data:
                    $ref: '#/components/schemas/ProfileMetrics'
        '400':
          $ref: '#/components/responses/messaging_BadRequestResponse'
        '401':
          $ref: '#/components/responses/messaging_UnauthorizedResponse'
        '404':
          $ref: '#/components/responses/messaging_NotFoundResponse'
      x-codeSamples:
        - lang: JavaScript
          source: |-
            import Telnyx from 'telnyx';

            const client = new Telnyx({
              apiKey: process.env['TELNYX_API_KEY'], // This is the default and can be omitted
            });

            const response = await client.messagingProfiles.retrieveMetrics(
              '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e',
            );

            console.log(response.data);
        - lang: Python
          source: |-
            import os
            from telnyx import Telnyx

            client = Telnyx(
                api_key=os.environ.get("TELNYX_API_KEY"),  # This is the default and can be omitted
            )
            response = client.messaging_profiles.retrieve_metrics(
                id="182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e",
            )
            print(response.data)
        - lang: Go
          source: "package main\n\nimport (\n\t\"context\"\n\t\"fmt\"\n\n\t\"github.com/team-telnyx/telnyx-go\"\n\t\"github.com/team-telnyx/telnyx-go/option\"\n)\n\nfunc main() {\n\tclient := telnyx.NewClient(\n\t\toption.WithAPIKey(\"My API Key\"),\n\t)\n\tresponse, err := client.MessagingProfiles.GetMetrics(\n\t\tcontext.TODO(),\n\t\t\"182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e\",\n\t\ttelnyx.MessagingProfileGetMetricsParams{},\n\t)\n\tif err != nil {\n\t\tpanic(err.Error())\n\t}\n\tfmt.Printf(\"%+v\\n\", response.Data)\n}\n"
        - lang: Java
          source: >-
            package com.telnyx.sdk.example;


            import com.telnyx.sdk.client.TelnyxClient;

            import com.telnyx.sdk.client.okhttp.TelnyxOkHttpClient;

            import
            com.telnyx.sdk.models.messagingprofiles.MessagingProfileRetrieveMetricsParams;

            import
            com.telnyx.sdk.models.messagingprofiles.MessagingProfileRetrieveMetricsResponse;


            public final class Main {
                private Main() {}

                public static void main(String[] args) {
                    TelnyxClient client = TelnyxOkHttpClient.fromEnv();

                    MessagingProfileRetrieveMetricsResponse response = client.messagingProfiles().retrieveMetrics("182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e");
                }
            }
        - lang: Ruby
          source: >-
            require "telnyx"


            telnyx = Telnyx::Client.new(api_key: "My API Key")


            response =
            telnyx.messaging_profiles.retrieve_metrics("182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e")


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
              $response = $client->messagingProfiles->retrieveMetrics(
                '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e', timeFrame: '1h'
              );

              var_dump($response);
            } catch (APIException $e) {
              echo $e->getMessage();
            }
        - lang: CLI
          source: |-
            telnyx messaging-profiles retrieve-metrics \
              --api-key 'My API Key' \
              --id 182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e
components:
  schemas:
    MessagingMetricsTimeFrame:
      type: string
      title: Messaging Metrics Time Frame
      description: The time frame for metrics aggregation.
      enum:
        - 1h
        - 3h
        - 24h
        - 3d
        - 7d
        - 30d
      default: 24h
    ProfileMetrics:
      type: object
      description: Detailed metrics for a messaging profile.
      additionalProperties: true
    messaging_Errors:
      properties:
        errors:
          type: array
          items:
            $ref: '#/components/schemas/messaging_Error'
    messaging_Error:
      required:
        - code
        - title
      properties:
        code:
          type: string
          x-format: integer
        title:
          type: string
        detail:
          type: string
        source:
          type: object
          properties:
            pointer:
              description: JSON pointer (RFC6901) to the offending entity.
              type: string
              format: json-pointer
            parameter:
              description: Indicates which query parameter caused the error.
              type: string
        meta:
          type: object
  responses:
    messaging_BadRequestResponse:
      description: Bad Request
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/messaging_Errors'
    messaging_UnauthorizedResponse:
      description: Unauthorized
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/messaging_Errors'
    messaging_NotFoundResponse:
      description: Not Found
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/messaging_Errors'
  securitySchemes:
    bearerAuth:
      scheme: bearer
      type: http

````
