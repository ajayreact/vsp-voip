---
title: "Update a credential"
source_url: "https://developers.telnyx.com/api-reference/credentials/update-a-credential.md"
category: "authentication"
synced_at: "2026-06-25T18:42:58.373Z"
content_hash: "8f1b3371faf0fae45c03d08f22023bf9ea68eba0e4d70e8ad563a0f9c0483838"
---
> ## Documentation Index
> Fetch the complete documentation index at: https://developers.telnyx.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Update a credential

> Update an existing credential.



## OpenAPI

````yaml https://telnyx-openapi-ng.s3.us-east-1.amazonaws.com/webrtc/sdk-client-credentials.yml patch /telephony_credentials/{id}
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
  /telephony_credentials/{id}:
    patch:
      tags:
        - Credentials
      summary: Update a credential
      description: Update an existing credential.
      operationId: UpdateTelephonyCredential
      parameters:
        - name: id
          in: path
          description: Identifies the resource.
          required: true
          schema:
            type: string
      requestBody:
        description: Parameters that can be updated in a credential
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/TelephonyCredentialUpdateRequest'
      responses:
        '200':
          description: Successful response with details about a credential
          content:
            application/json:
              schema:
                type: object
                title: Telephony Credential Response
                properties:
                  data:
                    $ref: '#/components/schemas/TelephonyCredential'
        '401':
          description: Unauthorized
        '404':
          description: Resource not found
        '422':
          description: Bad request
      x-codeSamples:
        - lang: JavaScript
          source: >-
            import Telnyx from 'telnyx';


            const client = new Telnyx({
              apiKey: process.env['TELNYX_API_KEY'], // This is the default and can be omitted
            });


            const telephonyCredential = await
            client.telephonyCredentials.update('id');


            console.log(telephonyCredential.data);
        - lang: Python
          source: |-
            import os
            from telnyx import Telnyx

            client = Telnyx(
                api_key=os.environ.get("TELNYX_API_KEY"),  # This is the default and can be omitted
            )
            telephony_credential = client.telephony_credentials.update(
                id="id",
            )
            print(telephony_credential.data)
        - lang: Go
          source: "package main\n\nimport (\n\t\"context\"\n\t\"fmt\"\n\n\t\"github.com/team-telnyx/telnyx-go\"\n\t\"github.com/team-telnyx/telnyx-go/option\"\n)\n\nfunc main() {\n\tclient := telnyx.NewClient(\n\t\toption.WithAPIKey(\"My API Key\"),\n\t)\n\ttelephonyCredential, err := client.TelephonyCredentials.Update(\n\t\tcontext.TODO(),\n\t\t\"id\",\n\t\ttelnyx.TelephonyCredentialUpdateParams{},\n\t)\n\tif err != nil {\n\t\tpanic(err.Error())\n\t}\n\tfmt.Printf(\"%+v\\n\", telephonyCredential.Data)\n}\n"
        - lang: Java
          source: >-
            package com.telnyx.sdk.example;


            import com.telnyx.sdk.client.TelnyxClient;

            import com.telnyx.sdk.client.okhttp.TelnyxOkHttpClient;

            import
            com.telnyx.sdk.models.telephonycredentials.TelephonyCredentialUpdateParams;

            import
            com.telnyx.sdk.models.telephonycredentials.TelephonyCredentialUpdateResponse;


            public final class Main {
                private Main() {}

                public static void main(String[] args) {
                    TelnyxClient client = TelnyxOkHttpClient.fromEnv();

                    TelephonyCredentialUpdateResponse telephonyCredential = client.telephonyCredentials().update("id");
                }
            }
        - lang: Ruby
          source: |-
            require "telnyx"

            telnyx = Telnyx::Client.new(api_key: "My API Key")

            telephony_credential = telnyx.telephony_credentials.update("id")

            puts(telephony_credential)
        - lang: PHP
          source: >-
            <?php


            require_once dirname(__DIR__) . '/vendor/autoload.php';


            use Telnyx\Client;

            use Telnyx\Core\Exceptions\APIException;


            $client = new Client(apiKey: getenv('TELNYX_API_KEY') ?: 'My API
            Key');


            try {
              $telephonyCredential = $client->telephonyCredentials->update(
                'id',
                connectionID: '987654321',
                expiresAt: '2018-02-02T22:25:27.521Z',
                name: 'My-new-updated-credential',
                tag: 'some_tag',
              );

              var_dump($telephonyCredential);
            } catch (APIException $e) {
              echo $e->getMessage();
            }
        - lang: CLI
          source: |-
            telnyx telephony-credentials update \
              --api-key 'My API Key' \
              --id id
components:
  schemas:
    TelephonyCredentialUpdateRequest:
      type: object
      title: TelephonyCredentialUpdateRequest
      properties:
        name:
          type: string
        tag:
          type: string
          description: >-
            Tags a credential. A single tag can hold at maximum 1000
            credentials.
          example: some_tag
        connection_id:
          type: string
          description: >-
            Identifies the Credential Connection this credential is associated
            with.
          example: '987654321'
        expires_at:
          type: string
          description: ISO-8601 formatted date indicating when the credential will expire.
          example: '2018-02-02T22:25:27.521Z'
      example:
        name: My-new-updated-credential
        connection_id: '987654321'
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
  securitySchemes:
    bearerAuth:
      scheme: bearer
      type: http

````
