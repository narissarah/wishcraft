import type { LoaderFunctionArgs } from "@remix-run/node";

/**
 * Swagger UI for API Documentation
 * GET /api/docs/ui - Interactive API documentation
 */
export async function loader({ request }: LoaderFunctionArgs) {
  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <title>WishCraft API Documentation</title>
      <meta charset="utf-8"/>
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5.17.14/swagger-ui.css" />
      <style>
        body {
          margin: 0;
          padding: 0;
        }
        .swagger-ui .topbar {
          display: none;
        }
      </style>
    </head>
    <body>
      <div id="swagger-ui"></div>
      <script src="https://unpkg.com/swagger-ui-dist@5.17.14/swagger-ui-bundle.js"></script>
      <script src="https://unpkg.com/swagger-ui-dist@5.17.14/swagger-ui-standalone-preset.js"></script>
      <script>
        window.onload = function() {
          const ui = SwaggerUIBundle({
            url: "/api/docs",
            dom_id: '#swagger-ui',
            deepLinking: true,
            presets: [
              SwaggerUIBundle.presets.apis,
              SwaggerUIStandalonePreset
            ],
            plugins: [
              SwaggerUIBundle.plugins.DownloadUrl
            ],
            layout: "StandaloneLayout",
            validatorUrl: null,
            supportedSubmitMethods: ['get', 'post', 'put', 'delete', 'patch'],
            onComplete: function() {
              console.log("Swagger UI loaded");
            }
          });
          window.ui = ui;
        }
      </script>
    </body>
    </html>
  `;
  
  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html",
      "Cache-Control": "public, max-age=3600",
    },
  });
}