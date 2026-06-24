import DashboardLayout from "@/components/DashboardLayout";
import { CreativesDraftsLibrary } from "@/components/creative/CreativesDraftsLibrary";

export default function MyCreatives() {
  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <CreativesDraftsLibrary />
      </div>
    </DashboardLayout>
  );
}
