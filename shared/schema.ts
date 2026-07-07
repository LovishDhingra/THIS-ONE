import { pgTable, text, serial, timestamp, real, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const detections = pgTable("detections", {
  id: serial("id").primaryKey(),
  label: text("label").notNull(), // e.g. "Safe / Attentive", "No Face Detected", etc.
  distracted: boolean("distracted").notNull().default(false),
  confidence: real("confidence").notNull(),
  snapshot: text("snapshot"), // Base64 or URL
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

export const insertDetectionSchema = createInsertSchema(detections).omit({
  id: true,
  timestamp: true,
});

export type Detection = typeof detections.$inferSelect;
export type InsertDetection = z.infer<typeof insertDetectionSchema>;

export const screenshots = pgTable("screenshots", {
  id: serial("id").primaryKey(),
  image: text("image").notNull(), // Base64 data URL
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

export const insertScreenshotSchema = createInsertSchema(screenshots).omit({
  id: true,
  timestamp: true,
});

export type ScreenshotRecord = typeof screenshots.$inferSelect;
export type InsertScreenshot = z.infer<typeof insertScreenshotSchema>;
