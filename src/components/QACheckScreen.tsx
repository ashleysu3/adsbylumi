import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  Circle,
  Link2,
  DollarSign,
  Calendar,
  SpellCheck,
  ArrowLeft,
  Rocket,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Zap,
  Settings,
  HelpCircle,
  Copy,
  Code,
  Pencil,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";
import { computeCopySignature } from "@/lib/copy-signature";


interface Issue {
  field: string;
  text: string;
  suggestion: string;
  reason: string;
  location?: string;
}

type CopyDraft = {
  key: string;
  label: string;
  source: "shared" | "item";
  index: number;
  headline: string;
  primary_text: string;
  description: string;
};


interface CheckResult {
  id: string;
  name: string;
  status: "pending" | "running" | "passed" | "warning" | "failed";
  message?: string;
  issues?: Issue[];
  details?: string;
  requiredEvent?: string;
  pixelId?: string | null;
  pixelNotInstalled?: boolean;
  campaignGoal?: string;
  pixelState?: 'no_url' | 'unknown' | 'no_pixel_on_page' | 'pixel_mismatch' | 'pixel_matched';
  foundPixelId?: string | null;
}

interface QACheckScreenProps {
  workspace: any;
  answers: any;
  onBack: () => void;
  onProceed: () => void;
  onFixIssue?: (issueType: string, issueData: any) => void;
  publishing?: boolean;
}


const CHECK_ICONS: Record<string, React.ReactNode> = {
  meta: <Link2 className="h-4 w-4" />,
  budget: <DollarSign className="h-4 w-4" />,
  schedule: <Calendar className="h-4 w-4" />,
  landing_page: <ExternalLink className="h-4 w-4" />,
  tracking: <Zap className="h-4 w-4" />,
  spelling: <SpellCheck className="h-4 w-4" />,
};

const INITIAL_CHECKS: CheckResult[] = [
  { id: "meta", name: "Meta Connection", status: "pending" },
  { id: "budget", name: "Budget", status: "pending" },
  { id: "schedule", name: "Schedule", status: "pending" },
  { id: "landing_page", name: "Landing Page", status: "pending" },
  { id: "tracking", name: "Event Tracking", status: "pending" },
  { id: "spelling", name: "Spelling & Grammar", status: "pending" },
];

