import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import AdminTabs from "@/components/AdminTabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { BookOpen, Plus, Edit, Trash2, Save, X, Upload, Search, Star, ExternalLink, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface KnowledgeDoc {
  id: string;
  category: string;
  title: string;
  content: string;
  tags: string[];
  version: number;
  active: boolean;
  created_at: string;
  updated_at: string;
  priority?: number;
  subcategory?: string;
  source_url?: string;
  usage_count?: number;
}

const categories = [
  { value: "best_practices", label: "Best Practices" },
  { value: "hook_ideas", label: "Hook Ideas" },
  { value: "strategies", label: "Strategies" },
  { value: "trends", label: "Trends" },
  { value: "examples", label: "Examples & Swipes" },
  { value: "creative_templates", label: "Creative Templates" },
  { value: "psychology", label: "Psychology Triggers" },
  { value: "copy_formulas", label: "Copy Formulas" },
  { value: "visual_guidelines", label: "Visual Guidelines" },
  { value: "meta_best_practices", label: "Meta Best Practices" },
  { value: "hooks", label: "Hooks Library" },
  { value: "ad_planner", label: "Ad Planner" },
  { value: "creative_department", label: "Creative Department" },
];

export default function Knowledge() {
  const navigate = useNavigate();
  const [authChecked, setAuthChecked] = useState(false);
  const [documents, setDocuments] = useState<KnowledgeDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [editingDoc, setEditingDoc] = useState<KnowledgeDoc | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  
  // Form state
  const [formCategory, setFormCategory] = useState("");
  const [formTitle, setFormTitle] = useState("");
  const [formContent, setFormContent] = useState("");
  const [formTags, setFormTags] = useState("");
  const [formPriority, setFormPriority] = useState(0);
  const [formSubcategory, setFormSubcategory] = useState("");
  const [formSourceUrl, setFormSourceUrl] = useState("");

  useEffect(() => {
    // Server-backed admin guard: redirect non-admins away from this page
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }
      const { data: roleRow } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();
      if (!roleRow) {
        navigate("/");
        return;
      }
      setAuthChecked(true);
      fetchDocuments();
    })();
  }, [navigate]);

  if (!authChecked) {
    return (
      <DashboardLayout>
        <div className="p-8 text-sm text-muted-foreground">Checking permissions…</div>
      </DashboardLayout>
    );
  }

  const fetchDocuments = async () => {
    try {
      const { data, error } = await supabase
        .from("knowledge_documents")
        .select("*")
        .order("priority", { ascending: false })
        .order("category", { ascending: true })
        .order("created_at", { ascending: false });

      if (error) throw error;
      setDocuments(data || []);
    } catch (error: any) {
      toast.error("Failed to load knowledge documents");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!formTitle || !formContent || !formCategory) {
      toast.error("Please fill in all required fields");
      return;
    }

    try {
      const tags = formTags.split(",").map(t => t.trim()).filter(Boolean);
      
      if (editingDoc) {
        const { error } = await supabase
          .from("knowledge_documents")
          .update({
            category: formCategory,
            title: formTitle,
            content: formContent,
            tags,
            version: editingDoc.version + 1,
            priority: formPriority,
            subcategory: formSubcategory || null,
            source_url: formSourceUrl || null,
          })
          .eq("id", editingDoc.id);

        if (error) throw error;
        toast.success("Knowledge document updated!");
      } else {
        const { error } = await supabase
          .from("knowledge_documents")
          .insert({
            category: formCategory,
            title: formTitle,
            content: formContent,
            tags,
            priority: formPriority,
            subcategory: formSubcategory || null,
            source_url: formSourceUrl || null,
          });

        if (error) throw error;
        toast.success("Knowledge document created!");
      }

      setDialogOpen(false);
      resetForm();
      fetchDocuments();
    } catch (error: any) {
      toast.error(error.message || "Failed to save knowledge document");
      console.error(error);
    }
  };

  const handleEdit = (doc: KnowledgeDoc) => {
    setEditingDoc(doc);
    setFormCategory(doc.category);
    setFormTitle(doc.title);
    setFormContent(doc.content);
    setFormTags(doc.tags.join(", "));
    setFormPriority(doc.priority || 0);
    setFormSubcategory(doc.subcategory || "");
    setFormSourceUrl(doc.source_url || "");
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this knowledge document?")) return;

    try {
      const { error } = await supabase
        .from("knowledge_documents")
        .delete()
        .eq("id", id);

      if (error) throw error;
      toast.success("Knowledge document deleted");
      fetchDocuments();
    } catch (error: any) {
      toast.error("Failed to delete document");
      console.error(error);
    }
  };

  const toggleActive = async (doc: KnowledgeDoc) => {
    try {
      const { error } = await supabase
        .from("knowledge_documents")
        .update({ active: !doc.active })
        .eq("id", doc.id);

      if (error) throw error;
      toast.success(doc.active ? "Document deactivated" : "Document activated");
      fetchDocuments();
    } catch (error: any) {
      toast.error("Failed to update status");
      console.error(error);
    }
  };

  const updatePriority = async (doc: KnowledgeDoc, newPriority: number) => {
    try {
      const { error } = await supabase
        .from("knowledge_documents")
        .update({ priority: newPriority })
        .eq("id", doc.id);

      if (error) throw error;
      toast.success("Priority updated");
      fetchDocuments();
    } catch (error: any) {
      toast.error("Failed to update priority");
      console.error(error);
    }
  };

  const resetForm = () => {
    setEditingDoc(null);
    setFormCategory("");
    setFormTitle("");
    setFormContent("");
    setFormTags("");
    setFormPriority(0);
    setFormSubcategory("");
    setFormSourceUrl("");
  };

  const handleBulkUpload = async (files: FileList) => {
    if (!files || files.length === 0) return;
    
    setUploading(true);
    const results: { success: number; failed: number; errors: string[] } = {
      success: 0,
      failed: 0,
      errors: []
    };

    for (const file of Array.from(files)) {
      try {
        let content = "";
        const fileName = file.name.replace(/\.[^/.]+$/, ""); // Remove extension
        
        // Read file content based on type
        if (file.type.startsWith("text/") || file.name.endsWith(".md") || file.name.endsWith(".txt")) {
          content = await file.text();
        } else {
          results.failed++;
          results.errors.push(`${file.name}: Unsupported file type. Please use .txt or .md files`);
          continue;
        }

        if (!content.trim()) {
          results.failed++;
          results.errors.push(`${file.name}: File is empty`);
          continue;
        }

        // Auto-detect category from filename or use default
        let category = "best_practices";
        const lowerName = file.name.toLowerCase();
        if (lowerName.includes("hook")) category = "hooks";
        else if (lowerName.includes("copy")) category = "copy_formulas";
        else if (lowerName.includes("visual")) category = "visual_guidelines";
        else if (lowerName.includes("psychology") || lowerName.includes("psych")) category = "psychology";
        else if (lowerName.includes("creative")) category = "creative_department";
        else if (lowerName.includes("meta")) category = "meta_best_practices";
        else if (lowerName.includes("strategy") || lowerName.includes("strategies")) category = "strategies";
        else if (lowerName.includes("trend")) category = "trends";
        else if (lowerName.includes("example") || lowerName.includes("swipe")) category = "examples";
        else if (lowerName.includes("template")) category = "creative_templates";
        else if (lowerName.includes("planner") || lowerName.includes("plan")) category = "ad_planner";

        // Insert into database
        const { error } = await supabase
          .from("knowledge_documents")
          .insert({
            title: fileName,
            content: content.trim(),
            category,
            tags: [],
          });

        if (error) {
          results.failed++;
          results.errors.push(`${file.name}: ${error.message}`);
        } else {
          results.success++;
        }
      } catch (error: any) {
        results.failed++;
        results.errors.push(`${file.name}: ${error.message || "Unknown error"}`);
      }
    }

    setUploading(false);
    setUploadDialogOpen(false);
    if (fileInputRef.current) fileInputRef.current.value = "";

    // Show results
    if (results.success > 0) {
      toast.success(`Successfully uploaded ${results.success} document(s)`);
      fetchDocuments();
    }
    if (results.failed > 0) {
      toast.error(`Failed to upload ${results.failed} document(s). Check console for details.`);
      console.error("Upload errors:", results.errors);
    }
  };

  const toggleCardExpanded = (id: string) => {
    setExpandedCards(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Filter by category and search query
  const filteredDocs = documents.filter(doc => {
    const matchesCategory = selectedCategory === "all" || doc.category === selectedCategory;
    const matchesSearch = searchQuery === "" || 
      doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (doc.subcategory && doc.subcategory.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-12">
          <div className="animate-pulse">Loading...</div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <AdminTabs />
        
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-display font-bold flex items-center gap-2">
              <BookOpen className="h-8 w-8 text-primary" />
              Knowledge Base
            </h1>
            <p className="text-muted-foreground mt-2">
              Lumi's brain for generating ads — {documents.length} documents
            </p>
          </div>
          <div className="flex gap-2">
            <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <Upload className="h-4 w-4" />
                  Bulk Upload
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Bulk Upload Knowledge Files</DialogTitle>
                  <DialogDescription>
                    Upload multiple .txt or .md files. Category will be auto-detected from filename.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Select Files</Label>
                    <Input
                      ref={fileInputRef}
                      type="file"
                      accept=".txt,.md,text/plain,text/markdown"
                      multiple
                      onChange={(e) => {
                        if (e.target.files) {
                          handleBulkUpload(e.target.files);
                        }
                      }}
                      disabled={uploading}
                    />
                    <p className="text-xs text-muted-foreground mt-2">
                      Tip: Include keywords in filenames (e.g., "hooks_library.txt", "strategies_funnel.md", "trends_2024.txt")
                    </p>
                  </div>
                  {uploading && (
                    <div className="text-center py-4">
                      <div className="animate-pulse">Uploading files...</div>
                    </div>
                  )}
                </div>
              </DialogContent>
            </Dialog>
            <Dialog open={dialogOpen} onOpenChange={(open) => {
              setDialogOpen(open);
              if (!open) resetForm();
            }}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Plus className="h-4 w-4" />
                  Add Knowledge
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingDoc ? "Edit" : "Add"} Knowledge Document</DialogTitle>
                <DialogDescription>
                  This knowledge will be used by the AI when generating creative assets
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Category *</Label>
                    <Select value={formCategory} onValueChange={setFormCategory}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map(cat => (
                          <SelectItem key={cat.value} value={cat.value}>
                            {cat.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Priority (higher = more important)</Label>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={formPriority}
                      onChange={(e) => setFormPriority(parseInt(e.target.value) || 0)}
                      placeholder="0-100"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Title *</Label>
                    <Input
                      value={formTitle}
                      onChange={(e) => setFormTitle(e.target.value)}
                      placeholder="e.g., PAS Copywriting Formula"
                    />
                  </div>
                  <div>
                    <Label>Subcategory</Label>
                    <Input
                      value={formSubcategory}
                      onChange={(e) => setFormSubcategory(e.target.value)}
                      placeholder="e.g., video_hooks, dm_hooks"
                    />
                  </div>
                </div>
                <div>
                  <Label>Content *</Label>
                  <Textarea
                    value={formContent}
                    onChange={(e) => setFormContent(e.target.value)}
                    placeholder="Enter the knowledge content..."
                    rows={8}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Tags (comma-separated)</Label>
                    <Input
                      value={formTags}
                      onChange={(e) => setFormTags(e.target.value)}
                      placeholder="e.g., copywriting, conversion"
                    />
                  </div>
                  <div>
                    <Label>Source URL</Label>
                    <Input
                      value={formSourceUrl}
                      onChange={(e) => setFormSourceUrl(e.target.value)}
                      placeholder="https://..."
                    />
                  </div>
                </div>
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" onClick={() => setDialogOpen(false)}>
                    <X className="h-4 w-4 mr-2" />
                    Cancel
                  </Button>
                  <Button onClick={handleSave}>
                    <Save className="h-4 w-4 mr-2" />
                    Save
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by title, content, or tags..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Category Filter */}
        <ScrollArea className="w-full whitespace-nowrap">
          <div className="flex gap-2 pb-2">
            <Button
              variant={selectedCategory === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedCategory("all")}
            >
              All ({documents.length})
            </Button>
            {categories.map(cat => {
              const count = documents.filter(d => d.category === cat.value).length;
              if (count === 0) return null;
              return (
                <Button
                  key={cat.value}
                  variant={selectedCategory === cat.value ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedCategory(cat.value)}
                >
                  {cat.label} ({count})
                </Button>
              );
            })}
          </div>
        </ScrollArea>

        {/* Documents List */}
        <div className="space-y-4">
          {filteredDocs.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <BookOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                  {searchQuery ? "No documents match your search" : "No knowledge documents yet"}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {filteredDocs.map(doc => (
                <Card key={doc.id} className={!doc.active ? "opacity-60" : ""}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-1 flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          {(doc.priority || 0) > 0 && (
                            <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
                          )}
                          <CardTitle className="text-lg truncate">{doc.title}</CardTitle>
                          {!doc.active && <Badge variant="outline">Inactive</Badge>}
                          <Badge variant="secondary">v{doc.version}</Badge>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <span>{categories.find(c => c.value === doc.category)?.label}</span>
                          {doc.subcategory && (
                            <>
                              <span>•</span>
                              <span>{doc.subcategory}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Select
                          value={String(doc.priority || 0)}
                          onValueChange={(v) => updatePriority(doc, parseInt(v))}
                        >
                          <SelectTrigger className="w-20 h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {[0, 1, 2, 3, 5, 10].map(p => (
                              <SelectItem key={p} value={String(p)}>
                                P{p}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button variant="ghost" size="sm" onClick={() => handleEdit(doc)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDelete(doc.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Collapsible
                      open={expandedCards.has(doc.id)}
                      onOpenChange={() => toggleCardExpanded(doc.id)}
                    >
                      <div className="text-sm text-muted-foreground whitespace-pre-wrap line-clamp-3">
                        {doc.content}
                      </div>
                      <CollapsibleContent>
                        <div className="text-sm text-muted-foreground whitespace-pre-wrap mt-2 pt-2 border-t">
                          {doc.content.split('\n').slice(3).join('\n')}
                        </div>
                      </CollapsibleContent>
                      {doc.content.split('\n').length > 3 && (
                        <CollapsibleTrigger asChild>
                          <Button variant="ghost" size="sm" className="mt-2 h-6 text-xs">
                            {expandedCards.has(doc.id) ? (
                              <>
                                <ChevronUp className="h-3 w-3 mr-1" />
                                Show less
                              </>
                            ) : (
                              <>
                                <ChevronDown className="h-3 w-3 mr-1" />
                                Show more
                              </>
                            )}
                          </Button>
                        </CollapsibleTrigger>
                      )}
                    </Collapsible>
                    
                    {doc.tags.length > 0 && (
                      <div className="flex gap-2 flex-wrap">
                        {doc.tags.map(tag => (
                          <Badge key={tag} variant="outline" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    )}
                    
                    <div className="flex items-center justify-between pt-2">
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span>Updated {new Date(doc.updated_at).toLocaleDateString()}</span>
                        {(doc.usage_count || 0) > 0 && (
                          <span>Used {doc.usage_count} times</span>
                        )}
                        {doc.source_url && (
                          <a
                            href={doc.source_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-primary hover:underline"
                          >
                            <ExternalLink className="h-3 w-3" />
                            Source
                          </a>
                        )}
                      </div>
                      <Button
                        variant={doc.active ? "outline" : "default"}
                        size="sm"
                        onClick={() => toggleActive(doc)}
                      >
                        {doc.active ? "Deactivate" : "Activate"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
