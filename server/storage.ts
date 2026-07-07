import {
  type Detection, type InsertDetection, detections,
  type ScreenshotRecord, type InsertScreenshot, screenshots,
} from "@shared/schema";
import { db } from "./db";
import { desc, sql, lt, gte } from "drizzle-orm";

type StatsResult = {
  byDay: { date: string; safe: number; distracted: number }[];
  totals: { total: number; safe: number; distracted: number; safetyScore: number };
  byLabel: { label: string; count: number }[];
};

const SCREENSHOT_RETENTION_HOURS = 72;

export interface IStorage {
  createDetection(detection: InsertDetection): Promise<Detection>;
  getDetections(limit?: number): Promise<Detection[]>;
  getStats(): Promise<StatsResult>;

  createScreenshot(screenshot: InsertScreenshot): Promise<ScreenshotRecord>;
  getScreenshots(): Promise<ScreenshotRecord[]>;
  deleteScreenshot(id: number): Promise<void>;
  deleteAllScreenshots(): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async createDetection(insertDetection: InsertDetection): Promise<Detection> {
    const [detection] = await db
      .insert(detections)
      .values(insertDetection)
      .returning();
    return detection;
  }

  async getDetections(limit: number = 100): Promise<Detection[]> {
    return db
      .select()
      .from(detections)
      .orderBy(desc(detections.timestamp))
      .limit(limit);
  }

  async getStats(): Promise<StatsResult> {
    const byDayRows = await db
      .select({
        date: sql<string>`to_char(${detections.timestamp}, 'YYYY-MM-DD')`,
        safe: sql<number>`cast(sum(case when ${detections.distracted} = false then 1 else 0 end) as int)`,
        distracted: sql<number>`cast(sum(case when ${detections.distracted} = true then 1 else 0 end) as int)`,
      })
      .from(detections)
      .groupBy(sql`to_char(${detections.timestamp}, 'YYYY-MM-DD')`)
      .orderBy(sql`to_char(${detections.timestamp}, 'YYYY-MM-DD') asc`)
      .limit(7);

    const [totalsRow] = await db
      .select({
        total: sql<number>`cast(count(*) as int)`,
        safe: sql<number>`cast(sum(case when ${detections.distracted} = false then 1 else 0 end) as int)`,
        distracted: sql<number>`cast(sum(case when ${detections.distracted} = true then 1 else 0 end) as int)`,
      })
      .from(detections);

    const total = totalsRow?.total ?? 0;
    const safe = totalsRow?.safe ?? 0;
    const distracted = totalsRow?.distracted ?? 0;
    const safetyScore = total > 0 ? Math.round((safe / total) * 100) : 100;

    const byLabelRows = await db
      .select({
        label: detections.label,
        count: sql<number>`cast(count(*) as int)`,
      })
      .from(detections)
      .groupBy(detections.label)
      .orderBy(sql`count(*) desc`);

    return {
      byDay: byDayRows,
      totals: { total, safe, distracted, safetyScore },
      byLabel: byLabelRows,
    };
  }

  async createScreenshot(insertScreenshot: InsertScreenshot): Promise<ScreenshotRecord> {
    // Purge anything older than the retention window whenever a new one comes in
    await db
      .delete(screenshots)
      .where(lt(screenshots.timestamp, sql`now() - interval '${sql.raw(String(SCREENSHOT_RETENTION_HOURS))} hours'`));

    const [row] = await db
      .insert(screenshots)
      .values(insertScreenshot)
      .returning();
    return row;
  }

  async getScreenshots(): Promise<ScreenshotRecord[]> {
    return db
      .select()
      .from(screenshots)
      .where(gte(screenshots.timestamp, sql`now() - interval '${sql.raw(String(SCREENSHOT_RETENTION_HOURS))} hours'`))
      .orderBy(desc(screenshots.timestamp));
  }

  async deleteScreenshot(id: number): Promise<void> {
    await db.delete(screenshots).where(sql`${screenshots.id} = ${id}`);
  }

  async deleteAllScreenshots(): Promise<void> {
    await db.delete(screenshots);
  }
}

export class MemStorage implements IStorage {
  private detections: Detection[] = [];
  private screenshotsList: ScreenshotRecord[] = [];
  private currentId: number = 1;
  private currentScreenshotId: number = 1;

  async createDetection(insertDetection: InsertDetection): Promise<Detection> {
    const detection: Detection = {
      ...insertDetection,
      id: this.currentId++,
      timestamp: new Date(),
      snapshot: insertDetection.snapshot || null,
      distracted: insertDetection.distracted ?? false,
    };
    this.detections.push(detection);
    return detection;
  }

