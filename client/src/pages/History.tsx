import { Layout } from "@/components/Layout";
import { useDetections } from "@/hooks/use-detections";
import { Card } from "@/components/ui/card";
import { format } from "date-fns";
import { Search, Download } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useState } from "react";

const LABEL_STYLES: Record<string, string> = {
  "Safe / Attentive":   "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  "Eyes Not Visible":   "bg-orange-500/10 text-orange-400 border-orange-500/20",
  "No Face Detected":   "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  "Driver Not Present": "bg-red-500/10 text-red-400 border-red-500/20",
};

const BAR_COLORS: Record<string, string> = {
  "Safe / Attentive":   "bg-emerald-500",
  "Eyes Not Visible":   "bg-orange-500",
  "No Face Detected":   "bg-yellow-500",
  "Driver Not Present": "bg-red-500",
};

export default function History() {
  const { data: detections, isLoading } = useDetections();
  const [search, setSearch] = useState("");

  const filtered = (detections ?? []).filter((d) =>
    d.label.toLowerCase().includes(search.toLowerCase())
  );

  const handleExport = () => {
    if (!detections?.length) return;
    const csv = [
      "ID,Timestamp,Label,Distracted,Confidence",
      ...detections.map((d) =>
        `${d.id},${new Date(d.timestamp).toISOString()},${d.label},${d.distracted},${(d.confidence * 100).toFixed(1)}%`
      ),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "driver-detections.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Layout>
      <div className="space-y-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white mb-2">Event Logs</h1>
            <p className="text-muted-foreground">Comprehensive history of all detected safety events.</p>
          </div>

          <div className="flex gap-2 w-full md:w-auto">
            <div className="relative flex-1 md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Filter by label..."
                className="pl-9 bg-card border-white/10 focus:border-primary/50"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Button variant="outline" size="icon" className="border-white/10" onClick={handleExport} title="Export CSV">
              <Download className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 bg-card/50 animate-pulse rounded-lg border border-white/5" />
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-white/10 overflow-hidden bg-card/30 backdrop-blur">
            <div className="grid grid-cols-12 gap-4 p-4 border-b border-white/10 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              <div className="col-span-2">Time</div>
              <div className="col-span-3">Label</div>
              <div className="col-span-2">Status</div>
              <div className="col-span-3">Confidence</div>
              <div className="col-span-2 text-right">ID</div>
            </div>

            <div className="divide-y divide-white/5">
              {filtered.length === 0 ? (
                <div className="p-12 text-center text-muted-foreground">
                  No records found.
                </div>
              ) : (
                filtered.map((detection) => (
                  <div
                    key={detection.id}
                    className="grid grid-cols-12 gap-4 p-4 items-center hover:bg-white/5 transition-colors"
                    data-testid={`row-detection-${detection.id}`}
                  >
                    <div className="col-span-2 font-mono text-sm">
                      {format(new Date(detection.timestamp), "HH:mm:ss")}
                      <span className="text-muted-foreground ml-1 text-xs block">
                        {format(new Date(detection.timestamp), "MMM dd")}
                      </span>
                    </div>

                    <div className="col-span-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${LABEL_STYLES[detection.label] ?? "bg-white/5 text-white border-white/10"}`}>
                        {detection.label}
                      </span>
                    </div>

                    <div className="col-span-2">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${detection.distracted ? "bg-red-500/10 text-red-400 border-red-500/20" : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"}`}>
                        {detection.distracted ? "Distracted" : "Safe"}
                      </span>
                    </div>

                    <div className="col-span-3">
                      <div className="w-full h-1.5 bg-secondary rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all ${BAR_COLORS[detection.label] ?? "bg-primary"}`}
                          style={{ width: `${detection.confidence * 100}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground mt-1 inline-block">
                        {(detection.confidence * 100).toFixed(1)}%
                      </span>
                    </div>

                    <div className="col-span-2 text-right font-mono text-xs text-muted-foreground">
                      #{detection.id.toString().padStart(6, "0")}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
