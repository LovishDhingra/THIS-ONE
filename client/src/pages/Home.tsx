import { Layout } from "@/components/Layout";
import { WebcamMonitor } from "@/components/WebcamMonitor";
import { useDetections } from "@/hooks/use-detections";
import { Card } from "@/components/ui/card";
import { AlertCircle, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export default function Home() {
  const { data: detections } = useDetections();
  
  // Get only recent events for the mini-feed
  const recentEvents = detections?.slice(0, 5) || [];

  return (
    <Layout>
      <div className="flex flex-col gap-8 h-full">
        <header className="flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white mb-2">Live Monitor</h1>
            <p className="text-muted-foreground">Real-time driver attention analysis system powered by Computer Vision.</p>
          </div>
          <div className="text-right hidden sm:block">
            <div className="text-2xl font-mono font-bold text-primary">
              {new Date().toLocaleTimeString()}
            </div>
            <div className="text-sm text-muted-foreground">
              {new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </div>
          </div>
        </header>

        <WebcamMonitor />

        {/* Recent Events Ticker */}
        <div className="mt-4">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5 text-primary" />
            Recent Activity
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {recentEvents.length === 0 ? (
              <Card className="col-span-full p-8 text-center border-dashed border-border/50 bg-transparent">
                <p className="text-muted-foreground">No recent events logged. Start monitoring to generate data.</p>
              </Card>
            ) : (
              recentEvents.map((event) => (
                <Card 
                  key={event.id} 
                  className={`p-4 border-l-4 bg-card/50 backdrop-blur hover:bg-card transition-colors ${
                    event.label === 'Distracted' ? 'border-l-red-500' : 'border-l-emerald-500'
                  }`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
                      event.label === 'Distracted' 
                        ? 'bg-red-500/20 text-red-500' 
                        : 'bg-emerald-500/20 text-emerald-500'
                    }`}>
                      {event.label}
                    </span>
                    <span className="text-xs text-muted-foreground font-mono">
                      {(event.confidence * 100).toFixed(0)}%
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(event.timestamp), { addSuffix: true })}
                  </div>
                </Card>
              ))
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
