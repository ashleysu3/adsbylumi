import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, Sparkles, Target, MessageSquare, TrendingUp, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

export default function Planning() {
  const [loading, setLoading] = useState(false);
  const [brand, setBrand] = useState<any>(null);
  const [strategies, setStrategies] = useState<any[]>([]);
  
  // Form state
  const [campaignGoal, setCampaignGoal] = useState("");
  const [campaignType, setCampaignType] = useState<"training" | "cold" | "warm">("cold");
  const [additionalContext, setAdditionalContext] = useState("");
  
  // Generated strategy
  const [generatedStrategy, setGeneratedStrategy] = useState<any>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: brandData } = await supabase
        .from("brands")
        .select("*")
        .eq("user_id", user.id)
        .single();

      setBrand(brandData);

      const { data: strategiesData } = await supabase
        .from("strategies")
        .select("*")
        .eq("brand_id", brandData?.id)
        .order("created_at", { ascending: false });

      setStrategies(strategiesData || []);
    } catch (error: any) {
      console.error("Error fetching data:", error);
    }
  };

  const generateStrategy = async () => {
    if (!campaignGoal.trim()) {
      toast.error("Please describe your campaign goal");
      return;
    }

    setLoading(true);
    try {
      // Mock strategy generation - in production, this would call an AI endpoint
      const mockStrategy = {
        name: `${campaignType.toUpperCase()} Campaign Strategy`,
        campaign_type: campaignType,
        messaging_framework: {
          hooks: [
            "Are you tired of [pain point]?",
            "What if you could [desired outcome] in just [timeframe]?",
            "The secret to [goal] that nobody talks about...",
          ],
          core_message: `Focus on transformation from ${campaignGoal} through emotional resonance and authority positioning.`,
          psychological_levers: ["Social proof", "Scarcity", "Authority", "Transformation"],
        },
        audience_psychology: {
          pain_points: ["Overwhelm", "Lack of results", "Time constraints"],
          desires: ["Fast results", "Clear path", "Expert guidance"],
          objections: ["Price", "Time commitment", "Skepticism"],
        },
        optimization_goals: ["CPL under $15", "CTR above 2%", "ROAS 3:1+"],
        kpi_benchmarks: {
          ctr: "2-3%",
          cpc: "$0.50-$1.50",
          cpl: "$10-$20",
        },
        contextual_keywords: ["coaching", "transformation", "results", "strategy"],
      };

      // Save to database
      const { data: newStrategy, error } = await supabase
        .from("strategies")
        .insert({
          brand_id: brand.id,
          name: mockStrategy.name,
          campaign_type: mockStrategy.campaign_type,
          messaging_framework: mockStrategy.messaging_framework,
          audience_psychology: mockStrategy.audience_psychology,
          optimization_goals: mockStrategy.optimization_goals,
          kpi_benchmarks: mockStrategy.kpi_benchmarks,
          contextual_keywords: mockStrategy.contextual_keywords,
          status: "draft",
        })
        .select()
        .single();

      if (error) throw error;

      setGeneratedStrategy(newStrategy);
      setStrategies([newStrategy, ...strategies]);
      toast.success("Strategy generated successfully!");
    } catch (error: any) {
      toast.error(error.message || "Failed to generate strategy");
    } finally {
      setLoading(false);
    }
  };

  if (!brand) {
    return (
      <DashboardLayout>
        <Card>
          <CardHeader>
            <CardTitle>Setup Required</CardTitle>
            <CardDescription>
              Please complete your brand setup first.
            </CardDescription>
          </CardHeader>
        </Card>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div className="space-y-2">
          <h2 className="text-3xl font-bold tracking-tight">
            Ad Planner
          </h2>
          <p className="text-muted-foreground">
            Get a clear strategy for {brand.name}
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Strategy Generator */}
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center space-x-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  <CardTitle>Create New Strategy</CardTitle>
                </div>
                <CardDescription>
                  Tell us what you want to achieve and we'll guide you step by step
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="campaignType">Campaign Type</Label>
                  <Select value={campaignType} onValueChange={(v: any) => setCampaignType(v)}>
                    <SelectTrigger className="h-11">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="training">Training (Warm-up audience)</SelectItem>
                      <SelectItem value="cold">Cold (New prospects)</SelectItem>
                      <SelectItem value="warm">Warm (Retargeting)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="campaignGoal">What do you want to achieve? *</Label>
                  <Textarea
                    id="campaignGoal"
                    value={campaignGoal}
                    onChange={(e) => setCampaignGoal(e.target.value)}
                    placeholder="E.g., Get more leads for my coaching program from people who are burnt out at work..."
                    className="min-h-[120px] resize-none"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="additionalContext">Anything else we should know? (Optional)</Label>
                  <Textarea
                    id="additionalContext"
                    value={additionalContext}
                    onChange={(e) => setAdditionalContext(e.target.value)}
                    placeholder="Any specific details about your offer or audience..."
                    className="min-h-[100px] resize-none"
                  />
                </div>

                <Button
                  onClick={generateStrategy}
                  disabled={loading || !campaignGoal.trim()}
                  className="w-full h-12 text-base"
                  size="lg"
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating Your Strategy...
                    </>
                  ) : (
                    <>
                      <Sparkles className="mr-2 h-4 w-4" />
                      Create Strategy
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* Generated Strategy Display */}
            {generatedStrategy && (
              <Card className="border-primary/20">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center space-x-2">
                      <CheckCircle2 className="h-5 w-5 text-primary" />
                      <span>{generatedStrategy.name}</span>
                    </CardTitle>
                    <Badge variant="secondary">
                      {generatedStrategy.campaign_type.toUpperCase()}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-3">
                    <div className="flex items-center space-x-2 text-sm font-medium">
                      <MessageSquare className="h-4 w-4 text-primary" />
                      <span>Your Messaging</span>
                    </div>
                    <div className="pl-6 space-y-2">
                      <p className="text-sm text-muted-foreground">
                        {generatedStrategy.messaging_framework?.core_message}
                      </p>
                      {generatedStrategy.messaging_framework?.hooks && (
                        <div className="mt-3">
                          <p className="text-sm font-medium mb-2">Hook Ideas:</p>
                          <ul className="space-y-1">
                            {generatedStrategy.messaging_framework.hooks.map((hook: string, idx: number) => (
                              <li key={idx} className="text-sm text-muted-foreground pl-4 border-l-2 border-primary/30">
                                {hook}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center space-x-2 text-sm font-medium">
                      <Target className="h-4 w-4 text-primary" />
                      <span>Who You're Talking To</span>
                    </div>
                    <div className="pl-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                      {["pain_points", "desires", "objections"].map((key) => (
                        <div key={key} className="space-y-2">
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                            {key.replace("_", " ")}
                          </p>
                          <ul className="space-y-1">
                            {generatedStrategy.audience_psychology?.[key]?.map((item: string, idx: number) => (
                              <li key={idx} className="text-sm">
                                • {item}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center space-x-2 text-sm font-medium">
                      <TrendingUp className="h-4 w-4 text-primary" />
                      <span>What to Watch</span>
                    </div>
                    <div className="pl-6 flex flex-wrap gap-3">
                      {Object.entries(generatedStrategy.kpi_benchmarks || {}).map(([key, value]) => (
                        <Badge key={key} variant="outline" className="text-sm">
                          {key.toUpperCase()}: {String(value)}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div className="flex space-x-3 pt-4">
                    <Button className="flex-1">
                      Create Ads
                    </Button>
                    <Button variant="outline">
                      Export
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Previous Strategies Sidebar */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Your Strategies</h3>
            {strategies.length === 0 ? (
              <Card>
                <CardContent className="pt-6 text-center text-sm text-muted-foreground">
                  No strategies yet. Create your first one!
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {strategies.map((strategy) => (
                  <Card
                    key={strategy.id}
                    className="cursor-pointer hover:shadow-lg transition-shadow"
                    onClick={() => setGeneratedStrategy(strategy)}
                  >
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">{strategy.name}</CardTitle>
                      <CardDescription className="text-xs">
                        {new Date(strategy.created_at).toLocaleDateString()}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Badge variant="secondary" className="text-xs">
                        {strategy.campaign_type}
                      </Badge>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
