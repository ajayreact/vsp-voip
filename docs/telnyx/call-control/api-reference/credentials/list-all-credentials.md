---
title: "List all credentials"
source_url: "https://developers.telnyx.com/api-reference/credentials/list-all-credentials.md"
category: "authentication"
synced_at: "2026-06-25T18:42:57.607Z"
content_hash: "d32b6fd0d704628087483eb2f88054339c82e07dd15bd781f9f5e17b0ed3a13c"
---
> ## Documentation Index
> Fetch the complete documentation index at: https://developers.telnyx.com/llms.txt
> Use this file to discover all available pages before exploring further.

# List all credentials

> List all On-demand Credentials.



## OpenAPI

````yaml https://telnyx-openapi-ng.s3.us-east-1.amazonaws.com/webrtc/sdk-client-credentials.yml get /telephony_credentials
openapi: 3.1.0
info:
  title: Telnyx SDK Client Credentials API
  version: 2.0.0
  description: API for managing WebRTC SDK client telephony credentials.
  contact:
    email: support@telnyx.com
servers:
  - url: https://api.telnyx.com/v2
security:
  - bearerAuth: []
paths:
  /telephony_credentials:
    get:
      tags:
        - Credentials
      summary: List all credentials
      description: List all On-demand Credentials.
      operationId: FindTelephonyCredentials
      parameters:
        - $ref: '#/components/parameters/telephony-credentials_PageConsolidated'
        - $ref: '#/components/parameters/telephony-credentials_FilterConsolidated'
      responses:
        '200':
          description: Successful response with multiple credentials
          content:
            application/json:
              schema:
                type: object
                title: Get All Telephony Credential Response
                properties:
                  data:
                    type: array
                    items:
                      $ref: '#/components/schemas/TelephonyCredential'
                  meta:
                    $ref: '#/components/schemas/PaginationMeta'
        '400':
          description: Bad request
        '401':
          description: Unauthorized
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

            for await (const telephonyCredential of
            client.telephonyCredentials.list()) {
              console.log(telephonyCredential.id);
            }
        - lang: Python
          source: |-
            import os
            from telnyx import Telnyx

            client = Telnyx(
                api_key=os.environ.get("TELNYX_API_KEY"),  # This is the default and can be omitted
            )
            page = client.telephony_credentials.list()
            page = page.data[0]
            print(page.id)
        - lang: Go
          source: "package main\n\nimport (\n\t\"context\"\n\t\"fmt\"\n\n\t\"github.com/team-telnyx/telnyx-go\"\n\t\"github.com/team-telnyx/telnyx-go/option\"\n)\n\nfunc main() {\n\tclient := telnyx.NewClient(\n\t\toption.WithAPIKey(\"My API Key\"),\n\t)\n\tpage, err := client.TelephonyCredentials.List(context.TODO(), telnyx.TelephonyCredentialListParams{})\n\tif err != nil {\n\t\tpanic(err.Error())\n\t}\n\tfmt.Printf(\"%+v\\n\", page)\n}\n"
        - lang: Java
          source: >-
            package com.telnyx.sdk.example;


            import com.telnyx.sdk.client.TelnyxClient;

            import com.telnyx.sdk.client.okhttp.TelnyxOkHttpClient;

            import
            com.telnyx.sdk.models.telephonycredentials.TelephonyCredentialListPage;

            import
            com.telnyx.sdk.models.telephonycredentials.TelephonyCredentialListParams;


            public final class Main {
                private Main() {}

                public static void main(String[] args) {
                    TelnyxClient client = TelnyxOkHttpClient.fromEnv();

                    TelephonyCredentialListPage page = client.telephonyCredentials().list();
                }
            }
        - lang: Ruby
          source: |-
            require "telnyx"

            telnyx = Telnyx::Client.new(api_key: "My API Key")

            page = telnyx.telephony_credentials.list

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
              $page = $client->telephonyCredentials->list(
                filter: [
                  'name' => 'name',
                  'resourceID' => 'resource_id',
                  'sipUsername' => 'sip_username',
                  'status' => 'status',
                  'tag' => 'tag',
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
            telnyx telephony-credentials list \
              --api-key 'My API Key'
components:
  parameters:
    telephony-credentials_PageConsolidated:
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
            default: 50
            description: The size of the page
    telephony-credentials_FilterConsolidated:
      name: filter
      in: query
      style: deepObject
      explode: true
      description: >-
        Consolidated filter parameter (deepObject style). Originally:
        filter[tag], filter[name], filter[status], filter[resource_id],
        filter[sip_username]
      schema:
        type: object
        properties:
          tag:
            type: string
            description: Filter by tag
          name:
            type: string
            description: Filter by name
          status:
            type: string
            description: Filter by status
          resource_id:
            type: string
            description: Filter by resource_id
          sip_username:
            type: string
            description: Filter by sip_username
  schemas:
    TelephonyCredential:
      type: object
      title: On-demand Credential
      properties:
        id:
          type: string
          description: Identifies the resource.
          example: c215ade3-0d39-418e-94be-c5f780760199
        record_type:
          type: string
          description: Identifies the type of the resource.
          example: credential
        name:
          type: string
        resource_id:
          type: string
          description: Identifies the resource this credential is associated with.
          example: connection:1234567890
        expired:
          type: boolean
          description: Defaults to false
        sip_username:
          type: string
          description: The randomly generated SIP username for the credential.
          example: gencrednCvHU5IYpSBPPsXI2iQsDX
        sip_password:
          type: string
          description: The randomly generated SIP password for the credential.
          example: a92dbcfb60184a8cb330b0acb2f7617b
        created_at:
          type: string
          description: ISO-8601 formatted date indicating when the resource was created.
          example: '2018-02-02T22:25:27.521Z'
        user_id:
          type: string
          description: Identifies the user this credential is associated with.
          example: user-id
        updated_at:
          type: string
          description: ISO-8601 formatted date indicating when the resource was updated.
          example: '2018-02-02T22:25:27.521Z'
        expires_at:
          type: string
          description: ISO-8601 formatted date indicating when the resource will expire.
          example: '2018-02-02T22:25:27.521Z'
      example:
        id: c215ade3-0d39-418e-94be-c5f780760199
        record_type: credential
        name: '2020-06-18 21:32:38.917732Z'
        expired: false
        user_id: user-id
        resource_id: connection:804252963366242252
        sip_password: a92dbcfb60184a8cb330b0acb2f7617b
        sip_username: gencrednCvHU5IYpSBPPsXI2iQsDX
        created_at: '2020-06-18T21:32:38'
        expires_at: '2042-06-18T21:32:38'
        updated_at: '2020-06-18T21:32:38.000Z'
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
  securitySchemes:
    bearerAuth:
      scheme: bearer
      type: http

````
