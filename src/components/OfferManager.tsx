import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { OfferDialog } from "./OfferDialog";
import { Plus, ExternalLink, Package, Loader2, Sparkles, Rocket, Archive, ArchiveRestore, ChevronRight, Brain, Target, Pencil } from "lucide-react";
import { OfferEditDialog } from "./OfferEditDialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Offer {
  id: string;
  name: string;
  url?: string | null;
  description?: string | null;
  price_point?: string | null;
  product_psychology?: any;
  offer_audience_psychology?: any;
  recommended_template_id?: string | null;
  recommendation_reason?: string | null;
  recommendation_confidence?: string | null;
  archived?: boolean;
  archived_at?: string | null;
}

interface OfferManagerProps {
  brandId: string;
  offers: Offer[];
  onUpdate: () => void;
}

export function OfferManager({ brandId, offers, onUpdate }: OfferManagerProps) {
  const navigate = useNavigate();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [expandedOffers, setExpandedOffers] = useState<Set<string>>(new Set());
  const [templates, setTemplates] = useState<any[]>([]);
  const [creatingCampaign, setCreatingCampaign] = useState<string | null>(null);
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
  const [offerToArchive, setOfferToArchive] = useState<Offer | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [editingOffer, setEditingOffer] = useState<Offer | null>(null);

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    const { data } = await supabase
      .from('campaign_templates')
      .select('*')
      .eq('active', true);
    if (data) setTemplates(data);
  };

  const toggleOffer = (offerId: string) => {
    setExpandedOffers(prev => {
      const newSet = new Set(prev);
      if (newSet.has(offerId)) newSet.delete(offerId);
      else newSet.add(offerId);
      return newSet;
    });
  };

  const createCampaignForOffer = async (offer: Offer) => {
    if (!offer.recommended_template_id) {
      toast.error("No campaign recommendation available");
      return;
    }
    setCreatingCampaign(offer.id);
    try {
      const template = templates.find(t => t.id === offer.recommended_template_id);
      if (!template) throw new Error("Template not found");

      const { data: strategy, error: strategyError } = await supabase
        .from('strategies')
        .insert({
          brand_id: brandId,
          template_id: template.id,
          name: `${template.name} - ${offer.name}`,
          campaign_type: template.slug,
          offer_name: offer.name,
          offer_url: offer.url,
          offer_price: offer.price_point,
          offer_description: offer.description,
        })
        .select()
        .single();
      if (strategyError) throw strategyError;

      const { data: workspace, error: workspaceError } = await supabase
        .from('campaign_workspaces')
        .insert({
          brand_id: brandId,
          template_id: template.id,
          strategy_id: strategy.id,
          name: `${template.name} - ${offer.name}`,
          strategy_json: template.strategy_template,
          offer_name: offer.name,
          offer_url: offer.url || null,
          offer_price: offer.price_point || null,
          offer_description: offer.description || null,
          progress_status: "creative_in_progress",
        })
        .select()
        .single();
      if (workspaceError) throw workspaceError;

      toast.success(`Campaign workspace created for ${offer.name}!`);
      navigate(`/creative?workspace=${workspace.id}`);
    } catch (error: any) {
      console.error('Error creating campaign:', error);
      toast.error(error.message || 'Failed to create campaign');
    } finally {
      setCreatingCampaign(null);
    }
  };

  const getRecommendedTemplate = (templateId?: string | null) => {
    if (!templateId) return null;
    return templates.find(t => t.id === templateId);
  };

  const handleArchiveOffer = async () => {
    if (!offerToArchive) return;
    try {
      const isArchiving = !offerToArchive.archived;
      const { error } = await supabase
        .from('offers')
        .update({
          archived: isArchiving,
          archived_at: isArchiving ? new Date().toISOString() : null,
        })
        .eq('id', offerToArchive.id);
      if (error) throw error;
      toast.success(isArchiving ? `${offerToArchive.name} archived` : `${offerToArchive.name} restored`);
      onUpdate();
    } catch (error: any) {
      console.error('Error archiving offer:', error);
      toast.error(error.message || 'Failed to archive offer');
    } finally {
      setArchiveDialogOpen(false);
      setOfferToArchive(null);
    }
  };

  const filteredOffers = showArchived ? offers : offers.filter(offer => !offer.archived);
  const archivedCount = offers.filter(o => o.archived).length;

  return (
    <>
      <Card variant="glow" data-section="offers">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" />
              <CardTitle>What You're Promoting</CardTitle>
            </div>
            <div className="flex items-center gap-3">
              {archivedCount > 0 && (
                <button
                  onClick={() => setShowArchived(!showArchived)}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showArchived ? "Hide archived" : `${archivedCount} archived`}
                </button>
              )}
              <Button size="sm" onClick={() => setDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Add What You're Promoting
              </Button>
            </div>
          </div>
          <CardDescription>
            Your products, services, and lead magnets — each with its own psychological profile for smarter ads.
          </CardDescription>
        </CardHeader>

        <CardContent>
          {filteredOffers.length === 0 ? (
            <div className="text-center py-8">
              <Package className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground mb-4">
                {showArchived ? "No archived offers" : "No offers added yet. Add your first offer to get started."}
              </p>
              <Button onClick={() => setDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Add What You're Promoting
              </Button>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filteredOffers.map((offer) => {
                const isExpanded = expandedOffers.has(offer.id);
                const recTemplate = getRecommendedTemplate(offer.recommended_template_id);
                const hasPsychology = !!offer.product_psychology;

                return (
                  <Collapsible
                    key={offer.id}
                    open={isExpanded}
                    onOpenChange={() => toggleOffer(offer.id)}
                  >
                    <div className={`${offer.archived ? 'opacity-50' : ''}`}>
                      {/* Row */}
                      <CollapsibleTrigger asChild>
                        <button className="w-full flex items-center gap-3 py-4 px-1 text-left hover:bg-muted/30 transition-colors rounded-lg group">
                          {/* Status dot */}
                          <div className={`h-2.5 w-2.5 rounded-full flex-shrink-0 ${
                            hasPsychology ? 'bg-green-500' : 'bg-amber-400 animate-pulse'
                          }`} />

                          {/* Name + meta */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm truncate">{offer.name}</span>
                              {offer.archived && (
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0">Archived</Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-3 mt-0.5">
                              {offer.price_point && (
                                <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                                  {offer.price_point}
                                </span>
                              )}
                              {recTemplate && (
                                <span className="text-xs text-primary flex items-center gap-1">
                                  <Target className="h-3 w-3" />
                                  {recTemplate.name}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Status label */}
                          <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${
                            hasPsychology
                              ? 'bg-green-500/10 text-green-600 dark:text-green-400'
                              : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                          }`}>
                            {hasPsychology ? 'Ready' : 'Processing'}
                          </span>

                          {/* Actions */}
                          <div className="flex items-center gap-1 flex-shrink-0">
                            {offer.url && (
                              <a
                                href={offer.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <ExternalLink className="h-3.5 w-3.5" />
                              </a>
                            )}
                            <button
                              className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingOffer(offer);
                              }}
                              title="Edit offer"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button
                              className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                              onClick={(e) => {
                                e.stopPropagation();
                                setOfferToArchive(offer);
                                setArchiveDialogOpen(true);
                              }}
                              title={offer.archived ? "Restore" : "Archive"}
                            >
                              {offer.archived ? (
                                <ArchiveRestore className="h-3.5 w-3.5" />
                              ) : (
                                <Archive className="h-3.5 w-3.5" />
                              )}
                            </button>
                            <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                          </div>
                        </button>
                      </CollapsibleTrigger>

                      {/* Expanded detail */}
                      <CollapsibleContent>
                        <div className="pl-6 pr-1 pb-4 space-y-4">
                          {offer.description && (
                            <p className="text-sm text-muted-foreground">{offer.description}</p>
                          )}

                          {/* Psychology summary — compact grid */}
                          {offer.product_psychology && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              {offer.product_psychology.positioning && (
                                <div className="p-3 rounded-lg bg-muted/40">
                                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Positioning</p>
                                  <p className="text-sm">{offer.product_psychology.positioning}</p>
                                </div>
                              )}
                              {offer.product_psychology.buying_triggers && (
                                <div className="p-3 rounded-lg bg-muted/40">
                                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Buying Triggers</p>
                                  <p className="text-sm">{offer.product_psychology.buying_triggers}</p>
                                </div>
                              )}
                              {offer.product_psychology.product_pain_points?.length > 0 && (
                                <div className="p-3 rounded-lg bg-muted/40">
                                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Pain Points</p>
                                  <ul className="space-y-0.5">
                                    {offer.product_psychology.product_pain_points.slice(0, 3).map((p: string, i: number) => (
                                      <li key={i} className="text-sm text-muted-foreground">• {p}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                              {offer.product_psychology.product_desires?.length > 0 && (
                                <div className="p-3 rounded-lg bg-muted/40">
                                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Desires</p>
                                  <ul className="space-y-0.5">
                                    {offer.product_psychology.product_desires.slice(0, 3).map((d: string, i: number) => (
                                      <li key={i} className="text-sm text-muted-foreground">• {d}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Audience psychology — before/after */}
                          {offer.offer_audience_psychology && (
                            <div className="space-y-3">
                              <h5 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                                <Brain className="h-3.5 w-3.5 text-primary" />
                                Audience Journey
                              </h5>

                              {offer.offer_audience_psychology.emotional_before_after && (
                                <div className="grid grid-cols-2 gap-3">
                                  <div className="p-3 rounded-lg bg-destructive/5 border border-destructive/10">
                                    <p className="text-[11px] font-semibold text-destructive mb-1">Before</p>
                                    <p className="text-xs text-muted-foreground">{offer.offer_audience_psychology.emotional_before_after.before}</p>
                                  </div>
                                  <div className="p-3 rounded-lg bg-green-500/5 border border-green-500/10">
                                    <p className="text-[11px] font-semibold text-green-600 dark:text-green-400 mb-1">After</p>
                                    <p className="text-xs text-muted-foreground">{offer.offer_audience_psychology.emotional_before_after.after}</p>
                                  </div>
                                </div>
                              )}

                              {offer.offer_audience_psychology.what_finally_convinces && (
                                <div className="p-3 rounded-lg bg-muted/40">
                                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">What convinces them</p>
                                  <p className="text-sm">{offer.offer_audience_psychology.what_finally_convinces}</p>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Campaign recommendation — clean CTA */}
                          {recTemplate && (
                            <div className="flex items-center gap-3 p-3 rounded-lg border border-primary/15 bg-primary/5">
                              <div className="flex-1 min-w-0">
                                <p className="text-xs text-muted-foreground">Recommended campaign</p>
                                <p className="text-sm font-medium flex items-center gap-1.5">
                                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                                  {recTemplate.name}
                                </p>
                                {offer.recommendation_reason && (
                                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{offer.recommendation_reason}</p>
                                )}
                              </div>
                              <Button
                                size="sm"
                                variant="lumi"
                                onClick={() => createCampaignForOffer(offer)}
                                disabled={creatingCampaign === offer.id}
                              >
                                {creatingCampaign === offer.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <>
                                    <Rocket className="mr-1.5 h-3.5 w-3.5" />
                                    Create Ad
                                  </>
                                )}
                              </Button>
                            </div>
                          )}
                        </div>
                      </CollapsibleContent>
                    </div>
                  </Collapsible>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <OfferDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        brandId={brandId}
        onSuccess={onUpdate}
      />

      <AlertDialog open={archiveDialogOpen} onOpenChange={setArchiveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {offerToArchive?.archived ? "Restore Offer" : "Archive Offer"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {offerToArchive?.archived
                ? `Are you sure you want to restore "${offerToArchive?.name}"?`
                : `Are you sure you want to archive "${offerToArchive?.name}"? Existing campaigns won't be affected.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleArchiveOffer}>
              {offerToArchive?.archived ? "Restore" : "Archive"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <OfferEditDialog
        open={!!editingOffer}
        onOpenChange={(open) => { if (!open) setEditingOffer(null); }}
        offer={editingOffer}
        onSuccess={onUpdate}
      />
    </>
  );
}