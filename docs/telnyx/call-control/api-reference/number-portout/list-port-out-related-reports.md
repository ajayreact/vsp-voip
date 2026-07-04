---
title: "List port-out related reports"
source_url: "https://developers.telnyx.com/api-reference/number-portout/list-port-out-related-reports.md"
category: "phone-numbers"
synced_at: "2026-06-25T18:43:33.214Z"
content_hash: "7ac8daa760678f656620531bbcb09501a0350380c76531a32388b3f7db258c06"
---
> ## Documentation Index
> Fetch the complete documentation index at: https://developers.telnyx.com/llms.txt
> Use this file to discover all available pages before exploring further.

# List port-out related reports

> List the reports generated about port-out operations.



## OpenAPI

````yaml https://telnyx-openapi-ng.s3.us-east-1.amazonaws.com/numbers-identity/portout.yml get /portouts/reports
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
    get:
      tags:
        - Number Portout
      summary: List port-out related reports
      description: List the reports generated about port-out operations.
      operationId: ListPortoutReports
      parameters:
        - $ref: '#/components/parameters/PageConsolidated'
        - name: filter
          in: query
          style: deepObject
          explode: true
          description: >-
            Consolidated filter parameter (deepObject style). Originally:
            filter[report_type], filter[status]
          schema:
            type: object
            properties:
              report_type:
                type: string
                enum:
                  - export_portouts_csv
                example: export_portouts_csv
                description: Filter reports of a specific type
              status:
                type: string
                enum:
                  - pending
                  - completed
                example: completed
                description: Filter reports of a specific status
      responses:
        '200':
          description: Successful response
          content:
            application/json:
              schema:
                type: object
                properties:
                  data:
                    type: array
                    items:
                      $ref: '#/components/schemas/PortoutReport'
                  meta:
                    $ref: '#/components/schemas/PaginationMeta'
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

            // Automatically fetches more pages as needed.
            for await (const portoutReport of client.portouts.reports.list()) {
              console.log(portoutReport.id);
            }
        - lang: Python
          source: |-
            import os
            from telnyx import Telnyx

            client = Telnyx(
                api_key=os.environ.get("TELNYX_API_KEY"),  # This is the default and can be omitted
            )
            page = client.portouts.reports.list()
            page = page.data[0]
            print(page.id)
        - lang: Go
          source: "package main\n\nimport (\n\t\"context\"\n\t\"fmt\"\n\n\t\"github.com/team-telnyx/telnyx-go\"\n\t\"github.com/team-telnyx/telnyx-go/option\"\n)\n\nfunc main() {\n\tclient := telnyx.NewClient(\n\t\toption.WithAPIKey(\"My API Key\"),\n\t)\n\tpage, err := client.Portouts.Reports.List(context.TODO(), telnyx.PortoutReportListParams{})\n\tif err != nil {\n\t\tpanic(err.Error())\n\t}\n\tfmt.Printf(\"%+v\\n\", page)\n}\n"
        - lang: Java
          source: |-
            package com.telnyx.sdk.example;

            import com.telnyx.sdk.client.TelnyxClient;
            import com.telnyx.sdk.client.okhttp.TelnyxOkHttpClient;
            import com.telnyx.sdk.models.portouts.reports.ReportListPage;
            import com.telnyx.sdk.models.portouts.reports.ReportListParams;

            public final class Main {
                private Main() {}

                public static void main(String[] args) {
                    TelnyxClient client = TelnyxOkHttpClient.fromEnv();

                    ReportListPage page = client.portouts().reports().list();
                }
            }
        - lang: Ruby
          source: |-
            require "telnyx"

            telnyx = Telnyx::Client.new(api_key: "My API Key")

            page = telnyx.portouts.reports.list

            puts(page)
        - lang: PHP
          source: >-
            <?php


            require_once dirname(__DIR__) . '/vendor/autoload.php';


            use Telnyx\Client;

            use Telnyx\Core\Exceptions\APIException;


            $client = new Client(apiKey: getenv('TELNYX_API_KEY') ?: 'My API
            Key');


            try {
              $page = $client->portouts->reports->list(
                filter: ['reportType' => 'export_portouts_csv', 'status' => 'completed'],
                pageNumber: 0,
                pageSize: 0,
              );

              var_dump($page);
            } catch (APIException $e) {
              echo $e->getMessage();
            }
        - lang: CLI
          source: |-
            telnyx portouts:reports list \
              --api-key 'My API Key'
components:
  parameters:
    PageConsolidated:
      name: page
      in: query
      style: deepObject
      explode: true
      description: >-
        Consolidated page parameter (deepObject style). Originally:
        page[number], page[size]
      schema:
        type: object
        properties:
          number:
            type: integer
            minimum: 1
            default: 1
            description: The page number to load
          size:
            type: integer
            minimum: 1
            maximum: 250
            default: 20
            description: The size of the page
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
    PaginationMeta:
      type: object
      properties:
        total_pages:
          type: integer
          example: 3
        total_results:
          type: integer
          example: 55
        page_number:
          type: integer
          example: 2
        page_size:
          type: integer
          example: 25
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
