import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, Rocket, Upload, Palette } from "lucide-react";

export function WorkspaceHelp() {
  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Rocket className="h-5 w-5 text-primary" />
          How Campaign Workspaces Work
        </CardTitle>
        <CardDescription>
          Your complete campaign production hub
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3 text-sm">
          <div className="flex items-start gap-3">
            <div className="bg-primary/10 rounded-full p-1.5 mt-0.5">
              <Palette className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="font-medium">1. Review Creative Assets</p>
              <p className="text-muted-foreground">
                Generated hooks, scripts, ad copy, and production guides
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="bg-primary/10 rounded-full p-1.5 mt-0.5">
              <CheckCircle2 className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="font-medium">2. Follow Production Checklist</p>
              <p className="text-muted-foreground">
                Track filming, editing, and design tasks
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="bg-primary/10 rounded-full p-1.5 mt-0.5">
              <Upload className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="font-medium">3. Upload Final Assets</p>
              <p className="text-muted-foreground">
                Add your finished videos, images, and graphics
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="bg-primary/10 rounded-full p-1.5 mt-0.5">
              <Rocket className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="font-medium">4. Publish to Meta</p>
              <p className="text-muted-foreground">
                Answer setup questions and launch to Ads Manager
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}