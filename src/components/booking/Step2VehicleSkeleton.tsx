import { Skeleton } from '@/components/ui/skeleton';

function VehicleCardSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      {/* Vehicle Image */}
      <Skeleton className="mb-4 h-32 w-full rounded-lg" />
      
      {/* Vehicle Name & Category */}
      <div className="mb-3 flex items-start justify-between">
        <div>
          <Skeleton className="h-5 w-32" />
          <Skeleton className="mt-1 h-4 w-20" />
        </div>
        <Skeleton className="h-6 w-6 rounded" />
      </div>
      
      {/* Passengers & Luggage */}
      <div className="mb-3 flex gap-4">
        <div className="flex items-center gap-1">
          <Skeleton className="h-4 w-4" />
          <Skeleton className="h-4 w-8" />
        </div>
        <div className="flex items-center gap-1">
          <Skeleton className="h-4 w-4" />
          <Skeleton className="h-4 w-8" />
        </div>
      </div>
      
      {/* Features */}
      <div className="mb-4 flex flex-wrap gap-2">
        <Skeleton className="h-5 w-16 rounded-full" />
        <Skeleton className="h-5 w-20 rounded-full" />
        <Skeleton className="h-5 w-14 rounded-full" />
      </div>
      
      {/* Price */}
      <div className="flex items-center justify-between border-t border-border pt-3">
        <Skeleton className="h-6 w-20" />
        <Skeleton className="h-9 w-24 rounded-lg" />
      </div>
    </div>
  );
}

export function Step2VehicleSkeleton() {
  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="mb-6 text-center">
        <Skeleton className="mx-auto h-8 w-48 sm:h-10 sm:w-56" />
        <Skeleton className="mx-auto mt-2 h-5 w-64" />
      </div>

      {/* Filter Bar Skeleton */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-card p-4">
        <div className="flex items-center gap-2">
          <Skeleton className="h-5 w-5" />
          <div className="flex gap-2">
            <Skeleton className="h-8 w-16 rounded-full" />
            <Skeleton className="h-8 w-20 rounded-full" />
            <Skeleton className="h-8 w-18 rounded-full" />
            <Skeleton className="h-8 w-24 rounded-full" />
          </div>
        </div>
        <Skeleton className="h-4 w-36" />
      </div>

      {/* Vehicle Grid Skeleton */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <VehicleCardSkeleton />
        <VehicleCardSkeleton />
        <VehicleCardSkeleton />
        <VehicleCardSkeleton />
        <VehicleCardSkeleton />
        <VehicleCardSkeleton />
      </div>

      {/* Navigation Buttons Skeleton */}
      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-between">
        <Skeleton className="order-2 h-10 w-full sm:order-1 sm:w-36" />
        <Skeleton className="order-1 h-10 w-full sm:order-2 sm:w-44" />
      </div>
    </div>
  );
}
