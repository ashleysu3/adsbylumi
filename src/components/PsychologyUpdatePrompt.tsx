 import { useState } from 'react';
 import { Card, CardContent } from '@/components/ui/card';
 import { Button } from '@/components/ui/button';
 import { supabase } from '@/integrations/supabase/client';
 import { toast } from 'sonner';
 import { formatInvokeError } from '@/lib/formatInvokeError';
 import { Sparkles, X, Loader2, RefreshCw } from 'lucide-react';
 
 interface PsychologyUpdatePromptProps {
   brandId: string;
   type: 'brand' | 'offer';
   offerId?: string;
   onDismiss: () => void;
   onUpdate: () => void;
 }
 
 export function PsychologyUpdatePrompt({ 
   brandId, 
   type, 
   offerId,
   onDismiss, 
   onUpdate 
 }: PsychologyUpdatePromptProps) {
   const [updating, setUpdating] = useState(false);
 
   const handleUpdate = async () => {
     setUpdating(true);
     try {
       if (type === 'brand') {
         const { error } = await supabase.functions.invoke('generate-audience-psychology', {
           body: { brandId }
         });
         if (error) throw error;
         toast.success("Audience psychology updated with new content!");
       } else if (type === 'offer' && offerId) {
         const { error } = await supabase.functions.invoke('generate-product-psychology', {
           body: { offerId, brandId }
         });
         if (error) throw error;
         toast.success("Product psychology updated with new content!");
       }
       
       setTimeout(() => {
         onUpdate();
         onDismiss();
       }, 1500);
     } catch (error: any) {
       console.error('Error updating psychology:', error);
       toast.error(formatInvokeError(error));
     } finally {
       setUpdating(false);
     }
   };
 
   return (
     <Card className="bg-gradient-to-r from-lumi-purple-1/10 to-lumi-pink-1/10 border-primary/20">
       <CardContent className="py-4 px-5">
         <div className="flex items-start justify-between gap-4">
           <div className="flex items-start gap-3">
             <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
               <Sparkles className="h-4 w-4 text-primary" />
             </div>
             <div>
               <p className="font-medium text-sm">
                 New content added since your last psychology profile
               </p>
               <p className="text-xs text-muted-foreground mt-0.5">
                 Want Lumi to incorporate your new {type === 'brand' ? 'brand content' : 'offer-specific content'} for even more accurate insights?
               </p>
             </div>
           </div>
           
           <div className="flex items-center gap-2">
             <Button
               size="sm"
               variant="ghost"
               onClick={onDismiss}
               disabled={updating}
               className="h-8"
             >
               <X className="h-4 w-4" />
             </Button>
             <Button
               size="sm"
               variant="lumi"
               onClick={handleUpdate}
               disabled={updating}
               className="h-8"
             >
               {updating ? (
                 <>
                   <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                   Updating...
                 </>
               ) : (
                 <>
                   <RefreshCw className="h-3 w-3 mr-1" />
                   Update Psychology
                 </>
               )}
             </Button>
           </div>
         </div>
       </CardContent>
     </Card>
   );
 }