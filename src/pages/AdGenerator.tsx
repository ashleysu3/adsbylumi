import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Wrench, Check } from "lucide-react";

/**
 * The graphic/image generator (beta) is temporarily offline while we upgrade it.
 * Everything written — scripts, b-roll overlay text, ad copy — is still live,
 * so this screen points people to those tools instead of dead-ending them.
 */
const STILL_AVAILABLE = [
  "Talking-head scripts written in your brand voice",
  "B-roll shot lists + on-screen overlay text",
  "Graphic copy: headlines, primary text, descriptions, CTAs",
  "Carousel outlines and hooks",
  "Upload your own photos and videos, then launch to Meta",
];

export default function AdGenerator() {
  const navigate = useNavigate();

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
        <Card className="p-8 space-y-6">
          <div className="flex items-start gap-4">
            <div className="h-12 w-12 rounded-2xl bg-muted flex items-center justify-center flex-shrink-0">
              <Wrench className="h-6 w-6 text-muted-foreground" />
            </div>
            <div className="space-y-2">
              <Badge variant="secondary" className="text-xs">Beta feature · down for upgrades</Badge>
              <h1 className="text-2xl font-bold font-display text-foreground">
                The creative generator is getting an upgrade
              </h1>
              <p className="text-sm text-muted-foreground leading-relaxed">
                We've temporarily taken the auto-generated graphics offline while we make them
                dramatically better. Nothing else changes — every original feature is still here
                and working.
              </p>
            </div>
          </div>

          <div className="rounded-xl border bg-muted/30 p-5 space-y-3">
            <p className="text-sm font-semibold text-foreground">Still fully available:</p>
            <ul className="space-y-2">
              {STILL_AVAILABLE.map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <Check className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button onClick={() => navigate("/creative")}>Go to Creative Studio</Button>
            <Button variant="outline" onClick={() => navigate("/")}>Back to dashboard</Button>
          </div>
        </Card>
      </div>
    </DashboardLayout>
  );
}
