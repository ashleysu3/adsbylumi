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
import { BrandVoiceCard } from "@/components/BrandVoiceCard";
import { TourFab } from "@/components/TourFab";
import { ContentAssetsEditor } from "@/components/ContentAssetsEditor";
import { Building2, Smile, X, Loader2, Mic } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface EmojiSettings {
  use_emojis: boolean;
  brand_emojis: string[];
  bullet_emoji: string;
}

const DEFAULT_EMOJIS = ["✨", "🎯", "💡", "🚀", "💪", "⭐"];
const BULLET_OPTIONS = ["✅", "→", "•", "✓", "▸", "★", "💫", "🔥"];

export default function Voice() {
  const { getEffectiveUserId } = useImpersonation();
  const { activeBrand: contextBrand } = useBrand();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [brand, setBrand] = useState<any>(null);
  const [offers, setOffers] = useState<any[]>([]);
  const [emojiSettings, setEmojiSettings] = useState<EmojiSettings>({
    use_emojis: true,
    brand_emojis: DEFAULT_EMOJIS,
    bullet_emoji: "✅",
  });
  const [newEmoji, setNewEmoji] = useState("");

  useEffect(() => {
    fetchData();
  }, [contextBrand?.id]);

  const fetchData = async () => {
    setLoading(true);
    setBrand(null);
    try {
      const effectiveUserId = await getEffectiveUserId();
      if (!effectiveUserId) return;

      let brandData: any = null;
      if (contextBrand) {
        const { data } = await supabase.from("brands").select("*").eq("id", contextBrand.id).maybeSingle();
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
        const { data: offersData } = await supabase
          .from("offers")
          .select("id, name")
          .eq("brand_id", brandData.id)
          .eq("archived", false);
        setOffers(offersData || []);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to load voice settings");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveCopyPerspective = async (perspective: "I" | "We") => {
    if (!brand) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("brands").update({ copy_perspective: perspective }).eq("id", brand.id);
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
    setEmojiSettings((prev) => ({ ...prev, brand_emojis: [...prev.brand_emojis, newEmoji.trim()] }));
    setNewEmoji("");
  };

  const removeEmoji = (emoji: string) => {
    setEmojiSettings((prev) => ({ ...prev, brand_emojis: prev.brand_emojis.filter((e) => e !== emoji) }));
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
            <CardDescription>Set up your brand first to manage voice + examples.</CardDescription>
          </CardHeader>
        </Card>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 md:space-y-8">
        <div className="flex items-start gap-4">
          <div className="h-12 w-12 rounded-2xl bg-[image:var(--gradient-lumi)] flex items-center justify-center flex-shrink-0">
            <Mic className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-display tracking-tight text-foreground">Voice + Examples</h1>
            <p className="text-sm md:text-base text-muted-foreground mt-1">
              How your ads sound — copy voice, emojis, brand voice, and your content library.
            </p>
          </div>
        </div>

        <div className="space-y-6 md:space-y-8 min-w-0">
          {/* Ad Copy Voice */}
          <Card variant="glow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Ad Copy Voice
              </CardTitle>
              <CardDescription>
                Should your ads say "I" or "We"? This applies to all generated ad copy for this brand.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => handleSaveCopyPerspective("I")}
                  className={cn(
                    "rounded-xl border-2 p-4 text-left transition-all",
                    brand.copy_perspective !== "We"
                      ? "border-primary bg-primary/5 shadow-sm"
                      : "border-border hover:border-muted-foreground/50"
                  )}
                >
                  <span className="font-semibold text-sm">Personal "I"</span>
                  <p className="text-xs text-muted-foreground mt-1 italic">"I help entrepreneurs scale..."</p>
                </button>
                <button
                  onClick={() => handleSaveCopyPerspective("We")}
                  className={cn(
                    "rounded-xl border-2 p-4 text-left transition-all",
                    brand.copy_perspective === "We"
                      ? "border-primary bg-primary/5 shadow-sm"
                      : "border-border hover:border-muted-foreground/50"
                  )}
                >
                  <span className="font-semibold text-sm">Team "We"</span>
                  <p className="text-xs text-muted-foreground mt-1 italic">"We help entrepreneurs scale..."</p>
                </button>
              </div>
            </CardContent>
          </Card>

          {/* Emoji Preferences */}
          <Card variant="glow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Smile className="h-5 w-5" />
                Emoji Preferences
              </CardTitle>
              <CardDescription>Control how emojis are used in your smart-generated ad copy.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-base">Use Emojis in Copy</Label>
                  <p className="text-sm text-muted-foreground">
                    Enable or disable emoji usage in generated headlines, descriptions, and primary copy
                  </p>
                </div>
                <Switch
                  checked={emojiSettings.use_emojis}
                  onCheckedChange={(checked) => setEmojiSettings((prev) => ({ ...prev, use_emojis: checked }))}
                />
              </div>

              {emojiSettings.use_emojis && (
                <>
                  <Separator />
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-base">Your Brand Emojis</Label>
                      <p className="text-sm text-muted-foreground">
                        Choose up to 6 emojis that represent your brand. These will be used in your ad copy.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {emojiSettings.brand_emojis.map((emoji) => (
                        <div key={emoji} className="flex items-center gap-1 px-3 py-2 bg-muted rounded-lg border">
                          <span className="text-xl">{emoji}</span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5 hover:bg-destructive/20"
                            onClick={() => removeEmoji(emoji)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                    {emojiSettings.brand_emojis.length < 6 && (
                      <div className="flex flex-wrap gap-2 items-center">
                        <EmojiQuickPicker
                          onSelect={(emoji) => {
                            if (emojiSettings.brand_emojis.length >= 6) {
                              toast.error("Maximum 6 emojis allowed");
                              return;
                            }
                            if (emojiSettings.brand_emojis.includes(emoji)) {
                              toast.error("Emoji already added");
                              return;
                            }
                            setEmojiSettings((prev) => ({ ...prev, brand_emojis: [...prev.brand_emojis, emoji] }));
                          }}
                          selectedEmojis={emojiSettings.brand_emojis}
                        />
                        <span className="text-xs text-muted-foreground">or</span>
                        <div className="flex gap-2">
                          <Input
                            value={newEmoji}
                            onChange={(e) => setNewEmoji(e.target.value)}
                            placeholder="Paste emoji..."
                            className="w-24"
                            maxLength={4}
                          />
                          <Button variant="ghost" size="sm" onClick={addEmoji}>
                            Add
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                  <Separator />
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-base">Bullet Point Style</Label>
                      <p className="text-sm text-muted-foreground">
                        Choose the emoji or symbol used for bullet points in your primary copy
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {BULLET_OPTIONS.map((bullet) => (
                        <Button
                          key={bullet}
                          variant={emojiSettings.bullet_emoji === bullet ? "default" : "outline"}
                          size="sm"
                          onClick={() => setEmojiSettings((prev) => ({ ...prev, bullet_emoji: bullet }))}
                          className="text-lg w-10 h-10 p-0"
                        >
                          {bullet}
                        </Button>
                      ))}
                    </div>
                    <div className="bg-muted/50 rounded-lg p-4 border">
                      <p className="text-xs font-medium text-muted-foreground uppercase mb-2">Preview</p>
                      <div className="space-y-1 text-sm">
                        <p>{emojiSettings.bullet_emoji} Stop wasting time on ads that don't convert</p>
                        <p>{emojiSettings.bullet_emoji} Get smart creative that actually works</p>
                        <p>{emojiSettings.bullet_emoji} Launch campaigns in minutes, not days</p>
                      </div>
                    </div>
                  </div>
                </>
              )}

              <div className="pt-4">
                <Button onClick={handleSaveEmojiSettings} disabled={saving} variant="lumi">
                  {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  Save Emoji Settings
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Brand Voice */}
          <BrandVoiceCard
            brandId={brand.id}
            brandVoice={brand.brand_voice ?? null}
            voiceProfile={(brand as any).voice_profile ?? null}
            voiceGeneratedAt={(brand as any).voice_profile_generated_at ?? null}
            onUpdate={fetchData}
          />

          {/* Your Content Library */}
          <ContentAssetsEditor brandId={brand.id} offers={offers.map((o) => ({ id: o.id, name: o.name }))} />
        </div>
      </div>

      <TourFab
        steps={[{
          targetSelector: '[data-help-target="analyze-voice"]',
          title: "Brand voice",
          description: "Add your Instagram handle (optional) and hit analyze — Lumi reads your site and posts to learn how you actually sound, then uses it to write ads that feel like you.",
        }]}
      />
    </DashboardLayout>
  );
}
