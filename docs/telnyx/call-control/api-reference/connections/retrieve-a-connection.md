---
title: "Retrieve a connection"
source_url: "https://developers.telnyx.com/api-reference/connections/retrieve-a-connection.md"
category: "sip"
synced_at: "2026-06-25T18:43:22.819Z"
content_hash: "a3043a161ff5e0808dee12f6ac79bb40263863db38cb959e6aff628ecb178c51"
---
> ## Documentation Index
> Fetch the complete documentation index at: https://developers.telnyx.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Retrieve a connection

> Retrieves the high-level details of an existing connection. To retrieve specific authentication information, use the endpoint for the specific connection type.



## OpenAPI

````yaml https://telnyx-openapi-ng.s3.us-east-1.amazonaws.com/real-time-communications/sip-connections.yml get /connections/{id}
openapi: 3.1.0
info:
  title: Telnyx SIP Connections API
  version: 2.0.0
  description: API for SIP connections.
  contact:
    email: support@telnyx.com
servers:
  - url: https://api.telnyx.com/v2
security:
  - bearerAuth: []
paths:
  /connections/{id}:
    get:
      tags:
        - Connections
      summary: Retrieve a connection
      description: >-
        Retrieves the high-level details of an existing connection. To retrieve
        specific authentication information, use the endpoint for the specific
        connection type.
      operationId: RetrieveConnection
      parameters:
        - name: id
          in: path
          description: IP Connection ID
          required: true
          schema:
            type: string
      responses:
        '200':
          description: Successful response with details about a connection.
          content:
            application/json:
              schema:
                type: object
                title: Connection Response
                properties:
                  data:
                    $ref: '#/components/schemas/Connection'
        '400':
          $ref: '#/components/responses/connections_BadRequestResponse'
        '401':
          $ref: '#/components/responses/UnauthenticatedResponse'
        '403':
          $ref: '#/components/responses/connections_UnauthorizedResponse'
        '404':
          $ref: '#/components/responses/connections_NotFoundResponse'
      x-codeSamples:
        - lang: JavaScript
          source: |-
            import Telnyx from 'telnyx';

            const client = new Telnyx({
              apiKey: process.env['TELNYX_API_KEY'], // This is the default and can be omitted
            });

            const connection = await client.connections.retrieve('id');

            console.log(connection.data);
        - lang: Python
          source: |-
            import os
            from telnyx import Telnyx

            client = Telnyx(
                api_key=os.environ.get("TELNYX_API_KEY"),  # This is the default and can be omitted
            )
            connection = client.connections.retrieve(
                "id",
            )
            print(connection.data)
        - lang: Go
          source: "package main\n\nimport (\n\t\"context\"\n\t\"fmt\"\n\n\t\"github.com/team-telnyx/telnyx-go\"\n\t\"github.com/team-telnyx/telnyx-go/option\"\n)\n\nfunc main() {\n\tclient := telnyx.NewClient(\n\t\toption.WithAPIKey(\"My API Key\"),\n\t)\n\tconnection, err := client.Connections.Get(context.TODO(), \"id\")\n\tif err != nil {\n\t\tpanic(err.Error())\n\t}\n\tfmt.Printf(\"%+v\\n\", connection.Data)\n}\n"
        - lang: Java
          source: |-
            package com.telnyx.sdk.example;

            import com.telnyx.sdk.client.TelnyxClient;
            import com.telnyx.sdk.client.okhttp.TelnyxOkHttpClient;
            import com.telnyx.sdk.models.connections.ConnectionRetrieveParams;
            import com.telnyx.sdk.models.connections.ConnectionRetrieveResponse;

            public final class Main {
                private Main() {}

                public static void main(String[] args) {
                    TelnyxClient client = TelnyxOkHttpClient.fromEnv();

                    ConnectionRetrieveResponse connection = client.connections().retrieve("id");
                }
            }
        - lang: Ruby
          source: |-
            require "telnyx"

            telnyx = Telnyx::Client.new(api_key: "My API Key")

            connection = telnyx.connections.retrieve("id")

            puts(connection)
        - lang: PHP
          source: >-
            <?php


            require_once dirname(__DIR__) . '/vendor/autoload.php';


            use Telnyx\Client;

            use Telnyx\Core\Exceptions\APIException;


            $client = new Client(apiKey: getenv('TELNYX_API_KEY') ?: 'My API
            Key');


            try {
              $connection = $client->connections->retrieve('id');

              var_dump($connection);
            } catch (APIException $e) {
              echo $e->getMessage();
            }
        - lang: CLI
          source: |-
            telnyx connections retrieve \
              --api-key 'My API Key' \
              --id id
components:
  schemas:
    Connection:
      type: object
      title: Connection
      properties:
        id:
          type: string
          description: Identifies the specific resource.
          example: 6a09cdc3-8948-47f0-aa62-74ac943d6c58
          x-format: int64
        record_type:
          type: string
          description: Identifies the type of the resource.
          example: ip_connection
        active:
          type: boolean
          description: Defaults to true
          example: true
        anchorsite_override:
          $ref: '#/components/schemas/AnchorsiteOverride'
        connection_name:
          type: string
          example: string
        created_at:
          type: string
          description: ISO 8601 formatted date indicating when the resource was created.
          example: '2018-02-02T22:25:27.521Z'
        updated_at:
          type: string
          description: ISO 8601 formatted date indicating when the resource was updated.
          example: '2018-02-02T22:25:27.521Z'
        webhook_event_url:
          description: The URL where webhooks related to this connection will be sent.
          type:
            - string
            - 'null'
          format: uri
          default: null
          example: https://example.com
        webhook_event_failover_url:
          description: >-
            The failover URL where webhooks related to this connection will be
            sent if sending to the primary URL fails.
          type:
            - string
            - 'null'
          format: uri
          default: ''
          example: https://failover.example.com
        webhook_api_version:
          description: Determines which webhook format will be used, Telnyx API v1 or v2.
          type: string
          enum:
            - '1'
            - '2'
          default: '1'
          example: '1'
        outbound_voice_profile_id:
          $ref: '#/components/schemas/connections_OutboundVoiceProfileId'
        tags:
          type: array
          items:
            type: string
          description: Tags associated with the connection.
          example:
            - tag1
            - tag2
      example:
        id: 6a09cdc3-8948-47f0-aa62-74ac943d6c58
        record_type: ip_connection
        active: true
        anchorsite_override: Latency
        connection_name: string
        created_at: '2018-02-02T22:25:27.521Z'
        updated_at: '2018-02-02T22:25:27.521Z'
        webhook_event_url: https://example.com
        webhook_event_failover_url: https://failover.example.com
        webhook_api_version: '1'
        outbound_voice_profile_id: '1293384261075731499'
    AnchorsiteOverride:
      title: Anchorsite Override
      type: string
      description: >-
        `Latency` directs Telnyx to route media through the site with the lowest
        round-trip time to the user's connection. Telnyx calculates this time
        using ICMP ping messages. This can be disabled by specifying a site to
        handle all media.
      enum:
        - Latency
        - Chicago, IL
        - Ashburn, VA
        - San Jose, CA
        - Sydney, Australia
        - Amsterdam, Netherlands
        - London, UK
        - Toronto, Canada
        - Vancouver, Canada
        - Frankfurt, Germany
      default: Latency
      example: Amsterdam, Netherlands
    connections_OutboundVoiceProfileId:
      title: Outbound Voice Profile ID
      type: string
      description: Identifies the associated outbound voice profile.
      example: '1293384261075731499'
      x-format: int64
    ErrorResponse:
      type: object
      properties:
        errors:
          type: array
          items:
            type: object
            properties:
              code:
                type: string
              detail:
                type: string
              meta:
                type: object
                properties:
                  url:
                    type: string
                    format: uri
              title:
                type: string
              source:
                type: object
                properties:
                  pointer:
                    type: string
  responses:
    connections_BadRequestResponse:
      description: >-
        Bad request, the request was unacceptable, often due to missing a
        required parameter.
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/ErrorResponse'
          examples:
            missingParameter:
              value:
                errors:
                  - code: '10015'
                    title: Bad Request
                    detail: The request failed because it was not well-formed.
                    source:
                      pointer: /
                    meta:
                      url: https://developers.telnyx.com/docs/overview/errors/10015
    UnauthenticatedResponse:
      description: Unauthorized
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/ErrorResponse'
          examples:
            Authentication Failed:
              value:
                errors:
                  - code: '10009'
                    title: Authentication failed
                    detail: Could not understand the provided credentials.
                    meta:
                      url: https://developers.telnyx.com/docs/overview/errors/10009
    connections_UnauthorizedResponse:
      description: >-
        The user doesn't have the required permissions to perform the requested
        action.
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/ErrorResponse'
          examples:
            notAuthorized:
              value:
                errors:
                  - code: '10010'
                    title: Not authorized
                    detail: You are not authorized to access the requested resource.
                    meta:
                      url: https://developers.telnyx.com/docs/overview/errors/10010
                    source:
                      pointer: /
    connections_NotFoundResponse:
      description: The requested resource doesn't exist.
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/ErrorResponse'
          examples:
            notFound:
              value:
                errors:
                  - code: '10005'
                    title: Resource not found
                    detail: The requested resource or URL could not be found.
                    meta:
                      url: https://developers.telnyx.com/docs/overview/errors/10005
                    source:
                      pointer: /
  securitySchemes:
    bearerAuth:
      scheme: bearer
      type: http

````
