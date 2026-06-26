---
title: "Create a comment on a portout request"
source_url: "https://developers.telnyx.com/api-reference/number-portout/create-a-comment-on-a-portout-request.md"
category: "phone-numbers"
synced_at: "2026-06-25T18:43:31.221Z"
content_hash: "7d69f49edb536735a11c5a20d568d3476697403c50cc43631712e94ca649e925"
---
> ## Documentation Index
> Fetch the complete documentation index at: https://developers.telnyx.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Create a comment on a portout request

> Creates a comment on a portout request.



## OpenAPI

````yaml https://telnyx-openapi-ng.s3.us-east-1.amazonaws.com/numbers-identity/portout.yml post /portouts/{id}/comments
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
    post:
      tags:
        - Number Portout
      summary: Create a comment on a portout request
      description: Creates a comment on a portout request.
      operationId: PostPortRequestComment
      parameters:
        - name: id
          in: path
          description: Portout id
          required: true
          schema:
            type: string
            format: uuid
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                body:
                  type: string
                  description: Comment to post on this portout request
      responses:
        '201':
          description: Portout Comment Response
          content:
            application/json:
              schema:
                type: object
                properties:
                  data:
                    $ref: '#/components/schemas/PortoutComment'
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


            const comment = await
            client.portouts.comments.create('182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e');


            console.log(comment.data);
        - lang: Python
          source: |-
            import os
            from telnyx import Telnyx

            client = Telnyx(
                api_key=os.environ.get("TELNYX_API_KEY"),  # This is the default and can be omitted
            )
            comment = client.portouts.comments.create(
                id="182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e",
            )
            print(comment.data)
        - lang: Go
          source: "package main\n\nimport (\n\t\"context\"\n\t\"fmt\"\n\n\t\"github.com/team-telnyx/telnyx-go\"\n\t\"github.com/team-telnyx/telnyx-go/option\"\n)\n\nfunc main() {\n\tclient := telnyx.NewClient(\n\t\toption.WithAPIKey(\"My API Key\"),\n\t)\n\tcomment, err := client.Portouts.Comments.New(\n\t\tcontext.TODO(),\n\t\t\"182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e\",\n\t\ttelnyx.PortoutCommentNewParams{},\n\t)\n\tif err != nil {\n\t\tpanic(err.Error())\n\t}\n\tfmt.Printf(\"%+v\\n\", comment.Data)\n}\n"
        - lang: Java
          source: >-
            package com.telnyx.sdk.example;


            import com.telnyx.sdk.client.TelnyxClient;

            import com.telnyx.sdk.client.okhttp.TelnyxOkHttpClient;

            import com.telnyx.sdk.models.portouts.comments.CommentCreateParams;

            import
            com.telnyx.sdk.models.portouts.comments.CommentCreateResponse;


            public final class Main {
                private Main() {}

                public static void main(String[] args) {
                    TelnyxClient client = TelnyxOkHttpClient.fromEnv();

                    CommentCreateResponse comment = client.portouts().comments().create("182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e");
                }
            }
        - lang: Ruby
          source: >-
            require "telnyx"


            telnyx = Telnyx::Client.new(api_key: "My API Key")


            comment =
            telnyx.portouts.comments.create("182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e")


            puts(comment)
        - lang: PHP
          source: >-
            <?php


            require_once dirname(__DIR__) . '/vendor/autoload.php';


            use Telnyx\Client;

            use Telnyx\Core\Exceptions\APIException;


            $client = new Client(apiKey: getenv('TELNYX_API_KEY') ?: 'My API
            Key');


            try {
              $comment = $client->portouts->comments->create(
                '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e', body: 'body'
              );

              var_dump($comment);
            } catch (APIException $e) {
              echo $e->getMessage();
            }
        - lang: CLI
          source: |-
            telnyx portouts:comments create \
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
  securitySchemes:
    bearerAuth:
      scheme: bearer
      type: http

````
