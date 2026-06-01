import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, ArrowRight } from "lucide-react";

interface Entry {
  id: string;
  title: string;
  body: string | null;
  category: string;
  created_at: string;
}

const categoryRoute: Record<string, string> = {
  feature: "/dashboard",
  improvement: "/dashboard",
  fix: "/dashboard",
  announcement: "/dashboard",
};

export function WhatsNewModal() {
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<Entry[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user || cancelled) return;
        const { data, error } = await supabase.rpc("get_whats_new");
        if (error || cancelled) return;
        const list = ((data as any)?.entries || []) as Entry[];
        if (list.length > 0) {
          setEntries(list);
          setOpen(true);
        }
      } catch { /* ignore */ }
    })();
    return () => { cancelled = true; };
  }, []);

  const dismiss = async () => {
    setOpen(false);
    try { await supabase.rpc("mark_updates_seen"); } catch { /* ignore */ }
  };

  if (entries.length === 0) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) dismiss(); }}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="mx-auto h-12 w-12 rounded-full bg-gradient-to-br from-lumi-orange-1 to-lumi-pink-1 flex items-center justify-center mb-2">
            <Sparkles className="h-6 w-6 text-white" />
          </div>
          <DialogTitle className="text-center text-2xl">What's new in Lumi</DialogTitle>
          <DialogDescription className="text-center">
            {entries.length === 1 ? "A fresh update since you were last here." : `${entries.length} fresh updates since you were last here.`}
          </DialogDescription>
        </DialogHeader>

        <ul className="space-y-3 pt-2">
          {entries.map((e) => (
            <li key={e.id} className="rounded-lg border bg-muted/30 p-3">
              <div className="flex items-center gap-2 mb-1">
                <Badge variant="outline" className="text-xs capitalize">{e.category}</Badge>
                <span className="text-xs text-muted-foreground">
                  {new Date(e.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                </span>
              </div>
              <p className="font-semibold text-sm">{e.title}</p>
              {e.body && <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{e.body}</p>}
            </li>
          ))}
        </ul>

        <div className="flex gap-2 pt-3">
          <Button variant="outline" onClick={dismiss} className="flex-1">Maybe later</Button>
          <Button onClick={() => { dismiss(); window.location.href = "/dashboard"; }} className="flex-1">
            Try it out <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
