import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Download, Loader2, CheckCircle2, Circle } from 'lucide-react';

interface MetaCampaign {
  id: string;
  name: string;
  status: string;
  objective: string;
  createdTime: string;
  dailyBudget?: string;
  lifetimeBudget?: string;
  alreadyImported: boolean;
}

interface ImportCampaignsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  brandId: string;
  metaAccountId: string;
  dateRangeStart?: string;
  dateRangeEnd?: string;
  onImportComplete: () => void;
}

export function ImportCampaignsModal({
  open,
  onOpenChange,
  brandId,
  metaAccountId,
  dateRangeStart,
  dateRangeEnd,
  onImportComplete,
}: ImportCampaignsModalProps) {
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [campaigns, setCampaigns] = useState<MetaCampaign[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      fetchCampaigns();
    }
  }, [open, brandId, metaAccountId, dateRangeStart, dateRangeEnd]);

  const fetchCampaigns = async () => {
    setLoading(true);
    setError(null);
    setSelectedIds(new Set());

    try {
      // Get existing campaign IDs from workspaces
      const { data: existingWorkspaces } = await supabase
        .from('campaign_workspaces')
        .select('meta_campaign_ids')
        .eq('brand_id', brandId);

      const existingCampaignIds = (existingWorkspaces || [])
        .map((w) => (w.meta_campaign_ids as any)?.campaignId)
        .filter(Boolean);

      // Get meta token from vault
      const { data: tokenData, error: tokenError } = await supabase.rpc('get_meta_token', {
        p_brand_id: brandId,
      });

      if (tokenError || !tokenData) {
        throw new Error('Failed to retrieve Meta access token');
      }

      // Fetch campaigns from Meta
      const { data, error: fetchError } = await supabase.functions.invoke('fetch-meta-campaigns', {
        body: {
          metaAccountId,
          metaAccessToken: tokenData,
          dateRangeStart,
          dateRangeEnd,
          existingCampaignIds,
        },
      });

      if (fetchError || !data?.success) {
        throw new Error(data?.error || fetchError?.message || 'Failed to fetch campaigns');
      }

      setCampaigns(data.campaigns || []);
    } catch (err: any) {
      console.error('Error fetching campaigns:', err);
      setError(err.message || 'Failed to load campaigns');
    } finally {
      setLoading(false);
    }
  };

  const toggleSelection = (campaignId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(campaignId)) {
        next.delete(campaignId);
      } else {
        next.add(campaignId);
      }
      return next;
    });
  };

  const selectAll = () => {
    const selectableCampaigns = campaigns.filter((c) => !c.alreadyImported);
    setSelectedIds(new Set(selectableCampaigns.map((c) => c.id)));
  };

  const deselectAll = () => {
    setSelectedIds(new Set());
  };

  const handleImport = async () => {
    if (selectedIds.size === 0) return;

    setImporting(true);

    try {
      // Get meta token from vault
      const { data: tokenData, error: tokenError } = await supabase.rpc('get_meta_token', {
        p_brand_id: brandId,
      });

      if (tokenError || !tokenData) {
        throw new Error('Failed to retrieve Meta access token');
      }

      const { data, error: syncError } = await supabase.functions.invoke('sync-meta-campaigns', {
        body: {
          brandId,
          metaAccountId,
          metaAccessToken: tokenData,
          campaignIds: Array.from(selectedIds),
        },
      });

      if (syncError || !data?.success) {
        throw new Error(data?.error || syncError?.message || 'Failed to import campaigns');
      }

      toast.success(`Successfully imported ${data.synced} campaign${data.synced !== 1 ? 's' : ''}`);
      onOpenChange(false);
      onImportComplete();
    } catch (err: any) {
      console.error('Error importing campaigns:', err);
      toast.error(err.message || 'Failed to import campaigns');
    } finally {
      setImporting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return <Badge variant="default" className="bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/30">Active</Badge>;
      case 'PAUSED':
        return <Badge variant="secondary" className="bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/30">Paused</Badge>;
      case 'ARCHIVED':
        return <Badge variant="outline" className="text-muted-foreground">Archived</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const selectableCampaigns = campaigns.filter((c) => !c.alreadyImported);
  const allSelected = selectableCampaigns.length > 0 && selectedIds.size === selectableCampaigns.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5 text-primary" />
            Import from Ads Manager
          </DialogTitle>
          <DialogDescription>
            {dateRangeStart && dateRangeEnd 
              ? `Showing campaigns with activity from ${dateRangeStart} to ${dateRangeEnd}`
              : 'Select campaigns to import and track'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col">
          {loading ? (
            <div className="space-y-3 py-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="h-5 w-5 rounded" />
                  <Skeleton className="h-10 flex-1 rounded" />
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="py-8 text-center">
              <p className="text-destructive text-sm">{error}</p>
              <Button variant="outline" size="sm" className="mt-4" onClick={fetchCampaigns}>
                Try Again
              </Button>
            </div>
          ) : campaigns.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-muted-foreground text-sm">
                {dateRangeStart ? 'No campaigns with activity in the selected date range' : 'No campaigns found in your ad account'}
              </p>
            </div>
          ) : (
            <>
              {/* Select All / Deselect All */}
              <div className="flex items-center justify-between pb-3 border-b">
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={() => (allSelected ? deselectAll() : selectAll())}
                    disabled={selectableCampaigns.length === 0}
                  />
                  <span className="text-sm text-muted-foreground">
                    {allSelected ? 'Deselect All' : 'Select All'}
                  </span>
                </div>
                <span className="text-sm text-muted-foreground">
                  {selectedIds.size} selected
                </span>
              </div>

              {/* Campaign List */}
              <ScrollArea className="flex-1 -mx-6 px-6">
                <div className="space-y-2 py-3">
                  {campaigns.map((campaign) => (
                    <div
                      key={campaign.id}
                      className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                        campaign.alreadyImported
                          ? 'bg-muted/30 opacity-60'
                          : selectedIds.has(campaign.id)
                          ? 'bg-primary/5 border-primary/30'
                          : 'hover:bg-muted/50'
                      }`}
                    >
                      {campaign.alreadyImported ? (
                        <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
                      ) : (
                        <Checkbox
                          checked={selectedIds.has(campaign.id)}
                          onCheckedChange={() => toggleSelection(campaign.id)}
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{campaign.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {campaign.objective?.replace(/_/g, ' ')}
                        </p>
                      </div>
                      <div className="shrink-0">
                        {campaign.alreadyImported ? (
                          <Badge variant="outline" className="text-xs">Imported</Badge>
                        ) : (
                          getStatusBadge(campaign.status)
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-4 border-t">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleImport}
            disabled={selectedIds.size === 0 || importing}
          >
            {importing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Importing...
              </>
            ) : (
              `Import ${selectedIds.size} Campaign${selectedIds.size !== 1 ? 's' : ''}`
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
