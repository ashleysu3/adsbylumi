import { useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useBrand } from '@/contexts/BrandContext';
import { PerformanceHistoryCard } from '@/components/insights/PerformanceHistoryCard';
import { ClientReportModal } from '@/components/insights/ClientReportModal';
import { PageShimmer } from '@/components/GradientShimmer';

export default function PastReports() {
  const { activeBrand, loading } = useBrand();
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [reportModalText, setReportModalText] = useState<string | undefined>();

  if (loading) return <DashboardLayout><PageShimmer /></DashboardLayout>;

  if (!activeBrand) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-[60vh] text-muted-foreground">
          <p>Please create a brand first to view past reports.</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6 p-4 md:p-6">
        <div>
          <h1 className="text-2xl font-bold">Past Reports</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Browse and review your generated performance reports
          </p>
        </div>

        <PerformanceHistoryCard
          brandId={activeBrand.id}
          onViewReport={(text) => {
            setReportModalText(text);
            setReportModalOpen(true);
          }}
          hideChart
          showReportsList
        />
      </div>

      <ClientReportModal
        open={reportModalOpen}
        onOpenChange={(v) => { setReportModalOpen(v); if (!v) setReportModalText(undefined); }}
        brandId={activeBrand.id}
        dateRangeStart=""
        dateRangeEnd=""
        initialReportText={reportModalText}
      />
    </DashboardLayout>
  );
}
