 import { useState, useEffect } from "react";
 import { supabase } from "@/integrations/supabase/client";
 import { X } from "lucide-react";
 import { Button } from "@/components/ui/button";
 import { cn } from "@/lib/utils";
 
 interface AnnouncementBanner {
   enabled: boolean;
   text: string;
   linkText?: string;
   linkUrl?: string;
   style: 'brand' | 'info' | 'warning' | 'success' | 'custom';
   customColors?: {
     background: string;
     text: string;
     linkText?: string;
   };
   dismissible: boolean;
   expiresAt?: string;
 }
 
 const defaultBanner: AnnouncementBanner = {
   enabled: false,
   text: "",
   style: "brand",
   dismissible: true,
 };
 
 export function GlobalAnnouncementBanner() {
   const [banner, setBanner] = useState<AnnouncementBanner | null>(null);
   const [dismissed, setDismissed] = useState(false);
   const [loading, setLoading] = useState(true);
 
   useEffect(() => {
     // Check localStorage for dismissal
     const dismissedKey = "announcement_banner_dismissed";
     const dismissedData = localStorage.getItem(dismissedKey);
     if (dismissedData) {
       try {
         const parsed = JSON.parse(dismissedData);
         // Check if dismissal is still valid (within 24 hours or same text)
         if (parsed.timestamp && Date.now() - parsed.timestamp < 24 * 60 * 60 * 1000) {
           setDismissed(true);
         } else {
           localStorage.removeItem(dismissedKey);
         }
       } catch {
         localStorage.removeItem(dismissedKey);
       }
     }
 
     fetchBanner();
 
     // Subscribe to realtime updates
     const channel = supabase
       .channel('site_settings_changes')
       .on(
         'postgres_changes',
         {
           event: '*',
           schema: 'public',
           table: 'site_settings',
           filter: 'key=eq.announcement_banner',
         },
         () => {
           fetchBanner();
           // Reset dismissal on banner update
           setDismissed(false);
           localStorage.removeItem("announcement_banner_dismissed");
         }
       )
       .subscribe();
 
     return () => {
       supabase.removeChannel(channel);
     };
   }, []);
 
   const fetchBanner = async () => {
     try {
       const { data, error } = await supabase
         .from("site_settings")
         .select("value")
         .eq("key", "announcement_banner")
         .single();
 
       if (error) {
         if (error.code !== "PGRST116") {
           console.error("Failed to fetch banner:", error);
         }
         setBanner(null);
       } else {
         const bannerData = (data?.value as unknown) as AnnouncementBanner || defaultBanner;
         
         // Check expiration
         if (bannerData.expiresAt && new Date(bannerData.expiresAt) < new Date()) {
           setBanner(null);
         } else {
           setBanner(bannerData);
         }
       }
     } catch (error) {
       console.error("Failed to fetch banner:", error);
       setBanner(null);
     } finally {
       setLoading(false);
     }
   };
 
   const handleDismiss = () => {
     setDismissed(true);
     localStorage.setItem("announcement_banner_dismissed", JSON.stringify({
       timestamp: Date.now(),
       text: banner?.text,
     }));
   };
 
   // Don't render if loading, no banner, not enabled, or dismissed
   if (loading || !banner || !banner.enabled || !banner.text || dismissed) {
     return null;
   }
 
   const getStyleClasses = () => {
     switch (banner.style) {
       case 'brand':
         return "bg-gradient-to-r from-[hsl(24,95%,53%)] via-[hsl(330,81%,60%)] to-[hsl(270,60%,70%)] text-white";
       case 'info':
         return "bg-[hsl(215,75%,70%/0.2)] text-[hsl(215,75%,40%)] dark:text-[hsl(215,75%,70%)]";
       case 'warning':
         return "bg-amber-500/10 text-amber-700 dark:text-amber-400";
       case 'success':
         return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400";
       case 'custom':
         return "";
       default:
         return "bg-gradient-to-r from-[hsl(24,95%,53%)] via-[hsl(330,81%,60%)] to-[hsl(270,60%,70%)] text-white";
     }
   };
 
   const customStyles = banner.style === 'custom' && banner.customColors ? {
     backgroundColor: banner.customColors.background,
     color: banner.customColors.text,
   } : {};
 
   return (
     <div
       className={cn(
         "w-full py-2 px-4 text-center text-sm font-medium relative",
         getStyleClasses()
       )}
       style={customStyles}
     >
       <div className="flex items-center justify-center gap-2">
         <span>{banner.text}</span>
         {banner.linkText && banner.linkUrl && (
           <a
             href={banner.linkUrl}
             className={cn(
               "underline underline-offset-2 font-semibold hover:opacity-80 transition-opacity",
               banner.style === 'custom' && banner.customColors?.linkText 
                 ? "" 
                 : ""
             )}
             style={banner.style === 'custom' && banner.customColors?.linkText 
               ? { color: banner.customColors.linkText } 
               : {}
             }
           >
             {banner.linkText}
           </a>
         )}
       </div>
       {banner.dismissible && (
         <Button
           variant="ghost"
           size="sm"
           onClick={handleDismiss}
           className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 p-0 hover:bg-white/20"
         >
           <X className="h-4 w-4" />
         </Button>
       )}
     </div>
   );
 }