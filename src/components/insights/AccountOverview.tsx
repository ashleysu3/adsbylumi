import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendingUp, DollarSign, Eye, MousePointer, ShoppingCart } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { MobileKPICard, MobileKPIGrid } from '@/components/MobileKPICard';

interface AccountMetrics {
  spend: number;
  impressions: number;
  reach: number;
  clicks: number;
  ctr: number;
  cpc: number;
  leads: number;
  purchases: number;
  roas: number | null;
}

interface AccountOverviewProps {
  metrics: AccountMetrics | null;
  isLoading: boolean;
}

export function AccountOverview({ metrics, isLoading }: AccountOverviewProps) {
  const isMobile = useIsMobile();

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatNumber = (value: number) => {
    if (value >= 1000000) {
      return `${(value / 1000000).toFixed(1)}M`;
    }
    if (value >= 1000) {
      return `${(value / 1000).toFixed(1)}K`;
    }
    return value.toLocaleString();
  };

  if (isLoading) {
    return (
      <Card className="rounded-2xl bg-gradient-to-br from-primary/5 via-background to-primary/5">
        <CardContent className="p-4 sm:p-6">
          <div className="flex items-center gap-2 mb-4">
            <Skeleton className="h-5 w-5 rounded-full" />
            <Skeleton className="h-5 w-32" />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-24 rounded-xl" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!metrics) {
    return null;
  }

  const stats = [
    {
      label: 'Spend',
      value: formatCurrency(metrics.spend),
      icon: <DollarSign className="h-4 w-4" />,
      status: 'neutral' as const,
    },
    {
      label: 'Impressions',
      value: formatNumber(metrics.impressions),
      icon: <Eye className="h-4 w-4" />,
      status: 'neutral' as const,
    },
    {
      label: 'Clicks',
      value: formatNumber(metrics.clicks),
      icon: <MousePointer className="h-4 w-4" />,
      status: 'neutral' as const,
    },
    {
      label: 'ROAS',
      value: metrics.roas ? `${metrics.roas.toFixed(1)}x` : '—',
      icon: <TrendingUp className="h-4 w-4" />,
      status: (metrics.roas && metrics.roas >= 2 ? 'good' : metrics.roas && metrics.roas >= 1 ? 'warning' : 'neutral') as 'good' | 'warning' | 'neutral',
    },
  ];

  // Mobile: Use KPI card grid
  if (isMobile) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 px-1">
          <TrendingUp className="h-4 w-4 text-primary" />
          <h3 className="font-semibold text-sm">Account Overview</h3>
        </div>
        <MobileKPIGrid>
          {stats.map((stat) => (
            <MobileKPICard
              key={stat.label}
              label={stat.label}
              value={stat.value}
              icon={stat.icon}
              status={stat.status}
            />
          ))}
        </MobileKPIGrid>
      </div>
    );
  }

  // Desktop: Original layout
  return (
    <Card className="rounded-2xl bg-gradient-to-br from-primary/5 via-background to-primary/5 border-primary/20">
      <CardContent className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="h-5 w-5 text-primary" />
          <h3 className="font-semibold text-sm">Account Overview</h3>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {stats.map((stat) => (
            <div key={stat.label} className="space-y-1">
              <div className="flex items-center gap-1.5">
                {stat.icon}
                <span className="text-xs text-muted-foreground">{stat.label}</span>
              </div>
              <p className="text-xl font-bold">{stat.value}</p>
            </div>
          ))}
          <div className="space-y-1">
            <div className="flex items-center gap-1.5">
              <ShoppingCart className="h-3.5 w-3.5 text-orange-600" />
              <span className="text-xs text-muted-foreground">Conversions</span>
            </div>
            <p className="text-xl font-bold">{formatNumber(metrics.leads + metrics.purchases)}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
