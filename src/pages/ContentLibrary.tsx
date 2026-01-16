import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
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
import { 
  Plus, Search, Lightbulb, FileText, Video, Image, 
  Sparkles, MoreHorizontal, Edit2, Trash2, FolderOpen,
  Filter, Tag
} from "lucide-react";
import { toast } from "sonner";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

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

const IDEA_TYPES = [
  { value: "hook", label: "Hook", icon: Sparkles, color: "bg-purple-500/10 text-purple-600 border-purple-500/30" },
  { value: "script", label: "Script", icon: FileText, color: "bg-blue-500/10 text-blue-600 border-blue-500/30" },
  { value: "visual", label: "Visual", icon: Image, color: "bg-pink-500/10 text-pink-600 border-pink-500/30" },
  { value: "video", label: "Video Idea", icon: Video, color: "bg-orange-500/10 text-orange-600 border-orange-500/30" },
  { value: "idea", label: "General Idea", icon: Lightbulb, color: "bg-yellow-500/10 text-yellow-600 border-yellow-500/30" },
];

const STATUS_OPTIONS = [
  { value: "idea", label: "Idea", color: "bg-muted text-muted-foreground" },
  { value: "in_progress", label: "In Progress", color: "bg-blue-500/10 text-blue-600" },
  { value: "used", label: "Used", color: "bg-green-500/10 text-green-600" },
];

