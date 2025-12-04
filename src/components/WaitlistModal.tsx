import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, CheckCircle } from "lucide-react";
import lumiBulb from "@/assets/lumi-bulb.png";

interface WaitlistModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function WaitlistModal({ open, onOpenChange }: WaitlistModalProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim() || !email.trim()) {
      toast.error("Please fill in all fields");
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase
        .from("waitlist")
        .insert({ name: name.trim(), email: email.trim().toLowerCase() });

      if (error) {
        if (error.code === "23505") {
          toast.error("You're already on the waitlist! We'll be in touch soon.");
        } else {
          throw error;
        }
      } else {
        setSuccess(true);
        toast.success("You're on the list! ✨");
      }
    } catch (error: any) {
      toast.error(error.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    // Reset state after modal closes
    setTimeout(() => {
      setSuccess(false);
      setName("");
      setEmail("");
    }, 300);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md bg-background border-border rounded-3xl p-0 overflow-hidden">
        <AnimatePresence mode="wait">
          {!success ? (
            <motion.div
              key="form"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="p-8"
            >
              {/* Lumi Bulb */}
              <motion.div
                className="flex justify-center mb-4"
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.1 }}
              >
                <div className="relative">
                  <img src={lumiBulb} alt="Lumi" className="w-16 h-16 object-contain" />
                  <motion.div
                    className="absolute inset-0 bg-primary/20 rounded-full blur-xl"
                    animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0.8, 0.5] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  />
                </div>
              </motion.div>

              <DialogHeader className="text-center space-y-2">
                <DialogTitle className="font-display text-2xl sm:text-3xl text-foreground">
                  Ready to Light Things Up?
                </DialogTitle>
                <DialogDescription className="text-muted-foreground text-base">
                  Join the waitlist and be the first to know when Lumi launches.
                </DialogDescription>
              </DialogHeader>

              <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="waitlist-name" className="text-foreground">Name</Label>
                  <Input
                    id="waitlist-name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your name"
                    className="h-12 rounded-xl bg-muted/50 border-border focus:border-primary"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="waitlist-email" className="text-foreground">Email</Label>
                  <Input
                    id="waitlist-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="h-12 rounded-xl bg-muted/50 border-border focus:border-primary"
                    required
                  />
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full h-12 text-base font-semibold rounded-xl shadow-lumi lumi-button-glow mt-6"
                >
                  {loading ? (
                    <motion.div
                      className="flex items-center gap-2"
                      animate={{ opacity: [1, 0.5, 1] }}
                      transition={{ duration: 1, repeat: Infinity }}
                    >
                      <Sparkles className="w-5 h-5" />
                      Adding you...
                    </motion.div>
                  ) : (
                    <>
                      <Sparkles className="w-5 h-5 mr-2" />
                      Light Me Up ✨
                    </>
                  )}
                </Button>
              </form>

              <p className="text-center text-xs text-muted-foreground mt-4">
                No spam, ever. Just Lumi goodness.
              </p>
            </motion.div>
          ) : (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="p-8 text-center"
            >
              {/* Success Animation */}
              <motion.div
                className="flex justify-center mb-6"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
              >
                <div className="relative">
                  <motion.div
                    className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center"
                    animate={{ scale: [1, 1.1, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                    <CheckCircle className="w-10 h-10 text-primary" />
                  </motion.div>
                  <motion.div
                    className="absolute inset-0 bg-primary/30 rounded-full blur-2xl"
                    animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0.2, 0.5] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  />
                </div>
              </motion.div>

              <DialogHeader className="space-y-2">
                <DialogTitle className="font-display text-2xl sm:text-3xl text-foreground">
                  You're In! 🎉
                </DialogTitle>
                <DialogDescription className="text-muted-foreground text-base">
                  Welcome to the Lumi family, {name.split(' ')[0]}! We'll let you know as soon as it's your turn to shine.
                </DialogDescription>
              </DialogHeader>

              <Button
                onClick={handleClose}
                variant="outline"
                className="mt-6 rounded-xl"
              >
                Close
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}