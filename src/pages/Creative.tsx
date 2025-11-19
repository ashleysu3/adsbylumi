import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Sparkles, Video, FileText, Image as ImageIcon, Copy } from "lucide-react";
import { toast } from "sonner";

export default function Creative() {
  const [loading, setLoading] = useState(false);
  const [brand, setBrand] = useState<any>(null);
  const [strategies, setStrategies] = useState<any[]>([]);
  const [selectedStrategy, setSelectedStrategy] = useState<string>("");
  const [creativeData, setCreativeData] = useState<any>(null);

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

  const generateCreative = async () => {
    if (!selectedStrategy) {
      toast.error("Please select a strategy first");
      return;
    }

    setLoading(true);
    try {
      const strategy = strategies.find(s => s.id === selectedStrategy);
      
      const { data, error } = await supabase.functions.invoke('generate-creative', {
        body: {
          brandName: brand.name,
          strategyData: strategy,
          creativeType: 'complete'
        }
      });

      if (error) throw error;

      setCreativeData(data);
      toast.success("Creative assets generated!");
    } catch (error: any) {
      console.error("Error generating creative:", error);
      toast.error(error.message || "Failed to generate creative");
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
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
            Creative Department
          </h2>
          <p className="text-muted-foreground">
            Generate scripts, copy, and creative direction for {brand.name}
          </p>
        </div>

        {/* Strategy Selector */}
        <Card>
          <CardHeader>
            <div className="flex items-center space-x-2">
              <Sparkles className="h-5 w-5 text-primary" />
              <CardTitle>Generate Creative Assets</CardTitle>
            </div>
            <CardDescription>
              Pick a strategy and we'll create everything you need
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Strategy</label>
              <Select value={selectedStrategy} onValueChange={setSelectedStrategy}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a strategy..." />
                </SelectTrigger>
                <SelectContent>
                  {strategies.length === 0 ? (
                    <SelectItem value="none" disabled>
                      No strategies yet - create one in Ad Planner
                    </SelectItem>
                  ) : (
                    strategies.map((strategy) => (
                      <SelectItem key={strategy.id} value={strategy.id}>
                        {strategy.name} ({strategy.campaign_type})
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <Button
              onClick={generateCreative}
              disabled={loading || !selectedStrategy}
              className="w-full h-12"
              size="lg"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating Your Assets...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Generate Creative
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Creative Output */}
        {creativeData && (
          <Tabs defaultValue="hooks" className="space-y-6">
            <TabsList className="grid grid-cols-2 lg:grid-cols-5 w-full">
              <TabsTrigger value="hooks">Hooks</TabsTrigger>
              <TabsTrigger value="scripts">Scripts</TabsTrigger>
              <TabsTrigger value="copy">Ad Copy</TabsTrigger>
              <TabsTrigger value="broll">B-Roll</TabsTrigger>
              <TabsTrigger value="graphics">Graphics</TabsTrigger>
            </TabsList>

            <TabsContent value="hooks" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Video className="h-5 w-5 text-primary" />
                    <span>Video Hooks</span>
                  </CardTitle>
                  <CardDescription>
                    Opening lines to grab attention in the first 3 seconds
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {creativeData.hooks?.map((hook: string, idx: number) => (
                    <div key={idx} className="p-4 bg-secondary rounded-lg flex items-start justify-between">
                      <div className="flex-1">
                        <Badge className="mb-2">Hook {idx + 1}</Badge>
                        <p className="text-sm">{hook}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(hook)}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="scripts" className="space-y-4">
              {creativeData.scripts?.map((script: any, idx: number) => (
                <Card key={idx}>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span className="flex items-center space-x-2">
                        <Video className="h-5 w-5 text-primary" />
                        <span>{script.title}</span>
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyToClipboard(script.content)}
                      >
                        <Copy className="mr-2 h-4 w-4" />
                        Copy
                      </Button>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="p-4 bg-secondary rounded-lg">
                      <p className="text-sm whitespace-pre-wrap">{script.content}</p>
                    </div>
                    <div className="flex items-center justify-between pt-4 border-t">
                      <span className="text-sm font-medium">Call to Action:</span>
                      <Badge variant="secondary">{script.cta}</Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </TabsContent>

            <TabsContent value="copy" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <FileText className="h-5 w-5 text-primary" />
                    <span>Ad Headlines</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {creativeData.headlines?.map((headline: string, idx: number) => (
                    <div key={idx} className="p-3 bg-secondary rounded-lg flex items-center justify-between">
                      <span className="text-sm font-medium">{headline}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(headline)}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Primary Copy Versions</CardTitle>
                  <CardDescription>
                    Test different lengths to see what works best
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {creativeData.primaryCopy && Object.entries(creativeData.primaryCopy).map(([length, copy]) => (
                    <div key={length} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Badge variant="outline" className="capitalize">{length}</Badge>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyToClipboard(copy as string)}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="p-4 bg-secondary rounded-lg">
                        <p className="text-sm">{copy as string}</p>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="broll" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Video className="h-5 w-5 text-primary" />
                    <span>B-Roll Shot List</span>
                  </CardTitle>
                  <CardDescription>
                    Visual shots to support your script
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {creativeData.broll?.map((shot: string, idx: number) => (
                    <div key={idx} className="p-4 bg-secondary rounded-lg">
                      <div className="flex items-start space-x-3">
                        <Badge variant="outline">{idx + 1}</Badge>
                        <p className="text-sm flex-1">{shot}</p>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="graphics" className="space-y-4">
              {creativeData.staticGraphics?.map((graphic: any, idx: number) => (
                <Card key={idx}>
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <ImageIcon className="h-5 w-5 text-primary" />
                      <span>{graphic.title}</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {graphic.elements?.map((element: string, eIdx: number) => (
                        <li key={eIdx} className="text-sm flex items-start">
                          <span className="mr-2">•</span>
                          <span>{element}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              ))}
            </TabsContent>
          </Tabs>
        )}

        {!creativeData && strategies.length > 0 && (
          <Card className="border-dashed">
            <CardContent className="pt-6 text-center py-12">
              <Sparkles className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
                Select a strategy and generate creative to get started
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
