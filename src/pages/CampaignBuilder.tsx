import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import { CampaignChat } from "@/components/CampaignChat";
import { CampaignSummary } from "@/components/CampaignSummary";
import { CampaignReview } from "@/components/CampaignReview";
import { CampaignSuccess } from "@/components/CampaignSuccess";
import { Button } from "@/components/ui/button";
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
import { ArrowLeft, Loader2, RotateCcw } from "lucide-react";
import { toast } from "sonner";

export default function CampaignBuilder() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const workspaceId = searchParams.get("workspace");

  const [workspace, setWorkspace] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [stage, setStage] = useState<"chat" | "review" | "publishing" | "success">("chat");
  const [answers, setAnswers] = useState<any>({});
  const [chatHistory, setChatHistory] = useState<any[]>([]);
  const [publishing, setPublishing] = useState(false);
  const [campaignIds, setCampaignIds] = useState<any>(null);

  useEffect(() => {
    if (workspaceId && !workspace) {
      fetchWorkspace();
    }
  }, [workspaceId]);

  const fetchWorkspace = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/auth');
        return;
      }

      const { data, error } = await supabase
        .from('campaign_workspaces')
        .select(`
          *,
          brands!inner(
            *
          )
        `)
        .eq('id', workspaceId)
        .single();

      if (error) throw error;
      if (!data) {
        toast.error("Workspace not found");
        navigate('/dashboard');
        return;
      }

      setWorkspace(data);
      
      // Load existing chat history and answers if resuming
      const chatHistory = data.chat_history as any[];
      if (chatHistory && chatHistory.length > 0) {
        setChatHistory(chatHistory);
      }
      if (data.campaign_builder_answers) {
        setAnswers(data.campaign_builder_answers as any);
      }
      
      // If already published, go straight to success
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
    // Auto-save to database
    saveProgress(newAnswers);
  };

  const handleChatUpdate = (messages: any[]) => {
    setChatHistory(messages);
    // Auto-save chat history
    saveChatHistory(messages);
  };

  const saveProgress = async (newAnswers: any) => {
    try {
      await supabase
        .from('campaign_workspaces')
        .update({ 
          campaign_builder_answers: newAnswers,
          updated_at: new Date().toISOString()
        })
        .eq('id', workspaceId);
    } catch (error) {
      console.error('Error saving progress:', error);
    }
  };

  const saveChatHistory = async (messages: any[]) => {
    try {
      await supabase
        .from('campaign_workspaces')
        .update({ 
          chat_history: messages,
          updated_at: new Date().toISOString()
        })
        .eq('id', workspaceId);
    } catch (error) {
      console.error('Error saving chat history:', error);
    }
  };

  const handleReview = () => {
    setStage('review');
  };

  const handleBackToChat = () => {
    setStage('chat');
  };

  const handleRestart = async () => {
    try {
      // Clear chat history and answers in database
      await supabase
        .from('campaign_workspaces')
        .update({ 
          chat_history: [],
          campaign_builder_answers: {},
          updated_at: new Date().toISOString()
        })
        .eq('id', workspaceId);

      // Reset local state
      setChatHistory([]);
      setAnswers({});
      setStage('chat');
      
      toast.success("Campaign builder restarted");
    } catch (error: any) {
      console.error('Error restarting builder:', error);
      toast.error("Failed to restart");
    }
  };

  const handlePublish = async () => {
    setStage('publishing');
    setPublishing(true);

    try {
      const { data, error } = await supabase.functions.invoke('build-meta-campaign', {
        body: { 
          workspaceId,
          answers 
        }
      });

      if (error) throw error;

      if (data.success) {
        setCampaignIds(data.campaignIds);
        
        // Update workspace with campaign IDs
        await supabase
          .from('campaign_workspaces')
          .update({ 
            meta_campaign_ids: data.campaignIds,
            meta_campaign_status: 'published',
            published_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', workspaceId);

        setStage('success');
        toast.success("Campaign published successfully!");
      } else {
        throw new Error(data.error || 'Failed to publish campaign');
      }
    } catch (error: any) {
      console.error('Error publishing campaign:', error);
      
      // Save error to workspace
      await supabase
        .from('campaign_workspaces')
        .update({ 
          meta_errors: {
            timestamp: new Date().toISOString(),
            error: error.message,
            stage: 'publishing'
          }
        })
        .eq('id', workspaceId);

      toast.error(error.message || "Failed to publish campaign");
      setStage('review'); // Go back to review to retry
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
          <Button onClick={() => navigate('/dashboard')} className="mt-4">
            Back to Dashboard
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(`/production?workspace=${workspaceId}`)}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold">Campaign Builder</h1>
              <p className="text-muted-foreground">{workspace.name}</p>
            </div>
            
            {/* Restart Button - only show during chat or review stages */}
            {(stage === 'chat' || stage === 'review') && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2">
                    <RotateCcw className="h-4 w-4" />
                    Restart
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Restart Campaign Builder?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will clear all your answers and chat history. You'll start from the beginning with a fresh conversation. This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleRestart}>
                      Yes, Restart
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>

          {/* Progress Steps */}
          <div className="flex items-center gap-2 text-sm">
            <div className={`flex items-center gap-2 ${stage === 'chat' ? 'text-primary font-medium' : 'text-muted-foreground'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${stage === 'chat' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                1
              </div>
              <span>Questions</span>
            </div>
            <div className="w-12 h-px bg-border" />
            <div className={`flex items-center gap-2 ${stage === 'review' ? 'text-primary font-medium' : stage === 'publishing' || stage === 'success' ? 'text-muted-foreground' : 'text-muted-foreground/50'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${stage === 'review' ? 'bg-primary text-primary-foreground' : stage === 'publishing' || stage === 'success' ? 'bg-muted' : 'bg-muted/50'}`}>
                2
              </div>
              <span>Review</span>
            </div>
            <div className="w-12 h-px bg-border" />
            <div className={`flex items-center gap-2 ${stage === 'publishing' ? 'text-primary font-medium' : stage === 'success' ? 'text-muted-foreground' : 'text-muted-foreground/50'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${stage === 'publishing' ? 'bg-primary text-primary-foreground' : stage === 'success' ? 'bg-muted' : 'bg-muted/50'}`}>
                3
              </div>
              <span>Publishing</span>
            </div>
            <div className="w-12 h-px bg-border" />
            <div className={`flex items-center gap-2 ${stage === 'success' ? 'text-primary font-medium' : 'text-muted-foreground/50'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${stage === 'success' ? 'bg-primary text-primary-foreground' : 'bg-muted/50'}`}>
                4
              </div>
              <span>Live</span>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Chat or Review/Success */}
          <div className="lg:col-span-2">
            {stage === 'chat' && (
              <CampaignChat
                workspace={workspace}
                chatHistory={chatHistory}
                answers={answers}
                onAnswerUpdate={handleAnswerUpdate}
                onChatUpdate={handleChatUpdate}
                onComplete={handleReview}
              />
            )}

            {stage === 'review' && (
              <CampaignReview
                workspace={workspace}
                answers={answers}
                onBack={handleBackToChat}
                onPublish={handlePublish}
              />
            )}

            {stage === 'publishing' && (
              <div className="bg-card rounded-lg border p-12 text-center">
                <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
                <h3 className="text-xl font-semibold mb-2">Publishing Your Campaign</h3>
                <p className="text-muted-foreground">
                  Creating your campaign on Meta... This may take a moment.
                </p>
              </div>
            )}

            {stage === 'success' && (
              <CampaignSuccess
                workspace={workspace}
                campaignIds={campaignIds}
                onBackToDashboard={() => navigate('/dashboard')}
              />
            )}
          </div>

          {/* Summary Sidebar */}
          <div className="lg:col-span-1">
            <CampaignSummary
              workspace={workspace}
              answers={answers}
              stage={stage}
            />
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
