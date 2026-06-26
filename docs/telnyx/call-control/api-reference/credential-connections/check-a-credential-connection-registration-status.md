---
title: "Check a Credential Connection Registration Status"
source_url: "https://developers.telnyx.com/api-reference/credential-connections/check-a-credential-connection-registration-status.md"
category: "sip"
synced_at: "2026-06-25T18:43:24.651Z"
content_hash: "d0d48a5868099f62f3e2fc8bf8717fae27c35497295d672981017155d2db12c5"
---
> ## Documentation Index
> Fetch the complete documentation index at: https://developers.telnyx.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Check a Credential Connection Registration Status

> Checks the registration_status for a credential connection, (`registration_status`) as well as the timestamp for the last SIP registration event (`registration_status_updated_at`)



## OpenAPI

````yaml https://telnyx-openapi-ng.s3.us-east-1.amazonaws.com/real-time-communications/sip-connections.yml post /credential_connections/{id}/actions/check_registration_status
openapi: 3.1.0
info:
  title: Telnyx SIP Connections API
  version: 2.0.0
  description: API for SIP connections.
  contact:
    email: support@telnyx.com
servers:
  - url: https://api.telnyx.com/v2
security:
  - bearerAuth: []
paths:
  /credential_connections/{id}/actions/check_registration_status:
    post:
      tags:
        - Credential Connections
      summary: Check a Credential Connection Registration Status
      description: >-
        Checks the registration_status for a credential connection,
        (`registration_status`) as well as the timestamp for the last SIP
        registration event (`registration_status_updated_at`)
      operationId: CheckRegistrationStatus
      parameters:
        - name: id
          in: path
          description: Identifies the resource.
          required: true
          schema:
            type: string
      responses:
        '200':
          description: >-
            Successful response with details about a credential connection
            registration status.
          content:
            application/json:
              schema:
                type: object
                title: Registration Status Response
                properties:
                  data:
                    type: object
                    title: Registration Status
                    properties:
                      record_type:
                        type: string
                        description: Identifies the type of the resource.
                        example: registration_status
                      status:
                        type: string
                        description: The current registration status of your SIP connection
                        enum:
                          - Not Applicable
                          - Not Registered
                          - Failed
                          - Expired
                          - Registered
                          - Unregistered
                      sip_username:
                        type: string
                        description: The user name of the SIP connection
                        example: sip_username
                      ip_address:
                        type: string
                        description: The ip used during the SIP connection
                        example: 190.106.106.121
                      transport:
                        type: string
                        description: The protocol of the SIP connection
                        example: TCP
                      port:
                        type: integer
                        description: The port of the SIP connection
                        example: 37223
                      user_agent:
                        type: string
                        description: The user agent of the SIP connection
                        example: Z 5.4.12 v2.10.13.2-mod
                      last_registration:
                        type: string
                        description: >-
                          ISO 8601 formatted date indicating when the resource
                          was last updated.
                        example: '2018-02-02T22:25:27.521Z'
                    example:
                      record_type: registration_status
                      status: Expired
                      sip_username: rogerp
                      ip_address: 190.106.106.121
                      transport: UDP
                      port: 37223
                      user_agent: Z 5.4.12 v2.10.13.2-mod
                      last_registration: '2021-09-28T15:11:02'
        '400':
          $ref: '#/components/responses/connections_BadRequestResponse'
        '401':
          $ref: '#/components/responses/UnauthenticatedResponse'
        '403':
          $ref: '#/components/responses/connections_UnauthorizedResponse'
        '404':
          $ref: '#/components/responses/connections_NotFoundResponse'
      x-codeSamples:
        - lang: JavaScript
          source: >-
            import Telnyx from 'telnyx';


            const client = new Telnyx({
              apiKey: process.env['TELNYX_API_KEY'], // This is the default and can be omitted
            });


            const response = await
            client.credentialConnections.actions.checkRegistrationStatus('id');


            console.log(response.data);
        - lang: Python
          source: >-
            import os

            from telnyx import Telnyx


            client = Telnyx(
                api_key=os.environ.get("TELNYX_API_KEY"),  # This is the default and can be omitted
            )

            response =
            client.credential_connections.actions.check_registration_status(
                "id",
            )

            print(response.data)
        - lang: Go
          source: "package main\n\nimport (\n\t\"context\"\n\t\"fmt\"\n\n\t\"github.com/team-telnyx/telnyx-go\"\n\t\"github.com/team-telnyx/telnyx-go/option\"\n)\n\nfunc main() {\n\tclient := telnyx.NewClient(\n\t\toption.WithAPIKey(\"My API Key\"),\n\t)\n\tresponse, err := client.CredentialConnections.Actions.CheckRegistrationStatus(context.TODO(), \"id\")\n\tif err != nil {\n\t\tpanic(err.Error())\n\t}\n\tfmt.Printf(\"%+v\\n\", response.Data)\n}\n"
        - lang: Java
          source: >-
            package com.telnyx.sdk.example;


            import com.telnyx.sdk.client.TelnyxClient;

            import com.telnyx.sdk.client.okhttp.TelnyxOkHttpClient;

            import
            com.telnyx.sdk.models.credentialconnections.actions.ActionCheckRegistrationStatusParams;

            import
            com.telnyx.sdk.models.credentialconnections.actions.ActionCheckRegistrationStatusResponse;


            public final class Main {
                private Main() {}

                public static void main(String[] args) {
                    TelnyxClient client = TelnyxOkHttpClient.fromEnv();

                    ActionCheckRegistrationStatusResponse response = client.credentialConnections().actions().checkRegistrationStatus("id");
                }
            }
        - lang: Ruby
          source: >-
            require "telnyx"


            telnyx = Telnyx::Client.new(api_key: "My API Key")


            response =
            telnyx.credential_connections.actions.check_registration_status("id")


            puts(response)
        - lang: PHP
          source: >-
            <?php


            require_once dirname(__DIR__) . '/vendor/autoload.php';


            use Telnyx\Client;

            use Telnyx\Core\Exceptions\APIException;


            $client = new Client(apiKey: getenv('TELNYX_API_KEY') ?: 'My API
            Key');


            try {
              $response = $client->credentialConnections->actions->checkRegistrationStatus(
                'id'
              );

              var_dump($response);
            } catch (APIException $e) {
              echo $e->getMessage();
            }
        - lang: CLI
          source: |-
            telnyx credential-connections:actions check-registration-status \
              --api-key 'My API Key' \
              --id id
components:
  responses:
    connections_BadRequestResponse:
      description: >-
        Bad request, the request was unacceptable, often due to missing a
        required parameter.
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/ErrorResponse'
          examples:
            missingParameter:
              value:
                errors:
                  - code: '10015'
                    title: Bad Request
                    detail: The request failed because it was not well-formed.
                    source:
                      pointer: /
                    meta:
                      url: https://developers.telnyx.com/docs/overview/errors/10015
    UnauthenticatedResponse:
      description: Unauthorized
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/ErrorResponse'
          examples:
            Authentication Failed:
              value:
                errors:
                  - code: '10009'
                    title: Authentication failed
                    detail: Could not understand the provided credentials.
                    meta:
                      url: https://developers.telnyx.com/docs/overview/errors/10009
    connections_UnauthorizedResponse:
      description: >-
        The user doesn't have the required permissions to perform the requested
        action.
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/ErrorResponse'
          examples:
            notAuthorized:
              value:
                errors:
                  - code: '10010'
                    title: Not authorized
                    detail: You are not authorized to access the requested resource.
                    meta:
                      url: https://developers.telnyx.com/docs/overview/errors/10010
                    source:
                      pointer: /
    connections_NotFoundResponse:
      description: The requested resource doesn't exist.
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/ErrorResponse'
          examples:
            notFound:
              value:
                errors:
                  - code: '10005'
                    title: Resource not found
                    detail: The requested resource or URL could not be found.
                    meta:
                      url: https://developers.telnyx.com/docs/overview/errors/10005
                    source:
                      pointer: /
  schemas:
    ErrorResponse:
      type: object
      properties:
        errors:
          type: array
          items:
            type: object
            properties:
              code:
                type: string
              detail:
                type: string
              meta:
                type: object
                properties:
                  url:
                    type: string
                    format: uri
              title:
                type: string
              source:
                type: object
                properties:
                  pointer:
                    type: string
  securitySchemes:
    bearerAuth:
      scheme: bearer
      type: http

````
