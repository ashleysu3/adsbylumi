import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Lightbulb, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface LumiEducationCardProps {
  cardId: string;
  headline: string;
  body: string;
}

export function LumiEducationCard({ cardId, headline, body }: LumiEducationCardProps) {
  const storageKey = `lumi-education-dismissed-${cardId}`;
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    const wasDismissed = localStorage.getItem(storageKey);
    setDismissed(wasDismissed === "true");
  }, [storageKey]);

  const handleDismiss = () => {
    localStorage.setItem(storageKey, "true");
    setDismissed(true);
  };

  if (dismissed) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
      >
        <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-accent/5">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Lightbulb className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <h4 className="font-semibold text-sm">{headline}</h4>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 flex-shrink-0 text-muted-foreground hover:text-foreground"
                    onClick={handleDismiss}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground mt-1">{body}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </AnimatePresence>
  );
}
