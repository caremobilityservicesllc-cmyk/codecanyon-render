import { Skeleton } from '@/components/ui/skeleton';

export function Step1LocationSkeleton() {
  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="mb-6 text-center">
        <Skeleton className="mx-auto h-8 w-64 sm:h-10 sm:w-80" />
        <Skeleton className="mx-auto mt-2 h-5 w-48" />
      </div>

      {/* Service Type Tabs Skeleton */}
      <div className="mx-auto mb-6 flex justify-center">
        <Skeleton className="h-10 w-56 rounded-lg" />
      </div>

      {/* Transfer Type Skeleton */}
      <div className="mx-auto mb-6 max-w-2xl">
        <Skeleton className="mb-3 h-4 w-24" />
        <div className="grid grid-cols-3 gap-3">
          <Skeleton className="h-16 rounded-lg" />
          <Skeleton className="h-16 rounded-lg" />
          <Skeleton className="h-16 rounded-lg" />
        </div>
      </div>

      <div className="mx-auto max-w-4xl">
        <div className="grid gap-8 lg:grid-cols-2">
          {/* Form Column Skeleton */}
          <div className="space-y-5">
            {/* Pickup Location */}
            <div className="space-y-2">
              <Skeleton className="h-4 w-28" />
              <div className="flex gap-2">
                <Skeleton className="h-10 flex-1 rounded-lg" />
                <Skeleton className="h-10 w-10 rounded-lg" />
              </div>
            </div>

            {/* Drop-off Location */}
            <div className="space-y-2">
              <Skeleton className="h-4 w-32" />
              <div className="flex gap-2">
                <Skeleton className="h-10 flex-1 rounded-lg" />
                <Skeleton className="h-10 w-10 rounded-lg" />
              </div>
            </div>

            {/* Date, Time, Passengers Row */}
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3">
              <div className="space-y-2">
                <Skeleton className="h-4 w-12" />
                <Skeleton className="h-10 rounded-lg" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-4 w-12" />
                <Skeleton className="h-10 rounded-lg" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-10 rounded-lg" />
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-20 rounded-lg" />
            </div>

            {/* Continue Button */}
            <Skeleton className="h-12 w-full rounded-lg" />
          </div>

          {/* Map Column Skeleton */}
          <div className="hidden lg:block">
            <Skeleton className="h-80 w-full rounded-xl" />
            {/* Route Info Card Skeleton */}
            <div className="mt-4 space-y-3">
              <Skeleton className="h-16 rounded-xl" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
