import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useBrand } from "@/contexts/BrandContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";

type AssetRow = {
  id: string;
  original_url: string;
  brand_id: string;
  kind: string | null;
  created_at: string;
};

type GalleryItem = AssetRow & { displayUrl: string };

export default function Photos() {
  const { activeBrand, loading: brandsLoading } = useBrand();
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  const load = async () => {
    if (brandsLoading) return;
    if (!activeBrand?.id) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("user_assets" as any)
        .select("id, original_url, brand_id, kind, created_at")
        .eq("kind", "photo")
        .eq("brand_id", activeBrand.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const rows = (data || []) as unknown as AssetRow[];
      const paths = rows.map((r) => r.original_url).filter(Boolean);
      let signed: { path?: string | null; signedUrl: string }[] = [];
      if (paths.length) {
        const { data: s, error: se } = await supabase.storage
          .from("ad-photos")
          .createSignedUrls(paths, 60 * 60);
        if (se) throw se;
        signed = s || [];
      }
      setItems(
        rows.map((r, i) => ({ ...r, displayUrl: signed[i]?.signedUrl || "" }))
      );
    } catch (e: any) {
      toast.error(e?.message || "Failed to load photos");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeBrand?.id, brandsLoading]);

  const onUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    if (!activeBrand?.id) {
      toast.error("Choose a brand before uploading photos");
      return;
    }
    setUploading(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth.user?.id;
      if (!userId) throw new Error("You must be signed in.");
      for (const file of files) {
        const safe = file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
        const path = `${userId}/${activeBrand.id}/${Date.now()}-${safe}`;
        const { error: upErr } = await supabase.storage
          .from("ad-photos")
          .upload(path, file, { cacheControl: "3600", upsert: false });
        if (upErr) throw upErr;
        const { error: insErr } = await supabase
          .from("user_assets" as any)
          .insert({ original_url: path, kind: "photo", brand_id: activeBrand.id });
        if (insErr) throw insErr;
      }
      toast.success(`Uploaded ${files.length} photo${files.length > 1 ? "s" : ""}`);
      e.target.value = "";
      await load();
    } catch (err: any) {
      toast.error(err?.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const remove = async (item: GalleryItem) => {
    try {
      await supabase.storage.from("ad-photos").remove([item.original_url]);
      const { error } = await supabase
        .from("user_assets" as any)
        .delete()
        .eq("id", item.id)
        .eq("brand_id", activeBrand?.id || "");
      if (error) throw error;
      setItems((prev) => prev.filter((p) => p.id !== item.id));
    } catch (e: any) {
      toast.error(e?.message || "Delete failed");
    }
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold font-display">My Photos</h1>
          <p className="text-muted-foreground">
            Upload photos once, reuse them in the Ad Generator.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Upload photos</CardTitle>
          </CardHeader>
          <CardContent>
            <label className="flex items-center gap-3">
              <Input
                type="file"
                accept="image/*"
                multiple
                onChange={onUpload}
                disabled={uploading}
              />
              {uploading && (
                <span className="text-xs text-muted-foreground flex items-center gap-2">
                  <Loader2 className="h-3 w-3 animate-spin" /> Uploading…
                </span>
              )}
            </label>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Your gallery</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : items.length === 0 ? (
              <div className="text-center py-10 text-sm text-muted-foreground">
                <Upload className="h-8 w-8 mx-auto mb-2 opacity-50" />
                No photos yet. Upload your first one above.
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {items.map((item) => (
                  <div key={item.id} className="relative group">
                    <img
                      src={item.displayUrl}
                      alt="photo"
                      className="w-full aspect-square object-cover rounded border border-border"
                    />
                    <Button
                      size="icon"
                      variant="destructive"
                      className="absolute top-1 right-1 h-7 w-7 opacity-0 group-hover:opacity-100 transition"
                      onClick={() => remove(item)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
