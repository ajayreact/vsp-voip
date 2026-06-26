---
title: "Update a stored credential"
source_url: "https://developers.telnyx.com/api-reference/call-recordings/update-a-stored-credential.md"
category: "recordings"
synced_at: "2026-06-25T18:43:29.405Z"
content_hash: "9e5d001e363114aa82a503d7afb51c3c063f9c84347e15a2a60c9fbb7b790bf0"
---
> ## Documentation Index
> Fetch the complete documentation index at: https://developers.telnyx.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Update a stored credential

> Updates a stored custom credentials configuration.



## OpenAPI

````yaml https://telnyx-openapi-ng.s3.us-east-1.amazonaws.com/real-time-communications/call-recordings.yml put /custom_storage_credentials/{connection_id}
openapi: 3.1.0
info:
  title: Telnyx Call Recordings API
  version: 2.0.0
  description: API for Call recordings.
  contact:
    email: support@telnyx.com
servers:
  - url: https://api.telnyx.com/v2
security:
  - bearerAuth: []
paths:
  /custom_storage_credentials/{connection_id}:
    put:
      tags:
        - Call Recordings
      summary: Update a stored credential
      description: Updates a stored custom credentials configuration.
      operationId: UpdateCustomStorageCredentials
      parameters:
        - $ref: '#/components/parameters/call-recordings_ConnectionId'
      requestBody:
        $ref: '#/components/requestBodies/CreateCredentialsRequest'
      responses:
        '200':
          description: A response containing a credentials resource.
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/CredentialsResponse'
        '401':
          $ref: '#/components/responses/call-recordings_UnauthorizedResponse'
        '404':
          $ref: '#/components/responses/call-recordings_NotFoundResponse'
        default:
          $ref: '#/components/responses/call-recordings_GenericErrorResponse'
      x-codeSamples:
        - lang: JavaScript
          source: >-
            import Telnyx from 'telnyx';


            const client = new Telnyx({
              apiKey: process.env['TELNYX_API_KEY'], // This is the default and can be omitted
            });


            const customStorageCredential = await
            client.customStorageCredentials.update('connection_id', {
              backend: 'gcs',
              configuration: { backend: 'gcs' },
            });


            console.log(customStorageCredential.connection_id);
        - lang: Python
          source: >-
            import os

            from telnyx import Telnyx


            client = Telnyx(
                api_key=os.environ.get("TELNYX_API_KEY"),  # This is the default and can be omitted
            )

            custom_storage_credential =
            client.custom_storage_credentials.update(
                connection_id="connection_id",
                backend="gcs",
                configuration={
                    "backend": "gcs"
                },
            )

            print(custom_storage_credential.connection_id)
        - lang: Go
          source: "package main\n\nimport (\n\t\"context\"\n\t\"fmt\"\n\n\t\"github.com/team-telnyx/telnyx-go\"\n\t\"github.com/team-telnyx/telnyx-go/option\"\n)\n\nfunc main() {\n\tclient := telnyx.NewClient(\n\t\toption.WithAPIKey(\"My API Key\"),\n\t)\n\tcustomStorageCredential, err := client.CustomStorageCredentials.Update(\n\t\tcontext.TODO(),\n\t\t\"connection_id\",\n\t\ttelnyx.CustomStorageCredentialUpdateParams{\n\t\t\tCustomStorageConfiguration: telnyx.CustomStorageConfigurationParam{\n\t\t\t\tBackend: telnyx.CustomStorageConfigurationBackendGcs,\n\t\t\t\tConfiguration: telnyx.CustomStorageConfigurationConfigurationUnionParam{\n\t\t\t\t\tOfGcs: &telnyx.GcsConfigurationDataParam{\n\t\t\t\t\t\tBackend: telnyx.GcsConfigurationDataBackendGcs,\n\t\t\t\t\t},\n\t\t\t\t},\n\t\t\t},\n\t\t},\n\t)\n\tif err != nil {\n\t\tpanic(err.Error())\n\t}\n\tfmt.Printf(\"%+v\\n\", customStorageCredential.ConnectionID)\n}\n"
        - lang: Java
          source: >-
            package com.telnyx.sdk.example;


            import com.telnyx.sdk.client.TelnyxClient;

            import com.telnyx.sdk.client.okhttp.TelnyxOkHttpClient;

            import
            com.telnyx.sdk.models.customstoragecredentials.CustomStorageConfiguration;

            import
            com.telnyx.sdk.models.customstoragecredentials.CustomStorageCredentialUpdateParams;

            import
            com.telnyx.sdk.models.customstoragecredentials.CustomStorageCredentialUpdateResponse;

            import
            com.telnyx.sdk.models.customstoragecredentials.GcsConfigurationData;


            public final class Main {
                private Main() {}

                public static void main(String[] args) {
                    TelnyxClient client = TelnyxOkHttpClient.fromEnv();

                    CustomStorageCredentialUpdateParams params = CustomStorageCredentialUpdateParams.builder()
                        .connectionId("connection_id")
                        .customStorageConfiguration(CustomStorageConfiguration.builder()
                            .backend(CustomStorageConfiguration.Backend.GCS)
                            .configuration(GcsConfigurationData.builder()
                                .backend(GcsConfigurationData.Backend.GCS)
                                .build())
                            .build())
                        .build();
                    CustomStorageCredentialUpdateResponse customStorageCredential = client.customStorageCredentials().update(params);
                }
            }
        - lang: Ruby
          source: >-
            require "telnyx"


            telnyx = Telnyx::Client.new(api_key: "My API Key")


            custom_storage_credential =
            telnyx.custom_storage_credentials.update("connection_id", backend:
            :gcs, configuration: {backend: :gcs})


            puts(custom_storage_credential)
        - lang: PHP
          source: >-
            <?php


            require_once dirname(__DIR__) . '/vendor/autoload.php';


            use Telnyx\Client;

            use Telnyx\Core\Exceptions\APIException;


            $client = new Client(apiKey: getenv('TELNYX_API_KEY') ?: 'My API
            Key');


            try {
              $customStorageCredential = $client->customStorageCredentials->update(
                'connection_id',
                backend: 'gcs',
                configuration: [
                  'backend' => 'gcs',
                  'bucket' => 'example-bucket',
                  'credentials' => 'OPAQUE_CREDENTIALS_TOKEN',
                ],
              );

              var_dump($customStorageCredential);
            } catch (APIException $e) {
              echo $e->getMessage();
            }
        - lang: CLI
          source: |-
            telnyx custom-storage-credentials update \
              --api-key 'My API Key' \
              --connection-id connection_id \
              --backend gcs \
              --configuration '{backend: gcs}'
components:
  parameters:
    call-recordings_ConnectionId:
      name: connection_id
      description: >-
        Uniquely identifies a Telnyx application (Call Control, TeXML) or Sip
        connection resource.
      in: path
      required: true
      schema:
        type: string
  requestBodies:
    CreateCredentialsRequest:
      description: Creates new credentials resource for the specified connection_id.
      required: true
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/CustomStorageConfiguration'
  schemas:
    CredentialsResponse:
      type: object
      title: CredentialsResponse
      required:
        - data
        - connection_id
        - record_type
      properties:
        data:
          $ref: '#/components/schemas/CustomStorageConfiguration'
        connection_id:
          $ref: '#/components/schemas/ConnectionIdCredentials'
        record_type:
          $ref: '#/components/schemas/RecordType'
    CustomStorageConfiguration:
      type: object
      title: Custom Storage Configuration
      required:
        - backend
        - configuration
      properties:
        backend:
          type: string
          enum:
            - gcs
            - s3
            - azure
          example: gcs
        configuration:
          oneOf:
            - $ref: '#/components/schemas/GCSConfigurationData'
            - $ref: '#/components/schemas/S3ConfigurationData'
            - $ref: '#/components/schemas/AzureConfigurationData'
          discriminator:
            propertyName: backend
            mapping:
              gcs:
                $ref: '#/components/schemas/GCSConfigurationData'
              s3:
                $ref: '#/components/schemas/S3ConfigurationData'
              azure:
                $ref: '#/components/schemas/AzureConfigurationData'
    ConnectionIdCredentials:
      type: string
      description: >-
        Uniquely identifies a Telnyx application (Call Control, TeXML) or Sip
        connection resource.
      example: '1234567890'
    RecordType:
      type: string
      description: Identifies record type.
      enum:
        - custom_storage_credentials
    call-recordings_Errors:
      properties:
        errors:
          type: array
          items:
            $ref: '#/components/schemas/call-recordings_Error'
      type: object
    GCSConfigurationData:
      type: object
      title: Google Cloud Storage Configuration Data
      properties:
        backend:
          type: string
          enum:
            - gcs
          description: Storage backend type
        credentials:
          $ref: '#/components/schemas/Credentials'
        bucket:
          $ref: '#/components/schemas/Bucket'
      required:
        - backend
    S3ConfigurationData:
      type: object
      title: AWS S3 Storage Configuration Data
      properties:
        backend:
          type: string
          enum:
            - s3
          description: Storage backend type
        bucket:
          $ref: '#/components/schemas/Bucket'
        region:
          $ref: '#/components/schemas/Region'
        aws_access_key_id:
          $ref: '#/components/schemas/AwsAccessKeyId'
        aws_secret_access_key:
          $ref: '#/components/schemas/AwsSecretAccessKey'
      required:
        - backend
    AzureConfigurationData:
      type: object
      title: Azure Blob Storage Configuration Data
      properties:
        backend:
          type: string
          enum:
            - azure
          description: Storage backend type
        bucket:
          $ref: '#/components/schemas/Bucket'
        account_name:
          $ref: '#/components/schemas/AzureAccountName'
        account_key:
          $ref: '#/components/schemas/AzureAccountKey'
      required:
        - backend
    call-recordings_Error:
      required:
        - code
        - title
      properties:
        code:
          type: string
          description: Error code identifier (string or numeric string).
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
            parameter:
              description: Indicates which query parameter caused the error.
              type: string
        meta:
          type: object
          additionalProperties: true
      type: object
    Credentials:
      description: >-
        Opaque credential token used to authenticate and authorize with storage
        provider.
      type: string
      example: OPAQUE_CREDENTIALS_TOKEN
    Bucket:
      description: Name of the bucket to be used to store recording files.
      type: string
      example: example-bucket
    Region:
      description: Region where the bucket is located.
      type: string
      example: us-east-1
    AwsAccessKeyId:
      description: AWS credentials access key id.
      type: string
      example: AKIAIOSFODNN7EXAMPLE
    AwsSecretAccessKey:
      description: AWS secret access key.
      type: string
      example: wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
    AzureAccountName:
      description: Azure Blob Storage account name.
      type: string
      example: my-account
    AzureAccountKey:
      description: Azure Blob Storage account key.
      type: string
      example: bPxRfiCYEXAMPLEKEY
  responses:
    call-recordings_UnauthorizedResponse:
      description: Unauthorized. The request lacks valid authentication credentials.
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/call-recordings_Errors'
          example:
            errors:
              - code: '401'
                title: Unauthorized
                detail: Unauthorized
    call-recordings_NotFoundResponse:
      description: Resource not found. The requested resource or URL could not be found.
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/call-recordings_Errors'
          examples:
            not_found:
              summary: Generic not found
              value:
                errors:
                  - code: '404'
                    title: Not Found
                    detail: Page not found
            connection_not_found:
              summary: Connection not found
              value:
                errors:
                  - code: '10005'
                    title: Resource not found
                    detail: The requested resource or URL could not be found.
                    source:
                      pointer: /connection_id
    call-recordings_GenericErrorResponse:
      description: Unexpected error.
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/call-recordings_Errors'
  securitySchemes:
    bearerAuth:
      scheme: bearer
      type: http

````
