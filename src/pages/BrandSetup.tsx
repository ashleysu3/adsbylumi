import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

type Suggested = {
  colors?: { background?: string; ink?: string; accent?: string; pops?: string[] };
  fonts?: { display?: { family?: string; url?: string; custom?: boolean }; body?: { family?: string } };
  imagery?: { ogImage?: string; photos?: string[] };
  voice?: { headlines?: string[]; description?: string };
};

type Raw = {
  backgrounds?: string[];
  textColors?: string[];
  fonts?: string[];
  faces?: { family?: string; url?: string }[];
};

type ExtractResponse = { suggested?: Suggested; raw?: Raw };

const Swatch = ({ color, active, onClick }: { color: string; active?: boolean; onClick: () => void }) => (
  <button
    type="button"
    onClick={onClick}
    title={color}
    className={`h-7 w-7 rounded-md border-2 transition ${active ? "border-foreground scale-110" : "border-border"}`}
    style={{ backgroundColor: color }}
  />
);

export default function BrandSetup() {
  const navigate = useNavigate();
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState<ExtractResponse | null>(null);

  const [bg, setBg] = useState("");
  const [ink, setInk] = useState("");
  const [accent, setAccent] = useState("");
  const [pop, setPop] = useState("");
  const [highlight, setHighlight] = useState("");
  const [cream, setCream] = useState("");
  const [displayUrl, setDisplayUrl] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [logoUploading, setLogoUploading] = useState(false);

  const handlePull = async () => {
    if (!url.trim()) {
      toast.error("Enter a website URL");
      return;
    }
    setLoading(true);
    try {
      const [{ data: res, error }, logoRes] = await Promise.all([
        supabase.functions.invoke("extract-brand", { body: { url: url.trim() } }),
        supabase.functions.invoke("extract-brand-logo", { body: { url: url.trim() } }),
      ]);
      if (error) throw error;
      const payload = res as ExtractResponse;
      setData(payload);
      const s = payload?.suggested || {};
      setBg(s.colors?.background || "");
      setInk(s.colors?.ink || "");
      setAccent(s.colors?.accent || "");
      setPop(s.colors?.pops?.[0] || "");
      setHighlight(s.colors?.pops?.[1] || "");
      setCream(s.colors?.background || "");
      setDisplayUrl(s.fonts?.display?.url || "");
      const detectedLogo = (logoRes?.data as { logoUrl?: string | null } | null)?.logoUrl || "";
      setLogoUrl(detectedLogo);
    } catch (e: any) {
      toast.error(e?.message || "Failed to extract brand");
    } finally {
      setLoading(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Logo must be under 5MB");
      return;
    }
    setLogoUploading(true);
    try {
      const { data: userRes } = await supabase.auth.getUser();
      const userId = userRes.user?.id;
      if (!userId) throw new Error("You must be signed in");
      const ext = (file.name.split(".").pop() || "png").toLowerCase();
      const path = `brand-logos/${userId}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("broll-library")
        .upload(path, file, { upsert: true, contentType: file.type || `image/${ext}` });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("broll-library").getPublicUrl(path);
      setLogoUrl(pub.publicUrl);
      toast.success("Logo uploaded");
    } catch (err: any) {
      toast.error(err?.message || "Failed to upload logo");
    } finally {
      setLogoUploading(false);
      e.target.value = "";
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data: userRes } = await supabase.auth.getUser();
      const userId = userRes.user?.id;
      if (!userId) {
        toast.error("You must be signed in");
        return;
      }
      const { error } = await supabase.from("brand_kits").upsert(
        {
          user_id: userId,
          source_url: url.trim(),
          colors: { bg, ink, accent, pop, highlight, cream },
          fonts: { displayItalicUrl: displayUrl },
          voice: data?.suggested?.voice || {},
          logo_url: logoUrl || null,
          status: "confirmed",
        },
        { onConflict: "user_id" }
      );
      if (error) throw error;
      toast.success("Brand saved");
      navigate("/ad-generator");
    } catch (e: any) {
      toast.error(e?.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const candidates = Array.from(
    new Set([...(data?.raw?.backgrounds || []), ...(data?.raw?.textColors || [])])
  );

  const ColorField = ({
    label,
    value,
    onChange,
  }: {
    label: string;
    value: string;
    onChange: (v: string) => void;
  }) => (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value || "#000000"}
          onChange={(e) => onChange(e.target.value)}
          className="h-10 w-12 cursor-pointer rounded border border-border bg-transparent"
        />
        <Input value={value} onChange={(e) => onChange(e.target.value)} className="font-mono" />
      </div>
      {candidates.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {candidates.map((c) => (
            <Swatch key={c} color={c} active={c.toLowerCase() === value.toLowerCase()} onClick={() => onChange(c)} />
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="container mx-auto max-w-3xl py-10 px-4">
      <div className="mb-8">
        <p className="text-sm text-muted-foreground">Step 1 of onboarding</p>
        <h1 className="text-3xl font-semibold tracking-tight">Brand Setup</h1>
        <p className="mt-2 text-muted-foreground">
          We'll pull your brand from your website. You can fix anything that looks off before saving.
        </p>
      </div>

      <Card className="p-6 mb-6">
        <Label htmlFor="url">Your website URL</Label>
        <div className="mt-2 flex gap-2">
          <Input
            id="url"
            placeholder="https://yourbrand.com"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            disabled={loading}
          />
          <Button onClick={handlePull} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Pulling…
              </>
            ) : (
              "Pull my brand"
            )}
          </Button>
        </div>
        {loading && (
          <p className="mt-3 text-sm text-muted-foreground">Scanning your site (this takes ~3–5s)…</p>
        )}
      </Card>

      {data && (
        <>
          <Card className="p-6 mb-6">
            <h2 className="text-xl font-semibold mb-1">Review & edit</h2>
            <p className="text-sm text-muted-foreground mb-6">
              This is a draft. Click a swatch if the auto-pick looks wrong — accents are often a bit off.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <ColorField label="Background color" value={bg} onChange={setBg} />
              <ColorField label="Ink / text color" value={ink} onChange={setInk} />
              <ColorField label="Accent color" value={accent} onChange={setAccent} />
              <ColorField label="Pop color" value={pop} onChange={setPop} />
              <ColorField label="Highlight color" value={highlight} onChange={setHighlight} />
              <ColorField label="Cream color" value={cream} onChange={setCream} />
            </div>

            <div className="mt-6 space-y-2">
              <Label htmlFor="displayUrl">Display font URL</Label>
              <Input
                id="displayUrl"
                value={displayUrl}
                onChange={(e) => setDisplayUrl(e.target.value)}
                placeholder="https://.../font.woff"
                className="font-mono text-sm"
              />
              {data.suggested?.fonts?.display?.family && (
                <p className="text-xs text-muted-foreground">
                  Detected: {data.suggested.fonts.display.family}
                </p>
              )}
            </div>
          </Card>

          {(data.suggested?.voice?.headlines?.length ?? 0) > 0 && (
            <Card className="p-6 mb-6">
              <h3 className="text-base font-semibold mb-3">Voice samples</h3>
              <ul className="space-y-2">
                {data.suggested!.voice!.headlines!.map((h, i) => (
                  <li key={i} className="text-sm text-muted-foreground border-l-2 border-border pl-3">
                    {h}
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <div className="flex justify-end">
            <Button size="lg" onClick={handleSave} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Saving…
                </>
              ) : (
                "Save my brand"
              )}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
