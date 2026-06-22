import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLumi } from "@/contexts/LumiContext";
import { isWorkPath } from "@/lib/work-routes";

/**
 * Floating "Return to what you were working on" button.
 *
 * Appears when Lumi has pulled the user out of a work-in-progress screen
 * (Creative Studio, Campaign Builder, Launch, Performance, etc.) and dropped
 * them on a setup/admin screen (Brand, Offers, Meta Settings, etc.).
 *
 * Auto-clears when the user reaches the saved path or navigates into any
 * other work screen on their own.
 */
export function ReturnToWorkButton() {
  const { interruptedWork, clearInterruptedWork } = useLumi();
  const location = useLocation();
  const navigate = useNavigate();

  // Auto-clear when user returns to the saved path or starts another piece of work.
  useEffect(() => {
    if (!interruptedWork) return;
    if (location.pathname === interruptedWork.path) {
      clearInterruptedWork();
      return;
    }
    // If they've navigated into a different work screen, drop the breadcrumb —
    // they've moved on and the old prompt would be stale.
    if (isWorkPath(location.pathname) && location.pathname !== interruptedWork.path) {
      clearInterruptedWork();
    }
  }, [location.pathname, interruptedWork, clearInterruptedWork]);

  return (
    <AnimatePresence>
      {interruptedWork && location.pathname !== interruptedWork.path && (
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.95 }}
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
          className="fixed z-40 bottom-24 left-4 md:bottom-6 md:left-6"
        >
          <div
            className="flex items-center gap-1 rounded-full border border-primary/20 bg-card/95 backdrop-blur-md shadow-lg pl-1 pr-1 py-1"
            style={{ boxShadow: '0 10px 30px -10px rgba(249, 115, 22, 0.25)' }}
          >
            <Button
              size="sm"
              onClick={() => {
                const path = interruptedWork.path;
                clearInterruptedWork();
                navigate(path);
              }}
              className="rounded-full gap-2 h-9 px-4 text-xs"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Return to {interruptedWork.label}
            </Button>
            <button
              onClick={clearInterruptedWork}
              className="h-7 w-7 flex items-center justify-center rounded-full hover:bg-muted text-muted-foreground"
              aria-label="Dismiss"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
