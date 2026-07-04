---
title: "List portout requests"
source_url: "https://developers.telnyx.com/api-reference/number-portout/list-portout-requests.md"
category: "phone-numbers"
synced_at: "2026-06-25T18:43:30.186Z"
content_hash: "405fef19ea7c23eeca1a6747fbc12d307d37466f45519366295c72ca96bb34d0"
---
> ## Documentation Index
> Fetch the complete documentation index at: https://developers.telnyx.com/llms.txt
> Use this file to discover all available pages before exploring further.

# List portout requests

> Returns the portout requests according to filters



## OpenAPI

````yaml https://telnyx-openapi-ng.s3.us-east-1.amazonaws.com/numbers-identity/portout.yml get /portouts
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
  /portouts:
    get:
      tags:
        - Number Portout
      summary: List portout requests
      description: Returns the portout requests according to filters
      operationId: ListPortoutRequest
      parameters:
        - $ref: '#/components/parameters/PageConsolidated'
        - name: filter
          in: query
          style: deepObject
          explode: true
          description: >-
            Consolidated filter parameter (deepObject style). Originally:
            filter[carrier_name], filter[country_code], filter[country_code_in],
            filter[foc_date], filter[inserted_at], filter[phone_number],
            filter[pon], filter[ported_out_at], filter[spid], filter[status],
            filter[status_in], filter[support_key]
          schema:
            type: object
            properties:
              carrier_name:
                type: string
                description: Filter by new carrier name.
              pon:
                type: string
                description: Filter by Port Order Number (PON).
              spid:
                type: string
                description: Filter by new carrier spid.
              status:
                type: string
                enum:
                  - pending
                  - authorized
                  - ported
                  - rejected
                  - rejected-pending
                  - canceled
                description: Filter by portout status.
              status_in:
                type: array
                items:
                  type: string
                  enum:
                    - pending
                    - authorized
                    - ported
                    - rejected
                    - rejected-pending
                    - canceled
                description: Filter by a list of portout statuses
              country_code:
                type: string
                description: Filter by 2-letter country code
                example: US
              country_code_in:
                type: array
                items:
                  type: string
                example:
                  - CA
                  - US
                description: Filter by a list of 2-letter country codes
              ported_out_at:
                type: object
                description: Filter by ported_out_at date range using nested operations
                properties:
                  gte:
                    type: string
                    format: date-time
                    example: '2024-09-04T00:00:00.000Z'
                    description: Filter by ported_out_at date greater than or equal.
                  lte:
                    type: string
                    format: date-time
                    example: '2024-09-04T00:00:00.000Z'
                    description: Filter by ported_out_at date less than or equal.
              inserted_at:
                type: object
                description: Filter by inserted_at date range using nested operations
                properties:
                  gte:
                    type: string
                    format: date-time
                    example: '2024-09-04T00:00:00.000Z'
                    description: Filter by inserted_at date greater than or equal.
                  lte:
                    type: string
                    format: date-time
                    example: '2024-09-04T00:00:00.000Z'
                    description: Filter by inserted_at date less than or equal.
              foc_date:
                type: string
                format: date-time
                example: '2024-09-04T00:00:00.000Z'
                description: Filter by foc_date. Matches all portouts with the same date
              phone_number:
                type: string
                example: '+13035551212'
                description: >-
                  Filter by a phone number on the portout. Matches all portouts
                  with the phone number
              support_key:
                type: string
                example: PO_abc123
                description: Filter by the portout's support_key
      responses:
        '200':
          description: Portout Response
          content:
            application/json:
              schema:
                type: object
                properties:
                  data:
                    type: array
                    items:
                      $ref: '#/components/schemas/PortoutDetails'
                  meta:
                    $ref: '#/components/schemas/Metadata'
        '401':
          description: Unauthorized
        '404':
          description: Resource not found
        '422':
          description: Unprocessable entity. Check message field in response for details.
      x-codeSamples:
        - lang: JavaScript
          source: |-
            import Telnyx from 'telnyx';

            const client = new Telnyx({
              apiKey: process.env['TELNYX_API_KEY'], // This is the default and can be omitted
            });

            // Automatically fetches more pages as needed.
            for await (const portoutDetails of client.portouts.list()) {
              console.log(portoutDetails.id);
            }
        - lang: Python
          source: |-
            import os
            from telnyx import Telnyx

            client = Telnyx(
                api_key=os.environ.get("TELNYX_API_KEY"),  # This is the default and can be omitted
            )
            page = client.portouts.list()
            page = page.data[0]
            print(page.id)
        - lang: Go
          source: "package main\n\nimport (\n\t\"context\"\n\t\"fmt\"\n\n\t\"github.com/team-telnyx/telnyx-go\"\n\t\"github.com/team-telnyx/telnyx-go/option\"\n)\n\nfunc main() {\n\tclient := telnyx.NewClient(\n\t\toption.WithAPIKey(\"My API Key\"),\n\t)\n\tpage, err := client.Portouts.List(context.TODO(), telnyx.PortoutListParams{})\n\tif err != nil {\n\t\tpanic(err.Error())\n\t}\n\tfmt.Printf(\"%+v\\n\", page)\n}\n"
        - lang: Java
          source: |-
            package com.telnyx.sdk.example;

            import com.telnyx.sdk.client.TelnyxClient;
            import com.telnyx.sdk.client.okhttp.TelnyxOkHttpClient;
            import com.telnyx.sdk.models.portouts.PortoutListPage;
            import com.telnyx.sdk.models.portouts.PortoutListParams;

            public final class Main {
                private Main() {}

                public static void main(String[] args) {
                    TelnyxClient client = TelnyxOkHttpClient.fromEnv();

                    PortoutListPage page = client.portouts().list();
                }
            }
        - lang: Ruby
          source: |-
            require "telnyx"

            telnyx = Telnyx::Client.new(api_key: "My API Key")

            page = telnyx.portouts.list

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
              $page = $client->portouts->list(
                filter: [
                  'carrierName' => 'carrier_name',
                  'countryCode' => 'US',
                  'countryCodeIn' => ['CA', 'US'],
                  'focDate' => new \DateTimeImmutable('2024-09-04T00:00:00.000Z'),
                  'insertedAt' => [
                    'gte' => new \DateTimeImmutable('2024-09-04T00:00:00.000Z'),
                    'lte' => new \DateTimeImmutable('2024-09-04T00:00:00.000Z'),
                  ],
                  'phoneNumber' => '+13035551212',
                  'pon' => 'pon',
                  'portedOutAt' => [
                    'gte' => new \DateTimeImmutable('2024-09-04T00:00:00.000Z'),
                    'lte' => new \DateTimeImmutable('2024-09-04T00:00:00.000Z'),
                  ],
                  'spid' => 'spid',
                  'status' => 'pending',
                  'statusIn' => ['pending'],
                  'supportKey' => 'PO_abc123',
                ],
                pageNumber: 0,
                pageSize: 0,
              );

              var_dump($page);
            } catch (APIException $e) {
              echo $e->getMessage();
            }
        - lang: CLI
          source: |-
            telnyx portouts list \
              --api-key 'My API Key'
