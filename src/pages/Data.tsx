import { useSearchParams } from 'react-router-dom';
import DashboardLayout from '@/components/DashboardLayout';
import InsightsHome from '@/components/insights/InsightsHome';
import InsightsDetail from '@/components/insights/InsightsDetail';

export default function Data() {
  const [searchParams] = useSearchParams();
  const workspaceId = searchParams.get('workspace');

  return (
    <DashboardLayout>
      {workspaceId ? <InsightsDetail /> : <InsightsHome />}
    </DashboardLayout>
  );
}
