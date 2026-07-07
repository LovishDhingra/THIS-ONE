import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type InsertDetection } from "@shared/routes";
import type { InsertScreenshot } from "@shared/schema";

// ============================================
// REST HOOKS
// ============================================

// GET /api/detections
export function useDetections() {
  return useQuery({
    queryKey: [api.detections.list.path],
    queryFn: async () => {
      const res = await fetch(api.detections.list.path);
      if (!res.ok) throw new Error("Failed to fetch detections");
      return api.detections.list.responses[200].parse(await res.json());
    },
    refetchInterval: 5000, // Auto-refresh history every 5s
  });
}

// POST /api/detections (Usually handled by backend processing, but exposed if manual needed)
export function useCreateDetection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: InsertDetection) => {
      const res = await fetch(api.detections.create.path, {
        method: api.detections.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create detection log");
      return api.detections.create.responses[201].parse(await res.json());
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [api.detections.list.path] }),
  });
}

// POST /api/process-frame - The core inference endpoint
export function useProcessFrame() {
  return useMutation({
    mutationFn: async (image: string) => {
      const res = await fetch(api.detections.detect.path, {
        method: api.detections.detect.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image }),
      });
      
      if (!res.ok) throw new Error("Processing failed");
      return api.detections.detect.responses[200].parse(await res.json());
    },
  });
}

// GET /api/stats
export function useDetectionStats() {
  return useQuery({
    queryKey: [api.detections.stats.path],
    queryFn: async () => {
      const res = await fetch(api.detections.stats.path);
      if (!res.ok) throw new Error("Failed to fetch stats");
      return api.detections.stats.responses[200].parse(await res.json());
    },
  });
}

// GET /api/screenshots - only last 72h, server-filtered
export function useScreenshots(tokenOverride?: string | null) {
  const token = tokenOverride !== undefined ? tokenOverride : (typeof window !== "undefined" ? localStorage.getItem("admin_token") : null);
  return useQuery({
    queryKey: [api.screenshots.list.path, token],
    queryFn: async () => {
      const res = await fetch(api.screenshots.list.path, {
        headers: {
          "x-admin-token": token || "",
        },
      });
      if (res.status === 401) {
        throw new Error("Unauthorized");
      }
      if (!res.ok) throw new Error("Failed to fetch screenshots");
      return api.screenshots.list.responses[200].parse(await res.json());
    },
    refetchInterval: 15000,
    retry: false,
  });
}

// POST /api/screenshots
export function useCreateScreenshot() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: InsertScreenshot) => {
      const res = await fetch(api.screenshots.create.path, {
        method: api.screenshots.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to upload screenshot");
      return api.screenshots.create.responses[201].parse(await res.json());
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [api.screenshots.list.path] }),
  });
}

// DELETE /api/screenshots/:id
export function useDeleteScreenshot() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const token = typeof window !== "undefined" ? localStorage.getItem("admin_token") : null;
      const res = await fetch(`/api/screenshots/${id}`, {
        method: "DELETE",
        headers: {
          "x-admin-token": token || "",
        },
      });
      if (!res.ok) throw new Error("Failed to delete screenshot");
      return await res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [api.screenshots.list.path] }),
  });
}

// DELETE /api/screenshots
export function useDeleteAllScreenshots() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const token = typeof window !== "undefined" ? localStorage.getItem("admin_token") : null;
      const res = await fetch("/api/screenshots", {
        method: "DELETE",
        headers: {
          "x-admin-token": token || "",
        },
      });
      if (!res.ok) throw new Error("Failed to delete all screenshots");
      return await res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [api.screenshots.list.path] }),
  });
}

