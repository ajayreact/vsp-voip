---
title: "Create a port-out related report"
source_url: "https://developers.telnyx.com/api-reference/number-portout/create-a-port-out-related-report.md"
category: "phone-numbers"
synced_at: "2026-06-25T18:43:33.464Z"
content_hash: "e7630f271e97d7e7c41e6eaac6efd4f31bfb5f2b703ff814e8c48c17d2cc9210"
---
> ## Documentation Index
> Fetch the complete documentation index at: https://developers.telnyx.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Create a port-out related report

> Generate reports about port-out operations.



## OpenAPI

````yaml https://telnyx-openapi-ng.s3.us-east-1.amazonaws.com/numbers-identity/portout.yml post /portouts/reports
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
  /portouts/reports:
    post:
      tags:
        - Number Portout
      summary: Create a port-out related report
      description: Generate reports about port-out operations.
      operationId: CreatePortoutReport
      requestBody:
        $ref: '#/components/requestBodies/CreatePortoutReport'
      responses:
        '201':
          description: Successful response
          content:
            application/json:
              schema:
                type: object
                properties:
                  data:
                    $ref: '#/components/schemas/PortoutReport'
        '422':
          description: Unprocessable entity. Check message field in response for details.
        '500':
          description: Internal server error
      x-codeSamples:
        - lang: JavaScript
          source: |-
            import Telnyx from 'telnyx';

            const client = new Telnyx({
              apiKey: process.env['TELNYX_API_KEY'], // This is the default and can be omitted
            });

            const report = await client.portouts.reports.create({
              params: { filters: {} },
              report_type: 'export_portouts_csv',
            });

            console.log(report.data);
        - lang: Python
          source: |-
            import os
            from telnyx import Telnyx

            client = Telnyx(
                api_key=os.environ.get("TELNYX_API_KEY"),  # This is the default and can be omitted
            )
            report = client.portouts.reports.create(
                params={
                    "filters": {}
                },
                report_type="export_portouts_csv",
            )
            print(report.data)
        - lang: Go
          source: "package main\n\nimport (\n\t\"context\"\n\t\"fmt\"\n\n\t\"github.com/team-telnyx/telnyx-go\"\n\t\"github.com/team-telnyx/telnyx-go/option\"\n)\n\nfunc main() {\n\tclient := telnyx.NewClient(\n\t\toption.WithAPIKey(\"My API Key\"),\n\t)\n\treport, err := client.Portouts.Reports.New(context.TODO(), telnyx.PortoutReportNewParams{\n\t\tParams: telnyx.ExportPortoutsCsvReportParam{\n\t\t\tFilters: telnyx.ExportPortoutsCsvReportFiltersParam{},\n\t\t},\n\t\tReportType: telnyx.PortoutReportNewParamsReportTypeExportPortoutsCsv,\n\t})\n\tif err != nil {\n\t\tpanic(err.Error())\n\t}\n\tfmt.Printf(\"%+v\\n\", report.Data)\n}\n"
        - lang: Java
          source: >-
            package com.telnyx.sdk.example;


            import com.telnyx.sdk.client.TelnyxClient;

            import com.telnyx.sdk.client.okhttp.TelnyxOkHttpClient;

            import
            com.telnyx.sdk.models.portouts.reports.ExportPortoutsCsvReport;

            import com.telnyx.sdk.models.portouts.reports.ReportCreateParams;

            import com.telnyx.sdk.models.portouts.reports.ReportCreateResponse;


            public final class Main {
                private Main() {}

                public static void main(String[] args) {
                    TelnyxClient client = TelnyxOkHttpClient.fromEnv();

                    ReportCreateParams params = ReportCreateParams.builder()
                        .params(ExportPortoutsCsvReport.builder()
                            .filters(ExportPortoutsCsvReport.Filters.builder().build())
                            .build())
                        .reportType(ReportCreateParams.ReportType.EXPORT_PORTOUTS_CSV)
                        .build();
                    ReportCreateResponse report = client.portouts().reports().create(params);
                }
            }
        - lang: Ruby
          source: >-
            require "telnyx"


            telnyx = Telnyx::Client.new(api_key: "My API Key")


            report = telnyx.portouts.reports.create(params: {filters: {}},
            report_type: :export_portouts_csv)


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
              $report = $client->portouts->reports->create(
                params: [
                  'filters' => [
                    'createdAtGt' => new \DateTimeImmutable('2019-12-27T18:11:19.117Z'),
                    'createdAtLt' => new \DateTimeImmutable('2019-12-27T18:11:19.117Z'),
                    'customerReferenceIn' => ['my-customer-reference'],
                    'endUserName' => 'McPortersen',
                    'phoneNumbersOverlaps' => ['+1234567890'],
                    'statusIn' => ['pending'],
                  ],
                ],
                reportType: 'export_portouts_csv',
              );

              var_dump($report);
            } catch (APIException $e) {
              echo $e->getMessage();
            }
        - lang: CLI
          source: |-
            telnyx portouts:reports create \
              --api-key 'My API Key' \
              --params '{filters: {}}' \
              --report-type export_portouts_csv
components:
  requestBodies:
    CreatePortoutReport:
      required: true
      content:
        application/json:
          schema:
            type: object
            description: The parameters for generating a new port-out related report.
            required:
              - report_type
              - params
            properties:
              report_type:
                type: string
                description: Identifies the type of report
                enum:
                  - export_portouts_csv
                example: export_portouts_csv
              params:
                oneOf:
                  - $ref: '#/components/schemas/ExportPortoutsCSVReport'
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