components:
  parameters:
    PageConsolidated:
      name: page
      in: query
      style: deepObject
      explode: true
      description: >-
        Consolidated page parameter (deepObject style). Originally:
        page[number], page[size]
      schema:
        type: object
        properties:
          number:
            type: integer
            minimum: 1
            default: 1
            description: The page number to load
          size:
            type: integer
            minimum: 1
            maximum: 250
            default: 20
            description: The size of the page
  schemas:
    PortoutDetails:
      type: object
      properties:
        id:
          type: string
          example: 0ccc7b54-4df3-4bca-a65a-3da1ecc777f0
        record_type:
          type: string
          description: Identifies the type of the resource.
          readOnly: true
          example: portout
        phone_numbers:
          description: Phone numbers associated with this portout
          type: array
          items:
            type: string
            description: E164 formatted phone number
          example:
            - '+35312345678'
        authorized_name:
          type: string
          description: Name of person authorizing the porting order
          example: McPortersen
        carrier_name:
          type: string
          description: Carrier the number will be ported out to
          example: test
        current_carrier:
          type: string
          description: The current carrier
          example: telnyx
        end_user_name:
          type: string
          description: Person name or company name requesting the port
          example: McPortersen
        city:
          type: string
          description: City or municipality of billing address
          example: Chicago
        state:
          type: string
          description: State, province, or similar of billing address
          example: IL
        zip:
          type: string
          description: Postal Code of billing address
          example: '00000'
        lsr:
          type: array
          description: The Local Service Request
          items:
            type: string
            format: uri
            description: A link to the Local Service Request
          example:
            - https://example.com/files/lsr.pdf
        pon:
          type: string
          description: >-
            Port order number assigned by the carrier the number will be ported
            out to
          example: '00000000'
        reason:
          type:
            - string
            - 'null'
          description: >-
            The reason why the order is being rejected by the user. If the order
            is authorized, this field can be left null
          example: null
        rejection_code:
          type: integer
          description: >-
            The rejection code for one of the valid rejections to reject a port
            out order
          example: 1002
        service_address:
          type: string
          description: First line of billing address (street address)
          example: 000 Example Street
        foc_date:
          type: string
          description: ISO 8601 formatted Date/Time of the FOC date
          example: '2018-02-02T22:25:27.521Z'
        requested_foc_date:
          type: string
          description: ISO 8601 formatted Date/Time of the user requested FOC date
          example: '2018-02-02T22:25:27.521Z'
        spid:
          type: string
          description: New service provider spid
          example: 0ccc7b54-4df3-4bca-a65a-3da1ecc777f0
        support_key:
          type: string
          description: >-
            A key to reference this port out request when contacting Telnyx
            customer support
          example: PO_764725
        status:
          type: string
          description: Status of portout request
          enum:
            - pending
            - authorized
            - ported
            - rejected
            - rejected-pending
            - canceled
          example: rejected
        already_ported:
          type: boolean
          description: Is true when the number is already ported
          example: false
        user_id:
          type: string
          format: uuid
          description: Identifies the user (or organization) who requested the port out
          example: 7865816a-ee85-4e50-b19e-52983dcc6d4a
        vendor:
          type: string
          description: Telnyx partner providing network coverage
          format: uuid
          example: 0e66ed3b-37e6-4fed-93d6-a30ce2493661
        created_at:
          type: string
          description: ISO 8601 formatted date of when the portout was created
          example: '2018-02-02T22:25:27.521Z'
        inserted_at:
          type: string
          description: ISO 8601 formatted date of when the portout was created
          example: '2018-02-02T22:25:27.521Z'
        updated_at:
          type: string
          description: ISO 8601 formatted date of when the portout was last updated
          example: '2018-02-02T22:25:27.521Z'
        host_messaging:
          type: boolean
          description: >-
            Indicates whether messaging services should be maintained with
            Telnyx after the port out completes
          default: false
          example: false
    Metadata:
      type: object
      title: Metadata
      properties:
        total_pages:
          type: number
          description: Total number of pages based on pagination settings
          example: 13
          format: integer
        total_results:
          type: number
          description: Total number of results
          example: 13
          format: integer
        page_number:
          type: number
          description: >-
            Current Page based on pagination settings (included when defaults
            are used.)
          example: 3
          format: integer
        page_size:
          type: number
          description: >-
            Number of results to return per page based on pagination settings
            (included when defaults are used.)
          example: 1
          format: integer
  securitySchemes:
    bearerAuth:
      scheme: bearer
      type: http

````
