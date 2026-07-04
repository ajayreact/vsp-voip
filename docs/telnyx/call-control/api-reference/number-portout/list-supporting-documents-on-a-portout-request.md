---
title: "List supporting documents on a portout request"
source_url: "https://developers.telnyx.com/api-reference/number-portout/list-supporting-documents-on-a-portout-request.md"
category: "phone-numbers"
synced_at: "2026-06-25T18:43:31.447Z"
content_hash: "8800e6df60d3338b424164e807c33552d28384c2de54c8c5f29bf321eec3aad5"
---
> ## Documentation Index
> Fetch the complete documentation index at: https://developers.telnyx.com/llms.txt
> Use this file to discover all available pages before exploring further.

# List supporting documents on a portout request

> List every supporting documents for a portout request.



## OpenAPI

````yaml https://telnyx-openapi-ng.s3.us-east-1.amazonaws.com/numbers-identity/portout.yml get /portouts/{id}/supporting_documents
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
  /portouts/{id}/supporting_documents:
    get:
      tags:
        - Number Portout
      summary: List supporting documents on a portout request
      description: List every supporting documents for a portout request.
      operationId: GetPortRequestSupportingDocuments
      parameters:
        - name: id
          in: path
          description: Portout id
          required: true
          schema:
            type: string
            format: uuid
      responses:
        '201':
          description: Portout Supporting Documents
          content:
            application/json:
              schema:
                type: object
                properties:
                  data:
                    type: array
                    items:
                      $ref: '#/components/schemas/PortOutSupportingDocument'
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


            const supportingDocuments = await
            client.portouts.supportingDocuments.list(
              '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e',
            );


            console.log(supportingDocuments.data);
        - lang: Python
          source: |-
            import os
            from telnyx import Telnyx

            client = Telnyx(
                api_key=os.environ.get("TELNYX_API_KEY"),  # This is the default and can be omitted
            )
            supporting_documents = client.portouts.supporting_documents.list(
                "182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e",
            )
            print(supporting_documents.data)
        - lang: Go
          source: "package main\n\nimport (\n\t\"context\"\n\t\"fmt\"\n\n\t\"github.com/team-telnyx/telnyx-go\"\n\t\"github.com/team-telnyx/telnyx-go/option\"\n)\n\nfunc main() {\n\tclient := telnyx.NewClient(\n\t\toption.WithAPIKey(\"My API Key\"),\n\t)\n\tsupportingDocuments, err := client.Portouts.SupportingDocuments.List(context.TODO(), \"182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e\")\n\tif err != nil {\n\t\tpanic(err.Error())\n\t}\n\tfmt.Printf(\"%+v\\n\", supportingDocuments.Data)\n}\n"
        - lang: Java
          source: >-
            package com.telnyx.sdk.example;


            import com.telnyx.sdk.client.TelnyxClient;

            import com.telnyx.sdk.client.okhttp.TelnyxOkHttpClient;

            import
            com.telnyx.sdk.models.portouts.supportingdocuments.SupportingDocumentListParams;

            import
            com.telnyx.sdk.models.portouts.supportingdocuments.SupportingDocumentListResponse;


            public final class Main {
                private Main() {}

                public static void main(String[] args) {
                    TelnyxClient client = TelnyxOkHttpClient.fromEnv();

                    SupportingDocumentListResponse supportingDocuments = client.portouts().supportingDocuments().list("182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e");
                }
            }
        - lang: Ruby
          source: >-
            require "telnyx"


            telnyx = Telnyx::Client.new(api_key: "My API Key")


            supporting_documents =
            telnyx.portouts.supporting_documents.list("182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e")


            puts(supporting_documents)
        - lang: PHP
          source: >-
            <?php


            require_once dirname(__DIR__) . '/vendor/autoload.php';


            use Telnyx\Client;

            use Telnyx\Core\Exceptions\APIException;


            $client = new Client(apiKey: getenv('TELNYX_API_KEY') ?: 'My API
            Key');


            try {
              $supportingDocuments = $client->portouts->supportingDocuments->list(
                '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e'
              );

              var_dump($supportingDocuments);
            } catch (APIException $e) {
              echo $e->getMessage();
            }
        - lang: CLI
          source: |-
            telnyx portouts:supporting-documents list \
              --api-key 'My API Key' \
              --id 182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e
components:
  schemas:
    PortOutSupportingDocument:
      required:
        - id
        - record_type
        - type
        - portout_id
        - document_id
        - created_at
        - updated_at
      properties:
        id:
          type: string
          format: uuid
          example: 5a16902a-2ee9-4882-a247-420fc6627b62
        record_type:
          type: string
          description: Identifies the type of the resource.
          readOnly: true
          example: supporting_document
        type:
          type: string
          enum:
            - loa
            - invoice
          description: Identifies the type of the document
          readOnly: true
          example: loa
        portout_id:
          type: string
          format: uuid
          description: Identifies the associated port request
          readOnly: true
          example: 0ccc7b54-4df3-4bca-a65a-3da1ecc777f0
        document_id:
          format: uuid
          type: string
          description: Identifies the associated document
          example: f1c5e079-9d82-4f50-95bc-ae2f6b8d84d7
        created_at:
          type: string
          description: Supporting document creation timestamp in ISO 8601 format
          example: '2018-02-02T22:25:27.521Z'
        updated_at:
          type: string
          description: Supporting document last changed timestamp in ISO 8601 format
          example: '2018-02-02T22:25:27.521Z'
      example:
        id: 5a16902a-2ee9-4882-a247-420fc6627b62
        record_type: supporting_document
        type: loa
        portout_id: 0ccc7b54-4df3-4bca-a65a-3da1ecc777f0
        document_id: f1c5e079-9d82-4f50-95bc-ae2f6b8d84d7
        created_at: '2018-02-02T22:25:27.521Z'
        updated_at: '2018-02-02T22:25:27.521Z'
      type: object
  securitySchemes:
    bearerAuth:
      scheme: bearer
      type: http

````
