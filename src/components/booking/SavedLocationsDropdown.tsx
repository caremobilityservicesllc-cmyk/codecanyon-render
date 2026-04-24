import { useState } from 'react';
import { MapPin, Star, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useSavedLocations, SavedLocation } from '@/hooks/useSavedLocations';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';

interface SavedLocationsDropdownProps {
  type: 'pickup' | 'dropoff';
  currentAddress: string;
  onSelectLocation: (address: string) => void;
}

export function SavedLocationsDropdown({ 
  type, 
  currentAddress, 
  onSelectLocation 
}: SavedLocationsDropdownProps) {
  const { user } = useAuth();
  const { t } = useLanguage();
  const sl = (t as any).savedLocations || {};
  const { savedLocations, addLocation, removeLocation, setDefaultLocation } = useSavedLocations();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newAddress, setNewAddress] = useState('');

  if (!user) return null;

  const handleAdd = () => {
    if (newName && newAddress) {
      addLocation.mutate({ 
        name: newName, 
        address: newAddress,
        is_default_pickup: false,
        is_default_dropoff: false,
      });
      setNewName('');
      setNewAddress('');
      setIsAddDialogOpen(false);
    }
  };

  const handleSaveCurrent = () => {
    if (currentAddress) {
      setNewAddress(currentAddress);
      setIsAddDialogOpen(true);
    }
  };

  return (
    <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
            <Star className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuLabel>{sl.title || 'Saved Locations'}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          
          {savedLocations.length === 0 ? (
            <div className="px-2 py-3 text-center text-sm text-muted-foreground">
              {sl.noSavedLocations || 'No saved locations yet'}
            </div>
          ) : (
            savedLocations.map((location) => (
              <DropdownMenuItem
                key={location.id}
                className="flex items-start justify-between gap-2"
                onSelect={(e) => {
                  e.preventDefault();
                  onSelectLocation(location.address);
                }}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1">
                    <MapPin className="h-3 w-3 text-accent shrink-0" />
                    <span className="font-medium truncate">{location.name}</span>
                    {((type === 'pickup' && location.is_default_pickup) || 
                      (type === 'dropoff' && location.is_default_dropoff)) && (
                      <Star className="h-3 w-3 text-yellow-500 fill-yellow-500 shrink-0" />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate ms-4">
                    {location.address}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 shrink-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeLocation.mutate(location.id);
                  }}
                >
                  <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                </Button>
              </DropdownMenuItem>
            ))
          )}
          
          <DropdownMenuSeparator />
          
          {currentAddress && (
            <DropdownMenuItem onSelect={handleSaveCurrent}>
              <Plus className="h-4 w-4 me-2" />
              {sl.saveCurrentAddress || 'Save current address'}
            </DropdownMenuItem>
          )}
          
          <DialogTrigger asChild>
            <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
              <Plus className="h-4 w-4 me-2" />
              {sl.addNewLocation || 'Add new location'}
            </DropdownMenuItem>
          </DialogTrigger>
        </DropdownMenuContent>
      </DropdownMenu>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>{sl.saveLocation || 'Save Location'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label htmlFor="location-name">{sl.name || 'Name'}</Label>
            <Input
              id="location-name"
              placeholder={sl.namePlaceholder || 'e.g., Home, Office, Airport'}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="location-address">{sl.address || 'Address'}</Label>
            <Input
              id="location-address"
              placeholder={sl.addressPlaceholder || 'Full address'}
              value={newAddress}
              onChange={(e) => setNewAddress(e.target.value)}
            />
          </div>
          <Button 
            onClick={handleAdd} 
            disabled={!newName || !newAddress || addLocation.isPending}
            className="w-full"
          >
            {sl.saveLocation || 'Save Location'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
