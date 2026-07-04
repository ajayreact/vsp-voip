---
title: "List all comments for a portout request"
source_url: "https://developers.telnyx.com/api-reference/number-portout/list-all-comments-for-a-portout-request.md"
category: "phone-numbers"
synced_at: "2026-06-25T18:43:30.685Z"
content_hash: "a36a52e78137566e178c0dd91ed21694b0ebde8f0588a71e07fc1856eb3685c1"
---
> ## Documentation Index
> Fetch the complete documentation index at: https://developers.telnyx.com/llms.txt
> Use this file to discover all available pages before exploring further.

# List all comments for a portout request

> Returns a list of comments for a portout request.



## OpenAPI

````yaml https://telnyx-openapi-ng.s3.us-east-1.amazonaws.com/numbers-identity/portout.yml get /portouts/{id}/comments
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
  /portouts/{id}/comments:
    get:
      tags:
        - Number Portout
      summary: List all comments for a portout request
      description: Returns a list of comments for a portout request.
      operationId: FindPortoutComments
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
          description: Portout Comments
          content:
            application/json:
              schema:
                type: object
                properties:
                  data:
                    type: array
                    items:
                      $ref: '#/components/schemas/PortoutComment'
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
          source: >-
            import Telnyx from 'telnyx';


            const client = new Telnyx({
              apiKey: process.env['TELNYX_API_KEY'], // This is the default and can be omitted
            });


            const comments = await
            client.portouts.comments.list('182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e');


            console.log(comments.data);
        - lang: Python
          source: |-
            import os
            from telnyx import Telnyx

            client = Telnyx(
                api_key=os.environ.get("TELNYX_API_KEY"),  # This is the default and can be omitted
            )
            comments = client.portouts.comments.list(
                "182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e",
            )
            print(comments.data)
        - lang: Go
          source: "package main\n\nimport (\n\t\"context\"\n\t\"fmt\"\n\n\t\"github.com/team-telnyx/telnyx-go\"\n\t\"github.com/team-telnyx/telnyx-go/option\"\n)\n\nfunc main() {\n\tclient := telnyx.NewClient(\n\t\toption.WithAPIKey(\"My API Key\"),\n\t)\n\tcomments, err := client.Portouts.Comments.List(context.TODO(), \"182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e\")\n\tif err != nil {\n\t\tpanic(err.Error())\n\t}\n\tfmt.Printf(\"%+v\\n\", comments.Data)\n}\n"
        - lang: Java
          source: |-
            package com.telnyx.sdk.example;

            import com.telnyx.sdk.client.TelnyxClient;
            import com.telnyx.sdk.client.okhttp.TelnyxOkHttpClient;
            import com.telnyx.sdk.models.portouts.comments.CommentListParams;
            import com.telnyx.sdk.models.portouts.comments.CommentListResponse;

            public final class Main {
                private Main() {}

                public static void main(String[] args) {
                    TelnyxClient client = TelnyxOkHttpClient.fromEnv();

                    CommentListResponse comments = client.portouts().comments().list("182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e");
                }
            }
        - lang: Ruby
          source: >-
            require "telnyx"


            telnyx = Telnyx::Client.new(api_key: "My API Key")


            comments =
            telnyx.portouts.comments.list("182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e")


            puts(comments)
        - lang: PHP
          source: >-
            <?php


            require_once dirname(__DIR__) . '/vendor/autoload.php';


            use Telnyx\Client;

            use Telnyx\Core\Exceptions\APIException;


            $client = new Client(apiKey: getenv('TELNYX_API_KEY') ?: 'My API
            Key');


            try {
              $comments = $client->portouts->comments->list(
                '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e'
              );

              var_dump($comments);
            } catch (APIException $e) {
              echo $e->getMessage();
            }
        - lang: CLI
          source: |-
            telnyx portouts:comments list \
              --api-key 'My API Key' \
              --id 182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e
components:
  schemas:
    PortoutComment:
      required:
        - id
        - body
        - user_id
        - created_at
      properties:
        id:
          type: string
          example: 0ccc7b54-4df3-4bca-a65a-3da1ecc777f0
        record_type:
          type: string
          description: Identifies the type of the resource.
          readOnly: true
          example: portout
        body:
          type: string
          description: Comment body
          example: This is a comment
        portout_id:
          type: string
          description: Identifies the associated port request
          default: null
          example: 0ccc7b54-4df3-4bca-a65a-3da1ecc777f0
        user_id:
          type: string
          description: >-
            Identifies the user who created the comment. Will be null if created
            by Telnyx Admin
          example: 0ccc7b54-4df3-4bca-a65a-3da1ecc777f0
        created_at:
          type: string
          description: Comment creation timestamp in ISO 8601 format
          example: '2018-02-02T22:25:27.521Z'
      example:
        id: 0ccc7b54-4df3-4bca-a65a-3da1ecc777f0
        record_type: portout
        body: This is a comment
        portout_id: 0ccc7b54-4df3-4bca-a65a-3da1ecc777f0
        user_id: 0ccc7b54-4df3-4bca-a65a-3da1ecc777f0
        created_at: '2018-02-02T22:25:27.521Z'
      type: object
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
