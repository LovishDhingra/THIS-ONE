import { Layout } from "@/components/Layout";
import { useScreenshots, useDeleteScreenshot, useDeleteAllScreenshots } from "@/hooks/use-detections";
import { format } from "date-fns";
import { Camera, Clock, ImageOff, Trash2, Loader2, Lock, KeyRound, Eye, EyeOff, LogOut, ShieldAlert } from "lucide-react";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

export default function Screenshots() {
  const [tokenState, setTokenState] = useState<string | null>(
    typeof window !== "undefined" ? localStorage.getItem("admin_token") : null
  );
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState("");

  const { data: screenshots, isLoading, error } = useScreenshots(tokenState);
  const deleteScreenshot = useDeleteScreenshot();
  const deleteAllScreenshots = useDeleteAllScreenshots();
  const { toast } = useToast();
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const selected = screenshots?.find((s) => s.id === selectedId) ?? null;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingIn(true);
    setLoginError("");

    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (res.ok) {
        const data = await res.json();
        localStorage.setItem("admin_token", data.token);
        setTokenState(data.token);
        toast({
          title: "Admin Access Granted",
          description: "You have successfully authenticated as administrator.",
        });
      } else {
        const data = await res.json();
        setLoginError(data.message || "Invalid administrator password");
      }
    } catch (err) {
      setLoginError("Failed to connect to authentication server");
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("admin_token");
    setTokenState(null);
    toast({
      title: "Logged Out",
      description: "Admin session terminated successfully.",
    });
  };

  const handleDelete = (id: number) => {
    deleteScreenshot.mutate(id, {
      onSuccess: () => {
        toast({
          title: "Screenshot deleted",
          description: "The screenshot has been deleted successfully.",
        });
        setSelectedId(null);
      },
      onError: () => {
        toast({
          title: "Error",
          description: "Failed to delete the screenshot.",
          variant: "destructive",
        });
      }
    });
  };

  const handleDeleteAll = () => {
    if (confirm("Are you sure you want to delete all screenshots? This action cannot be undone.")) {
      deleteAllScreenshots.mutate(undefined, {
        onSuccess: () => {
          toast({
            title: "All screenshots deleted",
            description: "All captured screenshots have been cleared.",
          });
        },
        onError: () => {
          toast({
            title: "Error",
            description: "Failed to clear screenshots.",
            variant: "destructive",
          });
        }
      });
    }
  };

  // Determine if we need to show the login wall
  const isUnauthorized = !tokenState || (error && error.message === "Unauthorized");

  if (isUnauthorized) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[70vh]">
          <div className="w-full max-w-md p-8 rounded-2xl border border-white/10 bg-card/40 backdrop-blur-md shadow-2xl relative overflow-hidden">
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-primary/5 rounded-full blur-3xl pointer-events-none" />
            
            <div className="flex flex-col items-center text-center mb-8">
              <div className="p-4 bg-primary/10 rounded-full text-primary mb-4 border border-primary/20 shadow-[0_0_15px_rgba(45,212,191,0.1)]">
                <Lock className="w-8 h-8" />
              </div>
              <h2 className="text-2xl font-bold tracking-tight text-white mb-2">Admin Panel Required</h2>
              <p className="text-sm text-muted-foreground max-w-xs">
                Screenshots contain driver monitoring audits and can only be accessed or deleted by administrators.
              </p>
            </div>

            <form onSubmit={handleLogin} className="space-y-5">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
                  Administrator Password
                </label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    className="pl-10 pr-10 bg-black/40 border-white/10 text-white focus:border-primary/50"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {loginError && (
                <div className="p-3.5 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-400 flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 shrink-0" />
                  <span>{loginError}</span>
                </div>
              )}

              <Button
                type="submit"
                className="w-full bg-primary hover:bg-primary/90 text-background font-semibold"
                disabled={isLoggingIn}
              >
                {isLoggingIn ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Authenticating...
                  </>
                ) : (
                  "Unlock Panel"
                )}
              </Button>
            </form>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 pb-6 border-b border-white/5">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-bold tracking-tight text-white">
                Screenshots
              </h1>
              <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Admin Session Active
              </span>
            </div>
            <p className="text-muted-foreground">
              Randomly captured audit snapshots from active monitoring sessions.
              Automatically deleted after 72 hours.
            </p>
          </div>
          
          <div className="flex items-center gap-3 self-start md:self-center shrink-0">
            {screenshots && screenshots.length > 0 && (
              <Button
                variant="outline"
                className="border-red-500/30 hover:border-red-500 hover:bg-red-500/10 text-red-400 hover:text-red-300 h-10"
                onClick={handleDeleteAll}
                disabled={deleteAllScreenshots.isPending}
              >
                {deleteAllScreenshots.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4 mr-2" />
                )}
                Clear All
              </Button>
            )}
            
            <Button
              variant="outline"
              className="border-white/10 hover:bg-white/5 text-muted-foreground hover:text-foreground h-10"
              onClick={handleLogout}
            >
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => (
              <div
                key={i}
                className="aspect-video bg-card/50 animate-pulse rounded-lg border border-white/5"
              />
            ))}
          </div>
        ) : !screenshots?.length ? (
          <div className="rounded-xl border border-white/10 bg-card/30 backdrop-blur p-16 flex flex-col items-center justify-center text-center gap-3">
            <ImageOff className="w-10 h-10 text-muted-foreground" />
            <p className="text-muted-foreground">
              No screenshots captured in the last 72 hours.
            </p>
            <p className="text-xs text-muted-foreground">
              Start Live Monitor to begin randomly capturing audit snapshots.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {screenshots.map((s) => (
              <div
                key={s.id}
                className="group relative aspect-video rounded-lg overflow-hidden border border-white/10 bg-black/40 hover:border-primary/50 transition-colors"
              >
                <button
                  onClick={() => setSelectedId(s.id)}
                  data-testid={`card-screenshot-${s.id}`}
                  className="w-full h-full text-left cursor-zoom-in"
                >
                  <img
                    src={s.image}
                    alt={`Screenshot ${s.id}`}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/0 to-black/0 opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-3">
                    <div className="flex items-center gap-1.5 text-xs text-white font-mono">
                      <Clock className="w-3 h-3" />
                      {format(new Date(s.timestamp), "MMM dd, HH:mm:ss")}
                    </div>
                  </div>
                  <div className="absolute top-2 left-2 flex items-center gap-1 bg-black/60 backdrop-blur px-2 py-0.5 rounded-full text-[10px] font-mono text-white/80">
                    <Camera className="w-3 h-3" />#{s.id}
                  </div>
                </button>
                <Button
                  variant="destructive"
                  size="icon"
                  className="absolute top-2 right-2 w-7 h-7 bg-red-600/90 hover:bg-red-600 border border-red-500/50 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(s.id);
                  }}
                  disabled={deleteScreenshot.isPending}
                >
                  {deleteScreenshot.isPending && selectedId === s.id ? (
                    <Loader2 className="w-3.5 h-3.5 text-white animate-spin" />
                  ) : (
                    <Trash2 className="w-3.5 h-3.5 text-white" />
                  )}
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={selectedId !== null} onOpenChange={(open) => !open && setSelectedId(null)}>
        <DialogContent className="max-w-3xl bg-card border-white/10">
          <DialogHeader>
            <div className="flex items-center justify-between pr-6">
              <DialogTitle className="font-mono text-sm">
                Screenshot #{selected?.id.toString().padStart(6, "0")}
                {selected && (
                  <span className="text-muted-foreground font-normal ml-2">
                    {format(new Date(selected.timestamp), "MMM dd, yyyy HH:mm:ss")}
                  </span>
                )}
              </DialogTitle>
              {selected && (
                <Button
                  variant="destructive"
                  size="sm"
                  className="flex items-center gap-1.5 h-8"
                  onClick={() => handleDelete(selected.id)}
                  disabled={deleteScreenshot.isPending}
                >
                  {deleteScreenshot.isPending ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="w-3.5 h-3.5" />
                  )}
                  Delete
                </Button>
              )}
            </div>
          </DialogHeader>
          {selected && (
            <img
              src={selected.image}
              alt={`Screenshot ${selected.id}`}
              className="w-full rounded-lg border border-white/10"
            />
          )}
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