  async getDetections(limit: number = 100): Promise<Detection[]> {
    return this.detections
      .slice()
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  async getStats(): Promise<StatsResult> {
    const dayMap = new Map<string, { safe: number; distracted: number }>();

    this.detections.forEach((d) => {
      const date = d.timestamp.toISOString().split("T")[0];
      if (!dayMap.has(date)) dayMap.set(date, { safe: 0, distracted: 0 });
      const entry = dayMap.get(date)!;
      if (d.distracted) entry.distracted++; else entry.safe++;
    });

    const byDay = Array.from(dayMap.entries())
      .map(([date, v]) => ({ date, ...v }))
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-7);

    const total = this.detections.length;
    const safe = this.detections.filter((d) => !d.distracted).length;
    const distracted = total - safe;
    const safetyScore = total > 0 ? Math.round((safe / total) * 100) : 100;

    const labelMap = new Map<string, number>();
    this.detections.forEach((d) => {
      labelMap.set(d.label, (labelMap.get(d.label) ?? 0) + 1);
    });
    const byLabel = Array.from(labelMap.entries())
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count);

    return { byDay, totals: { total, safe, distracted, safetyScore }, byLabel };
  }

  private purgeOldScreenshots() {
    const cutoff = Date.now() - SCREENSHOT_RETENTION_HOURS * 60 * 60 * 1000;
    this.screenshotsList = this.screenshotsList.filter((s) => s.timestamp.getTime() >= cutoff);
  }

  async createScreenshot(insertScreenshot: InsertScreenshot): Promise<ScreenshotRecord> {
    this.purgeOldScreenshots();
    const record: ScreenshotRecord = {
      ...insertScreenshot,
      id: this.currentScreenshotId++,
      timestamp: new Date(),
    };
    this.screenshotsList.push(record);
    return record;
  }

  async getScreenshots(): Promise<ScreenshotRecord[]> {
    this.purgeOldScreenshots();
    return this.screenshotsList
      .slice()
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  async deleteScreenshot(id: number): Promise<void> {
    this.screenshotsList = this.screenshotsList.filter((s) => s.id !== id);
  }

  async deleteAllScreenshots(): Promise<void> {
    this.screenshotsList = [];
  }
}

export class FallbackStorage implements IStorage {
  private dbStorage: DatabaseStorage | null = null;
  private memStorage: MemStorage;
  private useMemOnly = false;

  constructor() {
    this.memStorage = new MemStorage();
    if (process.env.DATABASE_URL) {
      this.dbStorage = new DatabaseStorage();
    } else {
      this.useMemOnly = true;
    }
  }

  async createDetection(detection: InsertDetection): Promise<Detection> {
    if (!this.useMemOnly && this.dbStorage) {
      try {
        return await this.dbStorage.createDetection(detection);
      } catch (err: any) {
        console.error("[DatabaseStorage] Failed to create detection, falling back to Memory Storage:", err.message);
        this.useMemOnly = true;
      }
    }
    return await this.memStorage.createDetection(detection);
  }

  async getDetections(limit?: number): Promise<Detection[]> {
    if (!this.useMemOnly && this.dbStorage) {
      try {
        return await this.dbStorage.getDetections(limit);
      } catch (err: any) {
        console.error("[DatabaseStorage] Failed to get detections, falling back to Memory Storage:", err.message);
        this.useMemOnly = true;
      }
    }
    return await this.memStorage.getDetections(limit);
  }

  async getStats(): Promise<StatsResult> {
    if (!this.useMemOnly && this.dbStorage) {
      try {
        return await this.dbStorage.getStats();
      } catch (err: any) {
        console.error("[DatabaseStorage] Failed to get stats, falling back to Memory Storage:", err.message);
        this.useMemOnly = true;
      }
    }
    return await this.memStorage.getStats();
  }

  async createScreenshot(screenshot: InsertScreenshot): Promise<ScreenshotRecord> {
    if (!this.useMemOnly && this.dbStorage) {
      try {
        return await this.dbStorage.createScreenshot(screenshot);
      } catch (err: any) {
        console.error("[DatabaseStorage] Failed to create screenshot, falling back to Memory Storage:", err.message);
        this.useMemOnly = true;
      }
    }
    return await this.memStorage.createScreenshot(screenshot);
  }

  async getScreenshots(): Promise<ScreenshotRecord[]> {
    if (!this.useMemOnly && this.dbStorage) {
      try {
        return await this.dbStorage.getScreenshots();
      } catch (err: any) {
        console.error("[DatabaseStorage] Failed to get screenshots, falling back to Memory Storage:", err.message);
        this.useMemOnly = true;
      }
    }
    return await this.memStorage.getScreenshots();
  }

  async deleteScreenshot(id: number): Promise<void> {
    if (!this.useMemOnly && this.dbStorage) {
      try {
        return await this.dbStorage.deleteScreenshot(id);
      } catch (err: any) {
        console.error("[DatabaseStorage] Failed to delete screenshot, falling back to Memory Storage:", err.message);
        this.useMemOnly = true;
      }
    }
    return await this.memStorage.deleteScreenshot(id);
  }

  async deleteAllScreenshots(): Promise<void> {
    if (!this.useMemOnly && this.dbStorage) {
      try {
        return await this.dbStorage.deleteAllScreenshots();
      } catch (err: any) {
        console.error("[DatabaseStorage] Failed to delete all screenshots, falling back to Memory Storage:", err.message);
        this.useMemOnly = true;
      }
    }
    return await this.memStorage.deleteAllScreenshots();
  }
}

export const storage = new FallbackStorage();
