---
title: "Creates a new mobile push credential"
source_url: "https://developers.telnyx.com/api-reference/push-credentials/creates-a-new-mobile-push-credential.md"
category: "authentication"
synced_at: "2026-06-25T18:42:59.431Z"
content_hash: "e76ffad6e71b277680da7cd26225a0a170df3f323b008d470a5b596ec563e0fe"
---
> ## Documentation Index
> Fetch the complete documentation index at: https://developers.telnyx.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Creates a new mobile push credential

> Creates a new mobile push credential



## OpenAPI

````yaml https://telnyx-openapi-ng.s3.us-east-1.amazonaws.com/webrtc/mobile-push-credentials.yml post /mobile_push_credentials
openapi: 3.1.0
info:
  title: Telnyx Mobile Push Credentials API
  version: 2.0.0
  description: API for managing mobile push credentials for WebRTC.
  contact:
    email: support@telnyx.com
servers:
  - url: https://api.telnyx.com/v2
security:
  - bearerAuth: []
paths:
  /mobile_push_credentials:
    post:
      tags:
        - Push Credentials
      summary: Creates a new mobile push credential
      description: Creates a new mobile push credential
      operationId: CreatePushCredential
      parameters: []
      requestBody:
        description: Mobile push credential parameters that need to be sent in the request
        content:
          application/json:
            schema:
              oneOf:
                - $ref: '#/components/schemas/CreateIosPushCredentialRequest'
                - $ref: '#/components/schemas/CreateAndroidPushCredentialRequest'
        required: true
      responses:
        '200':
          description: Mobile push credential created
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/PushCredentialResponse'
        '401':
          description: Unauthorized request
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/push-notifications_Errors'
        '422':
          description: Unable to process request
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/push-notifications_Errors'
      x-codeSamples:
        - lang: JavaScript
          source: >-
            import Telnyx from 'telnyx';


            const client = new Telnyx({
              apiKey: process.env['TELNYX_API_KEY'], // This is the default and can be omitted
            });


            const pushCredentialResponse = await
            client.mobilePushCredentials.create({
              createMobilePushCredentialRequest: {
                alias: 'LucyIosCredential',
                certificate:
                  '-----BEGIN CERTIFICATE----- MIIGVDCCBTKCAQEAsNlRJVZn9ZvXcECQm65czs... -----END CERTIFICATE-----',
                private_key:
                  '-----BEGIN RSA PRIVATE KEY----- MIIEpQIBAAKCAQEAsNlRJVZn9ZvXcECQm65czs... -----END RSA PRIVATE KEY-----',
                type: 'ios',
              },
            });


            console.log(pushCredentialResponse.data);
        - lang: Python
          source: |-
            import os
            from telnyx import Telnyx

            client = Telnyx(
                api_key=os.environ.get("TELNYX_API_KEY"),  # This is the default and can be omitted
            )
            push_credential_response = client.mobile_push_credentials.create(
                create_mobile_push_credential_request={
                    "alias": "LucyIosCredential",
                    "certificate": "-----BEGIN CERTIFICATE----- MIIGVDCCBTKCAQEAsNlRJVZn9ZvXcECQm65czs... -----END CERTIFICATE-----",
                    "private_key": "-----BEGIN RSA PRIVATE KEY----- MIIEpQIBAAKCAQEAsNlRJVZn9ZvXcECQm65czs... -----END RSA PRIVATE KEY-----",
                    "type": "ios",
                },
            )
            print(push_credential_response.data)
        - lang: Go
          source: "package main\n\nimport (\n\t\"context\"\n\t\"fmt\"\n\n\t\"github.com/team-telnyx/telnyx-go\"\n\t\"github.com/team-telnyx/telnyx-go/option\"\n)\n\nfunc main() {\n\tclient := telnyx.NewClient(\n\t\toption.WithAPIKey(\"My API Key\"),\n\t)\n\tpushCredentialResponse, err := client.MobilePushCredentials.New(context.TODO(), telnyx.MobilePushCredentialNewParams{\n\t\tOfIos: &telnyx.MobilePushCredentialNewParamsCreateMobilePushCredentialRequestIos{\n\t\t\tAlias:       \"LucyIosCredential\",\n\t\t\tCertificate: \"-----BEGIN CERTIFICATE----- MIIGVDCCBTKCAQEAsNlRJVZn9ZvXcECQm65czs... -----END CERTIFICATE-----\",\n\t\t\tPrivateKey:  \"-----BEGIN RSA PRIVATE KEY----- MIIEpQIBAAKCAQEAsNlRJVZn9ZvXcECQm65czs... -----END RSA PRIVATE KEY-----\",\n\t\t},\n\t})\n\tif err != nil {\n\t\tpanic(err.Error())\n\t}\n\tfmt.Printf(\"%+v\\n\", pushCredentialResponse.Data)\n}\n"
        - lang: Java
          source: >-
            package com.telnyx.sdk.example;


            import com.telnyx.sdk.client.TelnyxClient;

            import com.telnyx.sdk.client.okhttp.TelnyxOkHttpClient;

            import
            com.telnyx.sdk.models.mobilepushcredentials.MobilePushCredentialCreateParams;

            import
            com.telnyx.sdk.models.mobilepushcredentials.PushCredentialResponse;


            public final class Main {
                private Main() {}

                public static void main(String[] args) {
                    TelnyxClient client = TelnyxOkHttpClient.fromEnv();

                    MobilePushCredentialCreateParams.CreateMobilePushCredentialRequest.Ios params = MobilePushCredentialCreateParams.CreateMobilePushCredentialRequest.Ios.builder()
                        .alias("LucyIosCredential")
                        .certificate("-----BEGIN CERTIFICATE----- MIIGVDCCBTKCAQEAsNlRJVZn9ZvXcECQm65czs... -----END CERTIFICATE-----")
                        .privateKey("-----BEGIN RSA PRIVATE KEY----- MIIEpQIBAAKCAQEAsNlRJVZn9ZvXcECQm65czs... -----END RSA PRIVATE KEY-----")
                        .build();
                    PushCredentialResponse pushCredentialResponse = client.mobilePushCredentials().create(params);
                }
            }
        - lang: Ruby
          source: |-
            require "telnyx"

            telnyx = Telnyx::Client.new(api_key: "My API Key")

            push_credential_response = telnyx.mobile_push_credentials.create(
              create_mobile_push_credential_request: {
                alias: "LucyIosCredential",
                certificate: "-----BEGIN CERTIFICATE----- MIIGVDCCBTKCAQEAsNlRJVZn9ZvXcECQm65czs... -----END CERTIFICATE-----",
                private_key: "-----BEGIN RSA PRIVATE KEY----- MIIEpQIBAAKCAQEAsNlRJVZn9ZvXcECQm65czs... -----END RSA PRIVATE KEY-----",
                type: :ios
              }
            )

            puts(push_credential_response)
        - lang: PHP
          source: >-
            <?php


            require_once dirname(__DIR__) . '/vendor/autoload.php';


            use Telnyx\Client;

            use Telnyx\Core\Exceptions\APIException;


            $client = new Client(apiKey: getenv('TELNYX_API_KEY') ?: 'My API
            Key');


            try {
              $pushCredentialResponse = $client->mobilePushCredentials->create(
                createMobilePushCredentialRequest: [
                  'alias' => 'LucyIosCredential',
                  'certificate' => '-----BEGIN CERTIFICATE----- MIIGVDCCBTKCAQEAsNlRJVZn9ZvXcECQm65czs... -----END CERTIFICATE-----',
                  'privateKey' => '-----BEGIN RSA PRIVATE KEY----- MIIEpQIBAAKCAQEAsNlRJVZn9ZvXcECQm65czs... -----END RSA PRIVATE KEY-----',
                  'type' => 'ios',
                ],
              );

              var_dump($pushCredentialResponse);
            } catch (APIException $e) {
              echo $e->getMessage();
            }
        - lang: CLI
          source: |-
            telnyx mobile-push-credentials create \
              --api-key 'My API Key' \
              --create-mobile-push-credential-request "{alias: LucyIosCredential, certificate: '-----BEGIN CERTIFICATE----- MIIGVDCCBTKCAQEAsNlRJVZn9ZvXcECQm65czs... -----END CERTIFICATE-----', private_key: '-----BEGIN RSA PRIVATE KEY----- MIIEpQIBAAKCAQEAsNlRJVZn9ZvXcECQm65czs... -----END RSA PRIVATE KEY-----', type: ios}"
components:
  schemas:
    CreateIosPushCredentialRequest:
      type: object
      title: Create iOS push credential request
      required:
        - type
        - certificate
        - private_key
        - alias
      properties:
        type:
          description: Type of mobile push credential. Should be <code>ios</code> here
          type: string
          enum:
            - ios
        certificate:
          description: Certificate as received from APNs
          type: string
          example: >-
            -----BEGIN CERTIFICATE-----
            MIIGVDCCBTKCAQEAsNlRJVZn9ZvXcECQm65czs... -----END CERTIFICATE-----
        private_key:
          description: Corresponding private key to the certificate as received from APNs
          type: string
          example: >-
            -----BEGIN RSA PRIVATE KEY-----
            MIIEpQIBAAKCAQEAsNlRJVZn9ZvXcECQm65czs... -----END RSA PRIVATE
            KEY-----
        alias:
          description: Alias to uniquely identify the credential
          type: string
          example: LucyIosCredential
    CreateAndroidPushCredentialRequest:
      type: object
      title: Create Android Push Credential Request
      required:
        - type
        - project_account_json_file
        - alias
      properties:
        type:
          description: Type of mobile push credential. Should be <code>android</code> here
          type: string
          enum:
            - android
        project_account_json_file:
          description: Private key file in JSON format
          type: object
          example:
            private_key: BBBB0J56jd8kda:APA91vjb11BCjvxx3Jxja...
            client_email: account@customer.org
          additionalProperties: true
        alias:
          description: Alias to uniquely identify the credential
          type: string
          example: LucyAndroidCredential
    PushCredentialResponse:
      description: Success response with details about a push credential
      properties:
        data:
          $ref: '#/components/schemas/PushCredential'
      type: object
    push-notifications_Errors:
      properties:
        errors:
          type: array
          items:
            $ref: '#/components/schemas/push-notifications_Error'
      type: object
    PushCredential:
      type: object
      title: Successful response with details about a push credential
      required:
        - id
        - certificate
        - private_key
        - project_account_json_file
        - alias
        - type
        - record_type
        - created_at
        - updated_at
      properties:
        id:
          description: Unique identifier of a push credential
          type: string
          example: 0ccc7b54-4df3-4bcb-a65a-3da1ecc997d7
        certificate:
          description: Apple certificate for sending push notifications. For iOS only
          type: string
          example: >-
            -----BEGIN CERTIFICATE-----
            MIIGVDCCBTKCAQEAsNlRJVZn9ZvXcECQm65czs... -----END CERTIFICATE-----
        private_key:
          description: >-
            Apple private key for a given certificate for sending push
            notifications. For iOS only
          type: string
          example: >-
            -----BEGIN RSA PRIVATE KEY-----
            MIIEpQIBAAKCAQEAsNlRJVZn9ZvXcECQm65czs... -----END RSA PRIVATE
            KEY-----
        project_account_json_file:
          description: Google server key for sending push notifications. For Android only
          type: object
          example:
            private_key: BBBB0J56jd8kda:APA91vjb11BCjvxx3Jxja...
            client_email: account@customer.org
          additionalProperties: true
        alias:
          description: Alias to uniquely identify a credential
          type: string
          example: LucyCredential
        type:
          description: >-
            Type of mobile push credential. Either <code>ios</code> or
            <code>android</code>
          type: string
          example: ios
        record_type:
          type: string
          example: push_credential
          readOnly: true
        created_at:
          description: ISO 8601 timestamp when the room was created
          type: string
          format: date-time
          example: '2021-03-26T17:51:59.588408Z'
        updated_at:
          description: ISO 8601 timestamp when the room was updated.
          type: string
          format: date-time
          example: '2021-03-26T17:51:59.588408Z'
    push-notifications_Error:
      required:
        - code
        - title
      properties:
        code:
          type: string
          example: '10015'
        title:
          type: string
          example: Bad Request
        detail:
          type: string
          example: has already been taken
        source:
          type: object
          properties:
            pointer:
              description: JSON pointer (RFC6901) to the offending entity.
              type: string
              example: /mobile_push_credentials
            parameter:
              description: Indicates which query parameter caused the error.
              type: string
              example: application_name
        meta:
          type: object
          example:
            url: https://developers.telnyx.com/docs/overview/errors/10015
          additionalProperties: true
      type: object
  securitySchemes:
    bearerAuth:
      scheme: bearer
      type: http

````
