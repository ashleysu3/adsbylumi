import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Link2, Loader2, ExternalLink } from "lucide-react";

interface MetaAccountConnectProps {
  brandId: string;
  currentAccountId?: string | null;
  onUpdate: () => void;
}

export function MetaAccountConnect({ brandId, currentAccountId, onUpdate }: MetaAccountConnectProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [accountId, setAccountId] = useState(currentAccountId || "");

  const handleSave = async () => {
    if (!accountId.trim()) {
      toast.error("Please enter a Meta Ad Account ID");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('brands')
        .update({ meta_account_id: accountId })
        .eq('id', brandId);

      if (error) throw error;

      toast.success("Meta account connected successfully");
      onUpdate();
      setOpen(false);
    } catch (error: any) {
      console.error('Error connecting Meta account:', error);
      toast.error("Failed to connect Meta account");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {currentAccountId ? (
          <Button variant="outline" size="sm">
            <Link2 className="mr-2 h-4 w-4" />
            Change Account
          </Button>
        ) : (
          <Button variant="default" size="sm">
            <Link2 className="mr-2 h-4 w-4" />
            Connect Meta Account
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {currentAccountId ? "Change Meta Ad Account" : "Connect Meta Ad Account"}
          </DialogTitle>
          <DialogDescription>
            Enter your Meta Ad Account ID to enable campaign creation and management.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="accountId">Meta Ad Account ID</Label>
            <Input
              id="accountId"
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              placeholder="act_123456789"
            />
            <p className="text-xs text-muted-foreground">
              Find your Ad Account ID in{" "}
              <a
                href="https://business.facebook.com/settings/ad-accounts"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline inline-flex items-center gap-1"
              >
                Meta Business Settings
                <ExternalLink className="h-3 w-3" />
              </a>
            </p>
          </div>

          {currentAccountId && (
            <div className="rounded-lg bg-muted p-3 text-sm">
              <p className="font-medium mb-1">Current Account ID:</p>
              <code className="text-xs">{currentAccountId}</code>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              "Save"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
