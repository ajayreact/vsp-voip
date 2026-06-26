---
title: "Retrieve a report"
source_url: "https://developers.telnyx.com/api-reference/number-portout/retrieve-a-report.md"
category: "phone-numbers"
synced_at: "2026-06-25T18:43:33.742Z"
content_hash: "024d9e170f71c14a801a12e602c52696ee3df946314d550e5686c1631f0efc24"
---
> ## Documentation Index
> Fetch the complete documentation index at: https://developers.telnyx.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Retrieve a report

> Retrieve a specific report generated.



## OpenAPI

````yaml https://telnyx-openapi-ng.s3.us-east-1.amazonaws.com/numbers-identity/portout.yml get /portouts/reports/{id}
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
  /portouts/reports/{id}:
    get:
      tags:
        - Number Portout
      summary: Retrieve a report
      description: Retrieve a specific report generated.
      operationId: GetPortoutReport
      parameters:
        - name: id
          description: Identifies a report.
          in: path
          required: true
          schema:
            type: string
            format: uuid
      responses:
        '200':
          description: Successful response
          content:
            application/json:
              schema:
                type: object
                properties:
                  data:
                    $ref: '#/components/schemas/PortoutReport'
        '404':
          description: Resource not found
        '500':
          description: Internal server error
      x-codeSamples:
        - lang: JavaScript
          source: >-
            import Telnyx from 'telnyx';


            const client = new Telnyx({
              apiKey: process.env['TELNYX_API_KEY'], // This is the default and can be omitted
            });


            const report = await
            client.portouts.reports.retrieve('182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e');


            console.log(report.data);
        - lang: Python
          source: |-
            import os
            from telnyx import Telnyx

            client = Telnyx(
                api_key=os.environ.get("TELNYX_API_KEY"),  # This is the default and can be omitted
            )
            report = client.portouts.reports.retrieve(
                "182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e",
            )
            print(report.data)
        - lang: Go
          source: "package main\n\nimport (\n\t\"context\"\n\t\"fmt\"\n\n\t\"github.com/team-telnyx/telnyx-go\"\n\t\"github.com/team-telnyx/telnyx-go/option\"\n)\n\nfunc main() {\n\tclient := telnyx.NewClient(\n\t\toption.WithAPIKey(\"My API Key\"),\n\t)\n\treport, err := client.Portouts.Reports.Get(context.TODO(), \"182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e\")\n\tif err != nil {\n\t\tpanic(err.Error())\n\t}\n\tfmt.Printf(\"%+v\\n\", report.Data)\n}\n"
        - lang: Java
          source: >-
            package com.telnyx.sdk.example;


            import com.telnyx.sdk.client.TelnyxClient;

            import com.telnyx.sdk.client.okhttp.TelnyxOkHttpClient;

            import com.telnyx.sdk.models.portouts.reports.ReportRetrieveParams;

            import
            com.telnyx.sdk.models.portouts.reports.ReportRetrieveResponse;


            public final class Main {
                private Main() {}

                public static void main(String[] args) {
                    TelnyxClient client = TelnyxOkHttpClient.fromEnv();

                    ReportRetrieveResponse report = client.portouts().reports().retrieve("182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e");
                }
            }
        - lang: Ruby
          source: >-
            require "telnyx"


            telnyx = Telnyx::Client.new(api_key: "My API Key")


            report =
            telnyx.portouts.reports.retrieve("182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e")


            puts(report)
        - lang: PHP
          source: >-
            <?php


            require_once dirname(__DIR__) . '/vendor/autoload.php';


            use Telnyx\Client;

            use Telnyx\Core\Exceptions\APIException;


            $client = new Client(apiKey: getenv('TELNYX_API_KEY') ?: 'My API
            Key');


            try {
              $report = $client->portouts->reports->retrieve(
                '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e'
              );

              var_dump($report);
            } catch (APIException $e) {
              echo $e->getMessage();
            }
        - lang: CLI
          source: |-
            telnyx portouts:reports retrieve \
              --api-key 'My API Key' \
              --id 182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e
components:
  schemas:
    PortoutReport:
      type: object
      properties:
        id:
          type: string
          description: Uniquely identifies the report.
          format: uuid
          example: eef3340b-8903-4466-b445-89b697315a3a
        report_type:
          type: string
          description: Identifies the type of report
          enum:
            - export_portouts_csv
          example: export_portouts_csv
        status:
          type: string
          description: The current status of the report generation.
          enum:
            - pending
            - completed
          example: completed
        params:
          oneOf:
            - $ref: '#/components/schemas/ExportPortoutsCSVReport'
        document_id:
          type: string
          format: uuid
          description: >-
            Identifies the document that was uploaded when report was generated.
            This field is only populated when the report is under completed
            status.
          example: f1486bae-f067-460c-ad43-73a92848f902
        record_type:
          type: string
          example: portout_report
          description: Identifies the type of the resource.
          readOnly: true
        created_at:
          type: string
          format: date-time
          description: ISO 8601 formatted date indicating when the resource was created.
          example: '2021-03-19T10:07:15.527000Z'
        updated_at:
          type: string
          format: date-time
          description: ISO 8601 formatted date indicating when the resource was updated.
          example: '2021-03-19T10:07:15.527000Z'
    ExportPortoutsCSVReport:
      description: The parameters for generating a port-outs CSV report.
      type: object
      required:
        - filters
      properties:
        filters:
          type: object
          description: The filters to apply to the export port-out CSV report.
          properties:
            status__in:
              type: array
              description: The status of the port-outs to include in the report.
              items:
                type: string
                enum:
                  - pending
                  - authorized
                  - ported
                  - rejected
                  - rejected-pending
                  - canceled
            customer_reference__in:
              type: array
              description: >-
                The customer reference of the port-outs to include in the
                report.
              items:
                type: string
                example: my-customer-reference
            end_user_name:
              type: string
              description: The end user name of the port-outs to include in the report.
              example: McPortersen
            phone_numbers__overlaps:
              type: array
              description: >-
                A list of phone numbers that the port-outs phone numbers must
                overlap with.
              items:
                type: string
                example: '+1234567890'
            created_at__lt:
              type: string
              description: The date and time the port-out was created before.
              format: date-time
            created_at__gt:
              type: string
              description: The date and time the port-out was created after.
              format: date-time
  securitySchemes:
    bearerAuth:
      scheme: bearer
      type: http

````
