import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";
import { useNavigate } from "react-router-dom";

export function LabTrends({ seedId: _seedId }: { seedId?: string }) {
  const navigate = useNavigate();
  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold">Trend Translator</h3>
        <p className="text-sm text-muted-foreground">
          Paste a trending post, sound, or format and LUMI will translate it into ad concepts for
          your brand. Each translation saves to My Creatives.
        </p>
      </div>
      <Button onClick={() => navigate("/trends")}>
        <ExternalLink className="h-4 w-4 mr-2" />
        Open Trend Translator
      </Button>
    </div>
  );
}
