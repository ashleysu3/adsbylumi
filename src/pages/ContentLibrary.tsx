import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Search, Lightbulb, FileText, Video, Image, Sparkles, MoreHorizontal, Edit2, Trash2, FolderOpen, Filter, Tag, Wand2, Check, X, Loader2, Brain, RefreshCw, CheckCheck } from "lucide-react";
import { toast } from "sonner";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { CreativeFlowModal } from "@/components/creative/CreativeFlowModal";
type ContentIdea = {
  id: string;
  brand_id: string;
  offer_id: string | null;
  title: string;
  content: string | null;
  type: string;
  status: string;
  tags: string[];
  created_at: string;
  updated_at: string;
};
type Offer = {
  id: string;
  name: string;
};
const IDEA_TYPES = [{
  value: "hook",
  label: "Hook",
  icon: Sparkles,
  color: "bg-purple-500/10 text-purple-600 border-purple-500/30"
}, {
  value: "script",
  label: "Script",
  icon: FileText,
  color: "bg-blue-500/10 text-blue-600 border-blue-500/30"
}, {
  value: "visual",
  label: "Visual",
  icon: Image,
  color: "bg-pink-500/10 text-pink-600 border-pink-500/30"
}, {
  value: "video",
  label: "Video Idea",
  icon: Video,
  color: "bg-orange-500/10 text-orange-600 border-orange-500/30"
}, {
  value: "idea",
  label: "General Idea",
  icon: Lightbulb,
  color: "bg-yellow-500/10 text-yellow-600 border-yellow-500/30"
}];
const STATUS_OPTIONS = [{
  value: "idea",
  label: "Idea",
  color: "bg-muted text-muted-foreground"
}, {
  value: "in_progress",
  label: "In Progress",
  color: "bg-blue-500/10 text-blue-600"
}, {
  value: "used",
  label: "Used",
  color: "bg-green-500/10 text-green-600"
}];
export default function ContentLibrary() {
  const navigate = useNavigate();
  const { getEffectiveUserId } = useImpersonation();
  const [loading, setLoading] = useState(true);
  const [brand, setBrand] = useState<any>(null);
  const [ideas, setIdeas] = useState<ContentIdea[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterOffer, setFilterOffer] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingIdea, setEditingIdea] = useState<ContentIdea | null>(null);
  const [formData, setFormData] = useState({
    title: "",
    content: "",
    type: "idea",
    offer_id: "",
    tags: ""
  });

  // AI generation state
  const [aiDialogOpen, setAiDialogOpen] = useState(false);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<any[]>([]);
  const [aiIdeaType, setAiIdeaType] = useState<string>("idea");
  const [aiOfferId, setAiOfferId] = useState<string>("");
  const [selectedOffer, setSelectedOffer] = useState<any>(null);

  // Creative flow modal state
  const [creativeModalOpen, setCreativeModalOpen] = useState(false);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const [campaignSelectOpen, setCampaignSelectOpen] = useState(false);
  useEffect(() => {
    fetchData();
  }, []);
  const fetchData = async () => {
    try {
      const {
        data: {
          user
        }
      } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }

      // Use effective user ID for impersonation support
      const effectiveUserId = await getEffectiveUserId();
      if (!effectiveUserId) return;

      const {
        data: brandData
      } = await supabase.from("brands").select("*").eq("user_id", effectiveUserId).single();
      if (!brandData) {
        navigate("/dashboard");
        return;
      }
      setBrand(brandData);

      // Fetch offers, ideas, and campaigns in parallel
      const [offersRes, ideasRes, campaignsRes] = await Promise.all([supabase.from("offers").select("id, name").eq("brand_id", brandData.id).eq("archived", false).order("name"), supabase.from("content_ideas").select("*").eq("brand_id", brandData.id).order("created_at", {
        ascending: false
      }), supabase.from("campaign_workspaces").select("id, name, offer_name, progress_status, strategy_json").eq("brand_id", brandData.id).not("strategy_json", "is", null).order("updated_at", {
        ascending: false
      }).limit(20)]);
      if (offersRes.data) setOffers(offersRes.data);
      if (ideasRes.data) setIdeas(ideasRes.data as ContentIdea[]);
      if (campaignsRes.data) setCampaigns(campaignsRes.data);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Failed to load content library");
    } finally {
      setLoading(false);
    }
  };
  const handleOpenCreativeFlow = () => {
    if (campaigns.length === 0) {
      toast.error("No campaigns with strategy found. Create a campaign first.");
      return;
    }
    if (campaigns.length === 1) {
      setSelectedCampaignId(campaigns[0].id);
      setCreativeModalOpen(true);
    } else {
      setCampaignSelectOpen(true);
    }
  };
  const handleSelectCampaignForCreative = (campaignId: string) => {
    setSelectedCampaignId(campaignId);
    setCampaignSelectOpen(false);
    setCreativeModalOpen(true);
  };
  const openNewDialog = () => {
    setEditingIdea(null);
    setFormData({
      title: "",
      content: "",
      type: "idea",
      offer_id: "",
      tags: ""
    });
    setDialogOpen(true);
  };
  const openEditDialog = (idea: ContentIdea) => {
    setEditingIdea(idea);
    setFormData({
      title: idea.title,
      content: idea.content || "",
      type: idea.type,
      offer_id: idea.offer_id || "",
      tags: idea.tags?.join(", ") || ""
    });
    setDialogOpen(true);
  };
  const handleSave = async () => {
    if (!formData.title.trim()) {
      toast.error("Please enter a title");
      return;
    }
    try {
      const tagsArray = formData.tags.split(",").map(t => t.trim()).filter(t => t.length > 0);
      const payload = {
        brand_id: brand.id,
        title: formData.title.trim(),
        content: formData.content.trim() || null,
        type: formData.type,
        offer_id: formData.offer_id || null,
        tags: tagsArray
      };
      if (editingIdea) {
        const {
          error
        } = await supabase.from("content_ideas").update(payload).eq("id", editingIdea.id);
        if (error) throw error;
        toast.success("Idea updated!");
      } else {
        const {
          error
        } = await supabase.from("content_ideas").insert(payload);
        if (error) throw error;
        toast.success("Idea saved!");
      }
      setDialogOpen(false);
      fetchData();
    } catch (error: any) {
      console.error("Error saving idea:", error);
      toast.error(error.message || "Failed to save idea");
    }
  };
  const handleDelete = async (id: string) => {
    try {
      const {
        error
      } = await supabase.from("content_ideas").delete().eq("id", id);
      if (error) throw error;
      toast.success("Idea deleted");
      setIdeas(ideas.filter(i => i.id !== id));
    } catch (error) {
      console.error("Error deleting:", error);
      toast.error("Failed to delete idea");
    }
  };
  const updateStatus = async (id: string, status: string) => {
    try {
      const {
        error
      } = await supabase.from("content_ideas").update({
        status
      }).eq("id", id);
      if (error) throw error;
      setIdeas(ideas.map(i => i.id === id ? {
        ...i,
        status
      } : i));
      toast.success("Status updated");
    } catch (error) {
      console.error("Error updating status:", error);
    }
  };

  // AI Generation
  const openAiDialog = () => {
    setAiSuggestions([]);
    setAiIdeaType("idea");
    setAiOfferId("");
    setSelectedOffer(null);
    setAiDialogOpen(true);
  };
  const generateAiIdeas = async () => {
    setAiGenerating(true);
    try {
      // Fetch full offer data if selected
      let offerData = null;
      if (aiOfferId) {
        const {
          data
        } = await supabase.from("offers").select("*").eq("id", aiOfferId).single();
        offerData = data;
        setSelectedOffer(data);
      }
      const {
        data,
        error
      } = await supabase.functions.invoke("generate-content-ideas", {
        body: {
          brand,
          offer: offerData,
          ideaType: aiIdeaType,
          existingIdeas: ideas.slice(0, 20) // Send recent ideas to avoid duplicates
        }
      });
      if (error) throw error;
      if (data?.error) {
        if (data.error.includes("Rate limit")) {
          toast.error("Rate limit exceeded. Please try again in a moment.");
        } else if (data.error.includes("credits")) {
          toast.error("AI credits depleted. Please add credits in Settings.");
        } else {
          throw new Error(data.error);
        }
        return;
      }
      setAiSuggestions(data.ideas || []);
    } catch (error: any) {
      console.error("Error generating ideas:", error);
      toast.error(error.message || "Failed to generate ideas");
    } finally {
      setAiGenerating(false);
    }
  };
  const saveAiIdea = async (suggestion: any, index: number) => {
    try {
      const payload = {
        brand_id: brand.id,
        title: suggestion.title,
        content: `${suggestion.content}\n\n---\n🧠 Psychology: ${suggestion.psychology}`,
        type: suggestion.type,
        offer_id: aiOfferId || null,
        tags: suggestion.tags || [],
        status: "idea"
      };
      const {
        error
      } = await supabase.from("content_ideas").insert(payload);
      if (error) throw error;
      toast.success("Idea saved to library!");
      setAiSuggestions(prev => prev.filter((_, i) => i !== index));
      fetchData();
    } catch (error: any) {
      console.error("Error saving AI idea:", error);
      toast.error("Failed to save idea");
    }
  };
  const saveAllAiIdeas = async () => {
    if (aiSuggestions.length === 0) return;
    try {
      const payloads = aiSuggestions.map(suggestion => ({
        brand_id: brand.id,
        title: suggestion.title,
        content: `${suggestion.content}\n\n---\n🧠 Psychology: ${suggestion.psychology}`,
        type: suggestion.type,
        offer_id: aiOfferId || null,
        tags: suggestion.tags || [],
        status: "idea"
      }));
      const {
        error
      } = await supabase.from("content_ideas").insert(payloads);
      if (error) throw error;
      toast.success(`${aiSuggestions.length} ideas saved to library!`);
      setAiSuggestions([]);
      fetchData();
    } catch (error: any) {
      console.error("Error saving all ideas:", error);
      toast.error("Failed to save ideas");
    }
  };
  const regenerateSingleIdea = async (index: number) => {
    setAiSuggestions(prev => prev.map((s, i) => i === index ? {
      ...s,
      regenerating: true
    } : s));
    try {
      let offerData = null;
      if (aiOfferId) {
        const {
          data
        } = await supabase.from("offers").select("*").eq("id", aiOfferId).single();
        offerData = data;
      }

      // Get current suggestions to avoid duplicates
      const currentTitles = aiSuggestions.map(s => s.title);
      const existingToAvoid = [...ideas.slice(0, 20), ...aiSuggestions.map(s => ({
        title: s.title
      }))];
      const {
        data,
        error
      } = await supabase.functions.invoke("generate-content-ideas", {
        body: {
          brand,
          offer: offerData,
          ideaType: aiSuggestions[index]?.type || aiIdeaType,
          existingIdeas: existingToAvoid,
          count: 1
        }
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const newIdea = data.ideas?.[0];
      if (newIdea) {
        setAiSuggestions(prev => prev.map((s, i) => i === index ? newIdea : s));
        toast.success("Idea regenerated!");
      }
    } catch (error: any) {
      console.error("Error regenerating idea:", error);
      toast.error("Failed to regenerate idea");
      setAiSuggestions(prev => prev.map((s, i) => i === index ? {
        ...s,
        regenerating: false
      } : s));
    }
  };

  // Filter ideas
  const filteredIdeas = ideas.filter(idea => {
    const matchesSearch = searchQuery === "" || idea.title.toLowerCase().includes(searchQuery.toLowerCase()) || idea.content?.toLowerCase().includes(searchQuery.toLowerCase()) || idea.tags?.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesOffer = filterOffer === "all" || (filterOffer === "none" ? !idea.offer_id : idea.offer_id === filterOffer);
    const matchesType = filterType === "all" || idea.type === filterType;
    return matchesSearch && matchesOffer && matchesType;
  });

  // Group by offer
  const groupedByOffer = filteredIdeas.reduce((acc, idea) => {
    const key = idea.offer_id || "uncategorized";
    if (!acc[key]) acc[key] = [];
    acc[key].push(idea);
    return acc;
  }, {} as Record<string, ContentIdea[]>);
  const getOfferName = (offerId: string) => {
    if (offerId === "uncategorized") return "Uncategorized";
    return offers.find(o => o.id === offerId)?.name || "Unknown Offer";
  };
  const getTypeConfig = (type: string) => {
    return IDEA_TYPES.find(t => t.value === type) || IDEA_TYPES[4];
  };
  const getStatusConfig = (status: string) => {
    return STATUS_OPTIONS.find(s => s.value === status) || STATUS_OPTIONS[0];
  };
  if (loading) {
    return <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </DashboardLayout>;
  }
  return <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">Saved for Later</h1>
            <p className="text-muted-foreground text-sm">
              Creative concepts you've saved to revisit or use in future campaigns
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleOpenCreativeFlow} variant="outline" className="gap-2">
              <Sparkles className="h-4 w-4" />
              <span className="hidden sm:inline">Generate Angles & Ideas</span>
              <span className="sm:hidden">Angles</span>
            </Button>
            
            <Button onClick={openNewDialog} className="gap-2">
              <Plus className="h-4 w-4" />
              Add Idea
            </Button>
          </div>
        </div>

        {/* Search & Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search ideas..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-9" />
          </div>
          <Select value={filterOffer} onValueChange={setFilterOffer}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <FolderOpen className="h-4 w-4 mr-2 text-muted-foreground" />
              <SelectValue placeholder="Filter by offer" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Offers</SelectItem>
              <SelectItem value="none">Uncategorized</SelectItem>
              {offers.map(offer => <SelectItem key={offer.id} value={offer.id}>{offer.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-full sm:w-[160px]">
              <Filter className="h-4 w-4 mr-2 text-muted-foreground" />
              <SelectValue placeholder="Filter by type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {IDEA_TYPES.map(type => <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {/* Content */}
        {filteredIdeas.length === 0 ? <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <Lightbulb className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-medium mb-1">No content ideas yet</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Start saving your hooks, scripts, and creative ideas here
              </p>
              <Button onClick={openNewDialog} variant="outline" className="gap-2">
                <Plus className="h-4 w-4" />
                Add Your First Idea
              </Button>
            </CardContent>
          </Card> : <div className="space-y-6">
            {Object.entries(groupedByOffer).map(([offerId, offerIdeas]) => <div key={offerId}>
                <h3 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                  <FolderOpen className="h-4 w-4" />
                  {getOfferName(offerId)}
                  <Badge variant="secondary" className="ml-1">{offerIdeas.length}</Badge>
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {offerIdeas.map(idea => {
              const typeConfig = getTypeConfig(idea.type);
              const statusConfig = getStatusConfig(idea.status);
              const TypeIcon = typeConfig.icon;
              return <Card key={idea.id} className="group hover:shadow-md transition-shadow cursor-pointer" onClick={() => openEditDialog(idea)}>
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div className="flex items-center gap-2">
                              <div className={cn("p-1.5 rounded", typeConfig.color)}>
                                <TypeIcon className="h-3.5 w-3.5" />
                              </div>
                              <Badge variant="outline" className={cn("text-xs", statusConfig.color)}>
                                {statusConfig.label}
                              </Badge>
                            </div>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
                                <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={e => {
                          e.stopPropagation();
                          openEditDialog(idea);
                        }}>
                                  <Edit2 className="h-4 w-4 mr-2" />
                                  Edit
                                </DropdownMenuItem>
                                {STATUS_OPTIONS.map(status => <DropdownMenuItem key={status.value} onClick={e => {
                          e.stopPropagation();
                          updateStatus(idea.id, status.value);
                        }}>
                                    Mark as {status.label}
                                  </DropdownMenuItem>)}
                                <DropdownMenuItem onClick={e => {
                          e.stopPropagation();
                          handleDelete(idea.id);
                        }} className="text-destructive">
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                          
                          <h4 className="font-medium text-sm mb-1 line-clamp-2">{idea.title}</h4>
                          {idea.content && <p className="text-xs text-muted-foreground line-clamp-3">{idea.content}</p>}
                          
                          {idea.tags && idea.tags.length > 0 && <div className="flex flex-wrap gap-1 mt-2">
                              {idea.tags.slice(0, 3).map((tag, i) => <Badge key={i} variant="outline" className="text-xs px-1.5 py-0">
                                  {tag}
                                </Badge>)}
                              {idea.tags.length > 3 && <Badge variant="outline" className="text-xs px-1.5 py-0">
                                  +{idea.tags.length - 3}
                                </Badge>}
                            </div>}
                        </CardContent>
                      </Card>;
            })}
                </div>
              </div>)}
          </div>}
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingIdea ? "Edit Idea" : "Add New Idea"}</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="title">Title *</Label>
              <Input id="title" value={formData.title} onChange={e => setFormData({
              ...formData,
              title: e.target.value
            })} placeholder="e.g., Hook about transformation" />
            </div>
            
            <div>
              <Label htmlFor="content">Content</Label>
              <Textarea id="content" value={formData.content} onChange={e => setFormData({
              ...formData,
              content: e.target.value
            })} placeholder="Write your idea, script, or notes here..." rows={4} />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Type</Label>
                <Select value={formData.type} onValueChange={v => setFormData({
                ...formData,
                type: v
              })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {IDEA_TYPES.map(type => <SelectItem key={type.value} value={type.value}>
                        <span className="flex items-center gap-2">
                          <type.icon className="h-4 w-4" />
                          {type.label}
                        </span>
                      </SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label>Offer</Label>
                <Select value={formData.offer_id || "none"} onValueChange={v => setFormData({
                ...formData,
                offer_id: v === "none" ? "" : v
              })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select offer" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No offer</SelectItem>
                    {offers.map(offer => <SelectItem key={offer.id} value={offer.id}>{offer.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div>
              <Label htmlFor="tags">
                <span className="flex items-center gap-1">
                  <Tag className="h-3 w-3" />
                  Tags
                </span>
              </Label>
              <Input id="tags" value={formData.tags} onChange={e => setFormData({
              ...formData,
              tags: e.target.value
            })} placeholder="e.g., testimonial, urgency, social-proof (comma-separated)" />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave}>{editingIdea ? "Save Changes" : "Add Idea"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AI Generation Dialog */}
      <Dialog open={aiDialogOpen} onOpenChange={setAiDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-primary" />
              AI Idea Generator
            </DialogTitle>
          </DialogHeader>
          
          {aiSuggestions.length === 0 ? <div className="space-y-4 py-4">
              <p className="text-sm text-muted-foreground">
                Generate content ideas based on your brand psychology and offer details. The AI will analyze your audience and create tailored suggestions.
              </p>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Idea Type</Label>
                  <Select value={aiIdeaType} onValueChange={setAiIdeaType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {IDEA_TYPES.map(type => <SelectItem key={type.value} value={type.value}>
                          <span className="flex items-center gap-2">
                            <type.icon className="h-4 w-4" />
                            {type.label}
                          </span>
                        </SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label>For Offer (optional)</Label>
                  <Select value={aiOfferId || "none"} onValueChange={v => setAiOfferId(v === "none" ? "" : v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select offer" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Any / General</SelectItem>
                      {offers.map(offer => <SelectItem key={offer.id} value={offer.id}>{offer.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <Button onClick={generateAiIdeas} disabled={aiGenerating} className="w-full gap-2">
                {aiGenerating ? <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Generating ideas...
                  </> : <>
                    <Sparkles className="h-4 w-4" />
                    Generate 5 Ideas
                  </>}
              </Button>
            </div> : <div className="flex-1 overflow-y-auto space-y-3 py-2 pr-2">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-muted-foreground">
                  {aiSuggestions.length} idea{aiSuggestions.length !== 1 ? 's' : ''} generated
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={saveAllAiIdeas} disabled={aiSuggestions.length === 0} className="gap-1">
                    <CheckCheck className="h-3.5 w-3.5" />
                    Save All
                  </Button>
                  <Button variant="ghost" size="sm" onClick={generateAiIdeas} disabled={aiGenerating}>
                    {aiGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Regenerate All"}
                  </Button>
                </div>
              </div>
              
              {aiSuggestions.map((suggestion, index) => {
            const typeConfig = IDEA_TYPES.find(t => t.value === suggestion.type) || IDEA_TYPES[4];
            const TypeIcon = typeConfig.icon;
            const isRegenerating = suggestion.regenerating;
            return <Card key={index} className={cn("overflow-hidden transition-opacity", isRegenerating && "opacity-50")}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <div className={cn("p-1.5 rounded shrink-0", typeConfig.color)}>
                            <TypeIcon className="h-3.5 w-3.5" />
                          </div>
                          <h4 className="font-medium text-sm truncate">{suggestion.title}</h4>
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <Button size="sm" variant="ghost" onClick={() => regenerateSingleIdea(index)} disabled={isRegenerating} className="h-8 w-8 p-0" title="Regenerate this idea">
                            {isRegenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                          </Button>
                          <Button size="sm" onClick={() => saveAiIdea(suggestion, index)} className="gap-1" disabled={isRegenerating}>
                            <Check className="h-3 w-3" />
                            Save
                          </Button>
                        </div>
                      </div>
                      
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap mb-3">
                        {suggestion.content}
                      </p>
                      
                      <div className="bg-primary/5 rounded-lg p-2 mb-2">
                        <p className="text-xs text-primary flex items-start gap-1.5">
                          <Brain className="h-3 w-3 mt-0.5 shrink-0" />
                          <span>{suggestion.psychology}</span>
                        </p>
                      </div>
                      
                      {suggestion.tags?.length > 0 && <div className="flex flex-wrap gap-1">
                          {suggestion.tags.map((tag: string, i: number) => <Badge key={i} variant="outline" className="text-xs">
                              {tag}
                            </Badge>)}
                        </div>}
                    </CardContent>
                  </Card>;
          })}
            </div>}
          
          <DialogFooter className="border-t pt-4">
            <Button variant="outline" onClick={() => setAiDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Campaign Select Dialog */}
      <Dialog open={campaignSelectOpen} onOpenChange={setCampaignSelectOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Select a Campaign</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {campaigns.map(campaign => <Card key={campaign.id} className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => handleSelectCampaignForCreative(campaign.id)}>
                <CardContent className="p-3">
                  <p className="font-medium text-sm">{campaign.name}</p>
                  {campaign.offer_name && <p className="text-xs text-muted-foreground">{campaign.offer_name}</p>}
                </CardContent>
              </Card>)}
          </div>
        </DialogContent>
      </Dialog>

      {/* Creative Flow Modal */}
      <CreativeFlowModal open={creativeModalOpen} onOpenChange={setCreativeModalOpen} workspaceId={selectedCampaignId} />
    </DashboardLayout>;
}