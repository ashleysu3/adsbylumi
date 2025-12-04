import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";
import { 
  Video, 
  Image as ImageIcon, 
  Layers, 
  FileText,
  Upload,
  CheckSquare,
  Sprout,
  HeartHandshake,
  Rocket,
  Heart,
  Clipboard,
  Type,
  Bookmark,
  Star
} from "lucide-react";

interface CreativeSidebarProps {
  workspace: any;
  activeSection: string;
  onSectionChange: (section: string) => void;
  onNavigateToProduction: () => void;
}

export function CreativeSidebar({ workspace, activeSection, onSectionChange, onNavigateToProduction }: CreativeSidebarProps) {
  const creative = workspace.creative_json || {};
  const creativeMix = creative.creative_mix || creative.customer_journey || {};
  const lovedConcepts = workspace.loved_concepts || [];
  
  // Support both old (tofu/mofu/bofu) and new (grow/nurture/convert) structure
  const growCount = creativeMix.grow?.length || creativeMix.tofu?.length || 0;
  const nurtureCount = creativeMix.nurture?.length || creativeMix.mofu?.length || 0;
  const convertCount = creativeMix.convert?.length || creativeMix.bofu?.length || 0;

  // Count loved by stage - support both structures
  const lovedByStage = {
    grow: lovedConcepts.filter((id: string) => 
      (creativeMix.grow || creativeMix.tofu)?.some((c: any) => c.id === id)
    ).length,
    nurture: lovedConcepts.filter((id: string) => 
      (creativeMix.nurture || creativeMix.mofu)?.some((c: any) => c.id === id)
    ).length,
    convert: lovedConcepts.filter((id: string) => 
      (creativeMix.convert || creativeMix.bofu)?.some((c: any) => c.id === id)
    ).length,
  };
  
  // Count by format type - support both structures
  const allConcepts = [
    ...(creativeMix.grow || creativeMix.tofu || []),
    ...(creativeMix.nurture || creativeMix.mofu || []),
    ...(creativeMix.convert || creativeMix.bofu || [])
  ];
  
  const scriptsCount = allConcepts.filter(c => c.format === 'talking_head' || c.script).length;
  const brollCount = allConcepts.filter(c => c.format === 'b_roll' || c.broll_instructions).length;
  const carouselsCount = allConcepts.filter(c => c.format === 'carousel').length;
  const staticsCount = allConcepts.filter(c => c.format === 'static').length;
  
  const uploadCount = workspace.user_uploaded_assets?.length || 0;
  const checklistCount = workspace.production_checklist?.length || 0;
  const checklistCompleted = workspace.production_checklist?.filter((i: any) => i.completed).length || 0;

  // Count copy items
  const adCopyLibrary = creative.ad_copy_library || {};
  const headlinesCount = (adCopyLibrary.headlines || creative.headlines || []).length;
  const primaryCopyObj = adCopyLibrary.primary_copy || creative.primary_copy || {};
  const primaryCopyCount = Array.isArray(primaryCopyObj) 
    ? primaryCopyObj.length 
    : (primaryCopyObj.short?.length || 0) + (primaryCopyObj.medium?.length || 0) + (primaryCopyObj.long?.length || 0);
  const descriptionsCount = (adCopyLibrary.descriptions || creative.descriptions || []).length;
  const totalCopyCount = headlinesCount + primaryCopyCount + descriptionsCount;

  // Count saved concepts (selected copy)
  const selectedCopy = workspace.selected_copy || {};
  const savedHeadlines = selectedCopy.headlines?.length || 0;
  const savedPrimary = selectedCopy.primary_copy?.length || 0;
  const savedDescriptions = selectedCopy.descriptions?.length || 0;
  const totalSavedCopy = savedHeadlines + savedPrimary + savedDescriptions;

  const sections = [
    {
      id: "saved",
      label: "Saved",
      items: [
        { id: "saved-concepts", label: "Saved Concepts", icon: Bookmark, count: lovedConcepts.length, color: "text-pink-600 dark:text-pink-400" },
        { id: "saved-copy", label: "Saved Copy", icon: Star, count: totalSavedCopy, color: "text-amber-600 dark:text-amber-400" },
      ]
    },
    { 
      id: "journey", 
      label: "Customer Journey", 
      items: [
        { id: "grow", label: "Grow", icon: Sprout, count: growCount, color: "text-blue-600 dark:text-blue-400" },
        { id: "nurture", label: "Nurture", icon: HeartHandshake, count: nurtureCount, color: "text-purple-600 dark:text-purple-400" },
        { id: "convert", label: "Convert", icon: Rocket, count: convertCount, color: "text-green-600 dark:text-green-400" },
      ]
    },
    {
      id: "format",
      label: "By Format",
      items: [
        { id: "scripts", label: "Scripts", icon: FileText, count: scriptsCount },
        { id: "broll", label: "B-Roll", icon: Video, count: brollCount },
        { id: "carousels", label: "Carousels", icon: Layers, count: carouselsCount },
        { id: "static", label: "Static Graphics", icon: ImageIcon, count: staticsCount },
      ]
    },
    {
      id: "copy",
      label: "Ad Copy",
      items: [
        { id: "copy", label: "Copy Library", icon: Type, count: totalCopyCount, color: "text-amber-600 dark:text-amber-400" },
      ]
    },
    {
      id: "production",
      label: "Production",
      items: [
        { id: "uploads", label: "Uploads", icon: Upload, count: uploadCount },
        { id: "checklist", label: "Checklist", icon: CheckSquare, count: `${checklistCompleted}/${checklistCount}` },
      ]
    }
  ];

  return (
    <div className="w-72 shrink-0 border-r border-border bg-background/50 backdrop-blur-sm">
      <div className="p-4 border-b border-border">
        <h3 className="font-semibold text-sm text-muted-foreground">Lumi Creative</h3>
      </div>
      
      <ScrollArea className="h-[calc(100vh-12rem)]">
        <div className="p-2 space-y-6">
          {/* Loved Creative Ideas */}
          {lovedConcepts.length > 0 && (
            <>
              <Card className="mx-2 mt-2 p-3 bg-gradient-to-br from-pink-50 to-pink-100 dark:from-pink-950/20 dark:to-pink-900/20 border-pink-200 dark:border-pink-800">
                <div className="flex items-center gap-2 mb-2">
                  <Heart className="h-4 w-4 text-pink-600 dark:text-pink-400 fill-pink-600 dark:fill-pink-400" />
                  <span className="text-xs font-semibold text-pink-900 dark:text-pink-100">Loved Concepts</span>
                </div>
                <div className="text-3xl font-bold text-pink-900 dark:text-pink-100 mb-2">
                  {lovedConcepts.length}
                </div>
                <div className="flex flex-wrap gap-1">
                  {lovedByStage.grow > 0 && (
                    <Badge variant="secondary" className="text-xs px-1.5 py-0">
                      Grow {lovedByStage.grow}
                    </Badge>
                  )}
                  {lovedByStage.nurture > 0 && (
                    <Badge variant="secondary" className="text-xs px-1.5 py-0">
                      Nurture {lovedByStage.nurture}
                    </Badge>
                  )}
                  {lovedByStage.convert > 0 && (
                    <Badge variant="secondary" className="text-xs px-1.5 py-0">
                      Convert {lovedByStage.convert}
                    </Badge>
                  )}
                </div>
              </Card>
              
              <Button
                variant="default"
                className="mx-2 w-[calc(100%-1rem)] bg-pink-600 hover:bg-pink-700 dark:bg-pink-700 dark:hover:bg-pink-600 gap-2 mb-8"
                onClick={onNavigateToProduction}
              >
                <Clipboard className="h-4 w-4" />
                View Production
              </Button>
            </>
          )}
          
          {sections.map((section) => (
            <div key={section.id} className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground px-3 py-2">
                {section.label}
              </p>
              {section.items.map((item) => {
                const Icon = item.icon;
                const isActive = activeSection === item.id;
                
                return (
                  <Button
                    key={item.id}
                    variant={isActive ? "secondary" : "ghost"}
                    className={`w-full justify-start gap-3 ${item.color || ''}`}
                    onClick={() => onSectionChange(item.id)}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="flex-1 text-left">{item.label}</span>
                    {typeof item.count === 'number' && item.count > 0 && (
                      <Badge variant={isActive ? "default" : "secondary"} className="ml-auto">
                        {item.count}
                      </Badge>
                    )}
                    {typeof item.count === 'string' && (
                      <Badge variant={isActive ? "default" : "secondary"} className="ml-auto text-xs">
                        {item.count}
                      </Badge>
                    )}
                  </Button>
                );
              })}
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
