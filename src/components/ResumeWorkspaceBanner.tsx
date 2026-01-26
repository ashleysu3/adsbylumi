import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, X, Clock, Sparkles } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import lumiLogo from "@/assets/lumi-logo.png";

interface ResumeWorkspaceBannerProps {
  brandId: string;
}

interface InProgressWorkspace {
  id: string;
  name: string;
  progress_status: string;
  offer_name: string | null;
  updated_at: string;
  creative_json: any;
}

const STATUS_LABELS: Record<string, string> = {
  draft: "Just started",
  creative_in_progress: "Creating ads",
  waiting_for_assets: "Needs uploads",
};

export function ResumeWorkspaceBanner({ brandId }: ResumeWorkspaceBannerProps) {
  const navigate = useNavigate();
  const [workspace, setWorkspace] = useState<InProgressWorkspace | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRecentIncomplete();
  }, [brandId]);

  const fetchRecentIncomplete = async () => {
    try {
      // Get the most recently updated incomplete workspace
      const { data, error } = await supabase
        .from("campaign_workspaces")
        .select("id, name, progress_status, offer_name, updated_at, creative_json")
        .eq("brand_id", brandId)
        .eq("archived", false)
        .in("progress_status", ["draft", "creative_in_progress", "waiting_for_assets"])
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      
      // Only show if updated within last 7 days
      if (data) {
        const updatedAt = new Date(data.updated_at);
        const daysSinceUpdate = (Date.now() - updatedAt.getTime()) / (1000 * 60 * 60 * 24);
        if (daysSinceUpdate <= 7) {
          setWorkspace(data);
        }
      }
    } catch (error) {
      console.error("Error fetching incomplete workspace:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
    // Remember dismissal for this session
    sessionStorage.setItem(`dismissed_resume_${workspace?.id}`, "true");
  };

  const handleResume = () => {
    if (workspace) {
      navigate(`/creative-studio?workspace=${workspace.id}`);
    }
  };

  // Check if already dismissed this session
  useEffect(() => {
    if (workspace) {
      const wasDismissed = sessionStorage.getItem(`dismissed_resume_${workspace.id}`);
      if (wasDismissed) {
        setDismissed(true);
      }
    }
  }, [workspace]);

  if (loading || !workspace || dismissed) {
    return null;
  }

  const creativeJson = workspace.creative_json as any;
  const anglesCount = creativeJson?.angles?.length || 0;
  const selectedAnglesCount = creativeJson?.selectedAngleIds?.length || 0;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className="mb-4"
      >
        <Card className="border-primary/20 bg-gradient-to-r from-primary/5 via-background to-primary/5 overflow-hidden">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-start gap-3">
              {/* Lumi avatar */}
              <div className="flex-shrink-0 hidden sm:block">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <img src={lumiLogo} alt="Lumi" className="h-6 w-6" />
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1">
                    <p className="text-sm font-medium flex items-center gap-1.5">
                      <Sparkles className="h-3.5 w-3.5 text-primary" />
                      Continue your ad?
                    </p>
                    <p className="text-xs text-muted-foreground line-clamp-1">
                      <span className="font-medium">{workspace.name}</span>
                      {workspace.offer_name && (
                        <span> • {workspace.offer_name}</span>
                      )}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 shrink-0"
                    onClick={handleDismiss}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>

                {/* Progress indicators */}
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  <Badge variant="outline" className="text-xs gap-1 py-0.5">
                    <Clock className="h-3 w-3" />
                    {formatDistanceToNow(new Date(workspace.updated_at), { addSuffix: true })}
                  </Badge>
                  <Badge variant="secondary" className="text-xs py-0.5">
                    {STATUS_LABELS[workspace.progress_status] || workspace.progress_status}
                  </Badge>
                  {anglesCount > 0 && (
                    <Badge variant="secondary" className="text-xs py-0.5">
                      {selectedAnglesCount || anglesCount} angle{anglesCount !== 1 ? "s" : ""}
                    </Badge>
                  )}
                </div>

                {/* Action button */}
                <div className="mt-3">
                  <Button size="sm" onClick={handleResume} className="gap-1.5 h-8">
                    Resume
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </AnimatePresence>
  );
}
