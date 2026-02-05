 import { useState, useEffect, useCallback } from 'react';
 import { supabase } from '@/integrations/supabase/client';
 import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
 import { Button } from '@/components/ui/button';
 import { Textarea } from '@/components/ui/textarea';
 import { Label } from '@/components/ui/label';
 import { Badge } from '@/components/ui/badge';
 import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
 import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
 import { ChevronDown, FileText, MessageSquare, ClipboardList, HelpCircle, Sparkles, Loader2, Check, BookOpen } from 'lucide-react';
 import { toast } from 'sonner';
 import { cn } from '@/lib/utils';
import { PsychologyUpdatePrompt } from './PsychologyUpdatePrompt';
 
 interface ContentAsset {
   id?: string;
   brand_id: string;
   asset_type: string;
   content: string;
   label?: string;
   offer_ids: string[];
 }
 
 interface Offer {
   id: string;
   name: string;
 }
 
interface Brand {
  audience_psychology?: any;
  psychology_content_hash?: string | null;
}

 interface ContentAssetsEditorProps {
   brandId: string;
   offers?: Offer[];
  brand?: Brand | null;
  onBrandUpdate?: () => void;
 }
 
 const ASSET_TYPES = [
   {
     type: 'testimonials',
     label: 'Testimonials & Reviews',
     icon: MessageSquare,
     placeholder: 'Paste client testimonials, reviews, or success stories...\n\nExample:\n"I went from $2k months to $15k months in just 90 days using Sarah\'s framework. Game changer!" - Jessica M.',
     description: 'Real words from happy clients boost credibility and provide authentic language.',
   },
   {
     type: 'webinar_scripts',
     label: 'Webinar & Challenge Scripts',
     icon: FileText,
     placeholder: 'Paste your webinar intro, key talking points, or challenge day scripts...\n\nExample:\nDay 1: "If you\'ve ever felt stuck in the feast-or-famine cycle, today is going to change everything..."',
     description: 'Your best content often comes from live presentations and challenges.',
   },
   {
     type: 'survey_answers',
     label: 'Survey Responses',
     icon: ClipboardList,
     placeholder: 'Paste responses from surveys about pain points, goals, or transformations...\n\nExample:\nQ: What\'s your biggest struggle?\nA: "I don\'t have enough time to create content consistently"',
     description: 'Survey data reveals the exact language your audience uses.',
   },
   {
     type: 'client_objections',
     label: 'Client Objections & Questions',
     icon: HelpCircle,
     placeholder: 'What questions or objections do clients commonly raise?\n\nExample:\n- "Is this going to work for my niche?"\n- "I\'ve tried other programs before and failed"',
     description: 'Addressing objections in ads builds trust and overcomes hesitation.',
   },
   {
     type: 'other',
     label: 'Other Useful Content',
     icon: BookOpen,
     placeholder: 'Any other content that might be useful: sales page copy, email sequences, podcast transcripts, case studies...',
     description: 'Anything else that captures your voice and message.',
   },
 ];
 
