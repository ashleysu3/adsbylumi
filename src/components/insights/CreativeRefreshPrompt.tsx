import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, RefreshCw, Sparkles, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface FatigueAlert {
  adName: string;
  frequency: number;
  ctr: number;
  reason: string;
}

interface CreativeRefreshPromptProps {
  workspaceId: string;
  fatiguedAds: FatigueAlert[];
  benchAvailable: number;
  onApproveSwap?: () => void;
}

export function CreativeRefreshPrompt({
  workspaceId,
  fatiguedAds,
  benchAvailable,
  onApproveSwap,
}: CreativeRefreshPromptProps) {
  const navigate = useNavigate();

  if (fatiguedAds.length === 0) return null;

  return (
    <Card className="rounded-2xl border-amber-200 bg-amber-50/50">
      <CardContent className="p-4">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
          </div>
          <div>
            <h3 className="font-semibold text-sm">Creative Fatigue Detected</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {fatiguedAds.length} ad{fatiguedAds.length !== 1 ? 's' : ''} showing signs of fatigue
            </p>
          </div>
        </div>

        <div className="space-y-2 mb-4">
          {fatiguedAds.slice(0, 3).map((ad, i) => (
            <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-white border border-amber-100">
              <div>
                <p className="text-sm font-medium">{ad.adName}</p>
                <p className="text-xs text-muted-foreground">{ad.reason}</p>
              </div>
              <div className="flex gap-2">
                <Badge variant="outline" className="text-xs">Freq: {ad.frequency.toFixed(1)}</Badge>
                <Badge variant="outline" className="text-xs">CTR: {ad.ctr.toFixed(2)}%</Badge>
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          {benchAvailable > 0 && onApproveSwap && (
            <Button onClick={onApproveSwap} size="sm" className="rounded-xl">
              <RefreshCw className="h-4 w-4 mr-2" />
              Approve Swap ({benchAvailable} ready)
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(`/creative?workspace=${workspaceId}&refresh=true`)}
            className="rounded-xl"
          >
            <Sparkles className="h-4 w-4 mr-2" />
            Refresh Creative
            <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
