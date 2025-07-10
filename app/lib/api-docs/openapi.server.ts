/**
 * OpenAPI Documentation Generator
 * Generates OpenAPI 3.0 specification for WishCraft API
 */

export const openApiSpec = {
  openapi: "3.0.0",
  info: {
    title: "WishCraft API",
    version: "1.0.0",
    description: "Gift Registry API for Shopify stores",
    contact: {
      name: "WishCraft Support",
      email: "support@wishcraft.app",
    },
  },
  servers: [
    {
      url: "https://wishcraft-production.up.railway.app",
      description: "Production server",
    },
    {
      url: "http://localhost:3000",
      description: "Development server",
    },
  ],
  tags: [
    {
      name: "Registries",
      description: "Gift registry management",
    },
    {
      name: "Items",
      description: "Registry item management",
    },
    {
      name: "Purchases",
      description: "Registry purchase tracking",
    },
    {
      name: "Health",
      description: "Application health monitoring",
    },
  ],
  paths: {
    "/health": {
      get: {
        tags: ["Health"],
        summary: "Get application health status",
        description: "Returns detailed health information including database, Redis, and environment checks",
        operationId: "getHealth",
        responses: {
          "200": {
            description: "Application is healthy",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/HealthStatus",
                },
                example: {
                  status: "healthy",
                  timestamp: "2025-07-10T20:00:00.000Z",
                  version: "1.0.0",
                  environment: "production",
                  checks: {
                    database: {
                      status: "healthy",
                      responseTime: 12,
                      message: "Database connection successful",
                    },
                    redis: {
                      status: "healthy",
                      responseTime: 3,
                      message: "Redis connection successful",
                    },
                  },
                },
              },
            },
          },
          "503": {
            description: "Application is unhealthy",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/HealthStatus",
                },
              },
            },
          },
        },
      },
    },
    "/health/liveness": {
      get: {
        tags: ["Health"],
        summary: "Liveness probe",
        description: "Simple endpoint to check if the application is alive",
        operationId: "getLiveness",
        responses: {
          "200": {
            description: "Application is alive",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    status: {
                      type: "string",
                      example: "alive",
                    },
                    timestamp: {
                      type: "string",
                      format: "date-time",
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/health/readiness": {
      get: {
        tags: ["Health"],
        summary: "Readiness probe",
        description: "Check if the application is ready to serve traffic",
        operationId: "getReadiness",
        responses: {
          "200": {
            description: "Application is ready",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    status: {
                      type: "string",
                      example: "ready",
                    },
                    timestamp: {
                      type: "string",
                      format: "date-time",
                    },
                    database: {
                      type: "boolean",
                    },
                    shopify_configured: {
                      type: "boolean",
                    },
                  },
                },
              },
            },
          },
          "503": {
            description: "Application is not ready",
          },
        },
      },
    },
    "/api/registries": {
      get: {
        tags: ["Registries"],
        summary: "List all registries",
        description: "Get all gift registries for the authenticated shop",
        operationId: "getRegistries",
        security: [
          {
            shopifyAuth: [],
          },
        ],
        responses: {
          "200": {
            description: "List of registries",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    registries: {
                      type: "array",
                      items: {
                        $ref: "#/components/schemas/RegistrySummary",
                      },
                    },
                    total: {
                      type: "integer",
                      example: 10,
                    },
                  },
                },
              },
            },
          },
          "401": {
            $ref: "#/components/responses/Unauthorized",
          },
          "429": {
            $ref: "#/components/responses/TooManyRequests",
          },
          "500": {
            $ref: "#/components/responses/InternalError",
          },
        },
      },
      post: {
        tags: ["Registries"],
        summary: "Create a new registry",
        description: "Create a new gift registry for a customer",
        operationId: "createRegistry",
        security: [
          {
            shopifyAuth: [],
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/x-www-form-urlencoded": {
              schema: {
                type: "object",
                required: ["name", "customerId"],
                properties: {
                  name: {
                    type: "string",
                    description: "Registry name",
                    example: "Wedding Registry",
                  },
                  customerId: {
                    type: "string",
                    description: "Shopify customer ID",
                    example: "gid://shopify/Customer/123456789",
                  },
                  eventDate: {
                    type: "string",
                    format: "date",
                    description: "Event date",
                    example: "2025-12-25",
                  },
                  privacy: {
                    type: "string",
                    enum: ["PUBLIC", "PRIVATE"],
                    default: "PUBLIC",
                    description: "Registry privacy setting",
                  },
                },
              },
            },
          },
        },
        responses: {
          "201": {
            description: "Registry created successfully",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    registry: {
                      $ref: "#/components/schemas/Registry",
                    },
                  },
                },
              },
            },
          },
          "400": {
            $ref: "#/components/responses/BadRequest",
          },
          "401": {
            $ref: "#/components/responses/Unauthorized",
          },
          "429": {
            $ref: "#/components/responses/TooManyRequests",
          },
          "500": {
            $ref: "#/components/responses/InternalError",
          },
        },
      },
    },
  },
  components: {
    schemas: {
      HealthStatus: {
        type: "object",
        properties: {
          status: {
            type: "string",
            enum: ["healthy", "degraded", "unhealthy"],
          },
          timestamp: {
            type: "string",
            format: "date-time",
          },
          version: {
            type: "string",
          },
          environment: {
            type: "string",
            enum: ["development", "production", "test"],
          },
          checks: {
            type: "object",
            properties: {
              database: {
                $ref: "#/components/schemas/HealthCheck",
              },
              environment: {
                $ref: "#/components/schemas/HealthCheck",
              },
              memory: {
                $ref: "#/components/schemas/HealthCheck",
              },
              redis: {
                $ref: "#/components/schemas/HealthCheck",
              },
            },
          },
        },
      },
      HealthCheck: {
        type: "object",
        properties: {
          status: {
            type: "string",
            enum: ["healthy", "unhealthy", "degraded", "disabled"],
          },
          responseTime: {
            type: "integer",
            description: "Response time in milliseconds",
          },
          message: {
            type: "string",
          },
        },
      },
      Registry: {
        type: "object",
        properties: {
          id: {
            type: "string",
            format: "uuid",
          },
          shopId: {
            type: "string",
          },
          customerId: {
            type: "string",
          },
          name: {
            type: "string",
          },
          eventDate: {
            type: "string",
            format: "date-time",
            nullable: true,
          },
          status: {
            type: "string",
            enum: ["ACTIVE", "INACTIVE", "ARCHIVED"],
          },
          privacy: {
            type: "string",
            enum: ["PUBLIC", "PRIVATE"],
          },
          createdAt: {
            type: "string",
            format: "date-time",
          },
          updatedAt: {
            type: "string",
            format: "date-time",
          },
        },
      },
      RegistrySummary: {
        type: "object",
        properties: {
          id: {
            type: "string",
            format: "uuid",
          },
          name: {
            type: "string",
          },
          customerId: {
            type: "string",
          },
          eventDate: {
            type: "string",
            format: "date-time",
            nullable: true,
          },
          status: {
            type: "string",
            enum: ["ACTIVE", "INACTIVE", "ARCHIVED"],
          },
          privacy: {
            type: "string",
            enum: ["PUBLIC", "PRIVATE"],
          },
          itemCount: {
            type: "integer",
          },
          purchaseCount: {
            type: "integer",
          },
          createdAt: {
            type: "string",
            format: "date-time",
          },
          updatedAt: {
            type: "string",
            format: "date-time",
          },
        },
      },
      Error: {
        type: "object",
        properties: {
          error: {
            type: "string",
          },
          statusCode: {
            type: "integer",
          },
          timestamp: {
            type: "string",
            format: "date-time",
          },
        },
      },
    },
    securitySchemes: {
      shopifyAuth: {
        type: "apiKey",
        in: "header",
        name: "X-Shopify-Access-Token",
        description: "Shopify Admin API access token",
      },
    },
    responses: {
      BadRequest: {
        description: "Bad request",
        content: {
          "application/json": {
            schema: {
              $ref: "#/components/schemas/Error",
            },
            example: {
              error: "Invalid request parameters",
              statusCode: 400,
              timestamp: "2025-07-10T20:00:00.000Z",
            },
          },
        },
      },
      Unauthorized: {
        description: "Unauthorized",
        content: {
          "application/json": {
            schema: {
              $ref: "#/components/schemas/Error",
            },
            example: {
              error: "Authentication required",
              statusCode: 401,
              timestamp: "2025-07-10T20:00:00.000Z",
            },
          },
        },
      },
      TooManyRequests: {
        description: "Too many requests",
        content: {
          "application/json": {
            schema: {
              $ref: "#/components/schemas/Error",
            },
            example: {
              error: "Too many requests",
              statusCode: 429,
              timestamp: "2025-07-10T20:00:00.000Z",
            },
          },
        },
      },
      InternalError: {
        description: "Internal server error",
        content: {
          "application/json": {
            schema: {
              $ref: "#/components/schemas/Error",
            },
            example: {
              error: "An error occurred processing your request",
              statusCode: 500,
              timestamp: "2025-07-10T20:00:00.000Z",
            },
          },
        },
      },
    },
  },
};