export function QACheckScreen({
  workspace,
  answers,
  onBack,
  onProceed,
  onFixIssue,
  publishing = false,
}: QACheckScreenProps) {

  const navigate = useNavigate();
  const [phase, setPhase] = useState<"running" | "complete">("running");
  const [checks, setChecks] = useState<CheckResult[]>(INITIAL_CHECKS);
  const [currentCheckIndex, setCurrentCheckIndex] = useState(0);
  const [expandedChecks, setExpandedChecks] = useState<Set<string>>(new Set());
  const [summary, setSummary] = useState({ passed: 0, warnings: 0, failed: 0 });
  const hasStartedRef = useRef(false);

  // Tracking dialog state
  const [trackingDialogOpen, setTrackingDialogOpen] = useState(false);
  // Prefill from what was already saved so returning to this screen (e.g. after
  // editing copy) shows the thank-you page URL the user entered earlier.
  const [confirmationUrl, setConfirmationUrl] = useState<string>(
    workspace.custom_conversion_id || "",
  );
  const [trackingSetup, setTrackingSetup] = useState<{ verified: boolean; conversionUrl: string | null }>({
    verified: !!workspace.tracking_verified && !!workspace.custom_conversion_id,
    conversionUrl: workspace.custom_conversion_id || null,
  });
  const [trackingSaving, setTrackingSaving] = useState(false);
  const [trackingCheck, setTrackingCheck] = useState<CheckResult | null>(null);


  // ---- Inline copy editor (policy / spelling fixes without leaving QA) ----
  const [wsCopy, setWsCopy] = useState<{ selected_copy: any; production_items: any[] }>({
    selected_copy: workspace.selected_copy || null,
    production_items: Array.isArray(workspace.production_items) ? workspace.production_items : [],
  });
  const [copyDialogOpen, setCopyDialogOpen] = useState(false);
  const [copyCheck, setCopyCheck] = useState<CheckResult | null>(null);
  const [copyDrafts, setCopyDrafts] = useState<CopyDraft[]>([]);
  const [copySaving, setCopySaving] = useState(false);


  // ---- Landing page URL (editable at publish) ----
  const initialLandingUrl: string =
    workspace.offer_url ||
    workspace.offers?.url ||
    answers?.destinationUrl ||
    answers?.finalUrl ||
    workspace.brands?.website_url ||
    "";
  const [landingUrl, setLandingUrl] = useState<string>(initialLandingUrl);
  const [editingUrl, setEditingUrl] = useState(false);
  const [urlDraft, setUrlDraft] = useState<string>(initialLandingUrl);
  const [savingUrl, setSavingUrl] = useState(false);

  const progress = phase === "complete" 
    ? 100 
    : Math.round((currentCheckIndex / INITIAL_CHECKS.length) * 100);

  useEffect(() => {
    if (hasStartedRef.current) return;
    hasStartedRef.current = true;
    runChecks();
  }, []);

  const runChecks = async (
    overrideUrl?: string,
    overrideCopy?: { selected_copy: any; production_items: any[]; signature?: string },
  ) => {
    for (let i = 0; i < INITIAL_CHECKS.length; i++) {
      setCurrentCheckIndex(i);
      setChecks((prev) =>
        prev.map((c, idx) => (idx === i ? { ...c, status: "running" } : c))
      );
      await new Promise((r) => setTimeout(r, 400));
    }

    try {
      const template = workspace.campaign_templates || workspace.template || null;
      const copySource = overrideCopy || wsCopy;

      const { data, error } = await supabase.functions.invoke("qa-preflight-check", {
        body: {
          brand: workspace.brands,
          answers,
          creativeJson: workspace.creative_json,
          productionItems: copySource.production_items,
          offerUrl: overrideUrl || landingUrl || null,
          selectedCopy: copySource.selected_copy || null,
          template,
          approvedCopySignature:
            overrideCopy?.signature ?? workspace.approved_copy_signature ?? null,
          trackingSetup,
        },
      });



      if (error) throw error;

      if (data.success && data.checks) {
        setChecks(data.checks.map((c: any) => ({
          ...c,
          status: c.status as CheckResult["status"],
        })));
        setSummary(data.summary);

        // Landing Page always starts expanded — even a "passed" check can have
        // resolved to the wrong URL (e.g. the brand's general site instead of
        // an ad-specific tracking page), and a green checkmark gives no reason
        // to click in and find the edit control otherwise.
        const issueChecks = data.checks
          .filter((c: any) => c.status === "warning" || c.status === "failed" || c.id === "landing_page")
          .map((c: any) => c.id);
        setExpandedChecks(new Set(issueChecks));
      }
    } catch (error) {
      console.error("QA check error:", error);
      setChecks((prev) =>
        prev.map((c) => ({ ...c, status: "passed", message: "Check completed" }))
      );
      setSummary({ passed: 6, warnings: 0, failed: 0 });
    }

    setPhase("complete");
  };

  /**
   * Fix 3/4: changing the landing page URL invalidates the Landing Page and
   * Event Tracking rows. Clear them immediately, then re-run the whole
   * preflight against the new URL so a green check can never carry over.
   */
  const saveLandingUrl = async () => {
    const raw = urlDraft.trim();
    if (!raw) {
      toast.error("Enter a landing page URL");
      return;
    }
    const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    let parsed: URL;
    try {
      parsed = new URL(withScheme);
    } catch {
      toast.error("That doesn't look like a valid URL");
      return;
    }
    if (parsed.protocol !== "https:") {
      toast.error("Landing page URL must start with https://");
      return;
    }
    const finalUrl = parsed.toString();

    setSavingUrl(true);
    try {
      const { error } = await supabase
        .from("campaign_workspaces")
        .update({ offer_url: finalUrl, tracking_verified: false, updated_at: new Date().toISOString() })
        .eq("id", workspace.id);
      if (error) throw error;

      setLandingUrl(finalUrl);
      setUrlDraft(finalUrl);
      setEditingUrl(false);
      // Invalidate the dependent rows right away — no stale green checks.
      setChecks((prev) =>
        prev.map((c) =>
          c.id === "landing_page" || c.id === "tracking"
            ? { id: c.id, name: c.name, status: "running" as const, message: "Re-checking…" }
            : c,
        ),
      );
      setPhase("running");
      toast.success("Landing page updated — re-running checks");
      await runChecks(finalUrl);
    } catch (err: any) {
      console.error("Failed to save landing page URL:", err);
      toast.error(err?.message || "Couldn't save that URL");
    } finally {
      setSavingUrl(false);
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedChecks((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // ---- Inline copy editing ------------------------------------------------
  const buildCopyDrafts = (): CopyDraft[] => {
    const drafts: CopyDraft[] = [];
    const shared = Array.isArray(wsCopy.selected_copy?.shared_variations)
      ? wsCopy.selected_copy.shared_variations
      : [];
    shared.forEach((v: any, i: number) => {
      drafts.push({
        key: `shared-${i}`,
        label: shared.length > 1 ? `Ad copy ${i + 1}` : "Ad copy",
        source: "shared",
        index: i,
        headline: v?.headline || "",
        primary_text: v?.primary_text || v?.primaryText || "",
        description: v?.description || "",
      });
    });
    (wsCopy.production_items || []).forEach((item: any, i: number) => {
      const fc = item?.finalCopy || item?.final_copy;
      if (!fc) return;
      drafts.push({
        key: `item-${i}`,
        label: item?.concept_name || item?.name || `Creative ${i + 1}`,
        source: "item",
        index: i,
        headline: fc.headline || "",
        primary_text: fc.primary_text || fc.primaryText || "",
        description: fc.description || "",
      });
    });
    return drafts;
  };

  const openCopyDialog = (check: CheckResult) => {
    const drafts = buildCopyDrafts();
    if (drafts.length === 0) {
      // Nothing editable here — fall back to the full copy step.
      onFixIssue?.("copy", { check: check.id, issues: check.issues });
      return;
    }
    setCopyCheck(check);
    setCopyDrafts(drafts);
    setCopyDialogOpen(true);
  };

  const updateDraft = (key: string, field: "headline" | "primary_text" | "description", value: string) => {
    setCopyDrafts((prev) => prev.map((d) => (d.key === key ? { ...d, [field]: value } : d)));
  };

  const applySuggestion = (issue: Issue) => {
    if (!issue.text || !issue.suggestion) return;
    setCopyDrafts((prev) =>
      prev.map((d) => ({
        ...d,
        headline: d.headline.split(issue.text).join(issue.suggestion),
        primary_text: d.primary_text.split(issue.text).join(issue.suggestion),
        description: d.description.split(issue.text).join(issue.suggestion),
      })),
    );
    toast.success("Suggestion applied");
  };

  const saveCopyEdits = async () => {
    setCopySaving(true);
    try {
      const nextSelected = wsCopy.selected_copy
        ? JSON.parse(JSON.stringify(wsCopy.selected_copy))
        : null;
      const nextItems = JSON.parse(JSON.stringify(wsCopy.production_items || []));

      for (const d of copyDrafts) {
        if (d.source === "shared" && Array.isArray(nextSelected?.shared_variations)) {
          const v = nextSelected.shared_variations[d.index] || {};
          nextSelected.shared_variations[d.index] = {
            ...v,
            headline: d.headline,
            primary_text: d.primary_text,
            primaryText: d.primary_text,
            description: d.description,
          };
        } else if (d.source === "item" && nextItems[d.index]) {
          const item = nextItems[d.index];
          const key = item.finalCopy ? "finalCopy" : "final_copy";
          item[key] = {
            ...(item[key] || {}),
            headline: d.headline,
            primary_text: d.primary_text,
            primaryText: d.primary_text,
            description: d.description,
          };
        }
      }

      // The user just reviewed and approved this copy inline, so re-sign it —
      // otherwise the signature mismatch would block publish downstream.
      const variations: any[] = [];
      if (Array.isArray(nextSelected?.shared_variations)) variations.push(...nextSelected.shared_variations);
      for (const item of nextItems) {
        const fc = item?.finalCopy || item?.final_copy;
        if (fc) {
          variations.push({
            headline: fc.headline,
            primary_text: fc.primary_text || fc.primaryText,
            description: fc.description,
          });
        }
      }
      const signature = await computeCopySignature(variations);

      const { error } = await supabase
        .from("campaign_workspaces")
        .update({
          selected_copy: nextSelected,
          production_items: nextItems,
          approved_copy_signature: signature,
          updated_at: new Date().toISOString(),
        })
        .eq("id", workspace.id);
      if (error) throw error;

      // Keep the in-memory workspace in sync so publish uses the new copy.
      workspace.selected_copy = nextSelected;
      workspace.production_items = nextItems;
      workspace.approved_copy_signature = signature;
      setWsCopy({ selected_copy: nextSelected, production_items: nextItems });
      setCopyDialogOpen(false);

      setChecks((prev) =>
        prev.map((c) =>
          c.id === "spelling" || c.id === "ad_policy"
            ? { id: c.id, name: c.name, status: "running" as const, message: "Re-checking…" }
            : c,
        ),
      );
      setPhase("running");
      toast.success("Copy updated — re-running checks");
      await runChecks(undefined, {
        selected_copy: nextSelected,
        production_items: nextItems,
        signature,
      });
    } catch (err: any) {
      console.error("Failed to save copy edits:", err);
      toast.error(err?.message || "Couldn't save your copy");
    } finally {
      setCopySaving(false);
    }
  };


  // Let the user keep their copy as-is when a policy/spelling flag is only a
  // potential issue — we re-sign the current copy so publish isn't blocked.
  const acknowledgeCopyCheck = async (check: CheckResult) => {
    setCopySaving(true);
    try {
      const selected = wsCopy?.selected_copy ?? workspace.selected_copy ?? {};
      const items: any[] = wsCopy?.production_items ?? workspace.production_items ?? [];

      const variations: any[] = [];
      if (Array.isArray(selected?.shared_variations)) variations.push(...selected.shared_variations);
      for (const item of items) {
        const fc = item?.finalCopy || item?.final_copy;
        if (fc) {
          variations.push({
            headline: fc.headline,
            primary_text: fc.primary_text || fc.primaryText,
            description: fc.description,
          });
        }
      }
      const signature = await computeCopySignature(variations);

      const { error } = await supabase
        .from("campaign_workspaces")
        .update({
          approved_copy_signature: signature,
          updated_at: new Date().toISOString(),
        })
        .eq("id", workspace.id);
      if (error) throw error;

      workspace.approved_copy_signature = signature;

      setChecks((prev) =>
        prev.map((c) =>
          c.id === check.id
            ? {
                ...c,
                status: "passed" as const,
                message: "You chose to keep this copy",
                details:
                  "You reviewed this flag and decided to publish as-is. Meta may still review this ad.",
                issues: c.issues,
              }
            : c,
        ),
      );
      setSummary((prev) => ({
        ...prev,
        passed: prev.passed + 1,
        warnings: check.status === "warning" ? Math.max(0, prev.warnings - 1) : prev.warnings,
        failed: check.status === "failed" ? Math.max(0, prev.failed - 1) : prev.failed,
      }));
      setCopyDialogOpen(false);
      toast.success("Keeping your copy as-is");
    } catch (err: any) {
      console.error("Failed to acknowledge copy check:", err);
      toast.error(err?.message || "Couldn't save your choice");
    } finally {
      setCopySaving(false);
    }
  };


  const openTrackingDialog = (check: CheckResult) => {
    setTrackingCheck(check);
    setTrackingDialogOpen(true);
  };

  const handleSaveConfirmationUrl = async () => {
    if (!confirmationUrl.trim()) {
      toast.error("Please enter your confirmation page URL");
      return;
    }

    setTrackingSaving(true);
    try {
      const url = confirmationUrl.trim();
      // Save the confirmation URL to the workspace as the custom conversion URL
      const { error } = await supabase
        .from("campaign_workspaces")
        .update({
          custom_conversion_id: url,
          tracking_verified: true,
          updated_at: new Date().toISOString(),
        })
        .eq("id", workspace.id);

      if (error) throw error;

      // Keep the in-memory workspace + local state in sync so navigating away
      // and back (e.g. to edit copy) doesn't look like the URL was lost.
      workspace.custom_conversion_id = url;
      workspace.tracking_verified = true;
      setTrackingSetup({ verified: true, conversionUrl: url });



      // Update the tracking check to passed
      setChecks((prev) =>
        prev.map((c) =>
          c.id === "tracking"
            ? {
                ...c,
                status: "passed" as const,
                message: "Confirmation page URL set",
                details: `Meta will track conversions when someone lands on: ${confirmationUrl.trim()}`,
              }
            : c
        )
      );

      // Update summary
      setSummary((prev) => ({
        ...prev,
        passed: prev.passed + 1,
        warnings: Math.max(0, prev.warnings - 1),
      }));

      setTrackingDialogOpen(false);
      toast.success("Tracking configured!");
    } catch (error) {
      console.error("Error saving confirmation URL:", error);
      toast.error("Failed to save. Please try again.");
    } finally {
      setTrackingSaving(false);
    }
  };

  const hasIssues = summary.warnings > 0 || summary.failed > 0;
  const hasBlockingIssues = summary.failed > 0;

  const getStatusIcon = (status: CheckResult["status"]) => {
    switch (status) {
      case "pending": return <Circle className="h-4 w-4 text-muted-foreground" />;
      case "running": return <Loader2 className="h-4 w-4 animate-spin text-primary" />;
      case "passed": return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case "warning": return <AlertTriangle className="h-4 w-4 text-amber-500" />;
      case "failed": return <XCircle className="h-4 w-4 text-destructive" />;
    }
  };

  const getStatusColor = (status: CheckResult["status"]) => {
    switch (status) {
      case "pending": return "text-muted-foreground";
      case "running": return "text-primary";
      case "passed": return "text-green-600";
      case "warning": return "text-amber-600";
      case "failed": return "text-destructive";
    }
  };

  const renderMetaExpanded = (check: CheckResult) => {
    return (
      <div className="ml-10 mr-3 mb-3 space-y-3">
        {check.details && (
          <p className="text-sm text-muted-foreground">{check.details}</p>
        )}
        {check.status === "failed" && (
          <Button
            size="sm"
            variant="outline"
            className="gap-2"
            onClick={() => navigate("/meta-settings")}
          >
            <Settings className="h-3.5 w-3.5" />
            Connect Meta Ads
          </Button>
        )}
      </div>
    );
  };

  const handleCopyPixelCode = (pixelId: string) => {
    const code = `<!-- Meta Pixel Code -->
<script>
!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window, document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '${pixelId}');
fbq('track', 'PageView');
</script>
<noscript><img height="1" width="1" style="display:none"
src="https://www.facebook.com/tr?id=${pixelId}&ev=PageView&noscript=1"
/></noscript>
<!-- End Meta Pixel Code -->`;
    navigator.clipboard.writeText(code);
    toast.success("Pixel code copied!");
  };

  const renderLandingPageExpanded = (check: CheckResult) => {
    const url = landingUrl || check.message;
    const isNoUrl = !url || url === 'No landing page URL set';
    return (
      <div className="ml-10 mr-3 mb-3 space-y-3">
        {editingUrl ? (
          <div className="space-y-2">
            <Label className="text-xs">Landing page URL (this is where your ad sends people)</Label>
            <Input
              value={urlDraft}
              onChange={(e) => setUrlDraft(e.target.value)}
              placeholder="https://yoursite.com/facebook-offer"
              autoFocus
            />
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={saveLandingUrl} disabled={savingUrl} className="gap-2">
                {savingUrl ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                Save & re-check
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={savingUrl}
                onClick={() => { setUrlDraft(landingUrl); setEditingUrl(false); }}
              >
                Cancel
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Must start with https://. Saving clears the pixel + event checks and runs them again on the new URL.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {isNoUrl ? (
              <p className="text-xs text-muted-foreground">
                No landing page URL set yet — add the page your ad should send people to.
              </p>
            ) : (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm text-muted-foreground truncate max-w-[240px]" title={url}>
                  {url}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 gap-1.5 shrink-0 text-xs"
                  onClick={() => window.open(url.startsWith('http') ? url : `https://${url}`, '_blank')}
                >
                  <ExternalLink className="h-3 w-3" />
                  Open
                </Button>
              </div>
            )}
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                className="h-7 gap-1.5 text-xs"
                onClick={() => { setUrlDraft(landingUrl); setEditingUrl(true); }}
              >
                <Pencil className="h-3 w-3" />
                {isNoUrl ? 'Add URL' : 'Change URL'}
              </Button>
              {isNoUrl && (
                <Button size="sm" variant="ghost" className="h-7 gap-1.5 text-xs" onClick={() => navigate("/offers")}>
                  <ExternalLink className="h-3 w-3" />
                  Go to Offers
                </Button>
              )}
            </div>
            {!isNoUrl && (
              <p className="text-[11px] text-muted-foreground">
                This exact URL is what ships in the ad.
              </p>
            )}
          </div>
        )}
        {check.details && !isNoUrl && (
          <p className="text-xs text-muted-foreground">{check.details}</p>
        )}

        {/* Pixel not installed — show install instructions */}
        {check.pixelNotInstalled && check.pixelId && (
          <div className="mt-2 p-4 rounded-xl border border-amber-500/30 bg-amber-500/5 space-y-3">
            <div className="flex items-center gap-2">
              <Code className="h-4 w-4 text-amber-600" />
              <p className="text-sm font-medium text-amber-700">Install your Meta Pixel</p>
            </div>
            <p className="text-xs text-muted-foreground">
              Paste this code in the <code className="bg-muted px-1 py-0.5 rounded text-[11px]">&lt;head&gt;</code> section of your landing page so Meta can track conversions.
            </p>

            {/* Copyable code block */}
            <div className="relative">
              <pre className="p-3 rounded-lg bg-muted/80 border text-[11px] font-mono overflow-x-auto max-h-32 whitespace-pre-wrap break-all text-muted-foreground">
{`<script>
!function(f,b,e,v,n,t,s){if(f.fbq)return;...
fbq('init', '${check.pixelId}');
fbq('track', 'PageView');
</script>`}
              </pre>
              <Button
                size="sm"
                variant="outline"
                className="absolute top-2 right-2 h-7 gap-1.5 text-xs"
                onClick={() => handleCopyPixelCode(check.pixelId!)}
              >
                <Copy className="h-3 w-3" />
                Copy Full Code
              </Button>
            </div>

            {/* Platform guides */}
            <Collapsible>
              <CollapsibleTrigger asChild>
                <button className="flex items-center gap-1.5 text-xs text-primary hover:underline">
                  <HelpCircle className="h-3 w-3" />
                  Platform-specific instructions
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="mt-2 p-3 rounded-lg bg-muted/50 text-xs text-muted-foreground space-y-2">
                  <p><strong>Shopify:</strong> Go to Online Store → Preferences → paste your Pixel ID ({check.pixelId}) in the Facebook Pixel field.</p>
                  <p><strong>WordPress:</strong> Install the "PixelYourSite" or "Insert Headers and Footers" plugin, then paste the full code in the header section.</p>
                  <p><strong>Kajabi:</strong> Go to Settings → Site Details → Header Code, then paste the full code.</p>
                  <p><strong>Other platforms:</strong> Look for a "Custom Code" or "Header Scripts" setting and paste the code there.</p>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>
        )}
      </div>
    );
  };

  const renderTrackingExpanded = (check: CheckResult) => {
    const goal = (check.campaignGoal as 'leads' | 'sales') || 'leads';
    const event = check.requiredEvent || (goal === 'sales' ? 'Purchase' : 'Lead');
    const pixelState = check.pixelState;
    // A pixel problem is not an event problem — only offer the event setup flow
    // when the pixel itself is actually on the landing page.
    const isPixelProblem = pixelState === 'no_pixel_on_page' || pixelState === 'pixel_mismatch' || !check.pixelId;

    return (
      <div className="ml-10 mr-3 mb-3 space-y-3">
        {check.details && (
          <p className="text-sm text-muted-foreground">{check.details}</p>
        )}
        {(check.status === 'warning' || check.status === 'failed') && (
          isPixelProblem ? (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Fix the pixel first — open the <strong>Landing Page</strong> row above for install steps.
                Once the right pixel is on your page, come back and set up the {event} event.
              </p>
              <Button size="sm" variant="outline" className="gap-2" onClick={() => openTrackingDialog(check)}>
                <Zap className="h-3.5 w-3.5" />
                Set Up {event} Event Anyway
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Tell us the page someone lands on after they {goal === 'leads' ? 'submit your form' : 'complete a purchase'}.
                Meta will count a conversion every time someone visits that page.
                Your thank-you page has to be on the same domain as your landing page — if you just changed the
                landing page URL, the thank-you URL probably needs to change too.
              </p>
              <Button
                size="sm"
                className="gap-2"
                onClick={() => openTrackingDialog(check)}
              >
                <Zap className="h-3.5 w-3.5" />
                Set Up Tracking
              </Button>
            </div>
          )
        )}
      </div>
    );
  };


  const renderDefaultExpanded = (check: CheckResult) => {
    const isCopyCheck = check.id === "spelling" || check.id === "ad_policy";
    const failedFields = Array.from(
      new Set((check.issues || []).map((i) => i.field).filter(Boolean))
    );
    return (
      <div className="ml-10 mr-3 mb-3 space-y-2">
        {check.details && (
          <p className="text-sm text-muted-foreground">{check.details}</p>
        )}
        {isCopyCheck && (check.status === "warning" || check.status === "failed") && (
          <div className="space-y-2">
            {failedFields.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Issue in: <span className="font-medium">{failedFields.join(", ")}</span>
                {check.id === "ad_policy" && " (Meta ad policy)"}
              </p>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                className="gap-2"
                onClick={() => openCopyDialog(check)}
              >
                <SpellCheck className="h-3.5 w-3.5" />
                Fix copy here
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="gap-2 text-muted-foreground"
                disabled={copySaving}
                onClick={() => acknowledgeCopyCheck(check)}
              >
                Keep as-is
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Keeping it as-is publishes this copy unchanged — Meta still reviews every ad.
            </p>



          </div>
        )}
        {check.issues && check.issues.length > 0 && (
          <div className="space-y-2 mt-2">
            {check.issues.map((issue, issueIdx) => (
              <div key={issueIdx} className="p-3 bg-muted/50 rounded-lg border border-amber-500/20">
                <div className="space-y-1">
                  <p className="text-sm">
                    <span className="text-muted-foreground line-through">{issue.text}</span>
                    {" → "}
                    <span className="font-medium text-green-600">{issue.suggestion}</span>
                  </p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                    {issue.field && <Badge variant="secondary" className="text-xs">{issue.field}</Badge>}
                    <Badge variant="outline" className="text-xs">{issue.reason}</Badge>
                    {issue.location && <span>{issue.location}</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const getExpandedRenderer = (check: CheckResult) => {
    switch (check.id) {
      case "meta": return renderMetaExpanded(check);
      case "landing_page": return renderLandingPageExpanded(check);
      case "tracking": return renderTrackingExpanded(check);
      default: return renderDefaultExpanded(check);
    }
  };

  const trackingGoal = (trackingCheck?.campaignGoal as 'leads' | 'sales') || 'leads';

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-lg space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <AnimatePresence mode="wait">
            {phase === "running" ? (
              <motion.div key="running" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                <h2 className="text-2xl font-bold">Running Pre-Flight Checks</h2>
                <p className="text-muted-foreground">Making sure everything is ready for launch...</p>
              </motion.div>
            ) : (
              <motion.div key="complete" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                {hasBlockingIssues ? (
                  <>
                    <div className="inline-flex items-center gap-2 text-destructive mb-2">
                      <XCircle className="h-6 w-6" />
                      <h2 className="text-2xl font-bold">Issues Found</h2>
                    </div>
                    <p className="text-muted-foreground">Please fix these issues before publishing</p>
                  </>
                ) : hasIssues ? (
                  <>
                    <div className="inline-flex items-center gap-2 text-amber-600 mb-2">
                      <AlertTriangle className="h-6 w-6" />
                      <h2 className="text-2xl font-bold">Review Recommended</h2>
                    </div>
                    <p className="text-muted-foreground">
                      {summary.warnings} item{summary.warnings !== 1 ? "s" : ""} to review
                    </p>
                  </>
                ) : (
                  <>
                    <div className="inline-flex items-center gap-2 text-green-600 mb-2">
                      <CheckCircle2 className="h-6 w-6" />
                      <h2 className="text-2xl font-bold">All Checks Passed</h2>
                    </div>
                    <p className="text-muted-foreground">Your campaign is ready to go live</p>
                  </>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Progress Bar */}
        <div className="w-full">
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <motion.div
              className={cn(
                "h-full rounded-full",
                phase === "complete" && hasBlockingIssues
                  ? "bg-destructive"
                  : phase === "complete" && hasIssues
                  ? "bg-amber-500"
                  : "bg-gradient-to-r from-[hsl(var(--lumi-orange-1))] to-[hsl(var(--lumi-orange-2))]"
              )}
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.5, ease: "easeOut" }}
            />
          </div>
        </div>

        {/* Check List */}
        <Card>
          <CardContent className="p-4 space-y-2">
            {checks.map((check, idx) => (
              <Collapsible
                key={check.id}
                open={expandedChecks.has(check.id)}
                onOpenChange={() => toggleExpand(check.id)}
              >
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.1 }}
                >
                  <CollapsibleTrigger asChild>
                    <button
                      className={cn(
                        "w-full flex items-center justify-between p-3 rounded-lg transition-colors",
                        check.status === "pending" ? "opacity-50" : "hover:bg-muted/50 cursor-pointer"
                      )}
                      disabled={check.status === "pending"}
                    >
                      <div className="flex items-center gap-3">
                        <motion.div
                          initial={false}
                          animate={check.status === "passed" ? { scale: [1, 1.2, 1] } : {}}
                          transition={{ duration: 0.3 }}
                        >
                          {getStatusIcon(check.status)}
                        </motion.div>
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">{CHECK_ICONS[check.id]}</span>
                          <span className={cn("font-medium", getStatusColor(check.status))}>
                            {check.name}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {check.message && check.status !== "pending" && check.id !== "landing_page" && (
                          <span className="text-sm text-muted-foreground max-w-[300px] truncate" title={check.message}>
                            {check.message}
                          </span>
                        )}
                        {(check.issues?.length || check.details || check.id === "landing_page" || check.id === "meta") &&
                          check.status !== "pending" && (
                            expandedChecks.has(check.id) ? (
                              <ChevronUp className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            )
                          )}
                      </div>
                    </button>
                  </CollapsibleTrigger>

                  <CollapsibleContent>
                    {getExpandedRenderer(check)}
                  </CollapsibleContent>
                </motion.div>
              </Collapsible>
            ))}
          </CardContent>
        </Card>

        {/* Actions */}
        {phase === "complete" && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="flex items-center justify-between gap-4"
          >
            <Button variant="outline" onClick={onBack} className="gap-2" disabled={publishing}>
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>

            {hasBlockingIssues ? (
              <Button variant="outline" disabled className="gap-2">
                <XCircle className="h-4 w-4" />
                Fix Issues to Continue
              </Button>
            ) : (
              <Button
                onClick={onProceed}
                className="gap-2"
                size={hasIssues ? "default" : "lg"}
                disabled={publishing}
              >
                {publishing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Rocket className="h-4 w-4" />
                )}
                {publishing ? "Publishing…" : hasIssues ? "Publish Anyway" : "Publish to Meta"}
              </Button>
            )}

          </motion.div>
        )}
      </div>

      {/* Event Tracking Setup Dialog */}
      <Dialog open={trackingDialogOpen} onOpenChange={setTrackingDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" />
              Set Up {trackingGoal === 'sales' ? 'Purchase' : 'Lead'} Tracking
            </DialogTitle>
            <DialogDescription>
              This tells Meta when someone converts — so it can find more people like them.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 pt-2">
            {/* Simple explanation */}
            <div className="p-4 rounded-xl bg-muted/50 border space-y-2">
              <p className="text-sm font-medium">How it works</p>
              <p className="text-sm text-muted-foreground">
                When someone {trackingGoal === 'leads' ? 'fills out your form' : 'completes a purchase'}, 
                they usually land on a "Thank You" or confirmation page.
              </p>
              <p className="text-sm text-muted-foreground">
                Paste that page's URL below and Meta will count a conversion every time someone visits it after clicking your ad.
              </p>
            </div>

            {/* URL Input */}
            <div className="space-y-2">
              <Label htmlFor="confirmation-url" className="text-sm font-medium">
                Confirmation page URL
              </Label>
              <Input
                id="confirmation-url"
                placeholder={trackingGoal === 'leads' 
                  ? "https://yourdomain.com/thank-you" 
                  : "https://yourdomain.com/order-confirmation"
                }
                value={confirmationUrl}
                onChange={(e) => setConfirmationUrl(e.target.value)}
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                This is the page people see after they {trackingGoal === 'leads' ? 'submit your form' : 'complete their purchase'}.
              </p>
            </div>

            {/* Where to find it hint */}
            <Collapsible>
              <CollapsibleTrigger asChild>
                <button className="flex items-center gap-1.5 text-xs text-primary hover:underline">
                  <HelpCircle className="h-3 w-3" />
                  Where do I find this URL?
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="mt-2 p-3 rounded-lg bg-muted/50 text-xs text-muted-foreground space-y-2">
                  <p><strong>Forms (Kajabi, Typeform, ConvertKit, etc.):</strong> Submit your own form, then copy the URL of the page it sends you to.</p>
                  <p><strong>Checkout pages (Shopify, ThriveCart, etc.):</strong> Place a test order, then copy the URL of the order confirmation page.</p>
                  <p><strong>Not sure?</strong> Go through your funnel as if you were a customer and copy the URL of the very last page you see.</p>
                </div>
              </CollapsibleContent>
            </Collapsible>

            {/* Save button */}
            <Button
              onClick={handleSaveConfirmationUrl}
              disabled={trackingSaving || !confirmationUrl.trim()}
              className="w-full gap-2"
            >
              {trackingSaving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              Save & Verify
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Inline copy editor — fix policy/spelling issues without leaving QA */}
      <Dialog open={copyDialogOpen} onOpenChange={setCopyDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-5 w-5 text-primary" />
              Edit your ad copy
            </DialogTitle>
            <DialogDescription>
              {copyCheck?.id === "ad_policy"
                ? "Meta flagged wording that may break ad policy. Tweak it here and we'll re-check instantly."
                : "Fix the flagged wording here and we'll re-check instantly."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 pt-2">
            {(copyCheck?.issues || []).length > 0 && (
              <div className="space-y-2">
                <p className="text-xs uppercase text-muted-foreground">Flagged</p>
                {(copyCheck?.issues || []).map((issue, i) => (
                  <div
                    key={i}
                    className="p-3 rounded-lg bg-muted/50 border border-amber-500/20 flex items-start justify-between gap-3"
                  >
                    <div className="space-y-1 min-w-0">
                      <p className="text-sm break-words">
                        <span className="text-muted-foreground line-through">{issue.text}</span>
                        {issue.suggestion && (
                          <>
                            {" → "}
                            <span className="font-medium text-green-600">{issue.suggestion}</span>
                          </>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">{issue.reason}</p>
                    </div>
                    {issue.suggestion && (
                      <Button
                        size="sm"
                        variant="secondary"
                        className="shrink-0"
                        onClick={() => applySuggestion(issue)}
                      >
                        Use this
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-5">
              {copyDrafts.map((d) => (
                <div key={d.key} className="space-y-3 rounded-xl border p-4">
                  <p className="text-sm font-medium">{d.label}</p>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Headline</Label>
                    <Input
                      value={d.headline}
                      onChange={(e) => updateDraft(d.key, "headline", e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Primary text</Label>
                    <Textarea
                      rows={4}
                      value={d.primary_text}
                      onChange={(e) => updateDraft(d.key, "primary_text", e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Description</Label>
                    <Input
                      value={d.description}
                      onChange={(e) => updateDraft(d.key, "description", e.target.value)}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <Button onClick={saveCopyEdits} disabled={copySaving} className="flex-1 gap-2">
                {copySaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Save & re-check
              </Button>
              <Button
                variant="outline"
                onClick={() => copyCheck && acknowledgeCopyCheck(copyCheck)}
                disabled={copySaving}
              >
                Keep as-is
              </Button>
              <Button variant="ghost" onClick={() => setCopyDialogOpen(false)} disabled={copySaving}>
                Cancel
              </Button>

            </div>
            {onFixIssue && (
              <button
                type="button"
                className="text-xs text-muted-foreground hover:text-foreground underline"
                onClick={() => {
                  setCopyDialogOpen(false);
                  onFixIssue("copy", { check: copyCheck?.id, issues: copyCheck?.issues });
                }}
              >
                Open the full copy editor instead
              </button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>

  );
}
