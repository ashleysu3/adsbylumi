import { CreativeCell, CreativeCellData } from "./CreativeCell";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Plus } from "lucide-react";

interface CreativeGridProps {
  angles: { id: string; name: string }[];
  activeAngleId: string;
  onAngleChange: (angleId: string) => void;
  gridData: CreativeCellData[];
  selectedCells: string[];
  onCellToggle: (cellId: string) => void;
  onAddToChecklist: () => void;
}

const rowLabels = {
  attention: "Get Attention",
  trust: "Build Trust",
  action: "Drive Action",
};

const rowOrder: ("attention" | "trust" | "action")[] = ["attention", "trust", "action"];

export function CreativeGrid({
  angles,
  activeAngleId,
  onAngleChange,
  gridData,
  selectedCells,
  onCellToggle,
  onAddToChecklist,
}: CreativeGridProps) {
  const activeAngle = angles.find(a => a.id === activeAngleId);
  const selectedCount = selectedCells.filter(id => 
    gridData.find(cell => cell.id === id && cell.angleId === activeAngleId)
  ).length;

  return (
    <div className="space-y-6">
      {/* Header with angle selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Select value={activeAngleId} onValueChange={onAngleChange}>
            <SelectTrigger className="w-[280px]">
              <SelectValue placeholder="Select angle" />
            </SelectTrigger>
            <SelectContent>
              {angles.map((angle) => (
                <SelectItem key={angle.id} value={angle.id}>
                  {angle.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-3">
          {selectedCount > 0 && (
            <Badge variant="secondary" className="gap-1.5">
              <CheckCircle2 className="h-3 w-3" />
              {selectedCount} selected
            </Badge>
          )}
          <Button
            onClick={onAddToChecklist}
            disabled={selectedCount === 0}
            size="sm"
          >
            <Plus className="mr-1.5 h-4 w-4" />
            Add to Checklist
          </Button>
        </div>
      </div>

      {/* Grid */}
      <div className="space-y-6">
        {rowOrder.map((row) => {
          const rowCells = gridData.filter(
            cell => cell.row === row && cell.angleId === activeAngleId
          );

          return (
            <div key={row} className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                {rowLabels[row]}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {rowCells.map((cell) => (
                  <CreativeCell
                    key={cell.id}
                    cell={cell}
                    isSelected={selectedCells.includes(cell.id)}
                    onToggle={onCellToggle}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
