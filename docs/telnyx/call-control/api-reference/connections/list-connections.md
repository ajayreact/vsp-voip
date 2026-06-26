---
title: "List connections"
source_url: "https://developers.telnyx.com/api-reference/connections/list-connections.md"
category: "sip"
synced_at: "2026-06-25T18:43:22.515Z"
content_hash: "960f7c6087595b73b2725c92333f3fae94d5bf7df58484a83bcd9db4c99446dc"
---
> ## Documentation Index
> Fetch the complete documentation index at: https://developers.telnyx.com/llms.txt
> Use this file to discover all available pages before exploring further.

# List connections

> Returns a list of your connections irrespective of type.



## OpenAPI

````yaml https://telnyx-openapi-ng.s3.us-east-1.amazonaws.com/real-time-communications/sip-connections.yml get /connections
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
  /connections:
    get:
      tags:
        - Connections
      summary: List connections
      description: Returns a list of your connections irrespective of type.
      operationId: ListConnections
      parameters:
        - $ref: '#/components/parameters/connections_FilterConsolidated'
        - $ref: '#/components/parameters/connections_PageConsolidated'
        - $ref: '#/components/parameters/connections_SortConnection'
      responses:
        '200':
          $ref: '#/components/responses/ListConnectionsResponse'
        '400':
          $ref: '#/components/responses/connections_BadRequestResponse'
        '401':
          $ref: '#/components/responses/UnauthenticatedResponse'
        '403':
          $ref: '#/components/responses/connections_UnauthorizedResponse'
      x-codeSamples:
        - lang: JavaScript
          source: >-
            import Telnyx from 'telnyx';


            const client = new Telnyx({
              apiKey: process.env['TELNYX_API_KEY'], // This is the default and can be omitted
            });


            // Automatically fetches more pages as needed.

            for await (const connectionListResponse of
            client.connections.list()) {
              console.log(connectionListResponse.id);
            }
        - lang: Python
          source: |-
            import os
            from telnyx import Telnyx

            client = Telnyx(
                api_key=os.environ.get("TELNYX_API_KEY"),  # This is the default and can be omitted
            )
            page = client.connections.list()
            page = page.data[0]
            print(page.id)
        - lang: Go
          source: "package main\n\nimport (\n\t\"context\"\n\t\"fmt\"\n\n\t\"github.com/team-telnyx/telnyx-go\"\n\t\"github.com/team-telnyx/telnyx-go/option\"\n)\n\nfunc main() {\n\tclient := telnyx.NewClient(\n\t\toption.WithAPIKey(\"My API Key\"),\n\t)\n\tpage, err := client.Connections.List(context.TODO(), telnyx.ConnectionListParams{})\n\tif err != nil {\n\t\tpanic(err.Error())\n\t}\n\tfmt.Printf(\"%+v\\n\", page)\n}\n"
        - lang: Java
          source: |-
            package com.telnyx.sdk.example;

            import com.telnyx.sdk.client.TelnyxClient;
            import com.telnyx.sdk.client.okhttp.TelnyxOkHttpClient;
            import com.telnyx.sdk.models.connections.ConnectionListPage;
            import com.telnyx.sdk.models.connections.ConnectionListParams;

            public final class Main {
                private Main() {}

                public static void main(String[] args) {
                    TelnyxClient client = TelnyxOkHttpClient.fromEnv();

                    ConnectionListPage page = client.connections().list();
                }
            }
        - lang: Ruby
          source: |-
            require "telnyx"

            telnyx = Telnyx::Client.new(api_key: "My API Key")

            page = telnyx.connections.list

            puts(page)
        - lang: PHP
          source: >-
            <?php


            require_once dirname(__DIR__) . '/vendor/autoload.php';


            use Telnyx\Client;

            use Telnyx\Core\Exceptions\APIException;


            $client = new Client(apiKey: getenv('TELNYX_API_KEY') ?: 'My API
            Key');


            try {
              $page = $client->connections->list(
                filter: [
                  'connectionName' => ['contains' => 'contains'],
                  'fqdn' => 'fqdn',
                  'outboundVoiceProfileID' => '1293384261075731499',
                ],
                pageNumber: 0,
                pageSize: 0,
                sort: 'connection_name',
              );

              var_dump($page);
            } catch (APIException $e) {
              echo $e->getMessage();
            }
        - lang: CLI
          source: |-
            telnyx connections list \
              --api-key 'My API Key'
components:
  parameters:
    connections_FilterConsolidated:
      name: filter
      in: query
      style: deepObject
      explode: true
      description: >-
        Consolidated filter parameter (deepObject style). Originally:
        filter[connection_name], filter[fqdn],
        filter[outbound_voice_profile_id],
        filter[outbound.outbound_voice_profile_id]
      schema:
        type: object
        properties:
          connection_name:
            type: object
            description: Filter by connection_name using nested operations
            properties:
              contains:
                type: string
                default: null
                description: >-
                  If present, connections with <code>connection_name</code>
                  containing the given value will be returned. Matching is not
                  case-sensitive. Requires at least three characters.
          fqdn:
            type: string
            default: null
            description: >-
              If present, connections with an `fqdn` that equals the given value
              will be returned. Matching is case-sensitive, and the full string
              must match.
          outbound_voice_profile_id:
            type: string
            example: '1293384261075731499'
            description: Identifies the associated outbound voice profile.
            x-format: int64
    connections_PageConsolidated:
      name: page
      in: query
      style: deepObject
      explode: true
      description: >-
        Consolidated page parameter (deepObject style). Originally: page[size],
        page[number]
      schema:
        type: object
        properties:
          size:
            type: integer
            minimum: 1
            maximum: 250
            default: 250
            description: The size of the page
          number:
            type: integer
            minimum: 1
            default: 1
            description: The page number to load
    connections_SortConnection:
      name: sort
      in: query
      description: >-
        Specifies the sort order for results. By default sorting direction is
        ascending. To have the results sorted in descending order add the <code>
        -</code> prefix.<br/><br/>

        That is: <ul>
          <li>
            <code>connection_name</code>: sorts the result by the
            <code>connection_name</code> field in ascending order.
          </li>

          <li>
            <code>-connection_name</code>: sorts the result by the
            <code>connection_name</code> field in descending order.
          </li>
        </ul> <br/> If not given, results are sorted by <code>created_at</code>
        in descending order.
      schema:
        type: string
        enum:
          - created_at
          - connection_name
          - active
        example: connection_name
        default: created_at
  responses:
    ListConnectionsResponse:
      description: Successful response with a list of connections.
      content:
        application/json:
          schema:
            type: object
            title: List Connections Response
            properties:
              data:
                type: array
                items:
                  $ref: '#/components/schemas/Connection'
              meta:
                $ref: '#/components/schemas/connections_PaginationMeta'
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
    connections_PaginationMeta:
      title: Pagination Meta
      type: object
      properties:
        total_pages:
          type: integer
          example: 3
        total_results:
          type: integer
          example: 55
        page_number:
          type: integer
          example: 2
        page_size:
          type: integer
          example: 25
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
  securitySchemes:
    bearerAuth:
      scheme: bearer
      type: http

````
