import DashboardLayout from "@/components/DashboardLayout";
import AdminTabs from "@/components/AdminTabs";
import CreativeToolkitManager from "@/components/admin/CreativeToolkitManager";
import { Wrench } from "lucide-react";

export default function AdminCreativeToolkit() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <AdminTabs />

        <div>
          <h1 className="text-3xl font-display font-bold flex items-center gap-2">
            <Wrench className="h-8 w-8 text-primary" />
            Creative Toolkit
          </h1>
          <p className="text-muted-foreground mt-2">
            Manage toolkit content, visibility, and resources
          </p>
        </div>

        <CreativeToolkitManager />
      </div>
    </DashboardLayout>
  );
}
