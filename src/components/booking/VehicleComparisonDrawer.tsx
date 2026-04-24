import { X, Users, Briefcase, Check, AlertTriangle } from 'lucide-react';
import { Vehicle } from '@/types/booking';
import { VehiclePriceEstimate } from '@/hooks/useVehiclePricing';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerFooter,
} from '@/components/ui/drawer';
import { useLanguage } from '@/contexts/LanguageContext';

interface VehicleComparisonDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vehicles: Vehicle[];
  selectedVehicle: Vehicle | null;
  onSelectVehicle: (vehicle: Vehicle) => void;
  getPrice: (vehicle: Vehicle) => VehiclePriceEstimate | null;
  luggageCount: number;
  passengerCount: number;
  isReturnTrip: boolean;
}

export function VehicleComparisonDrawer({
  open,
  onOpenChange,
  vehicles,
  selectedVehicle,
  onSelectVehicle,
  getPrice,
  luggageCount,
  passengerCount,
  isReturnTrip,
}: VehicleComparisonDrawerProps) {
  const { t } = useLanguage();
  const allFeatures = Array.from(
    new Set(vehicles.flatMap((v) => v.features))
  ).sort();

  const handleSelect = (vehicle: Vehicle) => {
    onSelectVehicle(vehicle);
    onOpenChange(false);
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[85vh]">
        <DrawerHeader className="border-b border-border">
          <DrawerTitle>{t.vehicleComparison.compareVehicles}</DrawerTitle>
          <DrawerDescription>
            {t.vehicleComparison.sideByComparison.replace('{count}', String(vehicles.length))}
          </DrawerDescription>
        </DrawerHeader>

        <div className="overflow-x-auto p-4">
          <table className="w-full min-w-[600px] border-collapse">
            <thead>
              <tr>
                <th className="w-40 p-3 text-left text-sm font-medium text-muted-foreground">
                  {t.vehicleComparison.feature}
                </th>
                {vehicles.map((vehicle) => {
                  const isSelected = selectedVehicle?.id === vehicle.id;
                  const hasLuggageWarning = vehicle.luggage < luggageCount;
                  const hasPassengerWarning = vehicle.passengers < passengerCount;

                  return (
                    <th
                      key={vehicle.id}
                      className={cn(
                        'relative min-w-[180px] p-3 text-center',
                        isSelected && 'bg-primary/10'
                      )}
                    >
                      {isSelected && (
                        <div className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2">
                          <span className="rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground">
                            {t.vehicleComparison.selected}
                          </span>
                        </div>
                      )}
                      <div className="mx-auto mb-2 aspect-[16/10] w-32 overflow-hidden rounded-lg bg-muted">
                        <img src={vehicle.image} alt={vehicle.name} className="h-full w-full object-cover" />
                      </div>
                      <div className="font-display text-base font-semibold text-foreground">{vehicle.name}</div>
                      <div className="text-xs text-muted-foreground">{vehicle.category}</div>
                      {(hasLuggageWarning || hasPassengerWarning) && (
                        <div className="mt-1 flex items-center justify-center gap-1 text-xs text-amber-500">
                          <AlertTriangle className="h-3 w-3" />
                          <span>{t.vehicleComparison.capacityWarning}</span>
                        </div>
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>

            <tbody className="divide-y divide-border">
              <tr>
                <td className="p-3 text-sm font-medium text-muted-foreground">{t.vehicleComparison.price}</td>
                {vehicles.map((vehicle) => {
                  const priceEstimate = getPrice(vehicle);
                  const isSelected = selectedVehicle?.id === vehicle.id;
                  return (
                    <td key={vehicle.id} className={cn('p-3 text-center', isSelected && 'bg-primary/10')}>
                      {priceEstimate ? (
                        <div>
                          <span className="text-lg font-bold text-primary">${priceEstimate.estimatedTotal.toFixed(0)}</span>
                          <span className="ml-1 text-xs text-muted-foreground">{isReturnTrip ? t.vehicleComparison.return : ''}</span>
                        </div>
                      ) : vehicle.base_price ? (
                        <span className="text-lg font-bold text-accent">${vehicle.base_price.toFixed(0)}+</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                  );
                })}
              </tr>

              <tr>
                <td className="p-3 text-sm font-medium text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    {t.vehicleComparison.passengers}
                  </div>
                </td>
                {vehicles.map((vehicle) => {
                  const isSelected = selectedVehicle?.id === vehicle.id;
                  const hasWarning = vehicle.passengers < passengerCount;
                  return (
                    <td key={vehicle.id} className={cn('p-3 text-center', isSelected && 'bg-accent/10')}>
                      <span className={cn('font-medium', hasWarning ? 'text-destructive' : 'text-foreground')}>
                        {t.vehicleComparison.upTo.replace('{count}', String(vehicle.passengers))}
                        {hasWarning && (
                          <span className="ml-1 text-xs">({t.vehicleComparison.need.replace('{count}', String(passengerCount))})</span>
                        )}
                      </span>
                    </td>
                  );
                })}
              </tr>

              <tr>
                <td className="p-3 text-sm font-medium text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Briefcase className="h-4 w-4" />
                    {t.vehicleComparison.luggage}
                  </div>
                </td>
                {vehicles.map((vehicle) => {
                  const isSelected = selectedVehicle?.id === vehicle.id;
                  const hasWarning = vehicle.luggage < luggageCount;
                  return (
                    <td key={vehicle.id} className={cn('p-3 text-center', isSelected && 'bg-accent/10')}>
                      <span className={cn('font-medium', hasWarning ? 'text-destructive' : 'text-foreground')}>
                        {t.vehicleComparison.bags.replace('{count}', String(vehicle.luggage))}
                        {hasWarning && (
                          <span className="ml-1 text-xs">({t.vehicleComparison.need.replace('{count}', String(luggageCount))})</span>
                        )}
                      </span>
                    </td>
                  );
                })}
              </tr>

              {allFeatures.map((feature) => (
                <tr key={feature}>
                  <td className="p-3 text-sm text-muted-foreground">{feature}</td>
                  {vehicles.map((vehicle) => {
                    const hasFeature = vehicle.features.includes(feature);
                    const isSelected = selectedVehicle?.id === vehicle.id;
                    return (
                      <td key={vehicle.id} className={cn('p-3 text-center', isSelected && 'bg-accent/10')}>
                        {hasFeature ? (
                          <Check className="mx-auto h-5 w-5 text-accent" />
                        ) : (
                          <X className="mx-auto h-5 w-5 text-muted-foreground/30" />
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>

            <tfoot>
              <tr>
                <td className="p-3"></td>
                {vehicles.map((vehicle) => {
                  const isSelected = selectedVehicle?.id === vehicle.id;
                  return (
                    <td key={vehicle.id} className={cn('p-3', isSelected && 'bg-accent/10')}>
                      <Button
                        variant={isSelected ? 'default' : 'outline'}
                        className="w-full"
                        onClick={() => handleSelect(vehicle)}
                      >
                        {isSelected ? t.vehicleComparison.selected : t.vehicleComparison.select}
                      </Button>
                    </td>
                  );
                })}
              </tr>
            </tfoot>
          </table>
        </div>

        <DrawerFooter className="border-t border-border">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t.vehicleComparison.closeComparison}
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
