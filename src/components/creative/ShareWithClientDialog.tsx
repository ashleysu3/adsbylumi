import { useState, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Share2, Copy, ChevronDown, Loader2, RefreshCw, Check, Video, Film, Image } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ProductionItem } from "./ProductionChecklistPanel";

interface ShareWithClientDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspace: any;
  productionItems: ProductionItem[];
  brandId?: string;
  onPortalCreated?: () => void;
}

const formatLabels: Record<string, string> = {
  talking_head: "Talking Head",
  broll: "B-Roll",
  graphic: "Graphic",
};

const formatIcons: Record<string, typeof Video> = {
  talking_head: Video,
  broll: Film,
  graphic: Image,
};

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

async function hashCode(code: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(code);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export function ShareWithClientDialog({
  open,
  onOpenChange,
  workspace,
  productionItems,
  brandId,
  onPortalCreated,
}: ShareWithClientDialogProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [portalName, setPortalName] = useState(workspace?.name || "");
  const [clientName, setClientName] = useState("");
  const [accessCode, setAccessCode] = useState(() => generateCode());
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set(productionItems.map(i => i.id)));
  const [brandingOpen, setBrandingOpen] = useState(false);
  const [agencyName, setAgencyName] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#F97316");
  const [showPoweredBy, setShowPoweredBy] = useState(true);
  const [creating, setCreating] = useState(false);
  const [portalUrl, setPortalUrl] = useState("");
  const [copied, setCopied] = useState<'link' | 'code' | null>(null);

  useEffect(() => {
    if (open) {
      setStep(1);
      setPortalName(workspace?.name || "");
      setAccessCode(generateCode());
      setSelectedItemIds(new Set(productionItems.map(i => i.id)));
      setPortalUrl("");
    }
  }, [open]);

  const toggleItem = (id: string) => {
    setSelectedItemIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleCreate = async () => {
    if (!portalName.trim() || !accessCode.trim() || selectedItemIds.size === 0) {
      toast.error("Please fill in all required fields and select at least one item");
      return;
    }

    setCreating(true);
    try {
      const codeHash = await hashCode(accessCode);

      const { data: user } = await supabase.auth.getUser();
      if (!user?.user?.id) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from('client_portals')
        .insert({
          workspace_id: workspace.id,
          brand_id: brandId || workspace.brand_id,
          created_by: user.user.id,
          access_code_hash: codeHash,
          portal_name: portalName.trim(),
          client_name: clientName.trim() || null,
          agency_branding: {
            agency_name: agencyName || undefined,
            logo_url: logoUrl || null,
            primary_color: primaryColor,
            show_powered_by_lumi: showPoweredBy,
          },
          items_included: Array.from(selectedItemIds),
        })
        .select('id')
        .single();

      if (error) throw error;

      setPortalUrl(`https://adsbylumi.com/client-portal/${data.id}`);
      setStep(2);
      onPortalCreated?.();
      toast.success("Client portal created!");
    } catch (e: any) {
      console.error("Portal creation error:", e);
      toast.error(e.message || "Failed to create portal");
    } finally {
      setCreating(false);
    }
  };

  const copyToClipboard = (text: string, type: 'link' | 'code') => {
    navigator.clipboard.writeText(text);
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
    toast.success(type === 'link' ? 'Link copied!' : 'Code copied!');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5" />
            {step === 1 ? "Share with Client" : "Portal Ready!"}
          </DialogTitle>
          <DialogDescription>
            {step === 1
              ? "Create a password-protected portal for your client to review and approve creative."
              : "Share this link and access code with your client."}
          </DialogDescription>
        </DialogHeader>

        {step === 1 && (
          <div className="space-y-4">
            {/* Portal Name */}
            <div className="space-y-1.5">
              <Label>Portal Name</Label>
              <Input
                value={portalName}
                onChange={(e) => setPortalName(e.target.value)}
                placeholder="e.g. Spring Campaign Creative"
              />
            </div>

            {/* Client Name */}
            <div className="space-y-1.5">
              <Label>Client Name <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <Input
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="e.g. Sarah"
              />
            </div>

            {/* Access Code */}
            <div className="space-y-1.5">
              <Label>Access Code</Label>
              <div className="flex gap-2">
                <Input
                  value={accessCode}
                  onChange={(e) => setAccessCode(e.target.value.toUpperCase())}
                  className="font-mono tracking-widest"
                  maxLength={8}
                />
                <Button variant="outline" size="icon" onClick={() => setAccessCode(generateCode())}>
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">You'll share this code with your client separately.</p>
            </div>

            {/* Item Selection */}
            <div className="space-y-2">
              <Label>Items to Include</Label>
              <div className="max-h-48 overflow-y-auto space-y-1 border rounded-lg p-2">
                {productionItems.map((item) => {
                  const Icon = formatIcons[item.format] || Image;
                  return (
                    <label
                      key={item.id}
                      className="flex items-center gap-2 p-1.5 rounded hover:bg-muted/50 cursor-pointer"
                    >
                      <Checkbox
                        checked={selectedItemIds.has(item.id)}
                        onCheckedChange={() => toggleItem(item.id)}
                      />
                      <Icon className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                      <Badge variant="secondary" className="text-[10px]">
                        {formatLabels[item.format] || item.format}
                      </Badge>
                      <span className="text-sm truncate">{item.hook}</span>
                    </label>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground">
                {selectedItemIds.size} of {productionItems.length} selected
              </p>
            </div>

            {/* Branding */}
            <Collapsible open={brandingOpen} onOpenChange={setBrandingOpen}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="w-full justify-between text-sm text-muted-foreground">
                  Customize Branding
                  <ChevronDown className={`h-4 w-4 transition-transform ${brandingOpen ? 'rotate-180' : ''}`} />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-3 pt-2">
                <div className="space-y-1.5">
                  <Label className="text-xs">Agency Name</Label>
                  <Input
                    value={agencyName}
                    onChange={(e) => setAgencyName(e.target.value)}
                    placeholder="Your agency name"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Logo URL</Label>
                  <Input
                    value={logoUrl}
                    onChange={(e) => setLogoUrl(e.target.value)}
                    placeholder="https://..."
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Primary Color</Label>
                  <div className="flex gap-2 items-center">
                    <input
                      type="color"
                      value={primaryColor}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      className="h-8 w-8 rounded cursor-pointer border"
                    />
                    <Input
                      value={primaryColor}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      className="flex-1 font-mono text-sm"
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Show "Powered by LUMI"</Label>
                  <Switch checked={showPoweredBy} onCheckedChange={setShowPoweredBy} />
                </div>
              </CollapsibleContent>
            </Collapsible>

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button onClick={handleCreate} disabled={creating} className="gap-1">
                {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4" />}
                Create Portal
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-5">
            {/* Link */}
            <div className="space-y-2">
              <Label>Portal Link</Label>
              <div className="flex gap-2">
                <Input value={portalUrl} readOnly className="text-sm" />
                <Button variant="outline" size="icon" onClick={() => copyToClipboard(portalUrl, 'link')}>
                  {copied === 'link' ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            {/* Access Code */}
            <div className="space-y-2">
              <Label>Access Code</Label>
              <div className="flex gap-2">
                <div className="flex-1 bg-muted rounded-lg px-4 py-3 font-mono text-lg tracking-[0.3em] text-center font-bold">
                  {accessCode}
                </div>
                <Button variant="outline" size="icon" onClick={() => copyToClipboard(accessCode, 'code')}>
                  {copied === 'code' ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <div className="bg-muted/50 rounded-lg p-3 text-sm text-muted-foreground">
              <p>Send this link and code to your client via email or DM. They don't need a LUMI account.</p>
            </div>

            <DialogFooter>
              <Button onClick={() => onOpenChange(false)}>Done</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
