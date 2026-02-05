 import { useState } from "react";
 import { Card, CardContent } from "@/components/ui/card";
 import { Button } from "@/components/ui/button";
 import { Checkbox } from "@/components/ui/checkbox";
 import { Textarea } from "@/components/ui/textarea";
 import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
 import { Sparkles, ChevronDown, Lightbulb, Loader2 } from "lucide-react";
 import { cn } from "@/lib/utils";
 
 export interface CreativeContext {
   quickSelections: string[];
   additionalNotes: string;
   timestamp: string;
 }
 
 interface CreativeContextInputProps {
   onGenerate: (context: CreativeContext | null) => void;
   onSkip: () => void;
   isGenerating: boolean;
   existingContext?: CreativeContext | null;
   compact?: boolean;
 }
 
 const QUICK_SELECT_OPTIONS = [
   {
     id: "audience_early_journey",
     label: "Audience needs more education first",
     description: "They're not ready to buy yet"
   },
   {
     id: "audience_skeptical",
     label: "Audience is skeptical",
     description: "Need to build trust and handle objections"
   },
   {
     id: "previous_generic",
     label: "Previous creative felt generic",
     description: "Need more specific, authentic messaging"
   },
   {
     id: "need_urgency",
     label: "Need more urgency",
     description: "Drive action with scarcity/time pressure"
   },
   {
     id: "highlight_transformation",
     label: "Emphasize the transformation",
     description: "Focus on before/after results"
   },
   {
     id: "focus_pain_point",
     label: "Focus on a specific pain point",
     description: "Deep-dive on the core problem"
   }
 ];
 
 export function CreativeContextInput({
   onGenerate,
   onSkip,
   isGenerating,
   existingContext,
   compact = false
 }: CreativeContextInputProps) {
   const [expanded, setExpanded] = useState(!!existingContext);
   const [quickSelections, setQuickSelections] = useState<string[]>(
     existingContext?.quickSelections || []
   );
   const [additionalNotes, setAdditionalNotes] = useState(
     existingContext?.additionalNotes || ""
   );
 
   const toggleSelection = (id: string) => {
     setQuickSelections(prev =>
       prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
     );
   };
 
   const handleGenerate = () => {
     const hasContext = quickSelections.length > 0 || additionalNotes.trim();
     if (hasContext) {
       onGenerate({
         quickSelections,
         additionalNotes: additionalNotes.trim(),
         timestamp: new Date().toISOString()
       });
     } else {
       onGenerate(null);
     }
   };
 
   const content = (
     <div className="space-y-4">
       <Collapsible open={expanded} onOpenChange={setExpanded}>
         <CollapsibleTrigger asChild>
           <Button 
             variant="ghost" 
             className="w-full justify-between px-4 py-3 h-auto bg-muted/50 hover:bg-muted"
           >
             <div className="flex items-center gap-2">
               <Lightbulb className="h-4 w-4 text-primary" />
               <span className="text-sm font-medium">Help Lumi create better angles</span>
               <span className="text-xs text-muted-foreground">(optional)</span>
             </div>
             <ChevronDown 
               className={cn(
                 "h-4 w-4 text-muted-foreground transition-transform",
                 expanded && "rotate-180"
               )} 
             />
           </Button>
         </CollapsibleTrigger>
         
         <CollapsibleContent className="pt-4 space-y-4">
           <div className="space-y-3">
             <p className="text-sm text-muted-foreground">Quick select any that apply:</p>
             <div className="grid gap-2">
               {QUICK_SELECT_OPTIONS.map(option => (
                 <label
                   key={option.id}
                   className={cn(
                     "flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors",
                     quickSelections.includes(option.id) 
                       ? "border-primary bg-primary/5" 
                       : "border-border hover:border-muted-foreground/50"
                   )}
                 >
                   <Checkbox
                     checked={quickSelections.includes(option.id)}
                     onCheckedChange={() => toggleSelection(option.id)}
                     className="mt-0.5"
                   />
                   <div className="space-y-0.5">
                     <p className="text-sm font-medium">{option.label}</p>
                     <p className="text-xs text-muted-foreground">{option.description}</p>
                   </div>
                 </label>
               ))}
             </div>
           </div>
           
           <div className="space-y-2">
             <label className="text-sm text-muted-foreground">
               Anything else Lumi should know?
             </label>
             <Textarea
               placeholder="E.g., 'Focus on the time-saving aspect' or 'Avoid mentioning competitors'"
               value={additionalNotes}
               onChange={(e) => setAdditionalNotes(e.target.value)}
               className="resize-none"
               rows={3}
             />
           </div>
         </CollapsibleContent>
       </Collapsible>
       
       <div className="flex justify-end gap-3">
         <Button 
           variant="ghost" 
           onClick={onSkip}
           disabled={isGenerating}
         >
           Skip
         </Button>
         <Button 
           onClick={handleGenerate}
           disabled={isGenerating}
           className="gap-2"
         >
           {isGenerating ? (
             <Loader2 className="h-4 w-4 animate-spin" />
           ) : (
             <Sparkles className="h-4 w-4" />
           )}
           Generate Angles
         </Button>
       </div>
     </div>
   );
 
   if (compact) {
     return content;
   }
 
   return (
     <Card>
       <CardContent className="pt-6">
         <div className="text-center mb-6">
           <Sparkles className="h-12 w-12 mx-auto text-primary/50 mb-4" />
           <h3 className="text-lg font-semibold mb-2">Generate Creative Angles</h3>
           <p className="text-muted-foreground text-sm">
             Lumi will suggest unique creative angles for your campaign
           </p>
         </div>
         {content}
       </CardContent>
     </Card>
   );
 }