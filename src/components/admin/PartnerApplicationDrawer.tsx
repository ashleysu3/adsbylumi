import { useState } from "react";
import { Check, X, ExternalLink, Loader2, RotateCcw, Mail, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

function escapeHtml(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getEmailPreviewHtml(firstNameRaw: string, customMessageRaw: string, referralLinkRaw: string, referralCodeRaw: string) {
  const firstName = escapeHtml(firstNameRaw);
  const customMessage = escapeHtml(customMessageRaw);
  const referralLink = escapeHtml(referralLinkRaw);
  const referralCode = escapeHtml(referralCodeRaw);
  const trialCode = escapeHtml(firstNameRaw.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 10) + '14');
  return `
<div style="font-family: 'Red Hat Display', Arial, sans-serif; background: #FAF9F6; padding: 24px; border-radius: 12px;">
  <div style="background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 12px rgba(0,0,0,0.06);">
    <div style="height: 4px; background: linear-gradient(90deg, #F97316, #EC4899, #A78BFA, #93C5FD);"></div>
    <div style="padding: 24px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
        <strong style="font-size: 14px;">LUMI</strong>
        <span style="display: inline-block; padding: 2px 10px; border-radius: 20px; font-size: 10px; font-weight: 700; color: #fff; background: linear-gradient(135deg, #F97316, #EC4899);">PARTNER</span>
      </div>
      <h2 style="margin: 0 0 8px; font-size: 20px; font-weight: 800; color: #111;">Welcome to the team, ${firstName}! 🎉</h2>
      ${customMessage ? `
      <div style="margin: 0 0 16px; padding: 12px 16px; background: #FFF7ED; border-radius: 8px; border-left: 3px solid #F97316;">
        <p style="margin: 0; font-size: 13px; color: #333; font-style: italic;">"${customMessage}"</p>
        <p style="margin: 6px 0 0; font-size: 11px; color: #999;">— The LUMI Team</p>
      </div>` : ''}
      <p style="font-size: 13px; color: #555; line-height: 1.6; margin: 0 0 16px;">
        Your application has been approved. You now earn <strong>30% recurring monthly commission</strong> on every subscription you refer.
      </p>
      <div style="background: linear-gradient(135deg, #ECFDF5, #F0FDF4); border-radius: 10px; border: 2px solid #86EFAC; padding: 14px 18px; margin-bottom: 16px;">
        <p style="margin: 0 0 4px; font-size: 10px; font-weight: 700; color: #16A34A; text-transform: uppercase; letter-spacing: 1px;">🎁 Your Partner Trial Code</p>
        <p style="margin: 0 0 6px; font-size: 22px; font-weight: 800; color: #111; letter-spacing: 2px;">${trialCode}</p>
        <p style="margin: 0; font-size: 12px; color: #555;">Share this code — your audience gets a <strong>14-day free trial</strong>, you earn commission when they convert.</p>
      </div>
      <div style="background: linear-gradient(135deg, #FFF7ED, #FDF2F8); border-radius: 10px; border: 1px solid #FECDD3; padding: 14px 18px; margin-bottom: 16px;">
        <p style="margin: 0 0 4px; font-size: 10px; font-weight: 700; color: #F97316; text-transform: uppercase; letter-spacing: 1px;">Your Referral Link</p>
        <p style="margin: 0; font-size: 13px; font-weight: 600; color: #111; word-break: break-all;">${referralLink || '[generated on approval]'}</p>
        ${referralCode ? `<p style="margin: 6px 0 0; font-size: 12px; color: #666;">Code: <strong>${referralCode}</strong></p>` : ''}
      </div>
      <div style="text-align: center; margin-bottom: 16px;">
        <span style="display: inline-block; padding: 10px 28px; border-radius: 8px; font-size: 13px; font-weight: 700; color: #fff; background: linear-gradient(135deg, #F97316, #EC4899);">
          Open Your Partner Dashboard →
        </span>
      </div>
      <hr style="border: none; border-top: 1px solid #F0EDE8; margin: 16px 0;" />
      
      <p style="font-size: 16px; font-weight: 800; color: #111; margin: 0 0 6px;">📞 Let's Get You Set Up for Success</p>
      <p style="font-size: 12px; color: #555; line-height: 1.5; margin: 0 0 12px;">Book a 1:1 onboarding call so we can walk you through everything and set you up to earn from day one.</p>
      <div style="text-align: center; margin-bottom: 16px;">
        <span style="display: inline-block; padding: 10px 28px; border-radius: 8px; font-size: 13px; font-weight: 700; color: #fff; background: linear-gradient(135deg, #A78BFA, #6366F1);">
          Book Your Partner Setup Call →
        </span>
      </div>
      <hr style="border: none; border-top: 1px solid #F0EDE8; margin: 16px 0;" />

      <p style="font-size: 16px; font-weight: 800; color: #111; margin: 0 0 6px;">🎤 We'll Come Speak to Your Community</p>
      <p style="font-size: 12px; color: #555; line-height: 1.5; margin: 0 0 12px;">Want to offer your audience a masterclass on Meta ads? We'll come speak in your community — group call, membership, podcast, or live event. Your audience gets expert ads education, you earn commission on every signup.</p>
      <hr style="border: none; border-top: 1px solid #F0EDE8; margin: 16px 0;" />

      <p style="font-size: 14px; font-weight: 800; color: #111; margin: 0 0 8px;">📦 Your Marketing Kit</p>
      <div style="background: #FAFAF8; border-radius: 8px; border: 1px solid #F0EDE8; padding: 12px 14px; margin-bottom: 8px;">
        <p style="margin: 0 0 4px; font-size: 10px; font-weight: 700; color: #F97316; text-transform: uppercase;">📱 Social Post</p>
        <p style="margin: 0; font-size: 12px; color: #444; line-height: 1.5;">I've been recommending LUMI to my audience and they love it...</p>
      </div>
      <div style="background: #FAFAF8; border-radius: 8px; border: 1px solid #F0EDE8; padding: 12px 14px; margin-bottom: 8px;">
        <p style="margin: 0 0 4px; font-size: 10px; font-weight: 700; color: #A78BFA; text-transform: uppercase;">✉️ Email / Newsletter</p>
        <p style="margin: 0; font-size: 12px; color: #444; line-height: 1.5;">Quick recommendation: There's a tool called LUMI...</p>
      </div>
      <div style="background: #FAFAF8; border-radius: 8px; border: 1px solid #F0EDE8; padding: 12px 14px; margin-bottom: 8px;">
        <p style="margin: 0 0 4px; font-size: 10px; font-weight: 700; color: #EC4899; text-transform: uppercase;">💬 DM / Story</p>
        <p style="margin: 0; font-size: 12px; color: #444; line-height: 1.5;">Have you tried LUMI for your ads? It's a game-changer...</p>
      </div>
      <div style="background: #FAFAF8; border-radius: 8px; border: 1px solid #F0EDE8; padding: 12px 14px;">
        <p style="margin: 0 0 4px; font-size: 10px; font-weight: 700; color: #93C5FD; text-transform: uppercase;">🎬 Story / Reel Script</p>
        <p style="margin: 0; font-size: 12px; color: #444; line-height: 1.5;">"If you've been wanting to run Meta ads but have no idea where to start — let me introduce you to LUMI..."</p>
      </div>
    </div>
  </div>
</div>`;
}

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
  const [customMessage, setCustomMessage] = useState("");
  const [declineConfirm, setDeclineConfirm] = useState(false);
  const [activeTab, setActiveTab] = useState("details");

  const app = application;
  if (!app) return null;

  const isLoading = actionLoading === app.id;

  const handleApprove = async () => {
    await onApprove(app, customMessage || undefined);
    setCustomMessage("");
    setActiveTab("details");
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="sm:max-w-xl overflow-y-auto">
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

          <Tabs value={activeTab} onValueChange={setActiveTab} className="pb-8">
            <TabsList className="w-full mb-4">
              <TabsTrigger value="details" className="flex-1 text-xs">Application</TabsTrigger>
              {app.status === "pending" && (
                <TabsTrigger value="email-preview" className="flex-1 text-xs">
                  <Mail className="h-3 w-3 mr-1" /> Email Preview
                </TabsTrigger>
              )}
            </TabsList>

            <TabsContent value="details" className="space-y-6">
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
                    <p className="text-xs text-muted-foreground">This message will appear in their approval email. Preview it in the "Email Preview" tab above.</p>
                  </div>

                  <div className="flex gap-3">
                    <Button
                      className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                      disabled={isLoading}
                      onClick={handleApprove}
                    >
                      {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Check className="h-4 w-4 mr-2" />}
                      Approve & Send Email
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
            </TabsContent>

            {app.status === "pending" && (
              <TabsContent value="email-preview" className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Approval Email Preview</h3>
                  <Badge variant="outline" className="text-xs">
                    <Mail className="h-3 w-3 mr-1" /> To: {app.email}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  This is a preview of the email that will be sent when you approve. Edit the custom message on the Application tab to update it here.
                </p>

                {/* Live preview */}
                <div
                  className="border border-border rounded-lg overflow-hidden text-sm"
                  dangerouslySetInnerHTML={{
                    __html: getEmailPreviewHtml(
                      app.first_name,
                      customMessage,
                      '[referral-link]',
                      '[referral-code]'
                    ),
                  }}
                />

                <div className="flex gap-3 pt-2">
                  <Button
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                    disabled={isLoading}
                    onClick={handleApprove}
                  >
                    {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Check className="h-4 w-4 mr-2" />}
                    Approve & Send This Email
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setActiveTab("details")}
                  >
                    Back to Details
                  </Button>
                </div>
              </TabsContent>
            )}
          </Tabs>
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
