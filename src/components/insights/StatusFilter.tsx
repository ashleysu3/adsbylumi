import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Filter } from 'lucide-react';

interface StatusFilterProps {
  selectedStatuses: string[];
  onStatusChange: (statuses: string[]) => void;
  statusCounts: Record<string, number>;
}

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active', color: 'bg-green-500/10 text-green-600 border-green-500/30' },
  { value: 'paused', label: 'Paused', color: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/30' },
  { value: 'archived', label: 'Archived', color: 'bg-gray-500/10 text-gray-600 border-gray-500/30' },
  { value: 'live', label: 'Live', color: 'bg-blue-500/10 text-blue-600 border-blue-500/30' },
  { value: 'imported', label: 'Imported', color: 'bg-purple-500/10 text-purple-600 border-purple-500/30' },
];

export function StatusFilter({ selectedStatuses, onStatusChange, statusCounts }: StatusFilterProps) {
  const toggleStatus = (status: string) => {
    if (selectedStatuses.includes(status)) {
      onStatusChange(selectedStatuses.filter((s) => s !== status));
    } else {
      onStatusChange([...selectedStatuses, status]);
    }
  };

  const selectAll = () => {
    onStatusChange(STATUS_OPTIONS.map((s) => s.value));
  };

  const clearAll = () => {
    onStatusChange([]);
  };

  // Only show statuses that have campaigns
  const availableStatuses = STATUS_OPTIONS.filter((s) => statusCounts[s.value] > 0);

  if (availableStatuses.length <= 1) {
    return null;
  }

  const allSelected = availableStatuses.every((s) => selectedStatuses.includes(s.value));

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Filter className="h-4 w-4" />
        <span>Filter:</span>
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={allSelected ? clearAll : selectAll}
        className="text-xs h-7"
      >
        {allSelected ? 'Clear' : 'All'}
      </Button>
      {availableStatuses.map((status) => {
        const isSelected = selectedStatuses.includes(status.value);
        const count = statusCounts[status.value] || 0;

        return (
          <Badge
            key={status.value}
            variant={isSelected ? 'default' : 'outline'}
            className={`cursor-pointer transition-all ${
              isSelected ? status.color : 'opacity-50 hover:opacity-100'
            }`}
            onClick={() => toggleStatus(status.value)}
          >
            {status.label}
            <span className="ml-1 opacity-70">({count})</span>
          </Badge>
        );
      })}
    </div>
  );
}
