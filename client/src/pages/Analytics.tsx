import { Layout } from "@/components/Layout";
import { useDetectionStats } from "@/hooks/use-detections";
import { Card } from "@/components/ui/card";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Legend, Cell, PieChart, Pie,
} from "recharts";
import { TrendingUp, AlertTriangle, ShieldCheck, Activity } from "lucide-react";

const LABEL_COLORS: Record<string, string> = {
  "Safe / Attentive":   "#10b981",
  "Eyes Not Visible":   "#f97316",
  "No Face Detected":   "#eab308",
  "Driver Not Present": "#ef4444",
};

export default function Analytics() {
  const { data: stats, isLoading } = useDetectionStats();

  const totals = stats?.totals ?? { total: 0, safe: 0, distracted: 0, safetyScore: 100 };

  return (
    <Layout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white mb-2">System Analytics</h1>
          <p className="text-muted-foreground">Performance metrics and distraction trend analysis.</p>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card className="p-6 bg-gradient-to-br from-card to-card/50 border-white/10">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-primary/10 rounded-xl">
                <TrendingUp className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Safety Score</p>
                <h3 className="text-3xl font-bold mt-1 text-white">{totals.safetyScore}%</h3>
              </div>
            </div>
          </Card>

          <Card className="p-6 bg-gradient-to-br from-card to-card/50 border-white/10">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-muted/20 rounded-xl">
                <Activity className="w-6 h-6 text-muted-foreground" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Total Events</p>
                <h3 className="text-3xl font-bold mt-1 text-white">{totals.total}</h3>
              </div>
            </div>
          </Card>

          <Card className="p-6 bg-gradient-to-br from-card to-card/50 border-white/10">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-red-500/10 rounded-xl">
                <AlertTriangle className="w-6 h-6 text-red-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Distractions</p>
                <h3 className="text-3xl font-bold mt-1 text-white">{totals.distracted}</h3>
              </div>
            </div>
          </Card>

          <Card className="p-6 bg-gradient-to-br from-card to-card/50 border-white/10">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-emerald-500/10 rounded-xl">
                <ShieldCheck className="w-6 h-6 text-emerald-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Safe Intervals</p>
                <h3 className="text-3xl font-bold mt-1 text-white">{totals.safe}</h3>
              </div>
            </div>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Stacked Bar Chart */}
          <Card className="lg:col-span-2 p-6 border-white/10 bg-card/30 backdrop-blur">
            <h3 className="text-lg font-semibold mb-6 text-white">Safe vs Distracted (Last 7 Days)</h3>
            <div className="h-[320px] w-full">
              {isLoading ? (
                <div className="w-full h-full flex items-center justify-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats?.byDay ?? []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                    <XAxis dataKey="date" stroke="#888" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="#888" fontSize={12} tickLine={false} axisLine={false} />
                    <Tooltip
                      contentStyle={{ backgroundColor: "rgba(20,20,22,0.95)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px" }}
                      itemStyle={{ color: "#fff" }}
                      cursor={{ fill: "rgba(255,255,255,0.05)" }}
                    />
                    <Legend wrapperStyle={{ fontSize: 12, color: "#888" }} />
                    <Bar dataKey="safe" name="Safe" stackId="a" fill="#10b981" radius={[0,0,0,0]} maxBarSize={50} />
                    <Bar dataKey="distracted" name="Distracted" stackId="a" fill="#ef4444" radius={[4,4,0,0]} maxBarSize={50} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </Card>

          {/* Pie chart by label */}
          <Card className="p-6 border-white/10 bg-card/30 backdrop-blur">
            <h3 className="text-lg font-semibold mb-6 text-white">By Detection Type</h3>
            <div className="h-[200px]">
              {isLoading ? (
                <div className="w-full h-full flex items-center justify-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={stats?.byLabel ?? []} dataKey="count" nameKey="label" cx="50%" cy="50%" outerRadius={80} paddingAngle={3}>
                      {(stats?.byLabel ?? []).map((entry, index) => (
                        <Cell key={index} fill={LABEL_COLORS[entry.label] ?? "#6366f1"} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ backgroundColor: "rgba(20,20,22,0.95)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px" }}
                      itemStyle={{ color: "#fff" }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
            {/* Legend */}
            <div className="mt-4 space-y-2">
              {(stats?.byLabel ?? []).map((entry, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ background: LABEL_COLORS[entry.label] ?? "#6366f1" }} />
                    <span className="text-muted-foreground truncate max-w-[130px]">{entry.label}</span>
                  </div>
                  <span className="font-mono font-bold text-white">{entry.count}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
