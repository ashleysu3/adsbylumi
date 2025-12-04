import { useState } from 'react';
import { format } from 'date-fns';
import { Calendar as CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DateRange } from 'react-day-picker';

interface DateRangePickerProps {
  dateRange: string;
  customDateRange?: { from: Date; to: Date } | null;
  onDateRangeChange: (range: string) => void;
  onCustomDateRangeChange?: (range: { from: Date; to: Date } | null) => void;
  className?: string;
}

const presetOptions = [
  { value: '1', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: '3', label: 'Last 3 days' },
  { value: '7', label: 'Last 7 days' },
  { value: '14', label: 'Last 14 days' },
  { value: 'custom', label: 'Custom range' },
];

export function DateRangePicker({
  dateRange,
  customDateRange,
  onDateRangeChange,
  onCustomDateRangeChange,
  className,
}: DateRangePickerProps) {
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [tempRange, setTempRange] = useState<DateRange | undefined>(
    customDateRange ? { from: customDateRange.from, to: customDateRange.to } : undefined
  );

  const handlePresetChange = (value: string) => {
    if (value === 'custom') {
      setCalendarOpen(true);
    } else {
      onDateRangeChange(value);
      onCustomDateRangeChange?.(null);
    }
  };

  const handleCalendarSelect = (range: DateRange | undefined) => {
    setTempRange(range);
  };

  const handleApplyCustomRange = () => {
    if (tempRange?.from && tempRange?.to) {
      onDateRangeChange('custom');
      onCustomDateRangeChange?.({ from: tempRange.from, to: tempRange.to });
      setCalendarOpen(false);
    }
  };

  const getDisplayValue = () => {
    if (dateRange === 'custom' && customDateRange?.from && customDateRange?.to) {
      return `${format(customDateRange.from, 'MMM d')} - ${format(customDateRange.to, 'MMM d, yyyy')}`;
    }
    return presetOptions.find(o => o.value === dateRange)?.label || 'Last 7 days';
  };

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <Select value={dateRange} onValueChange={handlePresetChange}>
        <SelectTrigger className="w-[180px] rounded-xl border-[hsl(var(--fog-grey))]">
          <SelectValue>{getDisplayValue()}</SelectValue>
        </SelectTrigger>
        <SelectContent className="rounded-xl">
          {presetOptions.map(option => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            className={cn(
              'rounded-xl border-[hsl(var(--fog-grey))]',
              dateRange === 'custom' && 'border-[hsl(var(--lumi-orange-1))] bg-[hsl(var(--lumi-orange-1)/0.05)]'
            )}
          >
            <CalendarIcon className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0 rounded-xl" align="end">
          <div className="p-4 space-y-4">
            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">Select date range</p>
              <p className="text-xs text-muted-foreground">
                Click to select start and end dates
              </p>
            </div>
            <Calendar
              mode="range"
              selected={tempRange}
              onSelect={handleCalendarSelect}
              numberOfMonths={2}
              disabled={{ after: new Date() }}
              className="pointer-events-auto"
            />
            <div className="flex items-center justify-between pt-2 border-t border-[hsl(var(--fog-grey))]">
              <div className="text-sm text-muted-foreground">
                {tempRange?.from && tempRange?.to ? (
                  <span>
                    {format(tempRange.from, 'MMM d, yyyy')} – {format(tempRange.to, 'MMM d, yyyy')}
                  </span>
                ) : tempRange?.from ? (
                  <span>Select end date</span>
                ) : (
                  <span>Select start date</span>
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setTempRange(undefined);
                    setCalendarOpen(false);
                  }}
                  className="rounded-lg"
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleApplyCustomRange}
                  disabled={!tempRange?.from || !tempRange?.to}
                  className="rounded-lg bg-[hsl(var(--lumi-orange-1))] hover:bg-[hsl(var(--lumi-orange-1)/0.9)]"
                >
                  Apply
                </Button>
              </div>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
