import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import AdminTabs from "@/components/AdminTabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BookOpen, Plus, Edit, Trash2, Save, X, Upload } from "lucide-react";
import { toast } from "sonner";

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
}

const categories = [
  { value: "ad_planner", label: "Ad Planner" },
  { value: "creative_department", label: "Creative Department" },
  { value: "hooks", label: "Hooks Library" },
  { value: "copy_formulas", label: "Copy Formulas" },
  { value: "visual_guidelines", label: "Visual Guidelines" },
  { value: "psychology", label: "Psychology Triggers" },
  { value: "meta_best_practices", label: "Meta Best Practices" },
];

export default function Knowledge() {
  const [documents, setDocuments] = useState<KnowledgeDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [editingDoc, setEditingDoc] = useState<KnowledgeDoc | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Form state
  const [formCategory, setFormCategory] = useState("");
  const [formTitle, setFormTitle] = useState("");
  const [formContent, setFormContent] = useState("");
  const [formTags, setFormTags] = useState("");

  useEffect(() => {
    fetchDocuments();
  }, []);

  const fetchDocuments = async () => {
    try {
      const { data, error } = await supabase
        .from("knowledge_documents")
        .select("*")
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

  const resetForm = () => {
    setEditingDoc(null);
    setFormCategory("");
    setFormTitle("");
    setFormContent("");
    setFormTags("");
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
        let category = "ad_planner";
        const lowerName = file.name.toLowerCase();
        if (lowerName.includes("hook")) category = "hooks";
        else if (lowerName.includes("copy")) category = "copy_formulas";
        else if (lowerName.includes("visual")) category = "visual_guidelines";
        else if (lowerName.includes("psychology") || lowerName.includes("psych")) category = "psychology";
        else if (lowerName.includes("creative")) category = "creative_department";
        else if (lowerName.includes("meta")) category = "meta_best_practices";

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

  const filteredDocs = selectedCategory === "all" 
    ? documents 
    : documents.filter(d => d.category === selectedCategory);

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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-display font-bold">Knowledge Base</h1>
            <p className="text-muted-foreground mt-2">
              Manage AI knowledge for creative generation
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
                      Tip: Include keywords in filenames (e.g., "hooks_library.txt", "psychology_triggers.md")
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
                  <Label>Title *</Label>
                  <Input
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    placeholder="e.g., PAS Copywriting Formula"
                  />
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
                <div>
                  <Label>Tags (comma-separated)</Label>
                  <Input
                    value={formTags}
                    onChange={(e) => setFormTags(e.target.value)}
                    placeholder="e.g., copywriting, conversion, psychology"
                  />
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

        <Tabs value={selectedCategory} onValueChange={setSelectedCategory}>
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="all">All ({documents.length})</TabsTrigger>
            {categories.map(cat => {
              const count = documents.filter(d => d.category === cat.value).length;
              return (
                <TabsTrigger key={cat.value} value={cat.value}>
                  {cat.label} ({count})
                </TabsTrigger>
              );
            })}
          </TabsList>

          <TabsContent value={selectedCategory} className="space-y-4 mt-6">
            {filteredDocs.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <BookOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No knowledge documents yet</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {filteredDocs.map(doc => (
                  <Card key={doc.id}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="space-y-1 flex-1">
                          <div className="flex items-center gap-2">
                            <CardTitle className="text-lg">{doc.title}</CardTitle>
                            {!doc.active && <Badge variant="outline">Inactive</Badge>}
                            <Badge variant="secondary">v{doc.version}</Badge>
                          </div>
                          <CardDescription>
                            {categories.find(c => c.value === doc.category)?.label}
                          </CardDescription>
                        </div>
                        <div className="flex gap-2">
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
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                        {doc.content}
                      </p>
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
                        <span className="text-xs text-muted-foreground">
                          Updated {new Date(doc.updated_at).toLocaleDateString()}
                        </span>
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
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
