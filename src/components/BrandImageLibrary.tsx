import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Loader2, Images, Upload, Globe } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Role = "photo" | "texture" | "background" | "logo" | "graphic";

interface BrandAsset {
  id: string;
  url: string;
  source_url: string | null;
  role: Role;
  width: number | null;
  height: number | null;
  kept: boolean;
  created_at: string;
  signedUrl?: string;
}

const ROLE_OPTIONS: { value: Role; label: string }[] = [
  { value: "photo", label: "Photo" },
  { value: "texture", label: "Texture" },
  { value: "background", label: "Background" },
  { value: "logo", label: "Logo" },
  { value: "graphic", label: "Graphic" },
];

const GROUPS: { role: Role; label: string }[] = [
  { role: "photo", label: "Photos" },
  { role: "texture", label: "Textures" },
  { role: "background", label: "Backgrounds" },
  { role: "logo", label: "Logos" },
  { role: "graphic", label: "Graphics" },
];

function pathFromUrl(url: string): string | null {
  // Public URL: .../storage/v1/object/public/brand-assets/<path>
  const m = url.match(/\/storage\/v1\/object\/(?:public|sign)\/brand-assets\/([^?]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

export default function BrandImageLibrary({ brandId, websiteUrl }: { brandId: string; websiteUrl?: string | null }) {
  const [assets, setAssets] = useState<BrandAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [harvesting, setHarvesting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [url, setUrl] = useState(websiteUrl || "");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (websiteUrl) setUrl(websiteUrl);
  }, [websiteUrl]);

  const load = async () => {
    if (!brandId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("brand_assets" as any)
        .select("*")
        .eq("brand_id", brandId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const rows = (data || []) as unknown as BrandAsset[];
      const paths = rows.map((r) => pathFromUrl(r.url)).filter(Boolean) as string[];
      let signed: { signedUrl: string }[] = [];
      if (paths.length) {
        const { data: s } = await supabase.storage
          .from("brand-assets")
          .createSignedUrls(paths, 60 * 60);
        signed = (s || []) as { signedUrl: string }[];
      }
      let i = 0;
      setAssets(
        rows.map((r) => {
          const hasPath = !!pathFromUrl(r.url);
          const signedUrl = hasPath ? signed[i++]?.signedUrl || r.url : r.url;
          return { ...r, signedUrl };
        })
      );
    } catch (e: any) {
      toast.error(e?.message || "Failed to load brand images");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brandId]);


  const harvest = async () => {
    if (!url.trim()) {
      toast.error("Add your website URL first");
      return;
    }
    if (!brandId) {
      toast.error("Pick a brand first");
      return;
    }
    setHarvesting(true);
    try {
      const { data, error } = await supabase.functions.invoke("harvest-brand-assets", {
        body: { url: url.trim(), brandId },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success(`Pulled ${(data as any)?.saved ?? 0} images from your site`);
      await load();
    } catch (e: any) {
      toast.error(e?.message || "Couldn't pull images");
    } finally {
      setHarvesting(false);
    }
  };


  const onUpload = async (files: FileList | null) => {
    if (!files || !files.length) return;
    if (!brandId) {
      toast.error("Pick a brand first");
      return;
    }
    setUploading(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const userId = u.user?.id;
      if (!userId) throw new Error("Not signed in");
      for (const file of Array.from(files)) {
        if (!file.type.startsWith("image/")) continue;
        const ext = file.name.split(".").pop() || "jpg";
        const path = `${userId}/${brandId}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("brand-assets")
          .upload(path, file, { contentType: file.type, upsert: false });
        if (upErr) throw upErr;
        const { data: pub } = supabase.storage.from("brand-assets").getPublicUrl(path);
        const { error: insErr } = await supabase
          .from("brand_assets" as any)
          .insert({
            user_id: userId,
            brand_id: brandId,
            url: pub.publicUrl,
            source_url: null,
            role: "photo" as Role,
          });
        if (insErr) throw insErr;
      }
      toast.success("Uploaded");
      await load();
    } catch (e: any) {
      toast.error(e?.message || "Upload failed");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const toggleKept = async (a: BrandAsset, kept: boolean) => {
    setAssets((prev) => prev.map((x) => (x.id === a.id ? { ...x, kept } : x)));
    const { error } = await supabase
      .from("brand_assets" as any)
      .update({ kept })
      .eq("id", a.id);
    if (error) {
      toast.error("Couldn't update");
      setAssets((prev) => prev.map((x) => (x.id === a.id ? { ...x, kept: !kept } : x)));
    }
  };

  const updateRole = async (a: BrandAsset, role: Role) => {
    setAssets((prev) => prev.map((x) => (x.id === a.id ? { ...x, role } : x)));
    const { error } = await supabase
      .from("brand_assets" as any)
      .update({ role })
      .eq("id", a.id);
    if (error) toast.error("Couldn't re-tag");
  };

  const grouped = GROUPS.map((g) => ({
    ...g,
    items: assets.filter((a) => a.role === g.role),
  }));

  return (
    <Card variant="glow">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Images className="h-5 w-5" />
          Brand image library
        </CardTitle>
        <CardDescription>
          Pull images from your website and upload your own — we'll use these when generating creative.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Harvest + Upload controls */}
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">Your website URL</Label>
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://yourbrand.com"
                  className="pl-9"
                  disabled={harvesting}
                />
              </div>
              <Button onClick={harvest} disabled={harvesting} variant="lumi">
                {harvesting ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Pulling images… (20–40s)</>
                ) : (
                  <>Pull my brand's images</>
                )}
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={(e) => onUpload(e.target.files)}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? (
                <><Loader2 className="h-3 w-3 mr-2 animate-spin" /> Uploading…</>
              ) : (
                <><Upload className="h-3 w-3 mr-2" /> Upload your own</>
              )}
            </Button>
            <p className="text-xs text-muted-foreground">PNG, JPG, SVG, WebP</p>
          </div>
        </div>

        {/* Library */}
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading your library…
          </div>
        ) : assets.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-8 text-center">
            <p className="text-sm text-muted-foreground">
              No images yet. Pull from your website or upload your own to get started.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {grouped.map((g) =>
              g.items.length === 0 ? null : (
                <div key={g.role} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold">{g.label}</h3>
                    <span className="text-xs text-muted-foreground">({g.items.length})</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {g.items.map((a) => (
                      <div
                        key={a.id}
                        className={cn(
                          "rounded-lg border overflow-hidden bg-card transition",
                          a.kept ? "border-border" : "border-border/50 opacity-50"
                        )}
                      >
                        <div className="aspect-square bg-muted">
                          {a.signedUrl ? (
                            <img
                              src={a.signedUrl}
                              alt={g.label}
                              className="w-full h-full object-cover"
                              loading="lazy"
                            />
                          ) : null}
                        </div>
                        <div className="p-2 space-y-2">
                          <Select
                            value={a.role}
                            onValueChange={(v) => updateRole(a, v as Role)}
                          >
                            <SelectTrigger className="h-7 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {ROLE_OPTIONS.map((r) => (
                                <SelectItem key={r.value} value={r.value} className="text-xs">
                                  {r.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-muted-foreground">
                              {a.kept ? "Keep" : "Remove"}
                            </span>
                            <Switch
                              checked={a.kept}
                              onCheckedChange={(v) => toggleKept(a, v)}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
