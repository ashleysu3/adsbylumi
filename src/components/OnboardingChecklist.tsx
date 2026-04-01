import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { CheckCircle2, Circle, ChevronDown, Sparkles, Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface OnboardingChecklistProps {
  brand: any;
  offers: any[];
  onEditBrand: () => void;
}

interface ChecklistItem {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  action?: () => void;
  actionLabel?: string;
}

export function OnboardingChecklist({ brand, offers, onEditBrand }: OnboardingChecklistProps) {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(true);
  const [digestEnabled, setDigestEnabled] = useState<boolean | null>(null);

  // Check if digest_settings exist and are enabled for this brand
  useEffect(() => {
    if (!brand?.id) return;
    supabase
      .from("digest_settings")
      .select("enabled")
      .eq("brand_id", brand.id)
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        setDigestEnabled(data?.enabled ?? false);
      });
  }, [brand?.id]);

  const checklistItems: ChecklistItem[] = [
    {
      id: "brand-basics",
      title: "Complete Brand Basics",
      description: "Add your brand name, website, and industry",
      completed: !!(brand?.name && brand?.website_url && brand?.industry),
      action: onEditBrand,
      actionLabel: "Edit Details"
    },
    {
      id: "brand-positioning",
      title: "Define Your Positioning",
      description: "What you offer and who you serve",
      completed: !!(brand?.value_proposition && brand?.target_audience),
      action: onEditBrand,
      actionLabel: "Add Info"
    },
    {
      id: "audience-psychology",
      title: "Approve Audience Psychology",
      description: "Review and approve AI-generated insights about your ideal customers",
      completed: brand?.psychology_status === "approved",
      action: () => {
        const section = document.querySelector('[data-section="audience-psychology"]');
        section?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      },
      actionLabel: "Go to Section"
    },
    {
      id: "add-offer",
      title: "Add Your First Offer",
      description: "Add a product or service you want to promote",
      completed: offers.length > 0,
      action: () => navigate("/offers"),
      actionLabel: "Add Offer"
    },
    {
      id: "meta-account",
      title: "Connect Meta Ad Account",
      description: "Link your Facebook Ad Account to create campaigns",
      completed: !!brand?.meta_account_id,
      action: () => navigate("/meta-settings"),
      actionLabel: "Connect Now"
    },
    {
      id: "pixel-tracking",
      title: "Configure Event Tracking",
      description: "Ensure your pixel is tracking Purchase and Lead events",
      completed: !!(brand?.meta_pixel_id && brand?.meta_pixel_verified_at),
      action: () => navigate("/meta-settings"),
      actionLabel: "Check Pixel"
    },
    {
      id: "weekly-reports",
      title: "Enable Weekly Reports",
      description: "Get automated performance digests delivered to your inbox every week",
      completed: digestEnabled === true,
      action: () => {
        window.location.href = '/data';
      },
      actionLabel: "View Settings"
    }
  ];

  const completedCount = checklistItems.filter(item => item.completed).length;
  const totalCount = checklistItems.length;
  const progressPercentage = (completedCount / totalCount) * 100;
  const isComplete = completedCount === totalCount;

  // Hide checklist when all steps are complete
  if (isComplete) {
    return null;
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
        <CardHeader>
          <div className="flex items-start gap-3">
            <div className="mt-1">
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <CollapsibleTrigger asChild>
                <button className="flex items-center gap-2 hover:opacity-80 transition-opacity text-left w-full">
                  <CardTitle className="text-lg">Getting Started Checklist</CardTitle>
                  <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </button>
              </CollapsibleTrigger>
              <CardDescription className="mt-1">
                Complete these steps to set up your brand for success
              </CardDescription>
            </div>
          </div>

          <div className="space-y-2 pt-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {completedCount} of {totalCount} completed
              </span>
              <Badge variant={progressPercentage === 100 ? "default" : "secondary"}>
                {Math.round(progressPercentage)}%
              </Badge>
            </div>
            <Progress value={progressPercentage} className="h-2" />
          </div>
        </CardHeader>

        <CollapsibleContent>
          <CardContent>
            <div className="space-y-3">
              {checklistItems.map((item) => (
                <div
                  key={item.id}
                  className={`flex items-start gap-3 p-3 rounded-lg border transition-all ${
                    item.completed
                      ? 'bg-muted/30 border-muted'
                      : 'bg-background border-border hover:border-primary/50'
                  }`}
                >
                  <div className="mt-0.5">
                    {item.completed ? (
                      <CheckCircle2 className="h-5 w-5 text-primary" />
                    ) : (
                      <Circle className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1 space-y-1">
                    <p className={`font-medium text-sm ${item.completed ? 'text-muted-foreground' : ''}`}>
                      {item.title}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {item.description}
                    </p>
                  </div>
                  {!item.completed && item.action && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={item.action}
                      className="shrink-0"
                    >
                      {item.actionLabel}
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
