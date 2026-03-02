import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import { CampaignBuilderForm } from "@/components/CampaignBuilderForm";
import { MobileCampaignBuilder } from "@/components/MobileCampaignBuilder";
import { CampaignReview } from "@/components/CampaignReview";
import { CampaignSuccess } from "@/components/CampaignSuccess";
import { QACheckScreen } from "@/components/QACheckScreen";
import { Button } from "@/components/ui/button";
import { AutoSaveIndicator, SaveStatus } from "@/components/AutoSaveIndicator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ArrowLeft, Loader2, RotateCcw, Save, CheckCircle2 } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Stage = "configure" | "review" | "qa-check" | "publishing" | "success";

const STEPS = [
  { key: "configure", label: "Configure" },
  { key: "review", label: "Review" },
  { key: "qa-check", label: "QA Check" },
] as const;

function getStepState(stepKey: string, currentStage: Stage) {
  const order = ["configure", "review", "qa-check", "publishing", "success"];
  const stepIdx = order.indexOf(stepKey);
  const currentIdx = order.indexOf(currentStage);
  if (stepIdx < currentIdx) return "done";
  if (stepIdx === currentIdx) return "active";
  return "upcoming";
}

export default function CampaignBuilder() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const workspaceId = searchParams.get("workspace");

  const [workspace, setWorkspace] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [stage, setStage] = useState<Stage>("configure");
  const [answers, setAnswers] = useState<any>({});
  const [publishing, setPublishing] = useState(false);
  const [campaignIds, setCampaignIds] = useState<any>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");

  useEffect(() => {
    if (workspaceId && !workspace) {
      fetchWorkspace();
    }
  }, [workspaceId]);

  const fetchWorkspace = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate('/auth'); return; }

      const { data, error } = await supabase
        .from('campaign_workspaces')
        .select(`*, brands!inner(*), campaign_templates(*)`)
        .eq('id', workspaceId)
        .single();

      if (error) throw error;
      if (!data) { toast.error("Workspace not found"); navigate('/dashboard'); return; }

      setWorkspace(data);
      if (data.campaign_builder_answers) {
        setAnswers(data.campaign_builder_answers as any);
      }
      if (data.meta_campaign_status === 'published') {
        setStage('success');
        setCampaignIds(data.meta_campaign_ids);
      }
    } catch (error: any) {
      console.error('Error fetching workspace:', error);
      toast.error("Failed to load workspace");
    } finally {
      setLoading(false);
    }
  };

  const handleAnswerUpdate = (newAnswers: any) => {
    setAnswers(newAnswers);
    saveProgress(newAnswers);
  };

  const saveProgress = async (newAnswers: any) => {
    setSaveStatus("saving");
    try {
      await supabase
        .from('campaign_workspaces')
        .update({ campaign_builder_answers: newAnswers, updated_at: new Date().toISOString() })
        .eq('id', workspaceId);
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 2000);
    } catch {
      setSaveStatus("error");
      setTimeout(() => setSaveStatus("idle"), 3000);
    }
  };

  const handleReview = () => setStage('review');
  const handleBackToConfigure = () => setStage('configure');
  const handleStartQACheck = () => setStage('qa-check');
  const handleBackToReview = () => setStage('review');

  const handleQAComplete = () => {
    handlePublish(answers.launchActive ? 'active' : 'paused');
  };

  const handleSaveAsDraft = async () => {
    try {
      await supabase
        .from('campaign_workspaces')
        .update({
          campaign_builder_answers: answers,
          progress_status: 'draft',
          updated_at: new Date().toISOString(),
        })
        .eq('id', workspaceId);
      toast.success("Progress saved as draft");
      navigate('/campaigns');
    } catch {
      toast.error("Failed to save draft");
    }
  };

  const handleRestart = async () => {
    try {
      await supabase
        .from('campaign_workspaces')
        .update({ chat_history: [], campaign_builder_answers: {}, updated_at: new Date().toISOString() })
        .eq('id', workspaceId);
      setAnswers({});
      setStage('configure');
      toast.success("Campaign builder restarted");
    } catch {
      toast.error("Failed to restart");
    }
  };

  const handlePublish = async (launchStatus: 'active' | 'paused' = 'paused') => {
    setStage('publishing');
    setPublishing(true);
    try {
      const { data, error } = await supabase.functions.invoke('build-meta-campaign', {
        body: { workspaceId, answers: { ...answers, launchStatus } },
      });
      if (error) throw error;
      if (data.success) {
        const campaignData = { ...data.campaignIds, launchStatus };
        setCampaignIds(campaignData);
        await supabase
          .from('campaign_workspaces')
          .update({
            meta_campaign_ids: campaignData,
            meta_campaign_status: launchStatus === 'active' ? 'live' : 'published',
            published_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', workspaceId);
        setStage('success');
        toast.success(launchStatus === 'active'
          ? "Campaign is live! Ads will start after Meta approval."
          : "Campaign published in paused status!");
      } else {
        throw new Error(data.error || 'Failed to publish campaign');
      }
    } catch (error: any) {
      console.error('Error publishing campaign:', error);
      await supabase
        .from('campaign_workspaces')
        .update({ meta_errors: { timestamp: new Date().toISOString(), error: error.message, stage: 'publishing' } })
        .eq('id', workspaceId);
      toast.error(error.message || "Failed to publish campaign");
      setStage('review');
    } finally {
      setPublishing(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  if (!workspace) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <p className="text-muted-foreground">Workspace not found</p>
          <Button onClick={() => navigate('/dashboard')} className="mt-4">Back to Dashboard</Button>
        </div>
      </DashboardLayout>
    );
  }

  // ── Mobile Layout ──
  if (isMobile) {
    return (
      <DashboardLayout>
        <div className="px-4 pb-24">
          <div className="flex items-center gap-3 py-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(`/production?workspace=${workspaceId}`)} className="touch-target">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex-1 min-w-0">
              <h1 className="text-lg font-bold truncate">{workspace.name}</h1>
              <div className="flex items-center gap-2">
                <p className="text-xs text-muted-foreground">Campaign Builder</p>
                {saveStatus !== "idle" && (
                  <>
                    <span className="text-muted-foreground/50">•</span>
                    <AutoSaveIndicator status={saveStatus} size="sm" />
                  </>
                )}
              </div>
            </div>
            {(stage === 'configure' || stage === 'review') && (
              <RestartDialog onSaveAsDraft={handleSaveAsDraft} onRestart={handleRestart} />
            )}
          </div>

          {stage === 'configure' && (
            <MobileCampaignBuilder workspace={workspace} answers={answers} onAnswerUpdate={handleAnswerUpdate} onComplete={handleReview} />
          )}
          {stage === 'review' && (
            <CampaignReview workspace={workspace} answers={answers} onBack={handleBackToConfigure} onPublish={handleStartQACheck} />
          )}
          {stage === 'qa-check' && (
            <QACheckScreen workspace={workspace} answers={answers} onBack={handleBackToReview} onProceed={handleQAComplete} />
          )}
          {stage === 'publishing' && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
              <h3 className="text-lg font-semibold mb-2">Publishing...</h3>
              <p className="text-sm text-muted-foreground">Creating your campaign on Meta</p>
            </div>
          )}
          {stage === 'success' && (
            <CampaignSuccess workspace={workspace} campaignIds={campaignIds} onBackToDashboard={() => navigate('/dashboard')} />
          )}
        </div>
      </DashboardLayout>
    );
  }

  // ── Desktop Layout ──
  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(`/production?workspace=${workspaceId}`)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold">Campaign Builder</h1>
              <div className="flex items-center gap-2">
                <p className="text-muted-foreground">{workspace.name}</p>
                {saveStatus !== "idle" && (
                  <>
                    <span className="text-muted-foreground/50">•</span>
                    <AutoSaveIndicator status={saveStatus} />
                  </>
                )}
              </div>
            </div>
            {(stage === 'configure' || stage === 'review') && (
              <RestartDialog onSaveAsDraft={handleSaveAsDraft} onRestart={handleRestart} />
            )}
          </div>

          {/* 3-Step Progress */}
          <div className="flex items-center gap-2 text-sm">
            {STEPS.map((step, idx) => {
              const state = getStepState(step.key, stage);
              return (
                <div key={step.key} className="flex items-center gap-2">
                  {idx > 0 && <div className="w-10 h-px bg-border" />}
                  <div className={cn(
                    "flex items-center gap-2",
                    state === "active" && "text-primary font-medium",
                    state === "done" && "text-muted-foreground",
                    state === "upcoming" && "text-muted-foreground/50",
                  )}>
                    <div className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center text-sm",
                      state === "active" && "bg-primary text-primary-foreground",
                      state === "done" && "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400",
                      state === "upcoming" && "bg-muted/50 text-muted-foreground/50",
                    )}>
                      {state === "done" ? <CheckCircle2 className="h-4 w-4" /> : idx + 1}
                    </div>
                    <span>{step.label}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Main Content — full width, no sidebar */}
        <div>
          {stage === 'configure' && (
            <CampaignBuilderForm
              workspace={workspace}
              answers={answers}
              onAnswerUpdate={handleAnswerUpdate}
              onComplete={handleReview}
            />
          )}
          {stage === 'review' && (
            <CampaignReview workspace={workspace} answers={answers} onBack={handleBackToConfigure} onPublish={handleStartQACheck} />
          )}
          {stage === 'qa-check' && (
            <QACheckScreen workspace={workspace} answers={answers} onBack={handleBackToReview} onProceed={handleQAComplete} />
          )}
          {stage === 'publishing' && (
            <div className="bg-card rounded-lg border p-12 text-center max-w-lg mx-auto">
              <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">Publishing Your Campaign</h3>
              <p className="text-muted-foreground">Creating your campaign on Meta... This may take a moment.</p>
            </div>
          )}
          {stage === 'success' && (
            <CampaignSuccess workspace={workspace} campaignIds={campaignIds} onBackToDashboard={() => navigate('/dashboard')} />
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}

function RestartDialog({ onSaveAsDraft, onRestart }: { onSaveAsDraft: () => void; onRestart: () => void }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <RotateCcw className="h-4 w-4" />
          <span className="hidden sm:inline">Restart</span>
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Restart Campaign Builder?</AlertDialogTitle>
          <AlertDialogDescription>
            Save your progress as a draft, or start completely fresh.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col sm:flex-row gap-2">
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <Button variant="outline" onClick={onSaveAsDraft} className="gap-2">
            <Save className="h-4 w-4" />
            Save as Draft
          </Button>
          <AlertDialogAction onClick={onRestart} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
            Start Fresh
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
