---
title: "Delete a credential"
source_url: "https://developers.telnyx.com/api-reference/credentials/delete-a-credential.md"
category: "authentication"
synced_at: "2026-06-25T18:42:58.596Z"
content_hash: "48f8bf5ff073b5fd3f373d79e2baf01aa485c38ac1064b1894a8ebe99af41691"
---
> ## Documentation Index
> Fetch the complete documentation index at: https://developers.telnyx.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Delete a credential

> Delete an existing credential.



## OpenAPI

````yaml https://telnyx-openapi-ng.s3.us-east-1.amazonaws.com/webrtc/sdk-client-credentials.yml delete /telephony_credentials/{id}
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
    delete:
      tags:
        - Credentials
      summary: Delete a credential
      description: Delete an existing credential.
      operationId: DeleteTelephonyCredential
      parameters:
        - name: id
          in: path
          description: Identifies the resource.
          required: true
          schema:
            type: string
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
            client.telephonyCredentials.delete('id');


            console.log(telephonyCredential.data);
        - lang: Python
          source: |-
            import os
            from telnyx import Telnyx

            client = Telnyx(
                api_key=os.environ.get("TELNYX_API_KEY"),  # This is the default and can be omitted
            )
            telephony_credential = client.telephony_credentials.delete(
                "id",
            )
            print(telephony_credential.data)
        - lang: Go
          source: "package main\n\nimport (\n\t\"context\"\n\t\"fmt\"\n\n\t\"github.com/team-telnyx/telnyx-go\"\n\t\"github.com/team-telnyx/telnyx-go/option\"\n)\n\nfunc main() {\n\tclient := telnyx.NewClient(\n\t\toption.WithAPIKey(\"My API Key\"),\n\t)\n\ttelephonyCredential, err := client.TelephonyCredentials.Delete(context.TODO(), \"id\")\n\tif err != nil {\n\t\tpanic(err.Error())\n\t}\n\tfmt.Printf(\"%+v\\n\", telephonyCredential.Data)\n}\n"
        - lang: Java
          source: >-
            package com.telnyx.sdk.example;


            import com.telnyx.sdk.client.TelnyxClient;

            import com.telnyx.sdk.client.okhttp.TelnyxOkHttpClient;

            import
            com.telnyx.sdk.models.telephonycredentials.TelephonyCredentialDeleteParams;

            import
            com.telnyx.sdk.models.telephonycredentials.TelephonyCredentialDeleteResponse;


            public final class Main {
                private Main() {}

                public static void main(String[] args) {
                    TelnyxClient client = TelnyxOkHttpClient.fromEnv();

                    TelephonyCredentialDeleteResponse telephonyCredential = client.telephonyCredentials().delete("id");
                }
            }
        - lang: Ruby
          source: |-
            require "telnyx"

            telnyx = Telnyx::Client.new(api_key: "My API Key")

            telephony_credential = telnyx.telephony_credentials.delete("id")

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
              $telephonyCredential = $client->telephonyCredentials->delete('id');

              var_dump($telephonyCredential);
            } catch (APIException $e) {
              echo $e->getMessage();
            }
        - lang: CLI
          source: |-
            telnyx telephony-credentials delete \
              --api-key 'My API Key' \
              --id id
components:
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
  securitySchemes:
    bearerAuth:
      scheme: bearer
      type: http

````
