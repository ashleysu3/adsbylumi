import { useState, useCallback, useEffect } from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import { cn } from '@/lib/utils';
import { KPIProgressBar } from './KPIProgressBar';
import { KPITrendIndicator } from './KPITrendIndicator';
import { formatLumiKPIValue, formatBenchmarkRange } from '@/lib/lumi-kpi-config';

interface KPISlide {
  label: string;
  value: number | null;
  kpiKey: string;
  benchmark: {
    min: number;
    max: number;
    unit: string;
  };
  userGoal?: number | null;
  previousValue?: number | null;
}

interface MobileKPICarouselProps {
  slides: KPISlide[];
  statusLabel: string;
  statusColor: string;
}

export function MobileKPICarousel({ slides, statusLabel, statusColor }: MobileKPICarouselProps) {
  const [emblaRef, emblaApi] = useEmblaCarousel({ 
    loop: false,
    align: 'start',
    skipSnaps: false,
  });
  const [selectedIndex, setSelectedIndex] = useState(0);

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setSelectedIndex(emblaApi.selectedScrollSnap());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    onSelect();
    emblaApi.on('select', onSelect);
    return () => {
      emblaApi.off('select', onSelect);
    };
  }, [emblaApi, onSelect]);

  const scrollTo = useCallback((index: number) => {
    if (!emblaApi) return;
    emblaApi.scrollTo(index);
  }, [emblaApi]);

  return (
    <div className="space-y-3">
      {/* Carousel */}
      <div className="overflow-hidden" ref={emblaRef}>
        <div className="flex">
          {slides.map((slide, index) => (
            <div 
              key={slide.kpiKey} 
              className="flex-[0_0_100%] min-w-0 px-1"
            >
              <div className="bg-muted/30 rounded-xl p-4 text-center">
                <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium mb-1">
                  {slide.label}
                </p>
                <p className="text-4xl font-bold text-foreground mb-2">
                  {formatLumiKPIValue(slide.value, slide.kpiKey)}
                </p>
                
                {/* Trend */}
                <div className="flex justify-center mb-3">
                  <KPITrendIndicator
                    currentValue={slide.value}
                    previousValue={slide.previousValue || null}
                    kpiKey={slide.kpiKey}
                  />
                </div>
                
                {/* Progress Bar */}
                <div className="flex justify-center mb-3">
                  <KPIProgressBar
                    value={slide.value}
                    benchmark={slide.benchmark}
                    userGoal={slide.userGoal}
                    kpiKey={slide.kpiKey}
                    className="w-40"
                  />
                </div>
                
                {/* Benchmark & Goal */}
                <div className="flex justify-center gap-6 text-xs text-muted-foreground">
                  <div>
                    <span className="uppercase tracking-wider">Benchmark</span>
                    <p className="text-sm text-foreground mt-0.5">
                      {formatBenchmarkRange(slide.benchmark)}
                    </p>
                  </div>
                  {slide.userGoal && (
                    <div>
                      <span className="uppercase tracking-wider">Goal</span>
                      <p className="text-sm text-foreground mt-0.5">
                        {slide.benchmark.unit === 'x' 
                          ? `${slide.userGoal.toFixed(2)}x` 
                          : `${slide.benchmark.unit}${slide.userGoal.toFixed(2)}`
                        }
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Dot indicators + Status */}
      <div className="flex items-center justify-between px-1">
        <div className="flex gap-1.5">
          {slides.map((_, index) => (
            <button
              key={index}
              onClick={() => scrollTo(index)}
              className={cn(
                "h-2 rounded-full transition-all duration-200",
                index === selectedIndex 
                  ? "w-6 bg-primary" 
                  : "w-2 bg-muted-foreground/30 hover:bg-muted-foreground/50"
              )}
              aria-label={`Go to slide ${index + 1}`}
            />
          ))}
        </div>
        
        {/* Status Badge */}
        <span className={cn(
          "text-xs font-medium px-2.5 py-1 rounded-full",
          statusColor
        )}>
          {statusLabel}
        </span>
      </div>

      {/* Swipe hint on first load */}
      <p className="text-center text-xs text-muted-foreground/60">
        Swipe for more metrics
      </p>
    </div>
  );
}
