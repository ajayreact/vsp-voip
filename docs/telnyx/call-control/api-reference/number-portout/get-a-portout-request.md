---
title: "Get a portout request"
source_url: "https://developers.telnyx.com/api-reference/number-portout/get-a-portout-request.md"
category: "phone-numbers"
synced_at: "2026-06-25T18:43:30.414Z"
content_hash: "c26ba47ed1af18fb462bbb928b2bee92609ad309f035a34c1c863a5f3414188b"
---
> ## Documentation Index
> Fetch the complete documentation index at: https://developers.telnyx.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Get a portout request

> Returns the portout request based on the ID provided



## OpenAPI

````yaml https://telnyx-openapi-ng.s3.us-east-1.amazonaws.com/numbers-identity/portout.yml get /portouts/{id}
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
  /portouts/{id}:
    get:
      tags:
        - Number Portout
      summary: Get a portout request
      description: Returns the portout request based on the ID provided
      operationId: FindPortoutRequest
      parameters:
        - name: id
          in: path
          description: Portout id
          required: true
          schema:
            type: string
            format: uuid
      responses:
        '200':
          description: Portout Response
          content:
            application/json:
              schema:
                type: object
                properties:
                  data:
                    $ref: '#/components/schemas/PortoutDetails'
        '401':
          description: Unauthorized
        '404':
          description: Resource not found
        '422':
          description: Unprocessable entity. Check message field in response for details.
      x-codeSamples:
        - lang: JavaScript
          source: >-
            import Telnyx from 'telnyx';


            const client = new Telnyx({
              apiKey: process.env['TELNYX_API_KEY'], // This is the default and can be omitted
            });


            const portout = await
            client.portouts.retrieve('182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e');


            console.log(portout.data);
        - lang: Python
          source: |-
            import os
            from telnyx import Telnyx

            client = Telnyx(
                api_key=os.environ.get("TELNYX_API_KEY"),  # This is the default and can be omitted
            )
            portout = client.portouts.retrieve(
                "182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e",
            )
            print(portout.data)
        - lang: Go
          source: "package main\n\nimport (\n\t\"context\"\n\t\"fmt\"\n\n\t\"github.com/team-telnyx/telnyx-go\"\n\t\"github.com/team-telnyx/telnyx-go/option\"\n)\n\nfunc main() {\n\tclient := telnyx.NewClient(\n\t\toption.WithAPIKey(\"My API Key\"),\n\t)\n\tportout, err := client.Portouts.Get(context.TODO(), \"182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e\")\n\tif err != nil {\n\t\tpanic(err.Error())\n\t}\n\tfmt.Printf(\"%+v\\n\", portout.Data)\n}\n"
        - lang: Java
          source: |-
            package com.telnyx.sdk.example;

            import com.telnyx.sdk.client.TelnyxClient;
            import com.telnyx.sdk.client.okhttp.TelnyxOkHttpClient;
            import com.telnyx.sdk.models.portouts.PortoutRetrieveParams;
            import com.telnyx.sdk.models.portouts.PortoutRetrieveResponse;

            public final class Main {
                private Main() {}

                public static void main(String[] args) {
                    TelnyxClient client = TelnyxOkHttpClient.fromEnv();

                    PortoutRetrieveResponse portout = client.portouts().retrieve("182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e");
                }
            }
        - lang: Ruby
          source: >-
            require "telnyx"


            telnyx = Telnyx::Client.new(api_key: "My API Key")


            portout =
            telnyx.portouts.retrieve("182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e")


            puts(portout)
        - lang: PHP
          source: >-
            <?php


            require_once dirname(__DIR__) . '/vendor/autoload.php';


            use Telnyx\Client;

            use Telnyx\Core\Exceptions\APIException;


            $client = new Client(apiKey: getenv('TELNYX_API_KEY') ?: 'My API
            Key');


            try {
              $portout = $client->portouts->retrieve(
                '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e'
              );

              var_dump($portout);
            } catch (APIException $e) {
              echo $e->getMessage();
            }
        - lang: CLI
          source: |-
            telnyx portouts retrieve \
              --api-key 'My API Key' \
              --id 182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e
components:
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
  securitySchemes:
    bearerAuth:
      scheme: bearer
      type: http

````
