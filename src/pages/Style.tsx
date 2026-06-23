import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { useBrand } from "@/contexts/BrandContext";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { PageShimmer } from "@/components/GradientShimmer";
import EmojiQuickPicker from "@/components/EmojiQuickPicker";
import { BRollLibrary } from "@/components/BRollLibrary";
import { BrandEditDialog } from "@/components/BrandEditDialog";
import { Globe, Target, Edit } from "lucide-react";
import BrandImageLibrary from "@/components/BrandImageLibrary";
import BrandColorsAndFonts from "@/components/BrandColorsAndFonts";
import { BRollLibrariesManager } from "@/components/BRollLibrariesManager";
import { OverlayStylePicker } from "@/components/OverlayStylePicker";
import type { OverlayStyle } from "@/components/VideoTextPreview";
import { DEFAULT_OVERLAY_STYLE } from "@/components/VideoTextPreview";
import { Building2, Smile, X, Loader2, Palette } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface EmojiSettings {
  use_emojis: boolean;
  brand_emojis: string[];
  bullet_emoji: string;
}

const DEFAULT_EMOJIS = ["✨", "🎯", "💡", "🚀", "💪", "⭐"];
const BULLET_OPTIONS = ["✅", "→", "•", "✓", "▸", "★", "💫", "🔥"];

export default function Style() {
  const { getEffectiveUserId } = useImpersonation();
  const { activeBrand: contextBrand } = useBrand();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [brand, setBrand] = useState<any>(null);
  const [emojiSettings, setEmojiSettings] = useState<EmojiSettings>({
    use_emojis: true,
    brand_emojis: DEFAULT_EMOJIS,
    bullet_emoji: "✅",
  });
  const [newEmoji, setNewEmoji] = useState("");
  const [overlayStyle, setOverlayStyle] = useState<OverlayStyle>(DEFAULT_OVERLAY_STYLE);
  const [brollClips, setBrollClips] = useState<any[]>([]);
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  useEffect(() => {
    fetchBrand();
  }, [contextBrand?.id]);

  const fetchBrand = async () => {
    setLoading(true);
    setBrand(null);
    try {
      const effectiveUserId = await getEffectiveUserId();
      if (!effectiveUserId) return;

      let brandData: any = null;
      if (contextBrand) {
        const { data } = await supabase
          .from("brands")
          .select("*")
          .eq("id", contextBrand.id)
          .single();
        brandData = data;
      } else {
        const { data } = await supabase
          .from("brands")
          .select("*")
          .eq("user_id", effectiveUserId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        brandData = data;
      }

      setBrand(brandData);
      if (brandData) {
        setEmojiSettings({
          use_emojis: brandData.use_emojis ?? true,
          brand_emojis: brandData.brand_emojis ?? DEFAULT_EMOJIS,
          bullet_emoji: brandData.bullet_emoji ?? "✅",
        });
        setBrollClips((brandData as any).broll_library || []);
        setOverlayStyle((brandData as any).overlay_style || DEFAULT_OVERLAY_STYLE);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to load style settings");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveCopyPerspective = async (perspective: "I" | "We") => {
    if (!brand) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("brands")
        .update({ copy_perspective: perspective })
        .eq("id", brand.id);
      if (error) throw error;
      setBrand((prev: any) => ({ ...prev, copy_perspective: perspective }));
      toast.success(`Copy voice set to "${perspective}"`);
    } catch {
      toast.error("Failed to save copy voice");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveEmojiSettings = async () => {
    if (!brand) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("brands")
        .update({
          use_emojis: emojiSettings.use_emojis,
          brand_emojis: emojiSettings.brand_emojis,
          bullet_emoji: emojiSettings.bullet_emoji,
        })
        .eq("id", brand.id);
      if (error) throw error;
      toast.success("Emoji settings saved");
    } catch {
      toast.error("Failed to save emoji settings");
    } finally {
      setSaving(false);
    }
  };

  const addEmoji = () => {
    if (!newEmoji.trim()) return;
    if (emojiSettings.brand_emojis.length >= 6) {
      toast.error("Maximum 6 emojis allowed");
      return;
    }
    if (emojiSettings.brand_emojis.includes(newEmoji.trim())) {
      toast.error("Emoji already added");
      return;
    }
    setEmojiSettings((prev) => ({
      ...prev,
      brand_emojis: [...prev.brand_emojis, newEmoji.trim()],
    }));
    setNewEmoji("");
  };

  const removeEmoji = (emoji: string) => {
    setEmojiSettings((prev) => ({
      ...prev,
      brand_emojis: prev.brand_emojis.filter((e) => e !== emoji),
    }));
  };

  if (loading) {
    return (
      <DashboardLayout>
        <PageShimmer />
      </DashboardLayout>
    );
  }

  if (!brand) {
    return (
      <DashboardLayout>
        <Card>
          <CardHeader>
            <CardTitle>No Brand Found</CardTitle>
            <CardDescription>Set up a brand first to manage style settings.</CardDescription>
          </CardHeader>
        </Card>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 md:space-y-8">
        {/* Page Header */}
        <div className="flex items-start gap-4">
          <div className="h-12 w-12 rounded-2xl bg-[image:var(--gradient-lumi)] flex items-center justify-center flex-shrink-0">
            <Palette className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-display tracking-tight text-foreground">
              Style
            </h1>
            <p className="text-sm md:text-base text-muted-foreground mt-1">
              How your ads look — colors, fonts, b-roll, and text overlays.
            </p>
          </div>
        </div>

        <div className="space-y-6 md:space-y-8 min-w-0">
          {/* Brand Details */}
          <Card variant="glow">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Building2 className="h-5 w-5 text-primary" />
                  <CardTitle>Brand Details</CardTitle>
                </div>
                <Button variant="outline" size="sm" onClick={() => setEditDialogOpen(true)}>
                  <Edit className="mr-2 h-4 w-4" />
                  Edit Details
                </Button>
              </div>
              <CardDescription>The basics that anchor your brand.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start space-x-3">
                <Building2 className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Name</p>
                  <p className="text-sm text-muted-foreground">{brand.name || "—"}</p>
                </div>
              </div>
              {brand.website_url && (
                <div className="flex items-start space-x-3">
                  <Globe className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">Website</p>
                    <a href={brand.website_url} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline">
                      {brand.website_url}
                    </a>
                  </div>
                </div>
              )}
              {brand.industry && (
                <div className="flex items-start space-x-3">
                  <Target className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">Industry</p>
                    <p className="text-sm text-muted-foreground">{brand.industry}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Brand Colors & Fonts */}
          <BrandColorsAndFonts brandId={brand.id} websiteUrl={brand?.website_url || brand?.website} />


          {/* Brand Image Library */}
          <BrandImageLibrary brandId={brand.id} websiteUrl={brand?.website_url || brand?.website} />

          {/* B-Roll Libraries */}
          <BRollLibrariesManager
            brandId={brand.id}
            brandClips={brollClips}
            onBrandClipsChange={(clips) => setBrollClips(clips)}
          />

          {/* Overlay Style Picker */}
          <OverlayStylePicker
            style={overlayStyle}
            onChange={setOverlayStyle}
            brandId={brand.id}
            onSave={async () => {
              setSaving(true);
              try {
                const { error } = await supabase
                  .from("brands")
                  .update({ overlay_style: overlayStyle as any })
                  .eq("id", brand.id);
                if (error) throw error;
                toast.success("Overlay style saved");
              } catch {
                toast.error("Failed to save overlay style");
              }
              setSaving(false);
            }}
            saving={saving}
          />
        </div>
      </div>
    </DashboardLayout>
  );
}
