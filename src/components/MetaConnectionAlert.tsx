import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, X, RefreshCw, Link2Off, Wifi } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface MetaConnectionAlertProps {
  type: "disconnected" | "expired" | "not_connected";
  onDismiss?: () => void;
  className?: string;
}

const alertConfig = {
  disconnected: {
    icon: Link2Off,
    title: "Meta Connection Lost",
    description: "Your Meta ad account has been disconnected. Reconnect to continue syncing your campaign data.",
    buttonLabel: "Reconnect Now",
    color: "destructive" as const,
  },
  expired: {
    icon: RefreshCw,
    title: "Meta Token Expired",
    description: "Your Meta access token has expired. Please reconnect to continue viewing insights and managing campaigns.",
    buttonLabel: "Refresh Connection",
    color: "destructive" as const,
  },
  not_connected: {
    icon: Wifi,
    title: "Connect Your Meta Account",
    description: "Link your Meta ad account to unlock campaign insights, performance tracking, and publishing features.",
    buttonLabel: "Connect Meta",
    color: "warning" as const,
  },
};

export function MetaConnectionAlert({ type, onDismiss, className }: MetaConnectionAlertProps) {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(true);
  const config = alertConfig[type];
  const Icon = config.icon;

  const handleAction = () => {
    navigate("/dashboard");
    setIsOpen(false);
    onDismiss?.();
  };

  const handleDismiss = () => {
    setIsOpen(false);
    onDismiss?.();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <Dialog open={isOpen} onOpenChange={(open) => {
          if (!open) handleDismiss();
        }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <div className="flex items-center gap-3 mb-2">
                <div className={cn(
                  "p-3 rounded-full",
                  config.color === "destructive" ? "bg-destructive/10" : "bg-amber-500/10"
                )}>
                  <Icon className={cn(
                    "h-6 w-6",
                    config.color === "destructive" ? "text-destructive" : "text-amber-500"
                  )} />
                </div>
                <DialogTitle className="text-xl">{config.title}</DialogTitle>
              </div>
              <DialogDescription className="text-base">
                {config.description}
              </DialogDescription>
            </DialogHeader>
            
            <div className="flex flex-col gap-3 mt-4">
              <Button 
                onClick={handleAction}
                variant={config.color === "destructive" ? "default" : "lumi"}
                className="w-full"
              >
                <Icon className="h-4 w-4 mr-2" />
                {config.buttonLabel}
              </Button>
              <Button 
                variant="ghost" 
                onClick={handleDismiss}
                className="w-full text-muted-foreground"
              >
                Remind me later
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </AnimatePresence>
  );
}

// Inline banner version for pages
export function MetaConnectionBanner({ type, onDismiss, className }: MetaConnectionAlertProps) {
  const navigate = useNavigate();
  const [isDismissed, setIsDismissed] = useState(false);
  const config = alertConfig[type];
  const Icon = config.icon;

  if (isDismissed) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className={className}
    >
      <Card className={cn(
        "p-4 border-2",
        config.color === "destructive" 
          ? "border-destructive/30 bg-destructive/5" 
          : "border-amber-500/30 bg-amber-500/5"
      )}>
        <div className="flex items-start gap-4">
          <div className={cn(
            "p-2 rounded-full shrink-0",
            config.color === "destructive" ? "bg-destructive/10" : "bg-amber-500/10"
          )}>
            <Icon className={cn(
              "h-5 w-5",
              config.color === "destructive" ? "text-destructive" : "text-amber-500"
            )} />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className={cn(
              "font-semibold mb-1",
              config.color === "destructive" ? "text-destructive" : "text-amber-700"
            )}>
              {config.title}
            </h4>
            <p className="text-sm text-muted-foreground mb-3">
              {config.description}
            </p>
            <div className="flex items-center gap-2">
              <Button 
                size="sm"
                variant={config.color === "destructive" ? "destructive" : "default"}
                onClick={() => navigate("/dashboard")}
              >
                <Icon className="h-4 w-4 mr-2" />
                {config.buttonLabel}
              </Button>
              <Button 
                size="sm"
                variant="ghost"
                onClick={() => {
                  setIsDismissed(true);
                  onDismiss?.();
                }}
              >
                Dismiss
              </Button>
            </div>
          </div>
          <button
            onClick={() => {
              setIsDismissed(true);
              onDismiss?.();
            }}
            className="text-muted-foreground hover:text-foreground transition-colors p-1"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </Card>
    </motion.div>
  );
}
