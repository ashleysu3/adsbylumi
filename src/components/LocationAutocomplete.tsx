import { useState, useRef, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { MapPin, Loader2, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface LocationResult {
  name: string;
  region: string;
  country_name: string;
  latitude: number;
  longitude: number;
  key: string;
  type: string;
  display: string;
}

interface LocationAutocompleteProps {
  value: string;
  onChange: (value: string, location?: LocationResult) => void;
  brandId: string;
  placeholder?: string;
  confirmed?: boolean;
}

export function LocationAutocomplete({
  value,
  onChange,
  brandId,
  placeholder = "Enter an address or city",
  confirmed = false,
}: LocationAutocompleteProps) {
  const [results, setResults] = useState<LocationResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isConfirmed, setIsConfirmed] = useState(confirmed);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const searchLocations = useCallback(async (query: string) => {
    if (query.trim().length < 3 || !brandId) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("search-meta-locations", {
        body: { query, brandId },
      });

      if (error) {
        console.error("Location search error:", error);
        setResults([]);
      } else {
        setResults(data?.results || []);
        setIsOpen((data?.results || []).length > 0);
      }
    } catch (err) {
      console.error("Location search failed:", err);
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  }, [brandId]);

  const handleInputChange = (newValue: string) => {
    setIsConfirmed(false);
    onChange(newValue);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      searchLocations(newValue);
    }, 400);
  };

  const handleSelect = (location: LocationResult) => {
    setIsConfirmed(true);
    setIsOpen(false);
    setResults([]);
    onChange(location.display, location);
  };

  return (
    <div ref={wrapperRef} className="relative flex-1">
      <div className="relative">
        <Input
          value={value}
          onChange={(e) => handleInputChange(e.target.value)}
          onFocus={() => {
            if (results.length > 0 && !isConfirmed) setIsOpen(true);
          }}
          placeholder={placeholder}
          className={cn(
            "pr-8",
            isConfirmed && "border-green-500/50 bg-green-500/5"
          )}
        />
        <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : isConfirmed ? (
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          ) : (
            <MapPin className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </div>

      {/* Dropdown */}
      {isOpen && results.length > 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border bg-popover shadow-lg overflow-hidden">
          <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground font-medium border-b">
            Select a location Meta can target
          </div>
          {results.map((result, idx) => (
            <button
              key={`${result.key}-${idx}`}
              type="button"
              className="w-full text-left px-3 py-2.5 flex items-start gap-2.5 hover:bg-accent transition-colors border-b last:border-b-0"
              onClick={() => handleSelect(result)}
            >
              <MapPin className="h-4 w-4 text-primary mt-0.5 shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{result.name}</p>
                {(result.region || result.country_name) && (
                  <p className="text-xs text-muted-foreground truncate">
                    {[result.region, result.country_name].filter(Boolean).join(", ")}
                  </p>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Helper text */}
      {value.trim().length > 0 && !isConfirmed && !isLoading && !isOpen && (
        <p className="text-[11px] text-amber-600 mt-1 flex items-center gap-1">
          <MapPin className="h-3 w-3" />
          Type to search and select a verified location
        </p>
      )}
    </div>
  );
}
