import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FileUp, Loader2, Sparkles, FileText, Check } from "lucide-react";
import { toast } from "sonner";

interface Props {
  brandId: string;
  onApplied?: () => void;
}

interface Extracted {
  colors?: Record<string, string>;
  fonts?: { displayFamily?: string; bodyFamily?: string };
  brand_voice?: string;
  value_proposition?: string;
  target_audience?: string;
  taglines?: string[];
  keywords?: string[];
}

const MAX_MB = 20;

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

export default function BrandGuideUpload({ brandId, onApplied }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [extracted, setExtracted] = useState<Extracted | null>(null);

  const handleFile = async (file: File) => {
    if (file.size > MAX_MB * 1024 * 1024) {
      toast.error(`File must be under ${MAX_MB}MB`);
      return;
    }
    setUploading(true);
    setExtracted(null);
    setFileName(file.name);
    try {
      const dataUrl = await fileToDataUrl(file);
      const { data, error } = await supabase.functions.invoke("extract-brand-guide", {
        body: {
          fileDataUrl: dataUrl,
          fileName: file.name,
          mimeType: file.type || "application/pdf",
          brandId,
        },
      });
      if (error) throw error;
      const ex = (data as any)?.extracted as Extracted;
      if (!ex) throw new Error("No data extracted");
      setExtracted(ex);
      toast.success("Brand guide read — review and apply below");
    } catch (e: any) {
      toast.error(e?.message || "Failed to read brand guide");
      setFileName(null);
    } finally {
      setUploading(false);
    }
  };

  const apply = async () => {
    if (!extracted || !brandId) return;
    setApplying(true);
    try {
      const { data: userRes } = await supabase.auth.getUser();
      const userId = userRes.user?.id;
      if (!userId) throw new Error("Not signed in");

      // Update brand text fields (only overwrite if extracted has a value)
      const brandPatch: any = {};
      if (extracted.brand_voice) brandPatch.brand_voice = extracted.brand_voice;
      if (extracted.value_proposition) brandPatch.value_proposition = extracted.value_proposition;
      if (extracted.target_audience) brandPatch.target_audience = extracted.target_audience;
      if (Object.keys(brandPatch).length) {
        const { error } = await supabase.from("brands").update(brandPatch).eq("id", brandId);
        if (error) throw error;
      }

      // Merge colors + fonts into brand_kits
      const { data: existingKit } = await supabase
        .from("brand_kits")
        .select("colors, fonts, source_url")
        .eq("user_id", userId)
        .eq("brand_id", brandId)
        .maybeSingle();

      const mergedColors = {
        ...((existingKit?.colors as any) || {}),
        ...Object.fromEntries(
          Object.entries(extracted.colors || {}).filter(([, v]) => !!v)
        ),
      };
      const mergedFonts = {
        ...((existingKit?.fonts as any) || {}),
        ...(extracted.fonts?.displayFamily ? { displayFamily: extracted.fonts.displayFamily } : {}),
        ...(extracted.fonts?.bodyFamily ? { bodyFamily: extracted.fonts.bodyFamily } : {}),
      };

      const { error: kitErr } = await supabase
        .from("brand_kits")
        .upsert(
          {
            user_id: userId,
            brand_id: brandId,
            colors: mergedColors,
            fonts: mergedFonts,
            source_url: existingKit?.source_url || null,
            status: "confirmed",
          },
          { onConflict: "user_id,brand_id" }
        );
      if (kitErr) throw kitErr;

      toast.success("Applied brand guide to your style");
      setExtracted(null);
      setFileName(null);
      onApplied?.();
    } catch (e: any) {
      toast.error(e?.message || "Failed to apply");
    } finally {
      setApplying(false);
    }
  };

  return (
    <Card variant="glow">
      <CardHeader>
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary" />
          <CardTitle>Brand Guide</CardTitle>
        </div>
        <CardDescription>
          Upload a PDF or image of your brand guide and LUMI will pull the colors, fonts, voice, and audience for you.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
            e.target.value = "";
          }}
        />

        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="outline"
            onClick={() => inputRef.current?.click()}
            disabled={uploading || applying}
          >
            {uploading ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Reading…</>
            ) : (
              <><FileUp className="mr-2 h-4 w-4" />Upload brand guide</>
            )}
          </Button>
          {fileName && (
            <span className="text-sm text-muted-foreground truncate max-w-[240px]">{fileName}</span>
          )}
          <span className="text-xs text-muted-foreground">PDF, PNG, JPG · max {MAX_MB}MB</span>
        </div>

        {extracted && (
          <div className="space-y-4 rounded-lg border border-border/60 p-4 bg-background/40">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Sparkles className="h-4 w-4 text-primary" />
              Here's what LUMI found — edit anything, then apply.
            </div>

            {extracted.colors && Object.values(extracted.colors).some(Boolean) && (
              <div>
                <Label className="text-xs uppercase text-muted-foreground">Colors</Label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {Object.entries(extracted.colors).map(([k, v]) =>
                    v ? (
                      <div key={k} className="flex items-center gap-2 rounded-md border border-border/60 px-2 py-1 text-xs">
                        <span className="h-4 w-4 rounded" style={{ background: v }} />
                        <span className="font-mono">{v}</span>
                        <span className="text-muted-foreground">{k}</span>
                      </div>
                    ) : null
                  )}
                </div>
              </div>
            )}

            {(extracted.fonts?.displayFamily || extracted.fonts?.bodyFamily) && (
              <div>
                <Label className="text-xs uppercase text-muted-foreground">Fonts</Label>
                <div className="mt-1 text-sm">
                  {extracted.fonts?.displayFamily && <div>Display: <span className="font-medium">{extracted.fonts.displayFamily}</span></div>}
                  {extracted.fonts?.bodyFamily && <div>Body: <span className="font-medium">{extracted.fonts.bodyFamily}</span></div>}
                </div>
              </div>
            )}

            {extracted.brand_voice !== undefined && (
              <div>
                <Label className="text-xs uppercase text-muted-foreground">Brand voice</Label>
                <Textarea
                  value={extracted.brand_voice || ""}
                  onChange={(e) => setExtracted({ ...extracted, brand_voice: e.target.value })}
                  rows={3}
                />
              </div>
            )}
            {extracted.value_proposition !== undefined && (
              <div>
                <Label className="text-xs uppercase text-muted-foreground">Value proposition</Label>
                <Textarea
                  value={extracted.value_proposition || ""}
                  onChange={(e) => setExtracted({ ...extracted, value_proposition: e.target.value })}
                  rows={2}
                />
              </div>
            )}
            {extracted.target_audience !== undefined && (
              <div>
                <Label className="text-xs uppercase text-muted-foreground">Target audience</Label>
                <Textarea
                  value={extracted.target_audience || ""}
                  onChange={(e) => setExtracted({ ...extracted, target_audience: e.target.value })}
                  rows={2}
                />
              </div>
            )}

            {extracted.taglines?.length ? (
              <div>
                <Label className="text-xs uppercase text-muted-foreground">Taglines</Label>
                <ul className="mt-1 list-disc pl-5 text-sm">
                  {extracted.taglines.map((t, i) => <li key={i}>{t}</li>)}
                </ul>
              </div>
            ) : null}

            <div className="flex gap-2">
              <Button onClick={apply} disabled={applying}>
                {applying ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Applying…</> : <><Check className="mr-2 h-4 w-4" />Apply to brand</>}
              </Button>
              <Button variant="ghost" onClick={() => { setExtracted(null); setFileName(null); }} disabled={applying}>
                Discard
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
