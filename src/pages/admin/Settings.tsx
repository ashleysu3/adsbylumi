 import { useState, useEffect } from "react";
 import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
 import DashboardLayout from "@/components/DashboardLayout";
 import AdminTabs from "@/components/AdminTabs";
 import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
 import { Button } from "@/components/ui/button";
 import { Input } from "@/components/ui/input";
 import { Label } from "@/components/ui/label";
 import { Switch } from "@/components/ui/switch";
 import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Megaphone, Save, Eye } from "lucide-react";

 import { toast } from "sonner";
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
 
 export default function AdminSettings() {
   const [banner, setBanner] = useState<AnnouncementBanner>(defaultBanner);
   const [loading, setLoading] = useState(true);
   const [saving, setSaving] = useState(false);
 
   useEffect(() => {
     fetchBanner();
   }, []);
 
   const fetchBanner = async () => {
     try {
       const { data, error } = await supabase
         .from("site_settings")
         .select("value")
         .eq("key", "announcement_banner")
         .single();
 
       if (error && error.code !== "PGRST116") {
         throw error;
       }
 
       if (data?.value) {
        setBanner(data.value as unknown as AnnouncementBanner);
       }
     } catch (error: any) {
       console.error("Failed to fetch banner:", error);
       toast.error("Failed to load banner settings");
     } finally {
       setLoading(false);
     }
   };
 
   const handleSave = async () => {
     setSaving(true);
     try {
      // First try to update
      const { data: existing } = await supabase
         .from("site_settings")
        .select("id")
        .eq("key", "announcement_banner")
        .single();
 
      if (existing) {
        const { error } = await supabase
          .from("site_settings")
          .update({
            value: banner as unknown as Json,
            updated_at: new Date().toISOString(),
          })
          .eq("key", "announcement_banner");

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("site_settings")
          .insert([{
            key: "announcement_banner",
            value: banner as unknown as Json,
          }]);

        if (error) throw error;
      }
      
       toast.success("Banner settings saved!");
     } catch (error: any) {
       console.error("Failed to save banner:", error);
       toast.error("Failed to save banner settings");
     } finally {
       setSaving(false);
     }
   };
 
   const getPreviewClasses = () => {
     switch (banner.style) {
       case 'brand':
         return "bg-gradient-to-r from-[hsl(24,95%,53%)] via-[hsl(330,81%,60%)] to-[hsl(270,60%,70%)] text-white";
       case 'info':
         return "bg-[hsl(215,75%,70%/0.2)] text-[hsl(215,75%,40%)]";
       case 'warning':
         return "bg-amber-500/10 text-amber-700";
       case 'success':
         return "bg-emerald-500/10 text-emerald-700";
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
 
   if (loading) {
     return (
       <DashboardLayout>
         <div className="flex items-center justify-center py-12">
           <div className="animate-pulse">Loading...</div>
         </div>
       </DashboardLayout>
     );
   }
 
   return (
     <DashboardLayout>
       <div className="space-y-6">
         <AdminTabs />
 
         <div>
           <h1 className="text-3xl font-display font-bold flex items-center gap-2">
             <Megaphone className="h-8 w-8 text-primary" />
             Site Settings
           </h1>
           <p className="text-muted-foreground mt-2">
             Manage global settings and announcements
           </p>
         </div>
 
         {/* Announcement Banner Section */}
         <Card>
           <CardHeader>
             <div className="flex items-center justify-between">
               <div>
                 <CardTitle className="flex items-center gap-2">
                   📢 Announcement Banner
                 </CardTitle>
                 <CardDescription>
                   Display a message at the top of the site for all users
                 </CardDescription>
               </div>
               <div className="flex items-center gap-2">
                 <Label htmlFor="banner-enabled" className="text-sm">
                   {banner.enabled ? "Enabled" : "Disabled"}
                 </Label>
                 <Switch
                   id="banner-enabled"
                   checked={banner.enabled}
                   onCheckedChange={(checked) => setBanner({ ...banner, enabled: checked })}
                 />
               </div>
             </div>
           </CardHeader>
           <CardContent className="space-y-6">
             {/* Message */}
             <div className="space-y-2">
               <Label htmlFor="banner-text">Message</Label>
               <Input
                 id="banner-text"
                 value={banner.text}
                 onChange={(e) => setBanner({ ...banner, text: e.target.value })}
                 placeholder="🎉 New feature: Smart Creative Studio is live!"
               />
             </div>
 
             {/* Link */}
             <div className="grid grid-cols-2 gap-4">
               <div className="space-y-2">
                 <Label htmlFor="link-text">Link Text (optional)</Label>
                 <Input
                   id="link-text"
                   value={banner.linkText || ""}
                   onChange={(e) => setBanner({ ...banner, linkText: e.target.value })}
                   placeholder="Learn more"
                 />
               </div>
               <div className="space-y-2">
                 <Label htmlFor="link-url">Link URL</Label>
                 <Input
                   id="link-url"
                   value={banner.linkUrl || ""}
                   onChange={(e) => setBanner({ ...banner, linkUrl: e.target.value })}
                   placeholder="/creative-studio"
                 />
               </div>
             </div>
 
             {/* Style */}
             <div className="space-y-3">
               <Label>Style</Label>
               <RadioGroup
                 value={banner.style}
                 onValueChange={(value) => setBanner({ ...banner, style: value as AnnouncementBanner['style'] })}
                 className="flex flex-wrap gap-4"
               >
                 <div className="flex items-center space-x-2">
                   <RadioGroupItem value="brand" id="style-brand" />
                   <Label htmlFor="style-brand" className="cursor-pointer">Brand Gradient</Label>
                 </div>
                 <div className="flex items-center space-x-2">
                   <RadioGroupItem value="info" id="style-info" />
                   <Label htmlFor="style-info" className="cursor-pointer">Info Blue</Label>
                 </div>
                 <div className="flex items-center space-x-2">
                   <RadioGroupItem value="warning" id="style-warning" />
                   <Label htmlFor="style-warning" className="cursor-pointer">Warning</Label>
                 </div>
                 <div className="flex items-center space-x-2">
                   <RadioGroupItem value="success" id="style-success" />
                   <Label htmlFor="style-success" className="cursor-pointer">Success</Label>
                 </div>
                 <div className="flex items-center space-x-2">
                   <RadioGroupItem value="custom" id="style-custom" />
                   <Label htmlFor="style-custom" className="cursor-pointer">Custom Colors</Label>
                 </div>
               </RadioGroup>
             </div>
 
             {/* Custom Colors */}
             {banner.style === 'custom' && (
               <div className="grid grid-cols-3 gap-4 p-4 border rounded-lg bg-muted/50">
                 <div className="space-y-2">
                   <Label htmlFor="custom-bg">Background</Label>
                   <Input
                     id="custom-bg"
                     type="color"
                     value={banner.customColors?.background || "#f97316"}
                     onChange={(e) => setBanner({
                       ...banner,
                       customColors: {
                         ...banner.customColors,
                         background: e.target.value,
                         text: banner.customColors?.text || "#ffffff",
                       }
                     })}
                     className="h-10 p-1 cursor-pointer"
                   />
                 </div>
                 <div className="space-y-2">
                   <Label htmlFor="custom-text">Text Color</Label>
                   <Input
                     id="custom-text"
                     type="color"
                     value={banner.customColors?.text || "#ffffff"}
                     onChange={(e) => setBanner({
                       ...banner,
                       customColors: {
                         ...banner.customColors,
                         background: banner.customColors?.background || "#f97316",
                         text: e.target.value,
                       }
                     })}
                     className="h-10 p-1 cursor-pointer"
                   />
                 </div>
                 <div className="space-y-2">
                   <Label htmlFor="custom-link">Link Color</Label>
                   <Input
                     id="custom-link"
                     type="color"
                     value={banner.customColors?.linkText || "#ffffff"}
                     onChange={(e) => setBanner({
                       ...banner,
                       customColors: {
                         ...banner.customColors,
                         background: banner.customColors?.background || "#f97316",
                         text: banner.customColors?.text || "#ffffff",
                         linkText: e.target.value,
                       }
                     })}
                     className="h-10 p-1 cursor-pointer"
                   />
                 </div>
               </div>
             )}
 
             {/* Options */}
             <div className="flex items-center gap-6">
               <div className="flex items-center gap-2">
                 <Switch
                   id="dismissible"
                   checked={banner.dismissible}
                   onCheckedChange={(checked) => setBanner({ ...banner, dismissible: checked })}
                 />
                 <Label htmlFor="dismissible">Allow users to dismiss</Label>
               </div>
               <div className="flex items-center gap-2">
                 <Label htmlFor="expires">Expires at:</Label>
                 <Input
                   id="expires"
                   type="datetime-local"
                   value={banner.expiresAt ? banner.expiresAt.slice(0, 16) : ""}
                   onChange={(e) => setBanner({ 
                     ...banner, 
                     expiresAt: e.target.value ? new Date(e.target.value).toISOString() : undefined 
                   })}
                   className="w-auto"
                 />
                 {banner.expiresAt && (
                   <Button
                     variant="ghost"
                     size="sm"
                     onClick={() => setBanner({ ...banner, expiresAt: undefined })}
                   >
                     Clear
                   </Button>
                 )}
               </div>
             </div>
 
             {/* Preview */}
             <div className="space-y-2">
               <Label className="flex items-center gap-2">
                 <Eye className="h-4 w-4" />
                 Preview
               </Label>
               <div
                 className={cn(
                   "w-full py-2 px-4 text-center text-sm font-medium rounded-lg",
                   banner.text ? "" : "opacity-50",
                   getPreviewClasses()
                 )}
                 style={customStyles}
               >
                 <div className="flex items-center justify-center gap-2">
                   <span>{banner.text || "Your message will appear here"}</span>
                   {banner.linkText && (
                     <span 
                       className="underline underline-offset-2 font-semibold"
                       style={banner.style === 'custom' && banner.customColors?.linkText 
                         ? { color: banner.customColors.linkText } 
                         : {}
                       }
                     >
                       {banner.linkText}
                     </span>
                   )}
                 </div>
               </div>
             </div>
 
             {/* Save Button */}
             <div className="flex justify-end pt-4 border-t">
               <Button onClick={handleSave} disabled={saving} className="gap-2">
                 <Save className="h-4 w-4" />
                 {saving ? "Saving..." : "Save Banner"}
               </Button>
             </div>
           </CardContent>
          </Card>

        </div>
      </DashboardLayout>
    );
  }