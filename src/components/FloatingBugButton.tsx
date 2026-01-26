import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { BugReportModal } from "./BugReportModal";
import { LumiTooltip } from "./LumiTooltip";
import { supabase } from "@/integrations/supabase/client";
import { useLocation } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";

export function FloatingBugButton() {
  const isMobile = useIsMobile();
  
  // Hide on mobile to avoid blocking content
  if (isMobile) return null;
  const [bugReportOpen, setBugReportOpen] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  const location = useLocation();

  useEffect(() => {
    const fetchUserEmail = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.email) {
        setUserEmail(user.email);
      }
    };
    fetchUserEmail();
  }, []);

  const context = location.pathname;

  return (
    <>
      <LumiTooltip content="Report a bug" side="top">
        <motion.button
          onClick={() => setBugReportOpen(true)}
          className="fixed bottom-4 left-4 z-50 group"
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 1, type: "spring", stiffness: 200 }}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
        >
          {/* Ladybug body */}
          <div className="relative w-8 h-8">
            {/* Shadow */}
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-6 h-1.5 bg-black/10 rounded-full blur-sm" />
            
            {/* Body */}
            <motion.div 
              className="absolute inset-0 bg-gradient-to-br from-red-500 to-red-600 rounded-full shadow-md"
              animate={{ 
                y: [0, -1, 0],
              }}
              transition={{ 
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut"
              }}
            >
              {/* Head */}
              <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-3 h-2.5 bg-gray-900 rounded-t-full" />
              
              {/* Antennae */}
              <div className="absolute -top-2 left-1/2 -translate-x-[8px] w-0.5 h-1.5 bg-gray-900 rounded-full rotate-[-20deg]" />
              <div className="absolute -top-2 left-1/2 translate-x-[5px] w-0.5 h-1.5 bg-gray-900 rounded-full rotate-[20deg]" />
              
              {/* Center line */}
              <div className="absolute top-1 left-1/2 -translate-x-[0.5px] w-[1px] h-5 bg-gray-900" />
              
              {/* Spots */}
              <div className="absolute top-2 left-1.5 w-1.5 h-1.5 bg-gray-900 rounded-full" />
              <div className="absolute top-2 right-1.5 w-1.5 h-1.5 bg-gray-900 rounded-full" />
              <div className="absolute top-4 left-2 w-1 h-1 bg-gray-900 rounded-full" />
              <div className="absolute top-4 right-2 w-1 h-1 bg-gray-900 rounded-full" />
              <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 w-1 h-1 bg-gray-900 rounded-full" />
              
              {/* Shine */}
              <div className="absolute top-1 right-1 w-1 h-1 bg-white/40 rounded-full" />
            </motion.div>
            
            {/* Little legs that wiggle on hover */}
            <motion.div 
              className="absolute bottom-0 left-0.5 w-0.5 h-1 bg-gray-900 rounded-full origin-top"
              animate={{ rotate: [-5, 5, -5] }}
              transition={{ duration: 0.3, repeat: Infinity }}
            />
            <motion.div 
              className="absolute bottom-0 right-0.5 w-0.5 h-1 bg-gray-900 rounded-full origin-top"
              animate={{ rotate: [5, -5, 5] }}
              transition={{ duration: 0.3, repeat: Infinity }}
            />
          </div>
        </motion.button>
      </LumiTooltip>

      <BugReportModal 
        open={bugReportOpen} 
        onOpenChange={setBugReportOpen}
        context={context}
        userEmail={userEmail}
      />
    </>
  );
}
