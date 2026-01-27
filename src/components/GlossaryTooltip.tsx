import { HelpCircle } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { adsGlossary, GlossaryTerm } from "@/lib/ads-glossary";
import { cn } from "@/lib/utils";

interface GlossaryTooltipProps {
  term: keyof typeof adsGlossary | string;
  children?: React.ReactNode;
  className?: string;
  iconClassName?: string;
  showIcon?: boolean;
}

export function GlossaryTooltip({ 
  term, 
  children, 
  className,
  iconClassName,
  showIcon = true 
}: GlossaryTooltipProps) {
  const glossaryTerm = adsGlossary[term as keyof typeof adsGlossary];
  
  if (!glossaryTerm) {
    return <>{children}</>;
  }

  return (
    <TooltipProvider>
      <Tooltip delayDuration={300}>
        <TooltipTrigger asChild>
          <span className={cn("inline-flex items-center gap-1 cursor-help", className)}>
            {children}
            {showIcon && (
              <HelpCircle className={cn("h-3.5 w-3.5 text-muted-foreground hover:text-primary transition-colors", iconClassName)} />
            )}
          </span>
        </TooltipTrigger>
        <TooltipContent 
          side="top" 
          className="max-w-[280px] p-3 bg-popover border shadow-lg"
        >
          <div className="space-y-1.5">
            <p className="font-semibold text-sm">
              {glossaryTerm.term}
              {glossaryTerm.acronym && (
                <span className="text-muted-foreground font-normal"> ({glossaryTerm.acronym})</span>
              )}
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {glossaryTerm.definition}
            </p>
            {glossaryTerm.example && (
              <p className="text-xs text-muted-foreground/80 italic border-t border-border pt-1.5 mt-1.5">
                {glossaryTerm.example}
              </p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// Inline version for use within text
interface GlossaryTermInlineProps {
  term: keyof typeof adsGlossary | string;
  label?: string;
}

export function GlossaryTermInline({ term, label }: GlossaryTermInlineProps) {
  const glossaryTerm = adsGlossary[term as keyof typeof adsGlossary];
  const displayLabel = label || glossaryTerm?.acronym || glossaryTerm?.term || term;

  return (
    <GlossaryTooltip term={term} showIcon={false}>
      <span className="underline decoration-dotted decoration-muted-foreground/50 underline-offset-2 cursor-help">
        {displayLabel}
      </span>
    </GlossaryTooltip>
  );
}