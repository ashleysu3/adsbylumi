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
import { DateRange } from 'react-day-picker';

interface DateRangePillPickerProps {
  dateRange: string;
  customDateRange?: { from: Date; to: Date } | null;
  onDateRangeChange: (range: string) => void;
  onCustomDateRangeChange?: (range: { from: Date; to: Date } | null) => void;
  className?: string;
}

// Same preset set as DateRangePicker (the dropdown version used on /data),
// restyled as the segmented-pill control the Studio redesign calls for.
// Kept every existing option — Today/Yesterday/3-day/Custom — rather than
// trimming to just 7/14/30, so nothing a user relied on disappears.
const presetOptions = [
  { value: '1', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: '3', label: '3d' },
  { value: '7', label: '7d' },
  { value: '14', label: '14d' },
  { value: '30', label: '30d' },
];

export function DateRangePillPicker({
  dateRange,
  customDateRange,
  onDateRangeChange,
  onCustomDateRangeChange,
  className,
}: DateRangePillPickerProps) {
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [tempRange, setTempRange] = useState<DateRange | undefined>(
    customDateRange ? { from: customDateRange.from, to: customDateRange.to } : undefined
  );

  const handlePresetClick = (value: string) => {
    onDateRangeChange(value);
    onCustomDateRangeChange?.(null);
  };

  const handleApplyCustomRange = () => {
    if (tempRange?.from && tempRange?.to) {
      onDateRangeChange('custom');
      onCustomDateRangeChange?.({ from: tempRange.from, to: tempRange.to });
      setCalendarOpen(false);
    }
  };

  const isCustom = dateRange === 'custom';

  return (
    <div className={cn('flex items-center gap-1.5', className)}>
      <div className="flex items-center gap-1 rounded-full bg-muted/60 p-1">
        {presetOptions.map((option) => {
          const active = !isCustom && dateRange === option.value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => handlePresetClick(option.value)}
              className={cn(
                'rounded-full px-3 py-1.5 text-sm font-medium transition-colors',
                active
                  ? 'bg-card text-foreground font-semibold shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>

      <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            className={cn(
              'h-8 w-8 rounded-full border-border',
              isCustom && 'border-[hsl(var(--lumi-orange-1))] bg-[hsl(var(--lumi-orange-1)/0.05)]'
            )}
            aria-label={isCustom && customDateRange ? `Custom range: ${format(customDateRange.from, 'MMM d')} – ${format(customDateRange.to, 'MMM d')}` : 'Pick a custom date range'}
          >
            <CalendarIcon className="h-3.5 w-3.5" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0 rounded-xl" align="end">
          <div className="p-4 space-y-4">
            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">Select date range</p>
              <p className="text-xs text-muted-foreground">Click to select start and end dates</p>
            </div>
            <Calendar
              mode="range"
              selected={tempRange}
              onSelect={setTempRange}
              numberOfMonths={2}
              disabled={{ after: new Date() }}
              className="pointer-events-auto"
            />
            <div className="flex items-center justify-between pt-2 border-t border-border">
              <div className="text-sm text-muted-foreground">
                {tempRange?.from && tempRange?.to ? (
                  <span>{format(tempRange.from, 'MMM d, yyyy')} – {format(tempRange.to, 'MMM d, yyyy')}</span>
                ) : tempRange?.from ? (
                  <span>Select end date</span>
                ) : (
                  <span>Select start date</span>
                )}
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => { setTempRange(undefined); setCalendarOpen(false); }} className="rounded-lg">
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
