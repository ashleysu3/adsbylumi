import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronRight, ExternalLink, MessageSquare, Pencil } from 'lucide-react';
import { ClientHealthBadge } from './ClientHealthBadge';
import { format } from 'date-fns';

interface Campaign {
  id: string;
  name: string;
  progress_status: string;
  meta_campaign_status?: string;
}

interface AgencyClient {
  id: string;
  brand_id: string;
  slack_client_channel?: string;
  slack_internal_channel?: string;
  contact_name?: string;
  contact_email?: string;
  health_status: string;
  notes?: string;
  brand?: {
    id: string;
    name: string;
    meta_account_id?: string;
    last_review_date?: string;
    next_report_due?: string;
  };
  campaigns?: Campaign[];
}

export function ClientScorecard({
  client,
  onEdit,
  onViewDetail,
}: {
  client: AgencyClient;
  onEdit: (client: AgencyClient) => void;
  onViewDetail: (brandId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const brand = client.brand;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card className="border-border">
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/30 transition-colors pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {open ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                <div>
                  <CardTitle className="text-base">{brand?.name || 'Unknown'}</CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {brand?.meta_account_id ? `Act: ${brand.meta_account_id}` : 'No ad account'}
                    {client.contact_name && ` · ${client.contact_name}`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <ClientHealthBadge status={client.health_status} />
                {brand?.last_review_date && (
                  <Badge variant="outline" className="text-[10px]">
                    Last review: {format(new Date(brand.last_review_date), 'MMM d')}
                  </Badge>
                )}
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="pt-0 space-y-3">
            {/* Campaign list */}
            {client.campaigns && client.campaigns.length > 0 ? (
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Active Campaigns</p>
                {client.campaigns.map((c) => (
                  <div key={c.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-muted/30 text-sm">
                    <span className="font-medium">{c.name}</span>
                    <Badge variant="outline" className="text-[10px]">{c.progress_status}</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No campaigns yet.</p>
            )}

            {/* Notes */}
            {client.notes && (
              <div className="text-sm text-muted-foreground bg-muted/20 p-2 rounded-lg">
                <span className="font-medium text-foreground">Notes:</span> {client.notes}
              </div>
            )}

            {/* Slack info */}
            {(client.slack_client_channel || client.slack_internal_channel) && (
              <div className="flex gap-3 text-xs text-muted-foreground">
                {client.slack_client_channel && (
                  <span className="flex items-center gap-1"><MessageSquare className="h-3 w-3" /> Client: #{client.slack_client_channel}</span>
                )}
                {client.slack_internal_channel && (
                  <span className="flex items-center gap-1"><MessageSquare className="h-3 w-3" /> Internal: #{client.slack_internal_channel}</span>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 pt-1">
              <Button size="sm" variant="outline" onClick={() => onEdit(client)}>
                <Pencil className="h-3 w-3 mr-1" /> Edit
              </Button>
              <Button size="sm" variant="outline" onClick={() => onViewDetail(client.brand_id)}>
                <ExternalLink className="h-3 w-3 mr-1" /> View Detail
              </Button>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