export default function ContentLibrary() {
  const navigate = useNavigate();
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
    tags: "",
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }

      const { data: brandData } = await supabase
        .from("brands")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (!brandData) {
        navigate("/dashboard");
        return;
      }

      setBrand(brandData);

      // Fetch offers and ideas in parallel
      const [offersRes, ideasRes] = await Promise.all([
        supabase
          .from("offers")
          .select("id, name")
          .eq("brand_id", brandData.id)
          .eq("archived", false)
          .order("name"),
        supabase
          .from("content_ideas")
          .select("*")
          .eq("brand_id", brandData.id)
          .order("created_at", { ascending: false }),
      ]);

      if (offersRes.data) setOffers(offersRes.data);
      if (ideasRes.data) setIdeas(ideasRes.data as ContentIdea[]);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Failed to load content library");
    } finally {
      setLoading(false);
    }
  };

  const openNewDialog = () => {
    setEditingIdea(null);
    setFormData({ title: "", content: "", type: "idea", offer_id: "", tags: "" });
    setDialogOpen(true);
  };

  const openEditDialog = (idea: ContentIdea) => {
    setEditingIdea(idea);
    setFormData({
      title: idea.title,
      content: idea.content || "",
      type: idea.type,
      offer_id: idea.offer_id || "",
      tags: idea.tags?.join(", ") || "",
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.title.trim()) {
      toast.error("Please enter a title");
      return;
    }

    try {
      const tagsArray = formData.tags
        .split(",")
        .map(t => t.trim())
        .filter(t => t.length > 0);

      const payload = {
        brand_id: brand.id,
        title: formData.title.trim(),
        content: formData.content.trim() || null,
        type: formData.type,
        offer_id: formData.offer_id || null,
        tags: tagsArray,
      };

      if (editingIdea) {
        const { error } = await supabase
          .from("content_ideas")
          .update(payload)
          .eq("id", editingIdea.id);
        if (error) throw error;
        toast.success("Idea updated!");
      } else {
        const { error } = await supabase
          .from("content_ideas")
          .insert(payload);
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
      const { error } = await supabase
        .from("content_ideas")
        .delete()
        .eq("id", id);
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
      const { error } = await supabase
        .from("content_ideas")
        .update({ status })
        .eq("id", id);
      if (error) throw error;
      setIdeas(ideas.map(i => i.id === id ? { ...i, status } : i));
      toast.success("Status updated");
    } catch (error) {
      console.error("Error updating status:", error);
    }
  };

  // Filter ideas
  const filteredIdeas = ideas.filter(idea => {
    const matchesSearch = searchQuery === "" || 
      idea.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      idea.content?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      idea.tags?.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesOffer = filterOffer === "all" || 
      (filterOffer === "none" ? !idea.offer_id : idea.offer_id === filterOffer);
    
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
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">Content Library</h1>
            <p className="text-muted-foreground text-sm">
              Save hooks, scripts, and content ideas to use later
            </p>
          </div>
          <Button onClick={openNewDialog} className="gap-2">
            <Plus className="h-4 w-4" />
            Add Idea
          </Button>
        </div>

        {/* Search & Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search ideas..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={filterOffer} onValueChange={setFilterOffer}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <FolderOpen className="h-4 w-4 mr-2 text-muted-foreground" />
              <SelectValue placeholder="Filter by offer" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Offers</SelectItem>
              <SelectItem value="none">Uncategorized</SelectItem>
              {offers.map(offer => (
                <SelectItem key={offer.id} value={offer.id}>{offer.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-full sm:w-[160px]">
              <Filter className="h-4 w-4 mr-2 text-muted-foreground" />
              <SelectValue placeholder="Filter by type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {IDEA_TYPES.map(type => (
                <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Content */}
        {filteredIdeas.length === 0 ? (
          <Card className="border-dashed">
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
          </Card>
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedByOffer).map(([offerId, offerIdeas]) => (
              <div key={offerId}>
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
                    
                    return (
                      <Card 
                        key={idea.id} 
                        className="group hover:shadow-md transition-shadow cursor-pointer"
                        onClick={() => openEditDialog(idea)}
                      >
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
                                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); openEditDialog(idea); }}>
                                  <Edit2 className="h-4 w-4 mr-2" />
                                  Edit
                                </DropdownMenuItem>
                                {STATUS_OPTIONS.map(status => (
                                  <DropdownMenuItem 
                                    key={status.value}
                                    onClick={(e) => { e.stopPropagation(); updateStatus(idea.id, status.value); }}
                                  >
                                    Mark as {status.label}
                                  </DropdownMenuItem>
                                ))}
                                <DropdownMenuItem 
                                  onClick={(e) => { e.stopPropagation(); handleDelete(idea.id); }}
                                  className="text-destructive"
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                          
                          <h4 className="font-medium text-sm mb-1 line-clamp-2">{idea.title}</h4>
                          {idea.content && (
                            <p className="text-xs text-muted-foreground line-clamp-3">{idea.content}</p>
                          )}
                          
                          {idea.tags && idea.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {idea.tags.slice(0, 3).map((tag, i) => (
                                <Badge key={i} variant="outline" className="text-xs px-1.5 py-0">
                                  {tag}
                                </Badge>
                              ))}
                              {idea.tags.length > 3 && (
                                <Badge variant="outline" className="text-xs px-1.5 py-0">
                                  +{idea.tags.length - 3}
                                </Badge>
                              )}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
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
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="e.g., Hook about transformation"
              />
            </div>
            
            <div>
              <Label htmlFor="content">Content</Label>
              <Textarea
                id="content"
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                placeholder="Write your idea, script, or notes here..."
                rows={4}
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Type</Label>
                <Select value={formData.type} onValueChange={(v) => setFormData({ ...formData, type: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {IDEA_TYPES.map(type => (
                      <SelectItem key={type.value} value={type.value}>
                        <span className="flex items-center gap-2">
                          <type.icon className="h-4 w-4" />
                          {type.label}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label>Offer</Label>
                <Select 
                  value={formData.offer_id || "none"} 
                  onValueChange={(v) => setFormData({ ...formData, offer_id: v === "none" ? "" : v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select offer" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No offer</SelectItem>
                    {offers.map(offer => (
                      <SelectItem key={offer.id} value={offer.id}>{offer.name}</SelectItem>
                    ))}
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
              <Input
                id="tags"
                value={formData.tags}
                onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                placeholder="e.g., testimonial, urgency, social-proof (comma-separated)"
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave}>{editingIdea ? "Save Changes" : "Add Idea"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
