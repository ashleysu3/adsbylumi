import { useState } from "react";
import { Check, X, ExternalLink, Loader2, RotateCcw, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

interface PartnerApplication {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  website?: string;
  audience_description?: string;
  promotion_plan?: string;
  how_will_you_share?: string;
  status: string;
  application_type: string;
  rewardful_affiliate_id?: string;
  notes?: string;
  created_at: string;
  updated_at?: string;
}

interface PartnerApplicationDrawerProps {
  application: PartnerApplication | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApprove: (app: PartnerApplication, customMessage?: string) => Promise<void>;
  onDecline: (appId: string) => Promise<void>;
  onReconsider: (appId: string) => Promise<void>;
  onNoteSave: (appId: string, notes: string) => Promise<void>;
  actionLoading: string | null;
}

const statusStyles: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800",
  approved: "bg-green-100 text-green-800",
  declined: "bg-red-100 text-red-800",
};

export default function PartnerApplicationDrawer({
  application,
  open,
  onOpenChange,
  onApprove,
  onDecline,
  onReconsider,
  onNoteSave,
  actionLoading,
}: PartnerApplicationDrawerProps) {
  const [notes, setNotes] = useState("");
  const [customMessage, setCustomMessage] = useState("");
  const [declineConfirm, setDeclineConfirm] = useState(false);

  const app = application;
  if (!app) return null;

  const isLoading = actionLoading === app.id;

  const handleApprove = async () => {
    await onApprove(app, customMessage || undefined);
    setCustomMessage("");
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="sm:max-w-lg overflow-y-auto">
          <SheetHeader className="pb-4">
            <div className="flex items-center gap-3">
              <SheetTitle className="text-xl" style={{ fontFamily: "'Red Hat Display', sans-serif" }}>
                {app.first_name} {app.last_name}
              </SheetTitle>
              <Badge className={`${statusStyles[app.status] || "bg-muted text-muted-foreground"} border-0 capitalize`}>
                {app.status}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">{app.email}</p>
          </SheetHeader>

          <div className="space-y-6 pb-8">
            {/* Application Details */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Application Details</h3>

              <DetailField label="Applied" value={new Date(app.created_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })} />

              <DetailField
                label="Website"
                value={
                  app.website ? (
                    <a href={app.website} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">
                      {app.website} <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : "Not provided"
                }
              />

              <DetailField label="Audience Description" value={app.audience_description || "Not provided"} long />

              <DetailField label="Promotion Plan" value={app.promotion_plan || "Not provided"} long />

              <DetailField label="How They'll Share" value={app.how_will_you_share || "Not provided"} long />

              {app.rewardful_affiliate_id && (
                <DetailField label="Rewardful ID" value={<code className="text-xs bg-muted px-2 py-1 rounded">{app.rewardful_affiliate_id}</code>} />
              )}
            </div>

            <Separator />

            {/* Admin Notes */}
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Admin Notes</h3>
              <Textarea
                defaultValue={app.notes || ""}
                placeholder="Add internal notes about this application..."
                className="min-h-[80px]"
                onBlur={(e) => {
                  if (e.target.value !== (app.notes || "")) {
                    onNoteSave(app.id, e.target.value);
                  }
                }}
              />
            </div>

            <Separator />

            {/* Actions */}
            {app.status === "pending" && (
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Take Action</h3>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Custom Welcome Message <span className="text-muted-foreground font-normal">(optional)</span></label>
                  <Textarea
                    value={customMessage}
                    onChange={(e) => setCustomMessage(e.target.value)}
                    placeholder="Add a personal note that will be included in their welcome email..."
                    className="min-h-[100px]"
                  />
                  <p className="text-xs text-muted-foreground">This message will appear in their approval email, right after the welcome heading.</p>
                </div>

                <div className="flex gap-3">
                  <Button
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                    disabled={isLoading}
                    onClick={handleApprove}
                  >
                    {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Check className="h-4 w-4 mr-2" />}
                    Approve & Send Welcome Email
                  </Button>
                  <Button
                    variant="destructive"
                    disabled={isLoading}
                    onClick={() => setDeclineConfirm(true)}
                  >
                    <X className="h-4 w-4 mr-2" /> Decline
                  </Button>
                </div>
              </div>
            )}

            {app.status === "approved" && (
              <div className="rounded-lg bg-green-50 border border-green-200 p-4">
                <p className="text-sm text-green-800 font-medium">✅ This application has been approved.</p>
                {app.rewardful_affiliate_id && (
                  <p className="text-xs text-green-600 mt-1">Rewardful affiliate created: {app.rewardful_affiliate_id}</p>
                )}
              </div>
            )}

            {app.status === "declined" && (
              <div className="space-y-3">
                <div className="rounded-lg bg-red-50 border border-red-200 p-4">
                  <p className="text-sm text-red-800 font-medium">This application was declined.</p>
                </div>
                <Button
                  variant="outline"
                  disabled={isLoading}
                  onClick={() => onReconsider(app.id)}
                >
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RotateCcw className="h-4 w-4 mr-2" />}
                  Reconsider Application
                </Button>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Decline Confirmation */}
      <Dialog open={declineConfirm} onOpenChange={setDeclineConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Decline Application?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to decline the application from <strong>{app.first_name} {app.last_name}</strong>?
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeclineConfirm(false)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={isLoading}
              onClick={async () => {
                await onDecline(app.id);
                setDeclineConfirm(false);
              }}
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Decline
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function DetailField({ label, value, long }: { label: string; value: React.ReactNode; long?: boolean }) {
  return (
    <div>
      <p className="text-xs font-semibold text-muted-foreground mb-1">{label}</p>
      {long ? (
        <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{value}</p>
      ) : (
        <p className="text-sm text-foreground">{value}</p>
      )}
    </div>
  );
}
