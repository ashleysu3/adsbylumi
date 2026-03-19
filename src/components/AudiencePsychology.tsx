import { useState, useMemo, useEffect } from "react";
import { LumiThinking } from "@/components/LumiThinking";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatInvokeError } from "@/lib/formatInvokeError";
import { Brain, ChevronDown, RefreshCw, Loader2, Users, Heart, AlertCircle, Zap, CheckCircle2, Pencil, Sparkles, FileText } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

// Custom loading copy for psychology generation
const PSYCHOLOGY_LOADING_COPY = [
  "Analyzing your brand's positioning...",
  "Understanding your ideal client...",
  "Mapping psychological pain points...",
  "Identifying what motivates your audience...",
  "Building your psychology profile...",
  "This takes a moment — worth it.",
  "Extracting insights from your content...",
  "Defining desires and objections...",
];

interface AudiencePsychologyProps {
  brandId: string;
  psychology: any;
  status: string;
  onUpdate: () => void;
  psychologyContentHash?: string | null;
  psychologyGeneratedAt?: string | null;
}

export function AudiencePsychology({ 
  brandId, 
  psychology, 
  status, 
  onUpdate,
  psychologyContentHash,
  psychologyGeneratedAt 
}: AudiencePsychologyProps) {
  const [open, setOpen] = useState(status === 'completed' && !!psychology);
  const [generating, setGenerating] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editedPsychology, setEditedPsychology] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [contentAssets, setContentAssets] = useState<any[]>([]);
  const [hasNewContent, setHasNewContent] = useState(false);

  // Fetch content assets to check for updates
  useEffect(() => {
    const fetchContentAssets = async () => {
      const { data } = await supabase
        .from('brand_content_assets')
        .select('id')
        .eq('brand_id', brandId);
      
      if (data) {
        setContentAssets(data);
        
        // Check if there's new content since last psychology generation
        if (data.length > 0 && psychology) {
          const currentHash = data.map(a => a.id).sort().join(',');
          setHasNewContent(currentHash !== psychologyContentHash);
        }
      }
    };
    
    fetchContentAssets();
  }, [brandId, psychology, psychologyContentHash]);

  const handleGenerate = async () => {
    setGenerating(true);

    try {
      const { error } = await supabase.functions.invoke('generate-audience-psychology', {
        body: { brandId }
      });

      if (error) throw error;

      toast.success("Audience psychology generated successfully");
      setTimeout(() => onUpdate(), 2000);
    } catch (error: any) {
      console.error('Error generating psychology:', error);
      toast.error(formatInvokeError(error));
    } finally {
      setGenerating(false);
    }
  };

  const handleApprove = async () => {
    try {
      const { error } = await supabase
        .from('brands')
        .update({ psychology_status: 'approved' })
        .eq('id', brandId);

      if (error) throw error;

      toast.success("Audience psychology approved!");
      onUpdate();
    } catch (error: any) {
      console.error('Error approving psychology:', error);
      toast.error("Failed to approve");
    }
  };

  const handleOpenEdit = () => {
    setEditedPsychology(psychology ? { ...psychology } : {
      demographics: '',
      psychographics: '',
      pain_points: [],
      desires: [],
      objections: [],
      motivations: ''
    });
    setEditDialogOpen(true);
  };

  const handleSaveEdits = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('brands')
        .update({ 
          audience_psychology: editedPsychology,
          psychology_status: 'completed'
        })
        .eq('id', brandId);

      if (error) throw error;

      toast.success("Audience psychology updated!");
      setEditDialogOpen(false);
      onUpdate();
    } catch (error: any) {
      console.error('Error saving psychology:', error);
      toast.error("Failed to save changes");
    } finally {
      setSaving(false);
    }
  };

  const updateArrayField = (field: string, value: string) => {
    const items = value.split('\n').filter(item => item.trim());
    setEditedPsychology((prev: any) => ({ ...prev, [field]: items }));
  };

  const getStatusBadge = () => {
    switch (status) {
      case 'generating':
        return <Badge variant="secondary"><Loader2 className="mr-1 h-3 w-3 animate-spin" />Generating...</Badge>;
      case 'completed':
        return <Badge variant="outline" className="text-amber-600 border-amber-300">Ready for Review</Badge>;
      case 'approved':
        return <Badge variant="default" className="bg-green-600"><CheckCircle2 className="mr-1 h-3 w-3" />Approved</Badge>;
      case 'error':
        return <Badge variant="destructive">Error</Badge>;
      default:
        return <Badge variant="outline">Not Started</Badge>;
    }
  };

  const isApproved = status === 'approved';
  const canApprove = status === 'completed' && psychology;

  if (!psychology && status !== 'completed' && status !== 'approved') {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-primary" />
              <CardTitle>Audience Psychology</CardTitle>
            </div>
            {getStatusBadge()}
          </div>
          <CardDescription>
            Generate a deep psychological profile of your target audience
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={handleGenerate} disabled={generating || status === 'generating'}>
            {generating || status === 'generating' ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Brain className="mr-2 h-4 w-4" />
                Generate Profile
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      {/* LumiThinking Modal for loading state */}
      <LumiThinking 
        isOpen={generating} 
        customCopy={PSYCHOLOGY_LOADING_COPY}
      />
      
      <Collapsible open={open} onOpenChange={setOpen}>
        <Card data-section="audience-psychology">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CollapsibleTrigger asChild>
                <button className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                  <Brain className="h-5 w-5 text-primary" />
                  <CardTitle>Audience Psychology</CardTitle>
                  <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} />
                </button>
              </CollapsibleTrigger>
              <div className="flex items-center gap-2">
                {getStatusBadge()}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleOpenEdit}
                  title="Edit"
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleGenerate}
                  disabled={generating}
                  title="Regenerate"
                >
                  <RefreshCw className={`h-4 w-4 ${generating ? 'animate-spin' : ''}`} />
                </Button>
              </div>
            </div>
            <CardDescription>
              Deep psychological insights about your target audience
            </CardDescription>
          </CardHeader>

          <CollapsibleContent>
            <CardContent className="space-y-6">
              {psychology?.demographics && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <h4 className="font-semibold">Demographics</h4>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">{psychology.demographics}</p>
                </div>
              )}

              {psychology?.psychographics && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Brain className="h-4 w-4 text-muted-foreground" />
                    <h4 className="font-semibold">Psychographics</h4>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">{psychology.psychographics}</p>
                </div>
              )}

              {psychology?.pain_points && psychology.pain_points.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-muted-foreground" />
                    <h4 className="font-semibold">Pain Points</h4>
                  </div>
                  <ul className="list-disc list-inside space-y-1">
                    {psychology.pain_points.map((point: string, i: number) => (
                      <li key={i} className="text-sm text-muted-foreground">{point}</li>
                    ))}
                  </ul>
                </div>
              )}

              {psychology?.desires && psychology.desires.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Heart className="h-4 w-4 text-muted-foreground" />
                    <h4 className="font-semibold">Desires</h4>
                  </div>
                  <ul className="list-disc list-inside space-y-1">
                    {psychology.desires.map((desire: string, i: number) => (
                      <li key={i} className="text-sm text-muted-foreground">{desire}</li>
                    ))}
                  </ul>
                </div>
              )}

              {psychology?.objections && psychology.objections.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-muted-foreground" />
                    <h4 className="font-semibold">Objections</h4>
                  </div>
                  <ul className="list-disc list-inside space-y-1">
                    {psychology.objections.map((objection: string, i: number) => (
                      <li key={i} className="text-sm text-muted-foreground">{objection}</li>
                    ))}
                  </ul>
                </div>
              )}

              {psychology?.motivations && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Zap className="h-4 w-4 text-muted-foreground" />
                    <h4 className="font-semibold">Motivations</h4>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">{psychology.motivations}</p>
                </div>
              )}

              {/* Approval Section */}
              {canApprove && (
                <div className="pt-4 border-t">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">
                      Review the insights above. Once approved, this step is complete.
                    </p>
                    <Button onClick={handleApprove} className="gap-2">
                      <CheckCircle2 className="h-4 w-4" />
                      Approve Psychology
                    </Button>
                  </div>
                </div>
              )}

              {isApproved && (
                <div className="pt-4 border-t">
                  <p className="text-sm text-green-600 flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4" />
                    Audience psychology approved and ready to use
                  </p>
                </div>
              )}

              {/* Content Assets Available Alert */}
              {hasNewContent && (
                <Alert className="mt-4 border-primary/20 bg-primary/5">
                  <FileText className="h-4 w-4" />
                  <AlertDescription className="flex items-center justify-between">
                    <span className="text-sm">
                      <Sparkles className="inline h-3 w-3 mr-1" />
                      {contentAssets.length} content asset{contentAssets.length !== 1 ? 's' : ''} available – regenerate to include them
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleGenerate}
                      disabled={generating}
                      className="h-7 text-xs"
                    >
                      {generating ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <>
                          <RefreshCw className="h-3 w-3 mr-1" />
                          Regenerate
                        </>
                      )}
                    </Button>
                  </AlertDescription>
                </Alert>
              )}

              {/* Show when psychology was generated */}
              {psychologyGeneratedAt && (
                <p className="text-xs text-muted-foreground mt-2">
                  Last generated: {new Date(psychologyGeneratedAt).toLocaleDateString()}
                  {psychologyContentHash && ` • Using ${psychologyContentHash.split(',').length} content asset(s)`}
                </p>
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Audience Psychology</DialogTitle>
          </DialogHeader>
          
          {editedPsychology && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Demographics</Label>
                <Textarea
                  value={editedPsychology.demographics || ''}
                  onChange={(e) => setEditedPsychology((prev: any) => ({ ...prev, demographics: e.target.value }))}
                  placeholder="Describe the demographic profile..."
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label>Psychographics</Label>
                <Textarea
                  value={editedPsychology.psychographics || ''}
                  onChange={(e) => setEditedPsychology((prev: any) => ({ ...prev, psychographics: e.target.value }))}
                  placeholder="Describe the psychographic profile..."
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label>Pain Points (one per line)</Label>
                <Textarea
                  value={(editedPsychology.pain_points || []).join('\n')}
                  onChange={(e) => updateArrayField('pain_points', e.target.value)}
                  placeholder="Enter pain points, one per line..."
                  rows={4}
                />
              </div>

              <div className="space-y-2">
                <Label>Desires (one per line)</Label>
                <Textarea
                  value={(editedPsychology.desires || []).join('\n')}
                  onChange={(e) => updateArrayField('desires', e.target.value)}
                  placeholder="Enter desires, one per line..."
                  rows={4}
                />
              </div>

              <div className="space-y-2">
                <Label>Objections (one per line)</Label>
                <Textarea
                  value={(editedPsychology.objections || []).join('\n')}
                  onChange={(e) => updateArrayField('objections', e.target.value)}
                  placeholder="Enter objections, one per line..."
                  rows={4}
                />
              </div>

              <div className="space-y-2">
                <Label>Motivations</Label>
                <Textarea
                  value={editedPsychology.motivations || ''}
                  onChange={(e) => setEditedPsychology((prev: any) => ({ ...prev, motivations: e.target.value }))}
                  placeholder="Describe their core motivations..."
                  rows={3}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdits} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
