---
title: "List call control applications"
source_url: "https://developers.telnyx.com/api-reference/call-control-applications/list-call-control-applications.md"
category: "call-control"
synced_at: "2026-06-25T18:43:06.550Z"
content_hash: "58c5b3af1fe426d900fec8dc5a5ed8a8ff8086f104606716d50e21503691f0b8"
---
> ## Documentation Index
> Fetch the complete documentation index at: https://developers.telnyx.com/llms.txt
> Use this file to discover all available pages before exploring further.

# List call control applications

> Return a list of call control applications.



## OpenAPI

````yaml https://telnyx-openapi-ng.s3.us-east-1.amazonaws.com/call-control/applications.yml get /call_control_applications
openapi: 3.1.0
info:
  title: Telnyx Call Control Applications API
  version: 2.0.0
  description: API for managing Call Control Applications.
  contact:
    email: support@telnyx.com
servers:
  - url: https://api.telnyx.com/v2
security:
  - bearerAuth: []
paths:
  /call_control_applications:
    get:
      tags:
        - Call Control Applications
      summary: List call control applications
      description: Return a list of call control applications.
      operationId: ListCallControlApplications
      parameters:
        - $ref: '#/components/parameters/call-control_FilterConsolidated'
        - $ref: '#/components/parameters/call-control_PageConsolidated'
        - $ref: '#/components/parameters/SortConnection'
      responses:
        '200':
          description: Successful response with a list of call control applications.
          content:
            application/json:
              schema:
                type: object
                title: List Call Control Applications Response
                properties:
                  data:
                    type: array
                    items:
                      $ref: '#/components/schemas/CallControlApplication'
                  meta:
                    $ref: '#/components/schemas/PaginationMeta'
        '400':
          description: Bad request
        '401':
          $ref: '#/components/responses/UnauthorizedResponse'
        '404':
          description: Resource not found
      x-codeSamples:
        - lang: JavaScript
          source: >-
            import Telnyx from 'telnyx';


            const client = new Telnyx({
              apiKey: process.env['TELNYX_API_KEY'], // This is the default and can be omitted
            });


            // Automatically fetches more pages as needed.

            for await (const callControlApplication of
            client.callControlApplications.list()) {
              console.log(callControlApplication.id);
            }
        - lang: Python
          source: |-
            import os
            from telnyx import Telnyx

            client = Telnyx(
                api_key=os.environ.get("TELNYX_API_KEY"),  # This is the default and can be omitted
            )
            page = client.call_control_applications.list()
            page = page.data[0]
            print(page.id)
        - lang: Go
          source: "package main\n\nimport (\n\t\"context\"\n\t\"fmt\"\n\n\t\"github.com/team-telnyx/telnyx-go\"\n\t\"github.com/team-telnyx/telnyx-go/option\"\n)\n\nfunc main() {\n\tclient := telnyx.NewClient(\n\t\toption.WithAPIKey(\"My API Key\"),\n\t)\n\tpage, err := client.CallControlApplications.List(context.TODO(), telnyx.CallControlApplicationListParams{})\n\tif err != nil {\n\t\tpanic(err.Error())\n\t}\n\tfmt.Printf(\"%+v\\n\", page)\n}\n"
        - lang: Java
          source: >-
            package com.telnyx.sdk.example;


            import com.telnyx.sdk.client.TelnyxClient;

            import com.telnyx.sdk.client.okhttp.TelnyxOkHttpClient;

            import
            com.telnyx.sdk.models.callcontrolapplications.CallControlApplicationListPage;

            import
            com.telnyx.sdk.models.callcontrolapplications.CallControlApplicationListParams;


            public final class Main {
                private Main() {}

                public static void main(String[] args) {
                    TelnyxClient client = TelnyxOkHttpClient.fromEnv();

                    CallControlApplicationListPage page = client.callControlApplications().list();
                }
            }
        - lang: Ruby
          source: |-
            require "telnyx"

            telnyx = Telnyx::Client.new(api_key: "My API Key")

            page = telnyx.call_control_applications.list

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
              $page = $client->callControlApplications->list(
                filter: [
                  'applicationName' => ['contains' => 'contains'],
                  'applicationSessionID' => '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e',
                  'connectionID' => 'connection_id',
                  'failed' => false,
                  'from' => '+12025550142',
                  'legID' => '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e',
                  'name' => 'name',
                  'occurredAt' => [
                    'eq' => '2019-03-29T11:10:00Z',
                    'gt' => '2019-03-29T11:10:00Z',
                    'gte' => '2019-03-29T11:10:00Z',
                    'lt' => '2019-03-29T11:10:00Z',
                    'lte' => '2019-03-29T11:10:00Z',
                  ],
                  'outboundOutboundVoiceProfileID' => '1293384261075731499',
                  'product' => 'texml',
                  'status' => 'init',
                  'to' => '+12025550142',
                  'type' => 'webhook',
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
            telnyx call-control-applications list \
              --api-key 'My API Key'
components:
  parameters:
    call-control_FilterConsolidated:
      name: filter
      in: query
      style: deepObject
      explode: true
      description: >-
        Consolidated filter parameter (deepObject style). Originally:
        filter[application_name][contains],
        filter[outbound.outbound_voice_profile_id], filter[leg_id],
        filter[application_session_id], filter[connection_id], filter[product],
        filter[failed], filter[from], filter[to], filter[name], filter[type],
        filter[occurred_at][eq/gt/gte/lt/lte], filter[status]
      schema:
        type: object
        properties:
          application_name:
            type: object
            description: Application name filters
            properties:
              contains:
                type: string
                default: 'null'
                description: >-
                  If present, applications with <code>application_name</code>
                  containing the given value will be returned. Matching is not
                  case-sensitive. Requires at least three characters.
            additionalProperties: false
          outbound.outbound_voice_profile_id:
            type: string
            description: Identifies the associated outbound voice profile.
            example: '1293384261075731499'
            x-format: int64
          leg_id:
            type: string
            format: uuid
            description: The unique identifier of an individual call leg.
          application_session_id:
            type: string
            format: uuid
            description: >-
              The unique identifier of the call session. A session may include
              multiple call leg events.
          connection_id:
            type: string
            description: The unique identifier of the conection.
          product:
            type: string
            enum:
              - call_control
              - fax
              - texml
            example: texml
            description: Filter by product.
          failed:
            type: boolean
            example: false
            description: Delivery failed or not.
          from:
            type: string
            example: '+12025550142'
            description: Filter by From number.
          to:
            type: string
            example: '+12025550142'
            description: Filter by To number.
          name:
            type: string
            description: >-
              If present, conferences will be filtered to those with a matching
              `name` attribute. Matching is case-sensitive
          type:
            type: string
            enum:
              - command
              - webhook
            example: webhook
            description: Event type
          occurred_at:
            type: object
            description: Event occurred_at filters
            properties:
              eq:
                type: string
                example: '2019-03-29T11:10:00Z'
                description: 'Event occurred_at: equal'
              gt:
                type: string
                example: '2019-03-29T11:10:00Z'
                description: 'Event occurred_at: greater than'
              gte:
                type: string
                example: '2019-03-29T11:10:00Z'
                description: 'Event occurred_at: greater than or equal'
              lt:
                type: string
                example: '2019-03-29T11:10:00Z'
                description: 'Event occurred_at: lower than'
              lte:
                type: string
                example: '2019-03-29T11:10:00Z'
                description: 'Event occurred_at: lower than or equal'
            additionalProperties: false
          status:
            type: string
            enum:
              - init
              - in_progress
              - completed
            description: If present, conferences will be filtered by status.
    call-control_PageConsolidated:
      name: page
      in: query
      style: deepObject
      explode: true
      description: >-
        Consolidated page parameter (deepObject style). Originally: page[after],
        page[before], page[limit], page[size], page[number]
      schema:
        type: object
        properties:
          after:
            type: string
            default: 'null'
            description: Opaque identifier of next page
          before:
            type: string
            default: 'null'
            description: Opaque identifier of previous page
          limit:
            type: integer
            minimum: 1
            maximum: 250
            default: 20
            description: Limit of records per single page
          size:
            type: integer
            minimum: 1
            maximum: 250
            default: 20
            description: The size of the page
          number:
            type: integer
            minimum: 1
            default: 1
            description: The page number to load
    SortConnection:
      name: sort
      in: query
      required: false
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
  schemas:
    CallControlApplication:
      type: object
      title: Call Control Application
      properties:
        active:
          type: boolean
          description: Specifies whether the connection can be used.
          default: true
        anchorsite_override:
          type: string
          description: >
            <code>Latency</code> directs Telnyx to route media through the site
            with the lowest round-trip time to the user's connection. Telnyx
            calculates this time using ICMP ping messages. This can be disabled
            by specifying a site to handle all media.
          enum:
            - Latency
            - Chicago, IL
            - Ashburn, VA
            - San Jose, CA
            - London, UK
            - Chennai, IN
            - Amsterdam, Netherlands
            - Toronto, Canada
            - Sydney, Australia
          example: Amsterdam, Netherlands
          default: Latency
        application_name:
          type: string
          description: A user-assigned name to help manage the application.
          example: call-router
        created_at:
          type: string
          description: ISO 8601 formatted date of when the resource was created
          example: '2018-02-02T22:25:27.521Z'
        dtmf_type:
          type: string
          description: >-
            Sets the type of DTMF digits sent from Telnyx to this Connection.
            Note that DTMF digits sent to Telnyx will be accepted in all
            formats.
          enum:
            - RFC 2833
            - Inband
            - SIP INFO
          example: Inband
          default: RFC 2833
        first_command_timeout:
          type: boolean
          description: >-
            Specifies whether calls to phone numbers associated with this
            connection should hangup after timing out.
          example: true
          default: false
        first_command_timeout_secs:
          type: integer
          description: Specifies how many seconds to wait before timing out a dial command.
          example: 10
          default: 30
        tags:
          type: array
          items:
            type: string
          description: Tags assigned to the Call Control Application.
        id:
          type: string
          example: '1293384261075731499'
          x-format: int64
        inbound:
          $ref: '#/components/schemas/CallControlApplicationInbound'
        outbound:
          $ref: '#/components/schemas/CallControlApplicationOutbound'
        record_type:
          type: string
          enum:
            - call_control_application
          default: call_control_application
        updated_at:
          type: string
          description: ISO 8601 formatted date of when the resource was last updated
          example: '2018-02-02T22:25:27.521Z'
        webhook_api_version:
          type: string
          description: Determines which webhook format will be used, Telnyx API v1 or v2.
          enum:
            - '1'
            - '2'
          example: '1'
          default: '1'
        webhook_event_failover_url:
          type:
            - string
            - 'null'
          format: url
          description: >-
            The failover URL where webhooks related to this connection will be
            sent if sending to the primary URL fails. Must include a scheme,
            such as `https`.
          example: https://failover.example.com
          default: ''
        webhook_event_url:
          type: string
          format: url
          description: >-
            The URL where webhooks related to this connection will be sent. Must
            include a scheme, such as `https`.
          example: https://example.com
        webhook_timeout_secs:
          type:
            - integer
            - 'null'
          minimum: 0
          maximum: 30
          example: 25
          default: null
        call_cost_in_webhooks:
          type: boolean
          description: >-
            Specifies if call cost webhooks should be sent for this Call Control
            Application.
          default: false
        redact_dtmf_debug_logging:
          type: boolean
          description: >-
            When enabled, DTMF digits entered by users will be redacted in debug
            logs to protect PII data entered through IVR interactions.
          example: true
          default: false
      example:
        active: false
        anchorsite_override: Latency
        application_name: call-router
        created_at: '2018-02-02T22:25:27.521Z'
        dtmf_type: Inband
        first_command_timeout: true
        first_command_timeout_secs: 10
        id: '1293384261075731499'
        inbound:
          channel_limit: 10
          shaken_stir_enabled: true
          sip_subdomain: example
          sip_subdomain_receive_settings: only_my_connections
        outbound:
          channel_limit: 10
          outbound_voice_profile_id: '1293384261075731499'
        record_type: call_control_application
        updated_at: '2018-02-02T22:25:27.521Z'
        webhook_api_version: '1'
        webhook_event_failover_url: https://failover.example.com
        webhook_event_url: https://example.com
        webhook_timeout_secs: 25
        call_cost_in_webhooks: false
        redact_dtmf_debug_logging: true
    PaginationMeta:
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
    CallControlApplicationInbound:
      type: object
      title: Call Control Application Inbound
      properties:
        channel_limit:
          type: integer
          description: >-
            When set, this will limit the total number of inbound calls to phone
            numbers associated with this connection.
          example: 10
          default: null
        shaken_stir_enabled:
          type: boolean
          description: >-
            When enabled Telnyx will include Shaken/Stir data in the Webhook for
            new inbound calls.
          default: false
          example: false
        sip_subdomain:
          type: string
          description: >-
            Specifies a subdomain that can be used to receive Inbound calls to a
            Connection, in the same way a phone number is used, from a SIP
            endpoint. Example: the subdomain "example.sip.telnyx.com" can be
            called from any SIP endpoint by using the SIP URI
            "sip:@example.sip.telnyx.com" where the user part can be any
            alphanumeric value. Please note TLS encrypted calls are not allowed
            for subdomain calls.
          example: example
          default: null
        sip_subdomain_receive_settings:
          type: string
          description: >-
            This option can be enabled to receive calls from: "Anyone" (any SIP
            endpoint in the public Internet) or "Only my connections" (any
            connection assigned to the same Telnyx user).
          enum:
            - only_my_connections
            - from_anyone
          example: only_my_connections
          default: from_anyone
    CallControlApplicationOutbound:
      type: object
      title: Call Control Application Outbound
      properties:
        channel_limit:
          type: integer
          description: >-
            When set, this will limit the total number of outbound calls to
            phone numbers associated with this connection.
          example: 10
          default: null
        outbound_voice_profile_id:
          type: string
          description: Identifies the associated outbound voice profile.
          example: '1293384261075731499'
          x-format: int64
    call-control_Errors:
      properties:
        errors:
          type: array
          items:
            $ref: '#/components/schemas/call-control_Error'
    call-control_Error:
      required:
        - code
        - title
      properties:
        code:
          type: string
          format: integer
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
    UnauthorizedResponse:
      description: >-
        Unauthorized. Authentication failed - the required authentication
        headers were either invalid or not included in the request.
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/call-control_Errors'
          example:
            errors:
              - code: '10009'
                title: Authentication failed
                detail: >-
                  The required authentication headers were either invalid or not
                  included in the request.
                meta:
                  url: https://developers.telnyx.com/docs/overview/errors/10009
  securitySchemes:
    bearerAuth:
      scheme: bearer
      type: http

````
