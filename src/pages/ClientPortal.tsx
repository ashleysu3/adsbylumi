import { useState, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { 
  Lock, CheckCircle2, RotateCw, Video, Film, Image, FileText,
  Mic, Type, Eye, Brain, Volume2, Sparkles, Loader2
} from "lucide-react";
import confetti from "canvas-confetti";

interface PortalData {
  id: string;
  portal_name: string;
  client_name: string | null;
  agency_branding: {
    agency_name?: string;
    logo_url?: string | null;
    primary_color?: string;
    show_powered_by_lumi?: boolean;
  };
  items_included: string[];
  workspace_id: string;
}

interface ProductionItem {
  id: string;
  hook: string;
  format: string;
  angleName?: string;
  guidance?: string;
  script_lines?: string[];
  verbal_hook?: string;
  written_hook?: string;
  visual_hook?: string;
  visual_hook_options?: string[];
  delivery_style?: string;
  text_overlays?: { text: string; timing: string; type?: string }[];
  caption_reminder?: boolean;
  psychology_trigger?: string;
  why_this_works?: string;
  hook_technique?: string;
  approval_status?: string;
  approval_comment?: string;
}

type ItemStatus = Record<string, { status: string; comment?: string }>;

export default function ClientPortal() {
  const { portalId } = useParams<{ portalId: string }>();
  const [accessCode, setAccessCode] = useState("");
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [authError, setAuthError] = useState("");
  const [shakeInput, setShakeInput] = useState(false);
  const [portalInactive, setPortalInactive] = useState(false);

  const [authenticated, setAuthenticated] = useState(false);
  const [portal, setPortal] = useState<PortalData | null>(null);
  const [items, setItems] = useState<ProductionItem[]>([]);
  const [itemStatuses, setItemStatuses] = useState<ItemStatus>({});
  const [expandedChanges, setExpandedChanges] = useState<string | null>(null);
  const [changeComment, setChangeComment] = useState("");
  const [submittingAction, setSubmittingAction] = useState<string | null>(null);
  const [confettiFired, setConfettiFired] = useState(false);

  // Restore session from sessionStorage
  useEffect(() => {
    const stored = sessionStorage.getItem(`portal_${portalId}`);
    if (stored) {
      try {
        const { accessCode: storedCode } = JSON.parse(stored);
        if (storedCode) {
          handleAuth(storedCode);
        }
      } catch { /* ignore */ }
    }
  }, [portalId]);

  const handleAuth = async (code?: string) => {
    const codeToUse = code || accessCode;
    if (!codeToUse.trim()) return;

    setIsAuthenticating(true);
    setAuthError("");

    try {
      const { data, error } = await supabase.functions.invoke('client-portal-auth', {
        body: { portalId, accessCode: codeToUse },
      });

      if (error) throw error;

      if (data?.error) {
        if (data.error.includes('no longer active') || data.error.includes('expired')) {
          setPortalInactive(true);
        } else {
          setAuthError("Incorrect access code. Try again.");
          setShakeInput(true);
          setTimeout(() => setShakeInput(false), 500);
        }
        return;
      }

      if (data?.success) {
        sessionStorage.setItem(`portal_${portalId}`, JSON.stringify({ accessCode: codeToUse }));
        setPortal(data.portal);
        setAuthenticated(true);

        // Initialize items with their approval_status
        const productionItems = data.productionItems || [];
        setItems(productionItems);

        const statuses: ItemStatus = {};
        productionItems.forEach((item: ProductionItem) => {
          if (item.approval_status) {
            statuses[item.id] = {
              status: item.approval_status,
              comment: item.approval_comment,
            };
          }
        });
        setItemStatuses(statuses);
      }
    } catch (e: any) {
      console.error('Portal auth error:', e);
      setAuthError("Something went wrong. Please try again.");
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleAction = async (itemId: string, action: 'approved' | 'changes_requested', comment?: string) => {
    if (!portal) return;
    setSubmittingAction(itemId);

    // Optimistic update
    setItemStatuses(prev => ({
      ...prev,
      [itemId]: { status: action, comment },
    }));

    const storedData = sessionStorage.getItem(`portal_${portalId}`);
    const storedCode = storedData ? JSON.parse(storedData).accessCode : accessCode;

    try {
      await supabase.functions.invoke('client-portal-actions', {
        body: {
          portalId,
          accessCode: storedCode,
          action,
          productionItemId: itemId,
          comment,
          clientName: portal.client_name,
        },
      });
    } catch (e) {
      console.error('Action error:', e);
    } finally {
      setSubmittingAction(null);
      setExpandedChanges(null);
      setChangeComment("");
    }
  };

  // Check for all approved
  const approvedCount = Object.values(itemStatuses).filter(s => s.status === 'approved').length;
  const totalItems = items.length;
  const allApproved = totalItems > 0 && approvedCount === totalItems;

  useEffect(() => {
    if (allApproved && !confettiFired) {
      setConfettiFired(true);
      confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 } });
    }
  }, [allApproved, confettiFired]);

  const primaryColor = portal?.agency_branding?.primary_color || '#F97316';

  // Group items by format
  const groupedItems = items.reduce((acc, item) => {
    const key = item.format || 'other';
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {} as Record<string, ProductionItem[]>);

  const formatConfig: Record<string, { icon: typeof Video; label: string; emoji: string }> = {
    talking_head: { icon: Video, label: "Talking Head Scripts", emoji: "🎥" },
    broll: { icon: Film, label: "B-Roll Concepts", emoji: "🎬" },
    graphic: { icon: Image, label: "Graphic Direction", emoji: "🖼️" },
    copy: { icon: FileText, label: "Copy", emoji: "📋" },
  };

  // ── Password Gate ──
  if (portalInactive) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAF9F6] p-4">
        <Card className="max-w-md w-full text-center">
          <CardContent className="pt-8 pb-8 space-y-4">
            <Lock className="h-12 w-12 mx-auto text-muted-foreground/40" />
            <h2 className="text-xl font-semibold">Portal No Longer Active</h2>
            <p className="text-muted-foreground text-sm">
              This portal link is no longer active. Please contact your team.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!authenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAF9F6] p-4">
        <div className="max-w-sm w-full space-y-6 text-center">
          {/* Agency Branding Placeholder */}
          <div className="space-y-2">
            <Lock className="h-8 w-8 mx-auto text-muted-foreground/60" />
            <h1 className="text-2xl font-bold" style={{ fontFamily: "'Red Hat Display', sans-serif" }}>
              Review Your Creative
            </h1>
            <p className="text-muted-foreground text-sm">
              Enter your access code to view your creative assets
            </p>
          </div>

          <div className="space-y-3">
            <Input
              type="text"
              placeholder="Enter access code"
              value={accessCode}
              onChange={(e) => setAccessCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === 'Enter' && handleAuth()}
              className={cn(
                "text-center text-lg tracking-widest font-mono h-14",
                shakeInput && "animate-shake"
              )}
              maxLength={8}
              autoFocus
            />
            {authError && (
              <p className="text-sm text-destructive">{authError}</p>
            )}
            <Button
              onClick={() => handleAuth()}
              disabled={isAuthenticating || !accessCode.trim()}
              className="w-full h-12 text-base font-semibold"
              style={{ backgroundColor: primaryColor }}
            >
              {isAuthenticating ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                "Access Portal"
              )}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ── Portal Content ──
  const branding = portal?.agency_branding || {};

  return (
    <div className="min-h-screen bg-[#FAF9F6]" style={{ fontFamily: "'Red Hat Display', sans-serif" }}>
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {branding.logo_url ? (
              <img src={branding.logo_url} alt="" className="h-8 max-h-8 object-contain" />
            ) : (
              <span className="font-bold text-lg">{branding.agency_name || 'Your Team'}</span>
            )}
          </div>
          <div className="text-right">
            <p className="font-semibold text-sm">{portal?.portal_name}</p>
            {portal?.client_name && (
              <p className="text-xs text-muted-foreground">for {portal.client_name}</p>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {/* Progress */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">{approvedCount} of {totalItems} items approved</span>
            <span className="text-muted-foreground">{totalItems > 0 ? Math.round((approvedCount / totalItems) * 100) : 0}%</span>
          </div>
          <Progress
            value={totalItems > 0 ? (approvedCount / totalItems) * 100 : 0}
            className="h-2"
          />
        </div>

        {/* All Approved Banner */}
        {allApproved && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center space-y-2">
            <p className="text-2xl">🎉</p>
            <h3 className="text-lg font-bold text-green-800">All items approved!</h3>
            <p className="text-sm text-green-700">Your team has been notified.</p>
          </div>
        )}

        {/* Grouped Items */}
        {Object.entries(groupedItems).map(([format, formatItems]) => {
          const config = formatConfig[format] || { icon: FileText, label: format, emoji: "📄" };
          return (
            <div key={format} className="space-y-3">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <span>{config.emoji}</span>
                {config.label}
              </h2>

              {formatItems.map((item) => {
                const status = itemStatuses[item.id];
                const isActioned = status?.status === 'approved' || status?.status === 'changes_requested';
                const isApproved = status?.status === 'approved';
                const isChangesRequested = status?.status === 'changes_requested';

                return (
                  <Card key={item.id} className={cn(
                    "transition-all",
                    isApproved && "ring-1 ring-green-300 bg-green-50/50",
                    isChangesRequested && "ring-1 ring-amber-300 bg-amber-50/50"
                  )}>
                    <CardContent className="pt-5 pb-5 space-y-4">
                      {/* Header Row */}
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-xs">
                            {formatConfig[item.format]?.label || item.format}
                          </Badge>
                          {item.angleName && (
                            <Badge variant="outline" className="text-xs">{item.angleName}</Badge>
                          )}
                        </div>
                        {isApproved && (
                          <Badge className="bg-green-100 text-green-800 border-green-200">Approved ✅</Badge>
                        )}
                        {isChangesRequested && (
                          <Badge className="bg-amber-100 text-amber-800 border-amber-200">Changes Requested 🔄</Badge>
                        )}
                      </div>

                      {/* Content */}
                      <div className="space-y-3">
                        {/* Hook */}
                        <div className="bg-muted/50 rounded-lg p-3">
                          <p className="font-semibold text-base">"{item.hook}"</p>
                        </div>

                        {/* Talking Head Details */}
                        {item.format === 'talking_head' && (
                          <div className="space-y-3">
                            {/* Verbal Hook */}
                            {item.verbal_hook && (
                              <div className="p-3 rounded-lg bg-blue-500/5 border border-blue-500/20">
                                <div className="flex items-center gap-2 text-blue-600 mb-1">
                                  <Mic className="h-3.5 w-3.5" />
                                  <span className="text-xs font-semibold uppercase">What to say</span>
                                </div>
                                <p className="text-sm font-medium">"{item.verbal_hook}"</p>
                              </div>
                            )}

                            {/* Script */}
                            {item.script_lines && item.script_lines.length > 0 && (
                              <div className="space-y-1.5">
                                <h5 className="text-xs font-semibold text-muted-foreground uppercase">📜 Script</h5>
                                <div className="bg-muted/30 rounded-lg p-3 space-y-1">
                                  {item.script_lines.map((line, idx) => (
                                    <div key={idx} className="flex gap-2 text-sm">
                                      <span className="text-muted-foreground w-5 shrink-0 text-right">{idx + 1}.</span>
                                      <span>{line}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Delivery Style */}
                            {item.delivery_style && (
                              <p className="text-sm italic text-muted-foreground bg-muted/30 rounded-lg p-3">
                                💡 <span className="font-medium">Delivery:</span> {item.delivery_style}
                              </p>
                            )}

                            {/* Text Overlays */}
                            {item.text_overlays && item.text_overlays.length > 0 && (
                              <div className="space-y-1.5">
                                <h5 className="text-xs font-semibold text-muted-foreground uppercase">📝 Text to add in editing</h5>
                                {item.text_overlays.map((overlay, idx) => (
                                  <div key={idx} className="text-sm p-2 rounded bg-muted/30 flex justify-between">
                                    <span>"{overlay.text}"</span>
                                    <span className="text-xs text-muted-foreground">⏱️ {overlay.timing}</span>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Caption reminder */}
                            {item.caption_reminder !== false && (
                              <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 rounded-lg p-2.5 border border-amber-200">
                                <Volume2 className="h-4 w-4 flex-shrink-0" />
                                <span>Add captions — 85% watch without sound</span>
                              </div>
                            )}
                          </div>
                        )}

                        {/* B-Roll Details */}
                        {item.format === 'broll' && (
                          <div className="space-y-2">
                            {item.guidance && (
                              <div className="bg-muted/30 rounded-lg p-3">
                                <h5 className="text-xs font-semibold text-muted-foreground uppercase mb-1">Direction</h5>
                                <p className="text-sm">{item.guidance}</p>
                              </div>
                            )}
                            {item.visual_hook && (
                              <div className="p-3 rounded-lg bg-green-500/5 border border-green-500/20">
                                <div className="flex items-center gap-2 text-green-600 mb-1">
                                  <Eye className="h-3.5 w-3.5" />
                                  <span className="text-xs font-semibold uppercase">Visual Hook</span>
                                </div>
                                <p className="text-sm">{item.visual_hook}</p>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Graphic Details */}
                        {item.format === 'graphic' && item.guidance && (
                          <div className="bg-muted/30 rounded-lg p-3">
                            <h5 className="text-xs font-semibold text-muted-foreground uppercase mb-1">Design Direction</h5>
                            <p className="text-sm">{item.guidance}</p>
                          </div>
                        )}

                        {/* Why This Works */}
                        {item.why_this_works && (
                          <div className="p-3 rounded-lg bg-purple-500/5 border border-purple-500/20">
                            <div className="flex items-center gap-2 mb-1">
                              <Brain className="h-4 w-4 text-purple-600" />
                              <span className="text-xs font-semibold uppercase text-purple-700">Why This Works</span>
                            </div>
                            <p className="text-sm text-purple-800/80">{item.why_this_works}</p>
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      {!isActioned && (
                        <div className="space-y-3 pt-2 border-t">
                          {expandedChanges === item.id ? (
                            <div className="space-y-2">
                              <Textarea
                                placeholder="What would you like changed? (optional)"
                                value={changeComment}
                                onChange={(e) => setChangeComment(e.target.value)}
                                className="min-h-[60px] text-sm"
                              />
                              <div className="flex gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => { setExpandedChanges(null); setChangeComment(""); }}
                                >
                                  Cancel
                                </Button>
                                <Button
                                  size="sm"
                                  disabled={submittingAction === item.id}
                                  onClick={() => handleAction(item.id, 'changes_requested', changeComment || undefined)}
                                  className="bg-amber-500 hover:bg-amber-600 text-white"
                                >
                                  {submittingAction === item.id ? <Loader2 className="h-3 w-3 animate-spin" /> : "Submit Request"}
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                className="flex-1"
                                onClick={() => setExpandedChanges(item.id)}
                              >
                                <RotateCw className="h-4 w-4 mr-2" />
                                Request Changes
                              </Button>
                              <Button
                                className="flex-1"
                                disabled={submittingAction === item.id}
                                onClick={() => handleAction(item.id, 'approved')}
                                style={{ backgroundColor: primaryColor }}
                              >
                                {submittingAction === item.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <>
                                    <CheckCircle2 className="h-4 w-4 mr-2" />
                                    Approve
                                  </>
                                )}
                              </Button>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Show comment if changes requested */}
                      {isChangesRequested && status?.comment && (
                        <div className="pt-2 border-t">
                          <p className="text-sm text-muted-foreground italic">"{status.comment}"</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          );
        })}

        {/* Footer */}
        <div className="text-center py-8 space-y-3">
          <p className="text-sm text-muted-foreground">
            Need to send your talking head recordings or other files?<br />
            Send them to your team via Slack or email.
          </p>
          {branding.show_powered_by_lumi !== false && (
            <p className="text-xs text-muted-foreground/50">
              Powered by LUMI
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
