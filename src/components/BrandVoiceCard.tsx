import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Loader2, Mic, Save, RefreshCw, ChevronDown, ChevronUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface VoiceProfile {
  summary?: string;
  tone_descriptors?: string[];
  perspective?: string;
  formality?: string;
  sentence_rhythm?: string;
  emoji_usage?: string;
  signature_phrases?: string[];
  vocabulary_loves?: string[];
  vocabulary_avoids?: string[];
  example_sentences?: string[];
  do?: string[];
  dont?: string[];
}

interface Props {
  brandId: string;
  brandVoice: string | null;
  voiceProfile: VoiceProfile | null;
  voiceGeneratedAt: string | null;
  onUpdate: () => void;
}

const parseList = (s: string) =>
  s.split(/\n|,/).map((x) => x.trim()).filter(Boolean);

export function BrandVoiceCard({
  brandId,
  brandVoice,
  voiceProfile,
  voiceGeneratedAt,
  onUpdate,
}: Props) {
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [instagramHandle, setInstagramHandle] = useState("");

  const [summary, setSummary] = useState(brandVoice || "");
  const [profile, setProfile] = useState<VoiceProfile>(voiceProfile || {});

  useEffect(() => {
    setSummary(brandVoice || "");
    setProfile(voiceProfile || {});
  }, [brandVoice, voiceProfile]);

  const handleAnalyze = async () => {
    setAnalyzing(true);
    try {
      const { data, error } = await supabase.functions.invoke("analyze-brand-voice", {
        body: { brandId, instagramHandle: instagramHandle.trim() || undefined },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success("Brand voice refreshed");
      onUpdate();
      setExpanded(true);
    } catch (e: any) {
      toast.error(e?.message || "Couldn't analyze brand voice");
    } finally {
      setAnalyzing(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("brands")
        .update({
          brand_voice: summary,
          voice_profile: profile as any,
        })
        .eq("id", brandId)
        .select()
        .single();
      if (error) throw error;
      toast.success("Brand voice saved");
      onUpdate();
    } catch (e: any) {
      toast.error(e?.message || "Couldn't save");
    } finally {
      setSaving(false);
    }
  };

  const updateProfile = <K extends keyof VoiceProfile>(key: K, val: VoiceProfile[K]) =>
    setProfile((p) => ({ ...p, [key]: val }));

  const hasProfile = !!voiceProfile && Object.keys(voiceProfile || {}).length > 0;

  return (
    <Card variant="glow" data-section="brand-voice">
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Mic className="h-5 w-5 text-primary" />
            <CardTitle>Brand Voice</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            {voiceGeneratedAt && (
              <Badge variant="outline" className="text-[10px]">
                Last analyzed {new Date(voiceGeneratedAt).toLocaleDateString()}
              </Badge>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={handleAnalyze}
              disabled={analyzing}
              className="gap-1"
            >
              {analyzing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="h-3.5 w-3.5" />
              )}
              {hasProfile ? "Re-analyze" : "Analyze my voice"}
            </Button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Lumi reads your website and Instagram to capture how you actually sound, then uses this with your psychology and best practices to write ads that feel like you.
        </p>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid sm:grid-cols-[1fr_auto] gap-2 items-end">
          <div>
            <Label htmlFor="ig-handle" className="text-xs">Instagram handle (optional, for richer voice)</Label>
            <Input
              id="ig-handle"
              placeholder="@yourbrand"
              value={instagramHandle}
              onChange={(e) => setInstagramHandle(e.target.value)}
            />
          </div>
        </div>

        <div>
          <Label htmlFor="voice-summary" className="text-xs">Voice summary</Label>
          <Textarea
            id="voice-summary"
            rows={3}
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder='e.g. "Warm, no-nonsense best-friend energy. Short sentences. Drops the occasional all-lowercase aside. Never uses corporate jargon."'
          />
          <p className="text-[11px] text-muted-foreground mt-1">
            This is the short description Lumi feeds into every ad. Edit it to fit your brand.
          </p>
        </div>

        {hasProfile && (
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            {expanded ? "Hide detailed voice profile" : "Edit detailed voice profile"}
          </button>
        )}

        {expanded && (
          <div className="space-y-3 rounded-lg border bg-muted/30 p-3">
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Tone descriptors (comma-separated)</Label>
                <Input
                  value={(profile.tone_descriptors || []).join(", ")}
                  onChange={(e) => updateProfile("tone_descriptors", parseList(e.target.value))}
                  placeholder="warm, irreverent, no-nonsense"
                />
              </div>
              <div>
                <Label className="text-xs">Perspective</Label>
                <Input
                  value={profile.perspective || ""}
                  onChange={(e) => updateProfile("perspective", e.target.value)}
                  placeholder="second_person"
                />
              </div>
              <div>
                <Label className="text-xs">Formality</Label>
                <Input
                  value={profile.formality || ""}
                  onChange={(e) => updateProfile("formality", e.target.value)}
                  placeholder="casual / conversational / polished"
                />
              </div>
              <div>
                <Label className="text-xs">Sentence rhythm</Label>
                <Input
                  value={profile.sentence_rhythm || ""}
                  onChange={(e) => updateProfile("sentence_rhythm", e.target.value)}
                  placeholder="short and punchy"
                />
              </div>
              <div>
                <Label className="text-xs">Emoji usage</Label>
                <Input
                  value={profile.emoji_usage || ""}
                  onChange={(e) => updateProfile("emoji_usage", e.target.value)}
                  placeholder="sparingly / signature / none"
                />
              </div>
            </div>

            <div>
              <Label className="text-xs">Signature phrases (one per line)</Label>
              <Textarea
                rows={3}
                value={(profile.signature_phrases || []).join("\n")}
                onChange={(e) => updateProfile("signature_phrases", parseList(e.target.value))}
              />
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Words you love</Label>
                <Textarea
                  rows={3}
                  value={(profile.vocabulary_loves || []).join("\n")}
                  onChange={(e) => updateProfile("vocabulary_loves", parseList(e.target.value))}
                />
              </div>
              <div>
                <Label className="text-xs">Words to avoid</Label>
                <Textarea
                  rows={3}
                  value={(profile.vocabulary_avoids || []).join("\n")}
                  onChange={(e) => updateProfile("vocabulary_avoids", parseList(e.target.value))}
                />
              </div>
            </div>

            <div>
              <Label className="text-xs">Example sentences in your voice</Label>
              <Textarea
                rows={4}
                value={(profile.example_sentences || []).join("\n")}
                onChange={(e) => updateProfile("example_sentences", parseList(e.target.value))}
              />
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Do</Label>
                <Textarea
                  rows={3}
                  value={(profile.do || []).join("\n")}
                  onChange={(e) => updateProfile("do", parseList(e.target.value))}
                />
              </div>
              <div>
                <Label className="text-xs">Don't</Label>
                <Textarea
                  rows={3}
                  value={(profile.dont || []).join("\n")}
                  onChange={(e) => updateProfile("dont", parseList(e.target.value))}
                />
              </div>
            </div>
          </div>
        )}

        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving} className="gap-1">
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Save brand voice
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
