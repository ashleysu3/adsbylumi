import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { formatInvokeError } from "@/lib/formatInvokeError";
import { autoSubmitBugReport } from "@/lib/autoBugReport";
import DashboardLayout from "@/components/DashboardLayout";
import { CampaignBuilderForm } from "@/components/CampaignBuilderForm";
import { MobileCampaignBuilder } from "@/components/MobileCampaignBuilder";
import { CampaignSuccess } from "@/components/CampaignSuccess";
import { PostLaunchWalkthrough } from "@/components/PostLaunchWalkthrough";
import { QACheckScreen } from "@/components/QACheckScreen";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AutoSaveIndicator, SaveStatus } from "@/components/AutoSaveIndicator";
import { TourFab } from "@/components/TourFab";
import { ArrowLeft, Loader2, CheckCircle2, AlertTriangle, X } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Stage = "configure" | "qa-check" | "publishing" | "success";

const STEPS = [
  { key: "configure", label: "Configure" },
  { key: "qa-check", label: "QA Check" },
] as const;

function getStepState(stepKey: string, currentStage: Stage) {
  const order = ["configure", "qa-check", "publishing", "success"];
  const stepIdx = order.indexOf(stepKey);
  const currentIdx = order.indexOf(currentStage);
  if (stepIdx < currentIdx) return "done";
  if (stepIdx === currentIdx) return "active";
  return "upcoming";
}

