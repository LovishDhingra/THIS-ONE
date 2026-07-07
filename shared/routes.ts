import { z } from "zod";
import { insertDetectionSchema, detections, insertScreenshotSchema, screenshots } from "./schema";

export const errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional(),
  }),
  notFound: z.object({
    message: z.string(),
  }),
  internal: z.object({
    message: z.string(),
  }),
};

export const api = {
  detections: {
    list: {
      method: "GET" as const,
      path: "/api/detections",
      responses: {
        200: z.array(z.custom<typeof detections.$inferSelect>()),
      },
    },
    create: {
      method: "POST" as const,
      path: "/api/detections",
      input: insertDetectionSchema,
      responses: {
        201: z.custom<typeof detections.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    detect: {
      method: "POST" as const,
      path: "/api/process-frame",
      input: z.object({
        image: z.string(), // Base64 image
      }),
      responses: {
        200: z.object({
          distracted: z.boolean(),
          label: z.string(),
          confidence: z.number(),
        }),
        500: errorSchemas.internal,
      },
    },
    stats: {
      method: "GET" as const,
      path: "/api/stats",
      responses: {
        200: z.object({
          byDay: z.array(z.object({
            date: z.string(),
            safe: z.number(),
            distracted: z.number(),
          })),
          totals: z.object({
            total: z.number(),
            safe: z.number(),
            distracted: z.number(),
            safetyScore: z.number(),
          }),
          byLabel: z.array(z.object({
            label: z.string(),
            count: z.number(),
          })),
        }),
      },
    },
  },
  screenshots: {
    list: {
      method: "GET" as const,
      path: "/api/screenshots",
      responses: {
        200: z.array(z.custom<typeof screenshots.$inferSelect>()),
      },
    },
    create: {
      method: "POST" as const,
      path: "/api/screenshots",
      input: insertScreenshotSchema,
      responses: {
        201: z.custom<typeof screenshots.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    delete: {
      method: "DELETE" as const,
      path: "/api/screenshots/:id",
      responses: {
        200: z.object({ success: z.boolean() }),
        404: errorSchemas.notFound,
      },
    },
    deleteAll: {
      method: "DELETE" as const,
      path: "/api/screenshots",
      responses: {
        200: z.object({ success: z.boolean() }),
      },
    },
  },
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}
