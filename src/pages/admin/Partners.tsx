import { useEffect, useState, useCallback } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import AdminTabs from "@/components/AdminTabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Loader2, Plus, Trash2, Copy, Pencil, Upload, X, Users } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface PerkItem { title: string; description: string }
interface LinkItem { label: string; url: string }
interface StrategyItem { title: string; description: string }

interface Partner {
  id: string;
  email: string;
  partner_trial_code: string | null;
  partner_display_name: string | null;
  partner_title: string | null;
  partner_photo_url: string | null;
  welcome_message: string | null;
  perks: PerkItem[];
  support_links: LinkItem[];
  recommended_strategies: StrategyItem[];
  is_active: boolean;
  created_at: string;
}

const blankForm = (): Partial<Partner> => ({
  email: "",
  partner_trial_code: "",
  partner_display_name: "",
  partner_title: "",
  partner_photo_url: "",
  welcome_message: "",
  perks: [],
  support_links: [],
  recommended_strategies: [],
  is_active: true,
});

export default function AdminPartners() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [editing, setEditing] = useState<Partial<Partner> | null>(null);
  const [uploading, setUploading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("partner_access_tokens")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      setPartners((data || []) as unknown as Partner[]);
    } catch (e: any) {
      toast.error(e.message || "Failed to load partners");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    if (!editing) return;
    const code = (editing.partner_trial_code || "").toUpperCase().trim();
    if (!code) return toast.error("Trial code is required");
    if (!editing.partner_display_name) return toast.error("Partner name is required");

    setSaving(true);
    try {
      const payload: any = {
        email: editing.email || `${code.toLowerCase()}@partner.local`,
        partner_trial_code: code,
        partner_display_name: editing.partner_display_name,
        partner_title: editing.partner_title || null,
        partner_photo_url: editing.partner_photo_url || null,
        welcome_message: editing.welcome_message || null,
        perks: editing.perks || [],
        support_links: editing.support_links || [],
        recommended_strategies: editing.recommended_strategies || [],
        is_active: editing.is_active ?? true,
      };
      if (editing.id) {
        const { error } = await supabase.from("partner_access_tokens").update(payload).eq("id", editing.id);
        if (error) throw error;
        toast.success("Partner updated");
      } else {
        const { error } = await supabase.from("partner_access_tokens").insert(payload);
        if (error) throw error;
        toast.success("Partner created");
      }
      setEditing(null);
      load();
    } catch (e: any) {
      toast.error(e.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this partner code? This cannot be undone.")) return;
    try {
      const { error } = await supabase.from("partner_access_tokens").delete().eq("id", id);
      if (error) throw error;
      toast.success("Deleted");
      load();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const toggleActive = async (p: Partner) => {
    try {
      const { error } = await supabase.from("partner_access_tokens").update({ is_active: !p.is_active }).eq("id", p.id);
      if (error) throw error;
      load();
    } catch (e: any) { toast.error(e.message); }
  };

  const handlePhotoUpload = async (file: File) => {
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabase.storage.from("partner-assets").upload(path, file, { upsert: false });
      if (error) throw error;
      const { data } = supabase.storage.from("partner-assets").getPublicUrl(path);
      setEditing((e) => e ? { ...e, partner_photo_url: data.publicUrl } : e);
    } catch (e: any) {
      toast.error(e.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const copyLink = (code: string) => {
    navigator.clipboard.writeText(`https://adsbylumi.com/?code=${code}`);
    toast.success("Referral link copied");
  };

  return (
    <DashboardLayout>
      <div className="container mx-auto px-4 py-6 space-y-6">
        <AdminTabs />
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2"><Users className="h-6 w-6" /> Partner Codes</h1>
            <p className="text-muted-foreground text-sm">Configure custom welcome packages for affiliates and partners.</p>
          </div>
          <Button onClick={() => setEditing(blankForm())}>
            <Plus className="h-4 w-4 mr-2" /> New Partner
          </Button>
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : (
          <div className="grid gap-4">
            {partners.map((p) => (
              <Card key={p.id}>
                <CardContent className="p-4 flex items-start gap-4">
                  {p.partner_photo_url ? (
                    <img src={p.partner_photo_url} alt={p.partner_display_name || ""} className="h-14 w-14 rounded-full object-cover" />
                  ) : (
                    <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center text-lg font-semibold">
                      {(p.partner_display_name || "?")[0]}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold">{p.partner_display_name || "Unnamed"}</h3>
                      <Badge variant="outline">{p.partner_trial_code}</Badge>
                      <Badge variant={p.is_active ? "default" : "secondary"}>{p.is_active ? "Active" : "Inactive"}</Badge>
                    </div>
                    {p.partner_title && <p className="text-sm text-muted-foreground">{p.partner_title}</p>}
                    <div className="flex gap-3 text-xs text-muted-foreground mt-1">
                      <span>{(p.perks || []).length} perks</span>
                      <span>{(p.support_links || []).length} support links</span>
                      <span>{(p.recommended_strategies || []).length} strategies</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Switch checked={p.is_active} onCheckedChange={() => toggleActive(p)} />
                    <Button size="sm" variant="ghost" onClick={() => p.partner_trial_code && copyLink(p.partner_trial_code)}>
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditing(p)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => handleDelete(p.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
            {partners.length === 0 && (
              <Card><CardContent className="p-8 text-center text-muted-foreground">No partner codes yet. Click "New Partner" to add one.</CardContent></Card>
            )}
          </div>
        )}

        <Dialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editing?.id ? "Edit Partner" : "New Partner"}</DialogTitle>
              <DialogDescription>Anyone who signs up with this code gets the custom welcome experience below.</DialogDescription>
            </DialogHeader>
            {editing && (
              <div className="space-y-4 py-2">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Partner name *</Label>
                    <Input value={editing.partner_display_name || ""} onChange={(e) => setEditing({ ...editing, partner_display_name: e.target.value })} placeholder="Ashley Ebert" />
                  </div>
                  <div>
                    <Label>Trial code *</Label>
                    <Input value={editing.partner_trial_code || ""} onChange={(e) => setEditing({ ...editing, partner_trial_code: e.target.value.toUpperCase() })} placeholder="ASHLEY" />
                  </div>
                </div>
                <div>
                  <Label>Title / subtitle</Label>
                  <Input value={editing.partner_title || ""} onChange={(e) => setEditing({ ...editing, partner_title: e.target.value })} placeholder="Wedding Industry Strategist" />
                </div>
                <div>
                  <Label>Partner photo</Label>
                  <div className="flex items-center gap-3 mt-1">
                    {editing.partner_photo_url && (
                      <img src={editing.partner_photo_url} alt="" className="h-16 w-16 rounded-full object-cover" />
                    )}
                    <label className="inline-flex">
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handlePhotoUpload(e.target.files[0])} />
                      <Button type="button" variant="outline" disabled={uploading} asChild>
                        <span>{uploading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}Upload</span>
                      </Button>
                    </label>
                    {editing.partner_photo_url && (
                      <Button type="button" variant="ghost" size="sm" onClick={() => setEditing({ ...editing, partner_photo_url: "" })}>Remove</Button>
                    )}
                  </div>
                </div>
                <div>
                  <Label>Custom welcome message</Label>
                  <Textarea rows={4} value={editing.welcome_message || ""} onChange={(e) => setEditing({ ...editing, welcome_message: e.target.value })} placeholder="Personal note from the partner to new signups..." />
                </div>

                <RepeaterField
                  label="Bonus perks"
                  items={editing.perks || []}
                  onChange={(perks) => setEditing({ ...editing, perks })}
                  fields={[{ key: "title", placeholder: "Perk title" }, { key: "description", placeholder: "Description" }]}
                />

                <RepeaterField
                  label="Support links (calls, office hours, etc.)"
                  items={editing.support_links || []}
                  onChange={(support_links) => setEditing({ ...editing, support_links })}
                  fields={[{ key: "label", placeholder: "Button label" }, { key: "url", placeholder: "https://..." }]}
                />

                <RepeaterField
                  label="Recommended strategies"
                  items={editing.recommended_strategies || []}
                  onChange={(recommended_strategies) => setEditing({ ...editing, recommended_strategies })}
                  fields={[{ key: "title", placeholder: "Strategy name" }, { key: "description", placeholder: "Why it's great for their audience" }]}
                />

                <div className="flex items-center justify-between border-t pt-3">
                  <div>
                    <Label>Active</Label>
                    <p className="text-xs text-muted-foreground">When off, the code stops working for new signups.</p>
                  </div>
                  <Switch checked={editing.is_active ?? true} onCheckedChange={(v) => setEditing({ ...editing, is_active: v })} />
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Save Partner
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}

function RepeaterField<T extends Record<string, string>>({
  label, items, onChange, fields,
}: {
  label: string;
  items: T[];
  onChange: (next: T[]) => void;
  fields: { key: keyof T & string; placeholder: string }[];
}) {
  const update = (i: number, key: string, value: string) => {
    const next = [...items];
    next[i] = { ...next[i], [key]: value } as T;
    onChange(next);
  };
  const add = () => {
    const empty: any = {};
    fields.forEach((f) => (empty[f.key] = ""));
    onChange([...items, empty]);
  };
  const remove = (i: number) => onChange(items.filter((_, idx) => idx !== i));

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
        <Button type="button" size="sm" variant="outline" onClick={add}>
          <Plus className="h-3 w-3 mr-1" /> Add
        </Button>
      </div>
      <div className="space-y-2">
        {items.map((item, i) => (
          <div key={i} className="flex items-start gap-2 rounded-md border p-2 bg-muted/30">
            <div className="flex-1 space-y-1">
              {fields.map((f) => (
                <Input
                  key={f.key}
                  value={(item as any)[f.key] || ""}
                  onChange={(e) => update(i, f.key, e.target.value)}
                  placeholder={f.placeholder}
                />
              ))}
            </div>
            <Button type="button" size="sm" variant="ghost" onClick={() => remove(i)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        ))}
        {items.length === 0 && <p className="text-xs text-muted-foreground">None added yet.</p>}
      </div>
    </div>
  );
}