export default function CampaignBuilder({ embedded = false }: { embedded?: boolean } = {}) {
  const Layout: any = embedded ? (({ children }: any) => <>{children}</>) : DashboardLayout;
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { impersonatedUser, isImpersonating } = useImpersonation();
  const workspaceId = searchParams.get("workspace");

  const [workspace, setWorkspace] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [stage, setStage] = useState<Stage>("configure");
  const [answers, setAnswers] = useState<any>({});
  const [publishing, setPublishing] = useState(false);
  const [campaignIds, setCampaignIds] = useState<any>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [walkthroughOpen, setWalkthroughOpen] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);

  // Resolve campaign objective + template metadata for the walkthrough
  const objective: string | null =
    answers?.optimizationEvent ||
    workspace?.final_answers?.optimizationEvent ||
    workspace?.campaign_templates?.objective ||
    workspace?.campaign_templates?.name ||
    null;
  const templateName: string | null = workspace?.campaign_templates?.name || null;
  const templateSlug: string | null = workspace?.campaign_templates?.slug || null;
  const offerPrice: string | null = workspace?.offer_price || null;

  useEffect(() => {
    if (workspaceId && !workspace) {
      fetchWorkspace();
    }
  }, [workspaceId]);

  const fetchWorkspace = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate('/auth'); return; }

      // Fetch the workspace by itself first so a flaky sub-join (RLS on
      // offers/templates, missing FK row, etc.) can't take down the whole
      // builder and surface a confusing "Workspace not found" screen.
      const { data: ws, error: wsError } = await supabase
        .from('campaign_workspaces')
        .select('*')
        .eq('id', workspaceId)
        .maybeSingle();

      if (wsError) throw wsError;
      if (!ws) { toast.error("Workspace not found"); navigate('/dashboard'); return; }

      // Load related rows in parallel; failures here are non-fatal.
      const [brandRes, templateRes, offerRes] = await Promise.all([
        ws.brand_id
          ? supabase.from('brands').select('*').eq('id', ws.brand_id).maybeSingle()
          : Promise.resolve({ data: null, error: null } as any),
        ws.template_id
          ? supabase.from('campaign_templates').select('*').eq('id', ws.template_id).maybeSingle()
          : Promise.resolve({ data: null, error: null } as any),
        ws.offer_id
          ? supabase.from('offers').select('id, name, url, price_point').eq('id', ws.offer_id).maybeSingle()
          : Promise.resolve({ data: null, error: null } as any),
      ]);

      if (brandRes.error) console.warn('Brand load warning:', brandRes.error);
      if (templateRes.error) console.warn('Template load warning:', templateRes.error);
      if (offerRes.error) console.warn('Offer load warning:', offerRes.error);

      const data: any = {
        ...ws,
        brands: brandRes.data || null,
        campaign_templates: templateRes.data || null,
        offers: offerRes.data || null,
      };

      setWorkspace(data);
      if (data.campaign_builder_answers) {
        setAnswers(data.campaign_builder_answers as any);
      }
      // A workspace is only "really" live on Meta if it has a real campaign
      // ID — checking meta_campaign_status alone only matched 'published',
      // missing 'live' (what an actively-running campaign is stored as
      // elsewhere in the app), so re-opening an already-launched campaign
      // reset straight back to the fresh "Configure your budget" step
      // instead of recognizing it was already built. Same check ProductionManager
      // uses for hasLiveCampaign.
      const hasLiveMetaCampaign = !!(data.meta_campaign_ids && (
        Array.isArray(data.meta_campaign_ids)
          ? data.meta_campaign_ids.length > 0
          : Object.keys(data.meta_campaign_ids).length > 0
      ));
      if (hasLiveMetaCampaign) {
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

  const handleReview = () => setStage('qa-check');
  const handleBackToConfigure = () => setStage('configure');
  // The copy editor lives in Creative Studio, not the Configure (budget/
  // targeting) step. "Edit copy" and copy/policy publish errors must route
  // here. `/production` used to be that destination but is now a dead
  // redirect to `/campaigns` that drops the workspace param entirely — it
  // sent users into an unrecoverable loop (QA screen → "Edit copy" →
  // Campaigns list → same workspace → same QA screen).
  const goEditCopy = () => navigate(`/creative-studio?workspace=${workspaceId}`);
  // Meta's copy/policy disapprovals read as opaque errors to a non-marketer;
  // when the publish error looks like one, surface a direct path to edit copy.
  const isCopyPolicyError = (msg?: string | null) =>
    !!msg && /(policy|disapprov|ad copy|prohibited|unacceptable|does not comply|violat)/i.test(msg);

  // Meta refuses to create ads when the ad account has no valid card on file.
  // That's fixed in Meta's billing center, not in LUMI — link straight there.
  const isPaymentMethodError = (msg?: string | null) =>
    !!msg && /(no payment method|payment method|billing and payment|funding source|payment failed)/i.test(msg);

  const metaBillingUrl = (() => {
    const raw = (workspace?.brands?.meta_account_id || '') as string;
    const actId = raw ? (raw.startsWith('act_') ? raw : `act_${raw}`) : '';
    return actId
      ? `https://adsmanager.facebook.com/ads/manage/billing_settings?act=${actId.replace('act_', '')}`
      : 'https://business.facebook.com/billing_hub/payment_settings';
  })();

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


  const handlePublish = async (launchStatus: 'active' | 'paused' = 'paused') => {
    setPublishing(true);
    // Show the publishing screen immediately so the click always produces
    // visible feedback — the pre-flight checks below can take several seconds.
    setPublishError(null);
    setStage('publishing');
    // Any early return must send the user back to the QA screen.
    const abortToQA = (msg: string) => {
      toast.error(msg);
      setPublishing(false);
      setStage('qa-check');
    };
    try {

      // Pre-flight: ensure a destination URL is resolvable
      const resolvedUrl = answers?.finalUrl || workspace?.offer_url;
      if (!resolvedUrl) {
        // Check linked offer
        if (workspace?.offer_id) {
          const { data: offer } = await supabase
            .from('offers')
            .select('url')
            .eq('id', workspace.offer_id)
            .single();
          if (!offer?.url) {
            // Check brand website
            const { data: brand } = await supabase
              .from('brands')
              .select('website_url')
              .eq('id', workspace.brand_id)
              .single();
            if (!brand?.website_url) {
              abortToQA("No destination URL found. Please add a URL to your offer or enter a website URL in your brand settings.");
              return;
            }

          }
        } else {
          // No offer linked — check brand website
          const { data: brand } = await supabase
            .from('brands')
            .select('website_url')
            .eq('id', workspace.brand_id)
            .single();
          if (!brand?.website_url) {
            abortToQA("No destination URL found. Please add a URL to your offer or enter a website URL in your brand settings.");
            return;
          }
        }
      }

      // Enforce 10 live campaign limit — first refresh statuses from Meta
      // so paused/archived campaigns the user toggled in Meta directly stop
      // counting as live (otherwise stale "active" rows can falsely trip
      // this limit). Best-effort: cap at 12s so a slow/hung Meta sync can
      // never leave the user stuck with nothing happening.
      try {
        await Promise.race([
          supabase.functions.invoke('sync-meta-campaigns', {
            body: { brandId: workspace.brand_id },
          }),
          new Promise((resolve) => setTimeout(resolve, 12000)),
        ]);
      } catch (syncErr) {
        console.warn('Pre-publish status refresh failed (continuing):', syncErr);
      }


      // Count only genuinely-live Meta campaigns for this brand:
      //   - status is the Meta effective_status "active" (or our "live" alias)
      //   - has an actual meta_campaign_ids link (excludes drafts with stale status)
      //   - not archived in LUMI
      // Dedupe by the first meta_campaign_id so duplicate workspace rows pointing
      // at the same Meta campaign don't double-count toward the limit.
      const { data: liveRows, error: countError } = await supabase
        .from('campaign_workspaces')
        .select('id, meta_campaign_ids, meta_campaign_status, archived')
        .eq('brand_id', workspace.brand_id)
        .eq('archived', false)
        .in('meta_campaign_status', ['active', 'live']);

      if (countError) throw countError;

      // meta_campaign_ids is stored as either an object `{ campaignId }` or an
      // array of strings (older rows). Normalize both shapes, drop placeholder
      // "LUMI_" temp IDs, and dedupe by the real Meta campaign ID so duplicate
      // workspace rows pointing at the same Meta campaign don't double-count.
      const uniqueLiveMetaIds = new Set<string>();
      (liveRows || []).forEach((row: any) => {
        const raw = row?.meta_campaign_ids;
        const ids: string[] = Array.isArray(raw)
          ? raw.filter((x) => typeof x === 'string')
          : raw && typeof raw === 'object'
            ? [raw.campaignId, ...(Array.isArray(raw.campaignIds) ? raw.campaignIds : [])]
                .filter((x): x is string => typeof x === 'string' && !!x)
            : [];
        const realIds = ids.filter((id) => id && !id.startsWith('LUMI_'));
        if (realIds.length > 0) uniqueLiveMetaIds.add(realIds[0]);
      });
      const liveCount = uniqueLiveMetaIds.size;


      if (liveCount >= 10) {
        abortToQA(`You've reached the maximum of 10 live campaigns (currently ${liveCount}). Pause or archive an existing campaign before publishing a new one.`);
        return;
      }

      const { data, error } = await supabase.functions.invoke('build-meta-campaign', {
        body: {
          workspaceId,
          answers: { ...answers, launchStatus },
          ...(isImpersonating && impersonatedUser ? { actAsUserId: impersonatedUser.id } : {}),
        },
      });
      if (error) throw error;
      if (!data) throw new Error('No response from the publisher. Please try again.');
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
        const failedAdError = Array.isArray(data?.failedAds) && data.failedAds.length > 0
          ? data.failedAds[0]?.error
          : null;
        throw new Error(failedAdError || data.error || 'Failed to publish campaign');
      }
    } catch (error: any) {
      const friendlyMsg = formatInvokeError(error);
      console.error('Error publishing campaign:', friendlyMsg, error);
      await supabase
        .from('campaign_workspaces')
        .update({ meta_errors: { timestamp: new Date().toISOString(), error: friendlyMsg, stage: 'publishing' } })
        .eq('id', workspaceId);
      setPublishError(friendlyMsg || "Failed to publish campaign. Try again or contact support.");
      toast.error(friendlyMsg || "Failed to publish campaign");
      setStage('configure');
      // Auto-submit a bug report so we can investigate without the user having to file one
      autoSubmitBugReport({
        context: "Campaign publish failed",
        errorMessage: friendlyMsg || String(error?.message || error),
        extra: { workspaceId, launchStatus, rawError: String(error?.message || error) },
      });
    } finally {
      setPublishing(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  if (!workspace) {
    return (
      <Layout>
        <div className="text-center py-12">
          <p className="text-muted-foreground">Workspace not found</p>
          <Button onClick={() => navigate('/dashboard')} className="mt-4">Back to Dashboard</Button>
        </div>
      </Layout>
    );
  }

  // ── Mobile Layout ──
  if (isMobile) {
    return (
      <Layout>
        <div className="px-4 pb-24">
          <div className="flex items-center gap-3 py-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(`/creative-studio?workspace=${workspaceId}`)} className="touch-target">
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
          </div>

          {stage === 'configure' && (
            <>
              {publishError && (
                <Alert variant="destructive" className="mb-4 relative">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Publish failed — please review</AlertTitle>
                  <AlertDescription>
                    {publishError}
                    {isCopyPolicyError(publishError) && (
                      <div className="mt-3">
                        <Button size="sm" variant="outline" onClick={goEditCopy}>
                          Edit ad copy
                        </Button>
                      </div>
                    )}
                  </AlertDescription>
                  <button
                    onClick={() => setPublishError(null)}
                    aria-label="Dismiss"
                    className="absolute top-3 right-3 text-foreground/60 hover:text-foreground transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </Alert>
              )}
              <MobileCampaignBuilder workspace={workspace} answers={answers} onAnswerUpdate={handleAnswerUpdate} onComplete={handleReview} />
            </>
          )}
          {stage === 'qa-check' && (
            <QACheckScreen
              workspace={workspace}
              answers={answers}
              onBack={handleBackToConfigure}
              onProceed={handleQAComplete}
              publishing={publishing}
              onFixIssue={(type) => {
                if (type === "copy") {
                  goEditCopy();
                }
              }}
            />
          )}
          {stage === 'publishing' && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
              <h3 className="text-lg font-semibold mb-2">Publishing...</h3>
              <p className="text-sm text-muted-foreground">Creating your campaign on Meta</p>
            </div>
          )}
          {stage === 'success' && (
            <>
              <CampaignSuccess
                workspace={workspace}
                campaignIds={campaignIds}
                onBackToDashboard={(cid) => navigate(cid ? `/data?campaign=${workspace.id}` : '/dashboard')}
                onOpenWalkthrough={() => setWalkthroughOpen(true)}
              />
              <PostLaunchWalkthrough
                open={walkthroughOpen}
                onOpenChange={setWalkthroughOpen}
                workspaceId={workspace.id}
                brandId={workspace.brand_id}
                campaignName={workspace.offer_name || workspace.name}
                objective={objective}
                templateName={templateName}
                offerPrice={offerPrice}
                templateSlug={templateSlug}
                onComplete={() => navigate(`/data?campaign=${workspace.id}`)}
              />
            </>
          )}
        </div>
      </Layout>
    );
  }

  // ── Desktop Layout ──
  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(`/creative-studio?workspace=${workspaceId}`)}>
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
            <>
              {publishError && (
                <Alert variant="destructive" className="mb-4 relative">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Publish failed — please review</AlertTitle>
                  <AlertDescription>
                    {publishError}
                    {isCopyPolicyError(publishError) && (
                      <div className="mt-3">
                        <Button size="sm" variant="outline" onClick={goEditCopy}>
                          Edit ad copy
                        </Button>
                      </div>
                    )}
                  </AlertDescription>
                  <button
                    onClick={() => setPublishError(null)}
                    aria-label="Dismiss"
                    className="absolute top-3 right-3 text-foreground/60 hover:text-foreground transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </Alert>
              )}
              <CampaignBuilderForm
                workspace={workspace}
                answers={answers}
                onAnswerUpdate={handleAnswerUpdate}
                onComplete={handleReview}
              />
            </>
          )}
          {stage === 'qa-check' && (
            <QACheckScreen
              workspace={workspace}
              answers={answers}
              onBack={handleBackToConfigure}
              onProceed={handleQAComplete}
              publishing={publishing}
              onFixIssue={(type) => {
                if (type === "copy") {
                  goEditCopy();
                }
              }}
            />
          )}
          {stage === 'publishing' && (
            <div className="bg-card rounded-lg border p-12 text-center max-w-lg mx-auto">
              <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">Publishing Your Campaign</h3>
              <p className="text-muted-foreground">Creating your campaign on Meta... This may take a moment.</p>
            </div>
          )}
          {stage === 'success' && (
            <>
              <CampaignSuccess
                workspace={workspace}
                campaignIds={campaignIds}
                onBackToDashboard={(cid) => navigate(cid ? `/data?campaign=${workspace.id}` : '/dashboard')}
                onOpenWalkthrough={() => setWalkthroughOpen(true)}
              />
              <PostLaunchWalkthrough
                open={walkthroughOpen}
                onOpenChange={setWalkthroughOpen}
                workspaceId={workspace.id}
                brandId={workspace.brand_id}
                campaignName={workspace.offer_name || workspace.name}
                objective={objective}
                templateName={templateName}
                offerPrice={offerPrice}
                templateSlug={templateSlug}
                onComplete={() => navigate(`/data?campaign=${workspace.id}`)}
              />
            </>
          )}
        </div>
      </div>
      {stage === 'configure' && (
        <TourFab
          steps={[{
            targetSelector: '[data-help-target="campaign-review"]',
            title: "Campaign setup",
            description: "Review your campaign settings, then hit Continue below to move to the QA check before publishing.",
          }]}
        />
      )}
    </Layout>
  );
}

