import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Send, Bug, Camera, AlertCircle } from "lucide-react";

interface BugReportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  context?: string;
  recentMessages?: { role: string; content: string }[];
  userEmail?: string;
}

export function BugReportModal({ 
  open, 
  onOpenChange, 
  context = 'unknown',
  recentMessages = [],
  userEmail = ''
}: BugReportModalProps) {
  const [details, setDetails] = useState("");
  const [email, setEmail] = useState(userEmail);
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type and size
      if (!file.type.startsWith('image/')) {
        toast.error("Please upload an image file");
        return;
      }
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        toast.error("Image must be less than 5MB");
        return;
      }
      setScreenshot(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email.trim()) {
      toast.error("Please enter your email so we can follow up");
      return;
    }

    setIsSubmitting(true);

    try {
      // Convert screenshot to base64 if present
      let screenshotBase64 = null;
      let screenshotFilename = null;
      if (screenshot) {
        const reader = new FileReader();
        screenshotBase64 = await new Promise<string>((resolve) => {
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(screenshot);
        });
        screenshotFilename = screenshot.name;
      }

      // Get current page info
      const currentPage = window.location.pathname;
      const currentUrl = window.location.href;
      const userAgent = navigator.userAgent;
      const timestamp = new Date().toISOString();

      // Extract last few messages for context
      const conversationContext = recentMessages.slice(-6).map(m => 
        `${m.role === 'user' ? 'User' : 'Lumi'}: ${m.content.substring(0, 200)}${m.content.length > 200 ? '...' : ''}`
      ).join('\n\n');

      const { error } = await supabase.functions.invoke('send-bug-report', {
        body: {
          userEmail: email.trim(),
          details: details.trim(),
          context,
          currentPage,
          currentUrl,
          userAgent,
          timestamp,
          conversationContext,
          screenshot: screenshotBase64,
          screenshotFilename,
        }
      });

      if (error) throw error;

      toast.success("Bug report sent! We'll get back to you soon.", {
        description: "Thank you for helping us improve Lumi.",
      });
      
      // Reset form and close
      setDetails("");
      setScreenshot(null);
      onOpenChange(false);
    } catch (error) {
      console.error('Error sending bug report:', error);
      toast.error("Failed to send bug report", {
        description: "Please try emailing support@youradassistant.app directly.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bug className="h-5 w-5 text-destructive" />
            Report a Bug
          </DialogTitle>
          <DialogDescription>
            Help us fix issues by sharing what went wrong. We'll follow up via email.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Email */}
          <div className="space-y-2">
            <Label htmlFor="email">Your Email *</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <p className="text-xs text-muted-foreground">
              We'll use this to update you on the fix or ask follow-up questions.
            </p>
          </div>

          {/* Details */}
          <div className="space-y-2">
            <Label htmlFor="details">What happened?</Label>
            <Textarea
              id="details"
              placeholder="Describe what you were trying to do and what went wrong..."
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              rows={4}
              className="resize-none"
            />
          </div>

          {/* Screenshot */}
          <div className="space-y-2">
            <Label htmlFor="screenshot" className="flex items-center gap-2">
              <Camera className="h-4 w-4" />
              Screenshot (optional)
            </Label>
            <Input
              id="screenshot"
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="cursor-pointer"
            />
            {screenshot && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <AlertCircle className="h-4 w-4" />
                <span>{screenshot.name}</span>
                <Button 
                  type="button" 
                  variant="ghost" 
                  size="sm" 
                  className="h-auto p-1 text-xs"
                  onClick={() => setScreenshot(null)}
                >
                  Remove
                </Button>
              </div>
            )}
          </div>

          {/* Context info */}
          <div className="rounded-md bg-muted p-3 text-xs text-muted-foreground space-y-1">
            <p className="font-medium">We'll also include:</p>
            <ul className="list-disc list-inside space-y-0.5">
              <li>Current page: {window.location.pathname}</li>
              <li>Recent chat messages (last 6)</li>
              <li>Browser info</li>
            </ul>
          </div>

          {/* Submit */}
          <div className="flex gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting} className="flex-1 gap-2">
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  Send Report
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
