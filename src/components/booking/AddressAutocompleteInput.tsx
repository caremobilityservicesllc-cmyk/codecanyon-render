import { useState, useRef, useEffect } from 'react';
import { MapPin, Loader2, Navigation } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useAddressAutocomplete, AddressSuggestion } from '@/hooks/useAddressAutocomplete';
import { useLanguage } from '@/contexts/LanguageContext';

interface AddressAutocompleteInputProps {
  id: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  accentColor?: 'green' | 'red';
  className?: string;
  savedLocationsElement?: React.ReactNode;
  onLocateMe?: () => void;
  isLocating?: boolean;
  hasError?: boolean;
}

export function AddressAutocompleteInput({
  id,
  placeholder,
  value,
  onChange,
  onBlur,
  accentColor = 'green',
  className,
  savedLocationsElement,
  onLocateMe,
  isLocating,
  hasError,
}: AddressAutocompleteInputProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState(value);
  const [isFocused, setIsFocused] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { t } = useLanguage();

  const { suggestions, isLoading, search, clearSuggestions, isApiConfigured } = useAddressAutocomplete();

  useEffect(() => {
    setInputValue(value);
  }, [value]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setIsFocused(false);
        clearSuggestions();
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [clearSuggestions]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    onChange(newValue);

    if (isApiConfigured && newValue.length >= 3) {
      search(newValue);
      setIsOpen(true);
    } else {
      clearSuggestions();
      setIsOpen(false);
    }
  };

  const handleSuggestionClick = (suggestion: AddressSuggestion) => {
    setInputValue(suggestion.address);
    onChange(suggestion.address);
    setIsOpen(false);
    clearSuggestions();
  };

  const handleFocus = () => {
    setIsFocused(true);
    if (suggestions.length > 0) {
      setIsOpen(true);
    }
  };

  const handleBlur = () => {
    setIsFocused(false);
    onBlur?.();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
      clearSuggestions();
    }
  };

  const borderAccent = accentColor === 'green'
    ? 'border-s-emerald-500 dark:border-s-emerald-400'
    : 'border-s-red-500 dark:border-s-red-400';

  const dotColor = accentColor === 'green'
    ? 'bg-emerald-500'
    : 'bg-red-500';

  return (
    <div ref={containerRef} className="relative group">
      {/* Main input container */}
      <div
        className={cn(
          "flex items-center gap-2 rounded-xl border-2 border-s-4 bg-card px-3 py-0 transition-all duration-200",
          borderAccent,
          isFocused
            ? "border-primary/50 shadow-md ring-2 ring-primary/10"
            : "border-border hover:border-muted-foreground/30",
          hasError && "border-destructive border-s-destructive",
          className
        )}
      >
        {/* Colored dot indicator */}
        <div className={cn("h-2.5 w-2.5 shrink-0 rounded-full", dotColor)} />

        {/* Input */}
        <Input
          ref={inputRef}
          id={id}
          placeholder={placeholder}
          value={inputValue}
          onChange={handleInputChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          className="h-11 border-0 bg-transparent px-0 shadow-none ring-0 focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-muted-foreground/60"
          autoComplete="off"
        />

        {/* Loading spinner */}
        {isLoading && (
          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
        )}

        {/* Action buttons */}
        <div className="flex items-center gap-0.5 shrink-0">
          {savedLocationsElement}
          {onLocateMe && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onLocateMe}
              disabled={isLocating}
              className="h-8 w-8 text-muted-foreground hover:text-primary"
              title={t.booking.useMyLocation}
            >
              <Navigation className={cn("h-4 w-4", isLocating && "animate-pulse")} />
            </Button>
          )}
        </div>

        {/* MapPin icon */}
        <MapPin className={cn(
          "h-4 w-4 shrink-0 transition-colors",
          accentColor === 'green' ? 'text-emerald-500' : 'text-red-500'
        )} />
      </div>

      {/* Suggestions dropdown */}
      {isOpen && suggestions.length > 0 && (
        <div className="absolute z-50 mt-2 w-full rounded-xl border border-border bg-popover shadow-xl overflow-hidden">
          <ul className="max-h-60 overflow-auto py-1">
            {suggestions.map((suggestion) => (
              <li key={suggestion.id}>
                <button
                  type="button"
                  onClick={() => handleSuggestionClick(suggestion)}
                  className="flex w-full items-start gap-3 px-4 py-3 text-start transition-colors hover:bg-muted"
                >
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-foreground">
                      {suggestion.mainText}
                    </p>
                    {suggestion.secondaryText && (
                      <p className="truncate text-sm text-muted-foreground">
                        {suggestion.secondaryText}
                      </p>
                    )}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
