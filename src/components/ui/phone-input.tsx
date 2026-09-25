"use client";

import * as React from "react";
import { ChevronDown, Phone } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Country Data ────────────────────────────────────────────────────────────
export interface Country {
  code: string;   // e.g. "ET"
  name: string;   // e.g. "Ethiopia"
  dial: string;   // e.g. "+251"
  flag: string;   // emoji flag
}

const COUNTRIES: Country[] = [
  { code: "ET", name: "Ethiopia",       dial: "+251", flag: "🇪🇹" },
  { code: "US", name: "United States",  dial: "+1",   flag: "🇺🇸" },
  { code: "GB", name: "United Kingdom", dial: "+44",  flag: "🇬🇧" },
  { code: "KE", name: "Kenya",          dial: "+254", flag: "🇰🇪" },
  { code: "NG", name: "Nigeria",        dial: "+234", flag: "🇳🇬" },
  { code: "IN", name: "India",          dial: "+91",  flag: "🇮🇳" },
  { code: "DE", name: "Germany",        dial: "+49",  flag: "🇩🇪" },
  { code: "FR", name: "France",         dial: "+33",  flag: "🇫🇷" },
  { code: "AE", name: "UAE",            dial: "+971", flag: "🇦🇪" },
  { code: "SA", name: "Saudi Arabia",   dial: "+966", flag: "🇸🇦" },
  { code: "CN", name: "China",          dial: "+86",  flag: "🇨🇳" },
  { code: "JP", name: "Japan",          dial: "+81",  flag: "🇯🇵" },
  { code: "BR", name: "Brazil",         dial: "+55",  flag: "🇧🇷" },
  { code: "CA", name: "Canada",         dial: "+1",   flag: "🇨🇦" },
  { code: "AU", name: "Australia",      dial: "+61",  flag: "🇦🇺" },
  { code: "TR", name: "Turkey",         dial: "+90",  flag: "🇹🇷" },
  { code: "EG", name: "Egypt",          dial: "+20",  flag: "🇪🇬" },
  { code: "ZA", name: "South Africa",   dial: "+27",  flag: "🇿🇦" },
];

// ─── Component Props ─────────────────────────────────────────────────────────
interface PhoneInputProps {
  value?: string;
  onChange?: (fullNumber: string) => void;
  disabled?: boolean;
  placeholder?: string;
  id?: string;
  name?: string;
  className?: string;
  error?: boolean;
}

/**
 * PhoneInput — Input field with an integrated country code dropdown.
 * The `onChange` callback receives the full phone number as e.g. "0911223344"
 * (the backend normalises it). The country code is purely a visual UX hint.
 */
const PhoneInput = React.forwardRef<HTMLInputElement, PhoneInputProps>(
  ({ value, onChange, disabled, placeholder, id, name, className, error }, ref) => {
    const [selectedCountry, setSelectedCountry] = React.useState<Country>(COUNTRIES[0]);
    const [isOpen, setIsOpen] = React.useState(false);
    const [search, setSearch] = React.useState("");
    const dropdownRef = React.useRef<HTMLDivElement>(null);

    // Close dropdown on outside click
    React.useEffect(() => {
      const handleClickOutside = (e: MouseEvent) => {
        if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
          setIsOpen(false);
          setSearch("");
        }
      };
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const filteredCountries = COUNTRIES.filter(
      (c) =>
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.dial.includes(search) ||
        c.code.toLowerCase().includes(search.toLowerCase())
    );

    return (
      <div className={cn("relative", className)} ref={dropdownRef}>
        <div
          className={cn(
            "flex h-10 w-full rounded-lg border bg-background text-sm transition-colors",
            error ? "border-destructive" : "border-border/80",
            "focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-1",
            disabled && "opacity-50 cursor-not-allowed"
          )}
        >
          {/* Country selector button */}
          <button
            type="button"
            onClick={() => {
              if (!disabled) {
                setIsOpen((prev) => !prev);
                setSearch("");
              }
            }}
            className={cn(
              "flex items-center gap-1 px-2.5 border-r border-border/60 rounded-l-lg",
              "hover:bg-muted/60 transition-colors text-sm shrink-0",
              disabled && "pointer-events-none"
            )}
          >
            <span className="text-base leading-none">{selectedCountry.flag}</span>
            <span className="font-medium text-foreground text-xs">{selectedCountry.dial}</span>
            <ChevronDown className="size-3 text-muted-foreground" />
          </button>

          {/* Phone number input */}
          <input
            ref={ref}
            id={id}
            name={name}
            type="tel"
            inputMode="numeric"
            autoComplete="tel"
            disabled={disabled}
            placeholder={placeholder || ""}
            value={value || ""}
            onChange={(e) => {
              onChange?.(e.target.value);
            }}
            className={cn(
              "flex-1 bg-transparent px-3 py-2 outline-none placeholder:text-muted-foreground",
              "disabled:cursor-not-allowed"
            )}
          />

          <Phone className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
        </div>

        {/* Country dropdown */}
        {isOpen && (
          <div className="absolute left-0 top-full z-50 mt-1 w-full min-w-[280px] rounded-lg border border-border bg-popover shadow-lg animate-in fade-in-0 zoom-in-95">
            {/* Search */}
            <div className="p-2 border-b border-border/50">
              <input
                type="text"
                placeholder="Search countries..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-md bg-muted/50 px-3 py-1.5 text-sm outline-none placeholder:text-muted-foreground"
                autoFocus
              />
            </div>

            {/* List */}
            <div className="max-h-48 overflow-y-auto py-1">
              {filteredCountries.length === 0 ? (
                <div className="px-3 py-2 text-sm text-muted-foreground">No countries found</div>
              ) : (
                filteredCountries.map((country) => (
                  <button
                    key={country.code}
                    type="button"
                    onClick={() => {
                      setSelectedCountry(country);
                      setIsOpen(false);
                      setSearch("");
                    }}
                    className={cn(
                      "flex w-full items-center gap-2.5 px-3 py-2 text-sm transition-colors",
                      "hover:bg-muted/70",
                      selectedCountry.code === country.code && "bg-primary/10 text-primary font-medium"
                    )}
                  >
                    <span className="text-base">{country.flag}</span>
                    <span className="flex-1 text-left truncate">{country.name}</span>
                    <span className="text-xs text-muted-foreground font-mono">{country.dial}</span>
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    );
  }
);

PhoneInput.displayName = "PhoneInput";

export { PhoneInput, COUNTRIES };