export function ContentAssetsEditor({ brandId, offers = [], brand, onBrandUpdate }: ContentAssetsEditorProps) {
   const [assets, setAssets] = useState<ContentAsset[]>([]);
   const [loading, setLoading] = useState(true);
   const [saving, setSaving] = useState<string | null>(null);
   const [expandedTypes, setExpandedTypes] = useState<string[]>(['testimonials']);
   const [hasUnsavedChanges, setHasUnsavedChanges] = useState<Record<string, boolean>>({});
  const [showPsychologyPrompt, setShowPsychologyPrompt] = useState(false);
 
   // Fetch existing assets
   useEffect(() => {
     const fetchAssets = async () => {
       try {
         const { data, error } = await supabase
           .from('brand_content_assets')
           .select('*')
           .eq('brand_id', brandId);
 
         if (error) throw error;
 
         // Type assertion for the data
         const typedData = (data || []) as ContentAsset[];
         setAssets(typedData);
       } catch (error) {
         console.error('Error fetching content assets:', error);
       } finally {
         setLoading(false);
       }
     };
 
     fetchAssets();
   }, [brandId]);
 
  // Check if psychology needs updating when assets change
  const checkPsychologyUpdate = useCallback(() => {
    if (!brand?.audience_psychology) return; // No psychology yet
    
    const savedAssets = assets.filter(a => a.id && a.content?.trim());
    if (savedAssets.length === 0) return;
    
    const currentHash = savedAssets.map(a => a.id).sort().join(',');
    if (brand.psychology_content_hash !== currentHash) {
      setShowPsychologyPrompt(true);
    }
  }, [assets, brand?.audience_psychology, brand?.psychology_content_hash]);

   const getAssetForType = (type: string): ContentAsset => {
     const existing = assets.find(a => a.asset_type === type);
     return existing || {
       brand_id: brandId,
       asset_type: type,
       content: '',
       offer_ids: [],
     };
   };
 
   const updateAssetContent = (type: string, content: string) => {
     setAssets(prev => {
       const existing = prev.find(a => a.asset_type === type);
       if (existing) {
         return prev.map(a => a.asset_type === type ? { ...a, content } : a);
       }
       return [...prev, { brand_id: brandId, asset_type: type, content, offer_ids: [] }];
     });
     setHasUnsavedChanges(prev => ({ ...prev, [type]: true }));
   };
 
   const updateAssetOfferLink = (type: string, linkType: 'all' | 'specific', selectedOfferIds?: string[]) => {
     setAssets(prev => {
       const existing = prev.find(a => a.asset_type === type);
       const offer_ids = linkType === 'all' ? [] : (selectedOfferIds || []);
       
       if (existing) {
         return prev.map(a => a.asset_type === type ? { ...a, offer_ids } : a);
       }
       return [...prev, { brand_id: brandId, asset_type: type, content: '', offer_ids }];
     });
     setHasUnsavedChanges(prev => ({ ...prev, [type]: true }));
   };
 
   const saveAsset = async (type: string) => {
     const asset = getAssetForType(type);
     if (!asset.content.trim()) {
       // If content is empty and exists in DB, delete it
       if (asset.id) {
         setSaving(type);
         try {
           const { error } = await supabase
             .from('brand_content_assets')
             .delete()
             .eq('id', asset.id);
           
           if (error) throw error;
           
           setAssets(prev => prev.filter(a => a.id !== asset.id));
           toast.success('Content removed');
         } catch (error) {
           console.error('Error deleting asset:', error);
           toast.error('Failed to remove content');
         } finally {
           setSaving(null);
           setHasUnsavedChanges(prev => ({ ...prev, [type]: false }));
         }
       }
       return;
     }
 
     setSaving(type);
     try {
       if (asset.id) {
         // Update existing
         const { error } = await supabase
           .from('brand_content_assets')
           .update({
             content: asset.content,
             offer_ids: asset.offer_ids,
             updated_at: new Date().toISOString(),
           })
           .eq('id', asset.id);
 
         if (error) throw error;
       } else {
         // Insert new
         const { data, error } = await supabase
           .from('brand_content_assets')
           .insert({
             brand_id: brandId,
             asset_type: type,
             content: asset.content,
             offer_ids: asset.offer_ids,
           })
           .select()
           .single();
 
         if (error) throw error;
         
         // Update local state with the new ID
         setAssets(prev => prev.map(a => 
           a.asset_type === type ? { ...a, id: data.id } : a
         ));
       }
 
       toast.success('Content saved');
       setHasUnsavedChanges(prev => ({ ...prev, [type]: false }));
        
        // Check if we should prompt for psychology update
        setTimeout(checkPsychologyUpdate, 500);
     } catch (error) {
       console.error('Error saving asset:', error);
       toast.error('Failed to save content');
     } finally {
       setSaving(null);
     }
   };
 
   const toggleExpanded = (type: string) => {
     setExpandedTypes(prev => 
       prev.includes(type) 
         ? prev.filter(t => t !== type)
         : [...prev, type]
     );
   };
 
   const getSavedCount = () => assets.filter(a => a.content?.trim()).length;
 
   if (loading) {
     return (
       <Card>
         <CardContent className="flex items-center justify-center py-8">
           <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
         </CardContent>
       </Card>
     );
   }
 
   return (
     <Card variant="glow">
       <CardHeader>
         <div className="flex items-center justify-between">
           <div className="flex items-center gap-2">
             <Sparkles className="h-5 w-5 text-primary" />
             <CardTitle>Your Content Library</CardTitle>
           </div>
           {getSavedCount() > 0 && (
             <Badge variant="secondary">
               {getSavedCount()} asset{getSavedCount() !== 1 ? 's' : ''} saved
             </Badge>
           )}
         </div>
         <CardDescription>
           Paste existing content to supercharge your AI-generated ads. The more context Lumi has, the more authentic and specific your copy will be.
         </CardDescription>
       </CardHeader>
       <CardContent className="space-y-4">
        {showPsychologyPrompt && (
          <PsychologyUpdatePrompt
            brandId={brandId}
            type="brand"
            onDismiss={() => setShowPsychologyPrompt(false)}
            onUpdate={() => {
              onBrandUpdate?.();
            }}
          />
        )}
        
         {ASSET_TYPES.map((assetType) => {
           const asset = getAssetForType(assetType.type);
           const isExpanded = expandedTypes.includes(assetType.type);
           const hasContent = asset.content?.trim();
           const Icon = assetType.icon;
 
           return (
             <Collapsible
               key={assetType.type}
               open={isExpanded}
               onOpenChange={() => toggleExpanded(assetType.type)}
             >
               <CollapsibleTrigger asChild>
                 <div
                   className={cn(
                     'flex items-center justify-between p-4 rounded-lg border cursor-pointer transition-colors',
                     'hover:bg-muted/50',
                     hasContent && 'border-primary/30 bg-primary/5'
                   )}
                 >
                   <div className="flex items-center gap-3">
                     <Icon className={cn('h-5 w-5', hasContent ? 'text-primary' : 'text-muted-foreground')} />
                     <div>
                       <p className="font-medium text-sm">{assetType.label}</p>
                       <p className="text-xs text-muted-foreground">{assetType.description}</p>
                     </div>
                   </div>
                   <div className="flex items-center gap-2">
                     {hasContent && (
                       <Badge variant="outline" className="text-xs border-green-500 text-green-600">
                         <Check className="h-3 w-3 mr-1" />
                         Saved
                       </Badge>
                     )}
                     <ChevronDown className={cn(
                       'h-4 w-4 text-muted-foreground transition-transform',
                       isExpanded && 'rotate-180'
                     )} />
                   </div>
                 </div>
               </CollapsibleTrigger>
 
               <CollapsibleContent>
                 <div className="pt-4 pb-2 px-4 space-y-4">
                   <Textarea
                     value={asset.content}
                     onChange={(e) => updateAssetContent(assetType.type, e.target.value)}
                     placeholder={assetType.placeholder}
                     className="min-h-[150px] resize-y"
                     variant="gradient"
                   />
 
                   {offers.length > 0 && (
                     <div className="space-y-2">
                       <Label className="text-xs">Link to:</Label>
                       <Select
                         value={asset.offer_ids.length === 0 ? 'all' : 'specific'}
                         onValueChange={(value) => updateAssetOfferLink(
                           assetType.type, 
                           value as 'all' | 'specific',
                           value === 'specific' && offers.length > 0 ? [offers[0].id] : undefined
                         )}
                       >
                         <SelectTrigger className="w-48">
                           <SelectValue />
                         </SelectTrigger>
                         <SelectContent>
                           <SelectItem value="all">All Offers (brand-wide)</SelectItem>
                           <SelectItem value="specific">Specific Offer(s)</SelectItem>
                         </SelectContent>
                       </Select>
 
                       {asset.offer_ids.length > 0 && (
                         <div className="flex flex-wrap gap-2 mt-2">
                           {offers.map(offer => (
                             <Badge
                               key={offer.id}
                               variant={asset.offer_ids.includes(offer.id) ? 'default' : 'outline'}
                               className="cursor-pointer"
                               onClick={() => {
                                 const isSelected = asset.offer_ids.includes(offer.id);
                                 const newOfferIds = isSelected
                                   ? asset.offer_ids.filter(id => id !== offer.id)
                                   : [...asset.offer_ids, offer.id];
                                 updateAssetOfferLink(assetType.type, 'specific', newOfferIds);
                               }}
                             >
                               {offer.name}
                             </Badge>
                           ))}
                         </div>
                       )}
                     </div>
                   )}
 
                   <div className="flex justify-end">
                     <Button
                       size="sm"
                       onClick={() => saveAsset(assetType.type)}
                       disabled={saving === assetType.type || !hasUnsavedChanges[assetType.type]}
                       variant={hasUnsavedChanges[assetType.type] ? 'lumi' : 'outline'}
                     >
                       {saving === assetType.type ? (
                         <>
                           <Loader2 className="h-4 w-4 animate-spin mr-2" />
                           Saving...
                         </>
                       ) : hasUnsavedChanges[assetType.type] ? (
                         'Save'
                       ) : (
                         'Saved'
                       )}
                     </Button>
                   </div>
                 </div>
               </CollapsibleContent>
             </Collapsible>
           );
         })}
       </CardContent>
     </Card>
   );
 }