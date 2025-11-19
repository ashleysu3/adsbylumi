import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Sparkles, Video, FileText, Image as ImageIcon, Copy, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

export default function Creative() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const workspaceId = searchParams.get("workspace");
  const strategyId = searchParams.get("strategy"); // Keep for backward compatibility

  const [loading, setLoading] = useState(false);
  const [brand, setBrand] = useState<any>(null);
  const [workspace, setWorkspace] = useState<any>(null);
  const [strategy, setStrategy] = useState<any>(null);
  const [creativeData, setCreativeData] = useState<any>(null);
  const [hasPrefilledOffer, setHasPrefilledOffer] = useState(false);
  
  const [showOfferForm, setShowOfferForm] = useState(true);
  const [offerName, setOfferName] = useState("");
  const [offerUrl, setOfferUrl] = useState("");
  const [offerPrice, setOfferPrice] = useState("");
  const [offerDescription, setOfferDescription] = useState("");
  
  const [offers, setOffers] = useState<any[]>([]);
  const [selectedOfferId, setSelectedOfferId] = useState<string | null>(null);
  const [selectedOffer, setSelectedOffer] = useState<any>(null);
  const [usingOfferPsychology, setUsingOfferPsychology] = useState(false);

  useEffect(() => {
    fetchData();
  }, [workspaceId, strategyId]);

  const fetchData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: brandData } = await supabase.from("brands").select("*").eq("user_id", user.id).single();
      setBrand(brandData);

      if (brandData) {
        const { data: offersData } = await supabase
          .from('offers')
          .select('*')
          .eq('brand_id', brandData.id)
          .order('created_at', { ascending: false });
        setOffers(offersData || []);
      }

      // Load from workspace if available
      if (workspaceId) {
        const { data: workspaceData } = await supabase
          .from("campaign_workspaces")
          .select("*")
          .eq("id", workspaceId)
          .single();
        
        setWorkspace(workspaceData);
        
        if (workspaceData?.offer_name) {
          setOfferName(workspaceData.offer_name);
          setOfferUrl(workspaceData.offer_url || "");
          setOfferPrice(workspaceData.offer_price || "");
          setOfferDescription(workspaceData.offer_description || "");
          setShowOfferForm(false);
          setHasPrefilledOffer(true);
        }
        
        if (workspaceData?.creative_json) {
          setCreativeData(workspaceData.creative_json);
        }
        
        if (workspaceData?.strategy_id) {
          const { data: strategyData } = await supabase
            .from("strategies")
            .select("*")
            .eq("id", workspaceData.strategy_id)
            .single();
          setStrategy(strategyData);
        }
      } 
      // Fallback to old strategy-based flow
      else if (strategyId) {
        const { data: strategyData } = await supabase.from("strategies").select("*").eq("id", strategyId).single();
        setStrategy(strategyData);
        
        if (strategyData?.offer_name) {
          setOfferName(strategyData.offer_name);
          setOfferUrl(strategyData.offer_url || "");
          setOfferPrice(strategyData.offer_price || "");
          setOfferDescription(strategyData.offer_description || "");
          setShowOfferForm(false);
          setHasPrefilledOffer(true);
        }
      }
    } catch (error: any) {
      console.error("Error fetching data:", error);
    }
  };

  const saveOfferDetails = async () => {
    if (!offerName.trim()) {
      toast.error("Please enter your offer name");
      return;
    }

    try {
      // Save to workspace if available
      if (workspace) {
        const { error } = await supabase.from("campaign_workspaces").update({
          offer_name: offerName,
          offer_url: offerUrl,
          offer_price: offerPrice,
          offer_description: offerDescription,
          progress_status: "creative_in_progress",
        }).eq("id", workspace.id);
        
        if (error) throw error;
      }
      // Fallback to strategy
      else if (strategy) {
        const { error } = await supabase.from("strategies").update({
          offer_name: offerName,
          offer_url: offerUrl,
          offer_price: offerPrice,
          offer_description: offerDescription,
        }).eq("id", strategy.id);
        
        if (error) throw error;
      }
      
      setShowOfferForm(false);
      toast.success("Offer details saved!");
    } catch (error: any) {
      console.error("Error saving offer:", error);
      toast.error(error.message || "Failed to save offer details");
    }
  };

  const handleOfferSelect = async (offerId: string) => {
    const offer = offers.find(o => o.id === offerId);
    if (!offer) return;
    
    setSelectedOfferId(offerId);
    setSelectedOffer(offer);
    
    setOfferName(offer.name);
    setOfferUrl(offer.url || "");
    setOfferPrice(offer.price_point || "");
    setOfferDescription(offer.description || "");
    
    if (offer.product_psychology && brand.audience_psychology) {
      setUsingOfferPsychology(true);
      toast.success("Enhanced with product psychology!");
    }
  };

  const clearOfferSelection = () => {
    setSelectedOfferId(null);
    setSelectedOffer(null);
    setUsingOfferPsychology(false);
    setOfferName("");
    setOfferUrl("");
    setOfferPrice("");
    setOfferDescription("");
  };

  const generateCreative = async () => {
    setLoading(true);
    try {
      const payload: any = {
        brandName: brand.name,
        strategyData: { 
          ...(workspace?.strategy_json || strategy), 
          offer_name: offerName, 
          offer_url: offerUrl, 
          offer_price: offerPrice, 
          offer_description: offerDescription 
        },
        creativeType: 'complete'
      };
      
      if (selectedOffer?.product_psychology) {
        payload.productPsychology = selectedOffer.product_psychology;
      }
      if (brand?.audience_psychology) {
        payload.audiencePsychology = brand.audience_psychology;
      }
      
      const { data, error } = await supabase.functions.invoke('generate-creative', {
        body: payload
      });

      if (error) throw error;
      setCreativeData(data);
      
      // Save to workspace if available
      if (workspace) {
        await supabase.from("campaign_workspaces").update({
          creative_json: data,
          progress_status: "waiting_for_assets",
          production_checklist: generateProductionChecklist(data),
        }).eq("id", workspace.id);
        
        toast.success("Creative saved to workspace!");
        // Navigate to workspace instead of staying on creative page
        navigate(`/workspace/${workspace.id}`);
      } else {
        toast.success("Creative assets generated!");
      }
    } catch (error: any) {
      console.error("Error generating creative:", error);
      if (error.message?.includes("429")) toast.error("Rate limit exceeded. Please wait a moment.");
      else if (error.message?.includes("402")) toast.error("AI credits depleted. Please add credits in Settings.");
      else toast.error(error.message || "Failed to generate creative");
    } finally {
      setLoading(false);
    }
  };
  
  const generateProductionChecklist = (creative: any) => {
    const items = [];
    if (creative.hooks) items.push({ id: "hooks", category: "📹 To Record", title: "Film hook variations", completed: false });
    if (creative.scripts) items.push({ id: "scripts", category: "📹 To Record", title: "Record scripts", completed: false });
    if (creative.broll) items.push({ id: "broll", category: "📹 To Record", title: "Capture B-roll", completed: false });
    if (creative.graphics) items.push({ id: "graphics", category: "🎨 To Design", title: "Create graphics", completed: false });
    items.push({ id: "edit", category: "✂️ Post-Production", title: "Edit videos", completed: false });
    items.push({ id: "formats", category: "✂️ Post-Production", title: "Export formats", completed: false });
    return items;
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  if (!brand) {
    return (<DashboardLayout><Card><CardHeader><CardTitle>Setup Required</CardTitle><CardDescription>Please complete your brand setup first.</CardDescription></CardHeader></Card></DashboardLayout>);
  }

  if (!workspace && !strategy) {
    return (<DashboardLayout><Card><CardHeader><CardTitle>No Campaign Selected</CardTitle><CardDescription>Please select a campaign template from the Ad Planner first.</CardDescription></CardHeader><CardContent><Button onClick={() => navigate("/planning")}><ArrowLeft className="mr-2 h-4 w-4" />Go to Ad Planner</Button></CardContent></Card></DashboardLayout>);
  }

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {hasPrefilledOffer && !showOfferForm && (
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="font-semibold">Creating campaign for: {offerName}</p>
                  {offerPrice && <p className="text-sm text-muted-foreground">Price: {offerPrice}</p>}
                </div>
                <Button variant="outline" size="sm" onClick={() => setShowOfferForm(true)}>
                  Change Offer Details
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
        
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="flex items-center space-x-3">
              <Button variant="ghost" size="sm" onClick={() => navigate("/planning")}><ArrowLeft className="h-4 w-4" /></Button>
              <div>
                <h2 className="text-3xl font-bold tracking-tight">Creative Department</h2>
                <p className="text-muted-foreground">
                  {strategy?.name || workspace?.name || 'Campaign'} for {brand?.name}
                </p>
              </div>
            </div>
          </div>
          {strategy?.campaign_type && (
            <Badge variant="secondary">{strategy.campaign_type}</Badge>
          )}
        </div>

        {showOfferForm && (
          <Card>
            <CardHeader>
              <div className="flex items-center space-x-2"><Sparkles className="h-5 w-5 text-primary" /><CardTitle>Tell Us About Your Offer</CardTitle></div>
              <CardDescription>We need a few details to create personalized creative assets</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              
              {offers.length > 0 && !selectedOfferId && (
                <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg space-y-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary" />
                    <span className="font-medium">Quick Start with Existing Offer</span>
                  </div>
                  <Select onValueChange={handleOfferSelect}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose from your offers..." />
                    </SelectTrigger>
                    <SelectContent>
                      {offers.map(offer => (
                        <SelectItem key={offer.id} value={offer.id}>
                          <div className="flex items-center gap-2">
                            <span>{offer.name}</span>
                            {offer.price_point && (
                              <Badge variant="secondary" className="ml-2">
                                ${offer.price_point}
                              </Badge>
                            )}
                            {offer.product_psychology && (
                              <Badge variant="outline" className="ml-2">
                                ✨ Psychology
                              </Badge>
                            )}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Selecting an offer will auto-fill details and enhance creative with psychology data
                  </p>
                </div>
              )}
              
              {selectedOfferId && (
                <div className="p-4 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="font-medium">Using: {offerName}</p>
                      {usingOfferPsychology && (
                        <Badge variant="default" className="gap-1">
                          <Sparkles className="h-3 w-3" />
                          Enhanced with Product Psychology
                        </Badge>
                      )}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={clearOfferSelection}
                    >
                      Clear & Enter Manually
                    </Button>
                  </div>
                </div>
              )}
              
              {selectedOfferId && (
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-sm text-muted-foreground">or edit details below</span>
                  <div className="flex-1 h-px bg-border" />
                </div>
              )}
              
              <div className="space-y-2">
                <Label htmlFor="offerName">What are you promoting? *</Label>
                <Input id="offerName" value={offerName} onChange={(e) => setOfferName(e.target.value)} placeholder="e.g., Email Marketing Masterclass" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="offerUrl">URL (optional)</Label>
                  <Input id="offerUrl" value={offerUrl} onChange={(e) => setOfferUrl(e.target.value)} placeholder="https://..." />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="offerPrice">Price (optional)</Label>
                  <Input id="offerPrice" value={offerPrice} onChange={(e) => setOfferPrice(e.target.value)} placeholder="e.g., $47" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="offerDescription">Short description (optional)</Label>
                <Textarea id="offerDescription" value={offerDescription} onChange={(e) => setOfferDescription(e.target.value)} placeholder="What problem does it solve?" className="min-h-[100px] resize-none" />
              </div>
              <Button onClick={saveOfferDetails} disabled={!offerName.trim()} className="w-full">Continue to Creative Generation</Button>
            </CardContent>
          </Card>
        )}

        {!showOfferForm && !creativeData && (
          <Card>
            <CardHeader>
              <CardTitle>Ready to Generate Creative?</CardTitle>
              <CardDescription>We'll create scripts, copy, and creative direction for "{offerName}"</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-secondary rounded-lg space-y-2 text-sm">
                <div><strong>Offer:</strong> {offerName}</div>
                {offerPrice && <div><strong>Price:</strong> {offerPrice}</div>}
                {offerDescription && <div><strong>About:</strong> {offerDescription}</div>}
              </div>
              <div className="flex space-x-3">
                <Button onClick={generateCreative} disabled={loading} className="flex-1" size="lg">
                  {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creating Your Assets...</> : <><Sparkles className="mr-2 h-4 w-4" />Generate Creative</>}
                </Button>
                <Button variant="outline" onClick={() => setShowOfferForm(true)}>Edit Offer</Button>
              </div>
            </CardContent>
          </Card>
        )}

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
                <CardHeader><CardTitle className="flex items-center space-x-2"><Video className="h-5 w-5 text-primary" /><span>Video Hooks</span></CardTitle><CardDescription>Opening lines to grab attention in the first 3 seconds</CardDescription></CardHeader>
                <CardContent className="space-y-3">
                  {creativeData.hooks?.map((hook: string, idx: number) => (
                    <div key={idx} className="p-4 bg-secondary rounded-lg flex items-start justify-between">
                      <div className="flex-1"><Badge className="mb-2">Hook {idx + 1}</Badge><p className="text-sm">{hook}</p></div>
                      <Button variant="ghost" size="sm" onClick={() => copyToClipboard(hook)}><Copy className="h-4 w-4" /></Button>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="scripts" className="space-y-4">
              {creativeData.scripts?.map((script: any, idx: number) => (
                <Card key={idx}>
                  <CardHeader><CardTitle className="flex items-center justify-between"><span className="flex items-center space-x-2"><Video className="h-5 w-5 text-primary" /><span>{script.title}</span></span><Button variant="outline" size="sm" onClick={() => copyToClipboard(script.content)}><Copy className="mr-2 h-4 w-4" />Copy</Button></CardTitle></CardHeader>
                  <CardContent className="space-y-4">
                    <div className="p-4 bg-secondary rounded-lg"><p className="text-sm whitespace-pre-wrap">{script.content}</p></div>
                    <div className="flex items-center justify-between pt-4 border-t"><span className="text-sm font-medium">Call to Action:</span><Badge variant="secondary">{script.cta}</Badge></div>
                  </CardContent>
                </Card>
              ))}
            </TabsContent>

            <TabsContent value="copy" className="space-y-4">
              <Card>
                <CardHeader><CardTitle className="flex items-center space-x-2"><FileText className="h-5 w-5 text-primary" /><span>Ad Headlines</span></CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  {creativeData.headlines?.map((headline: string, idx: number) => (
                    <div key={idx} className="p-3 bg-secondary rounded-lg flex items-center justify-between">
                      <span className="text-sm font-medium">{headline}</span>
                      <Button variant="ghost" size="sm" onClick={() => copyToClipboard(headline)}><Copy className="h-4 w-4" /></Button>
                    </div>
                  ))}
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle>Primary Copy Versions</CardTitle><CardDescription>Test different lengths to see what works best</CardDescription></CardHeader>
                <CardContent className="space-y-4">
                  {creativeData.primaryCopy && Object.entries(creativeData.primaryCopy).map(([length, copy]) => (
                    <div key={length} className="space-y-2">
                      <div className="flex items-center justify-between"><Badge variant="outline" className="capitalize">{length}</Badge><Button variant="ghost" size="sm" onClick={() => copyToClipboard(copy as string)}><Copy className="h-4 w-4" /></Button></div>
                      <div className="p-4 bg-secondary rounded-lg"><p className="text-sm">{copy as string}</p></div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="broll" className="space-y-4">
              <Card>
                <CardHeader><CardTitle className="flex items-center space-x-2"><Video className="h-5 w-5 text-primary" /><span>B-Roll Shot List</span></CardTitle><CardDescription>Visual shots to support your script</CardDescription></CardHeader>
                <CardContent className="space-y-3">
                  {creativeData.broll?.map((shot: string, idx: number) => (
                    <div key={idx} className="p-4 bg-secondary rounded-lg"><div className="flex items-start space-x-3"><Badge variant="outline">{idx + 1}</Badge><p className="text-sm flex-1">{shot}</p></div></div>
                  ))}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="graphics" className="space-y-4">
              {creativeData.staticGraphics?.map((graphic: any, idx: number) => (
                <Card key={idx}>
                  <CardHeader><CardTitle className="flex items-center space-x-2"><ImageIcon className="h-5 w-5 text-primary" /><span>{graphic.title}</span></CardTitle></CardHeader>
                  <CardContent><ul className="space-y-2">{graphic.elements?.map((element: string, eIdx: number) => (<li key={eIdx} className="text-sm flex items-start"><span className="mr-2">•</span><span>{element}</span></li>))}</ul></CardContent>
                </Card>
              ))}
            </TabsContent>
          </Tabs>
        )}
      </div>
    </DashboardLayout>
  );
}
