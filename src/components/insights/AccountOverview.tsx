import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendingUp, DollarSign, Eye, MousePointer, ShoppingCart } from 'lucide-react';

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
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
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
        <CardContent className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Skeleton className="h-5 w-5 rounded-full" />
            <Skeleton className="h-5 w-32" />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-8 w-24" />
              </div>
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
      label: 'Total Spend',
      value: formatCurrency(metrics.spend),
      icon: DollarSign,
      color: 'text-green-600',
    },
    {
      label: 'Impressions',
      value: formatNumber(metrics.impressions),
      icon: Eye,
      color: 'text-blue-600',
    },
    {
      label: 'Clicks',
      value: formatNumber(metrics.clicks),
      icon: MousePointer,
      color: 'text-purple-600',
    },
    {
      label: 'Conversions',
      value: formatNumber(metrics.leads + metrics.purchases),
      icon: ShoppingCart,
      color: 'text-orange-600',
    },
    {
      label: 'ROAS',
      value: metrics.roas ? `${metrics.roas.toFixed(2)}x` : '—',
      icon: TrendingUp,
      color: metrics.roas && metrics.roas >= 2 ? 'text-green-600' : 'text-muted-foreground',
    },
  ];

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
                <stat.icon className={`h-3.5 w-3.5 ${stat.color}`} />
                <span className="text-xs text-muted-foreground">{stat.label}</span>
              </div>
              <p className="text-xl font-bold">{stat.value}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
