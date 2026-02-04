import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBrand } from '@/contexts/BrandContext';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { Building2, ChevronDown, Plus, Check, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BrandSelectorProps {
  className?: string;
  compact?: boolean;
}

export function BrandSelector({ className, compact = false }: BrandSelectorProps) {
  const { brands, activeBrand, setActiveBrand, isAgencyUser, loading } = useBrand();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  // Don't show if not an agency user
  if (!isAgencyUser) {
    return null;
  }

  if (loading) {
    return (
      <div className={cn("flex items-center gap-2 px-3 py-2", className)}>
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const handleAddBrand = () => {
    setOpen(false);
    navigate('/onboarding?mode=add-brand');
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className={cn(
            "gap-2 h-auto py-2 px-3",
            "hover:bg-muted/80 transition-colors",
            compact && "px-2",
            className
          )}
        >
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded-md bg-gradient-to-br from-lumi-orange-1 to-lumi-pink-1 flex items-center justify-center">
              <Building2 className="h-3.5 w-3.5 text-white" />
            </div>
            {!compact && (
              <div className="flex flex-col items-start">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-muted-foreground font-normal">Brand</span>
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 bg-lumi-purple-1/10 text-lumi-purple-1 border-0">
                    Agency
                  </Badge>
                </div>
                <span className="text-sm font-medium truncate max-w-[120px]">
                  {activeBrand?.name || 'Select Brand'}
                </span>
              </div>
            )}
          </div>
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>Your Brands</span>
          <Badge variant="secondary" className="text-xs">
            {brands.length} total
          </Badge>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <div className="max-h-[300px] overflow-y-auto">
          {brands.map((brand) => (
            <DropdownMenuItem
              key={brand.id}
              onClick={() => {
                setActiveBrand(brand);
                setOpen(false);
              }}
              className="flex items-center gap-3 py-2.5 cursor-pointer"
            >
              <div className="h-8 w-8 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Building2 className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{brand.name}</p>
                {brand.industry && (
                  <p className="text-xs text-muted-foreground truncate">{brand.industry}</p>
                )}
              </div>
              {activeBrand?.id === brand.id && (
                <Check className="h-4 w-4 text-primary flex-shrink-0" />
              )}
            </DropdownMenuItem>
          ))}
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleAddBrand} className="gap-2 text-primary cursor-pointer">
          <Plus className="h-4 w-4" />
          Add New Brand
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
