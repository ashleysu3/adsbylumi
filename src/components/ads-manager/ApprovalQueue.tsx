import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, X, Loader2 } from 'lucide-react';
import { ClientHealthBadge } from './ClientHealthBadge';
import { format } from 'date-fns';

interface ReviewLog {
  id: string;
  brand_id: string;
  review_date: string;
  action_plan?: string;
  approval_status: string;
  notes?: string;
  brand?: { name: string };
  ad_level_data?: any;
}

interface ApprovalQueueProps {
  reviews: ReviewLog[];
  onApprove: (reviewId: string) => void;
  onReject: (reviewId: string) => void;
  loadingId?: string;
}

export function ApprovalQueue({ reviews, onApprove, onReject, loadingId }: ApprovalQueueProps) {
  const pendingReviews = reviews.filter((r) => r.approval_status === 'pending' || r.approval_status === 'draft');

  if (pendingReviews.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">No pending approvals — you're all caught up! ✅</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {pendingReviews.map((review) => {
        const adData = (review.ad_level_data || []) as any[];
        const pauseActions = adData.filter((a: any) => a.flag === 'pause');
        const scaleActions = adData.filter((a: any) => a.flag === 'scale');
        const isLoading = loadingId === review.id;

        return (
          <Card key={review.id}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{review.brand?.name || 'Client'}</CardTitle>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px]">
                    {format(new Date(review.review_date), 'EEE, MMM d')}
                  </Badge>
                  <Badge variant="outline" className={
                    review.approval_status === 'pending' ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20' :
                    'bg-muted text-muted-foreground'
                  }>
                    {review.approval_status}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Action plan */}
              {review.action_plan && (
                <div className="text-sm bg-muted/30 p-3 rounded-lg whitespace-pre-wrap">
                  {review.action_plan}
                </div>
              )}

              {/* Summary */}
              <div className="flex gap-4 text-xs text-muted-foreground">
                {pauseActions.length > 0 && (
                  <span className="text-destructive font-medium">{pauseActions.length} ad{pauseActions.length !== 1 ? 's' : ''} to pause</span>
                )}
                {scaleActions.length > 0 && (
                  <span className="text-green-600 dark:text-green-400 font-medium">{scaleActions.length} ad{scaleActions.length !== 1 ? 's' : ''} to scale</span>
                )}
              </div>

              {review.notes && (
                <p className="text-xs text-muted-foreground">{review.notes}</p>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-1">
                <Button size="sm" onClick={() => onApprove(review.id)} disabled={isLoading} className="bg-green-600 hover:bg-green-700 text-white">
                  {isLoading ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Check className="h-3 w-3 mr-1" />}
                  Approve
                </Button>
                <Button size="sm" variant="outline" onClick={() => onReject(review.id)} disabled={isLoading}>
                  <X className="h-3 w-3 mr-1" /> Dismiss
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
