import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Video, 
  Image as ImageIcon, 
  Layers, 
  FileText,
  Upload,
  CheckSquare,
  Target,
  Zap,
  TrendingUp
} from "lucide-react";

interface CreativeSidebarProps {
  workspace: any;
  activeSection: string;
  onSectionChange: (section: string) => void;
}

export function CreativeSidebar({ workspace, activeSection, onSectionChange }: CreativeSidebarProps) {
  const creative = workspace.creative_json || {};
  const creativeMix = creative.creative_mix || {};
  
  const tofuCount = creativeMix.tofu?.length || 0;
  const mofuCount = creativeMix.mofu?.length || 0;
  const bofuCount = creativeMix.bofu?.length || 0;
  
  // Count by format type
  const allConcepts = [
    ...(creativeMix.tofu || []),
    ...(creativeMix.mofu || []),
    ...(creativeMix.bofu || [])
  ];
  
  const scriptsCount = allConcepts.filter(c => c.format === 'talking_head' || c.script).length;
  const brollCount = allConcepts.filter(c => c.format === 'b_roll' || c.broll_instructions).length;
  const carouselsCount = allConcepts.filter(c => c.format === 'carousel').length;
  const staticsCount = allConcepts.filter(c => c.format === 'static').length;
  
  const uploadCount = workspace.user_uploaded_assets?.length || 0;
  const checklistCount = workspace.production_checklist?.length || 0;
  const checklistCompleted = workspace.production_checklist?.filter((i: any) => i.completed).length || 0;

  const sections = [
    { 
      id: "funnel", 
      label: "Funnel Stages", 
      items: [
        { id: "tofu", label: "TOFU", icon: Target, count: tofuCount, color: "text-blue-600 dark:text-blue-400" },
        { id: "mofu", label: "MOFU", icon: Zap, count: mofuCount, color: "text-purple-600 dark:text-purple-400" },
        { id: "bofu", label: "BOFU", icon: TrendingUp, count: bofuCount, color: "text-green-600 dark:text-green-400" },
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
      id: "production",
      label: "Production",
      items: [
        { id: "uploads", label: "Uploads", icon: Upload, count: uploadCount },
        { id: "checklist", label: "Checklist", icon: CheckSquare, count: `${checklistCompleted}/${checklistCount}` },
      ]
    }
  ];

  return (
    <div className="w-64 shrink-0 border-r border-border bg-background/50 backdrop-blur-sm">
      <div className="p-4 border-b border-border">
        <h3 className="font-semibold text-sm text-muted-foreground">Creative Dashboard</h3>
      </div>
      
      <ScrollArea className="h-[calc(100vh-12rem)]">
        <div className="p-2 space-y-6">
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
