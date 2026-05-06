import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import AdminTabs from "@/components/AdminTabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Mail, Pencil, Zap, Code2, Loader2 } from "lucide-react";
import { toast } from "sonner";

type EmailTemplate = {
  id: string;
  key: string;
  label: string;
  description: string | null;
  trigger_description: string | null;
  edge_function: string | null;
  category: string;
  subject: string | null;
  intro: string | null;
  outro: string | null;
  enabled: boolean;
  updated_at: string;
};

const categoryColors: Record<string, string> = {
  lifecycle: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20",
  reporting: "bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/20",
  alerts: "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20",
  partners: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20",
  support: "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20",
  product: "bg-pink-500/10 text-pink-700 dark:text-pink-400 border-pink-500/20",
  transactional: "bg-muted text-muted-foreground",
};

export default function AdminEmails() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<EmailTemplate | null>(null);
  const [draft, setDraft] = useState<Partial<EmailTemplate>>({});

  const { data: templates, isLoading } = useQuery({
    queryKey: ["admin-email-templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("email_templates")
        .select("*")
        .order("category", { ascending: true })
        .order("label", { ascending: true });
      if (error) throw error;
      return data as EmailTemplate[];
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (payload: Partial<EmailTemplate> & { id: string }) => {
      const { error } = await supabase
        .from("email_templates")
        .update({
          subject: payload.subject,
          intro: payload.intro,
          outro: payload.outro,
          enabled: payload.enabled,
        })
        .eq("id", payload.id)
        .select()
        .single();
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Email updated");
      qc.invalidateQueries({ queryKey: ["admin-email-templates"] });
      setEditing(null);
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to update"),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      const { error } = await supabase
        .from("email_templates")
        .update({ enabled })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-email-templates"] }),
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });

  const openEdit = (t: EmailTemplate) => {
    setEditing(t);
    setDraft({ subject: t.subject ?? "", intro: t.intro ?? "", outro: t.outro ?? "", enabled: t.enabled });
  };

  // Group by category
  const grouped = (templates ?? []).reduce<Record<string, EmailTemplate[]>>((acc, t) => {
    (acc[t.category] ||= []).push(t);
    return acc;
  }, {});

  return (
    <DashboardLayout>
      <div className="p-6 max-w-7xl mx-auto">
        <AdminTabs />

        <div className="mb-6">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Mail className="h-6 w-6" />
            Emails
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Every email Lumi sends, what triggers it, and the editable copy.
          </p>
        </div>

        {isLoading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {!isLoading && Object.entries(grouped).map(([category, items]) => (
          <div key={category} className="mb-8">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">
              {category}
            </h2>
            <div className="grid gap-4 md:grid-cols-2">
              {items.map((t) => (
                <Card key={t.id} className={!t.enabled ? "opacity-60" : ""}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <CardTitle className="text-base flex items-center gap-2">
                          {t.label}
                          <Badge variant="outline" className={categoryColors[t.category] || ""}>
                            {t.category}
                          </Badge>
                        </CardTitle>
                        {t.description && (
                          <CardDescription className="mt-1">{t.description}</CardDescription>
                        )}
                      </div>
                      <Switch
                        checked={t.enabled}
                        onCheckedChange={(v) => toggleMutation.mutate({ id: t.id, enabled: v })}
                      />
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    {t.trigger_description && (
                      <div className="flex items-start gap-2">
                        <Zap className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-medium text-xs text-muted-foreground uppercase tracking-wide">Trigger</p>
                          <p className="text-foreground">{t.trigger_description}</p>
                        </div>
                      </div>
                    )}
                    {t.edge_function && (
                      <div className="flex items-start gap-2">
                        <Code2 className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                        <div>
                          <p className="font-medium text-xs text-muted-foreground uppercase tracking-wide">Edge function</p>
                          <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{t.edge_function}</code>
                        </div>
                      </div>
                    )}
                    {t.subject && (
                      <div>
                        <p className="font-medium text-xs text-muted-foreground uppercase tracking-wide mb-1">Subject</p>
                        <p className="text-foreground">{t.subject}</p>
                      </div>
                    )}
                    <div className="pt-2">
                      <Button size="sm" variant="outline" className="gap-2" onClick={() => openEdit(t)}>
                        <Pencil className="h-3.5 w-3.5" />
                        Edit copy
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ))}

        <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle>Edit: {editing?.label}</DialogTitle>
              <DialogDescription>
                Subject and intro/outro text are editable. The rest of the email is generated dynamically.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="subject">Subject line</Label>
                <Input
                  id="subject"
                  value={draft.subject ?? ""}
                  onChange={(e) => setDraft({ ...draft, subject: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="intro">Intro text</Label>
                <Textarea
                  id="intro"
                  rows={3}
                  value={draft.intro ?? ""}
                  onChange={(e) => setDraft({ ...draft, intro: e.target.value })}
                  placeholder="First line(s) of the email."
                />
              </div>
              <div>
                <Label htmlFor="outro">Outro / sign-off</Label>
                <Textarea
                  id="outro"
                  rows={2}
                  value={draft.outro ?? ""}
                  onChange={(e) => setDraft({ ...draft, outro: e.target.value })}
                  placeholder="Final line(s) of the email."
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
              <Button
                onClick={() => editing && updateMutation.mutate({ id: editing.id, ...draft })}
                disabled={updateMutation.isPending}
              >
                {updateMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Save changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
