import { Skeleton } from '@/components/ui/skeleton';

function PaymentMethodSkeleton() {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-border p-4">
      <Skeleton className="h-12 w-12 shrink-0 rounded-xl" />
      <div className="flex-1">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="mt-1 h-4 w-48" />
      </div>
      <Skeleton className="h-5 w-5 rounded-full" />
    </div>
  );
}

function SavedCardSkeleton() {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border p-3">
      <Skeleton className="h-10 w-10 rounded-lg" />
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <Skeleton className="h-5 w-12 rounded" />
          <Skeleton className="h-4 w-20" />
        </div>
        <Skeleton className="mt-1 h-3 w-24" />
      </div>
      <Skeleton className="h-5 w-5 rounded-full" />
    </div>
  );
}

function OrderSummarySkeleton() {
  return (
    <div className="rounded-xl border border-border bg-card p-6">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-5 w-20 rounded-full" />
      </div>

      {/* Trip Details */}
      <div className="space-y-3 border-b border-border pb-4">
        <div className="flex items-start gap-3">
          <Skeleton className="mt-1 h-4 w-4 rounded-full" />
          <div className="flex-1">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="mt-1 h-4 w-full" />
          </div>
        </div>
        <div className="flex items-start gap-3">
          <Skeleton className="mt-1 h-4 w-4 rounded-full" />
          <div className="flex-1">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="mt-1 h-4 w-full" />
          </div>
        </div>
      </div>

      {/* Date/Time/Passengers Grid */}
      <div className="grid grid-cols-3 gap-3 border-b border-border py-4">
        <div>
          <Skeleton className="h-3 w-10" />
          <Skeleton className="mt-1 h-4 w-16" />
        </div>
        <div>
          <Skeleton className="h-3 w-10" />
          <Skeleton className="mt-1 h-4 w-14" />
        </div>
        <div>
          <Skeleton className="h-3 w-16" />
          <Skeleton className="mt-1 h-4 w-8" />
        </div>
      </div>

      {/* Vehicle Info */}
      <div className="border-b border-border py-4">
        <div className="flex items-center gap-3">
          <Skeleton className="h-12 w-16 rounded-lg" />
          <div>
            <Skeleton className="h-4 w-24" />
            <Skeleton className="mt-1 h-3 w-16" />
          </div>
        </div>
      </div>

      {/* Price Breakdown */}
      <div className="space-y-2 pt-4">
        <div className="flex justify-between">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-16" />
        </div>
        <div className="flex justify-between">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-14" />
        </div>
        <div className="flex justify-between border-t border-border pt-2">
          <Skeleton className="h-5 w-16" />
          <Skeleton className="h-5 w-20" />
        </div>
        <div className="flex justify-between">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-16" />
        </div>
      </div>
    </div>
  );
}

export function Step3PaymentSkeleton() {
  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="mb-6 text-center">
        <Skeleton className="mx-auto h-8 w-56 sm:h-10 sm:w-72" />
        <Skeleton className="mx-auto mt-2 h-5 w-72" />
      </div>

      <div className="mx-auto max-w-4xl">
        <div className="grid gap-8 lg:grid-cols-5">
          {/* Left Column - Payment Methods */}
          <div className="space-y-6 lg:col-span-3">
            {/* Payment Methods Card */}
            <div className="rounded-xl border border-border bg-card p-6">
              <Skeleton className="mb-4 h-6 w-44" />
              <div className="space-y-3">
                <PaymentMethodSkeleton />
                <PaymentMethodSkeleton />
                <PaymentMethodSkeleton />
              </div>

              {/* Saved Cards Section Skeleton */}
              <div className="mt-4 space-y-3 border-t border-border pt-4">
                <Skeleton className="h-4 w-24" />
                <SavedCardSkeleton />
                <SavedCardSkeleton />
              </div>
            </div>

            {/* Promo Code Section */}
            <div className="rounded-xl border border-border bg-card p-6">
              <Skeleton className="mb-4 h-6 w-32" />
              <div className="flex gap-2">
                <Skeleton className="h-10 flex-1 rounded-lg" />
                <Skeleton className="h-10 w-20 rounded-lg" />
              </div>
            </div>

            {/* Terms Section */}
            <div className="rounded-xl border border-border bg-card p-6">
              <div className="flex items-start gap-3">
                <Skeleton className="h-5 w-5 rounded" />
                <div className="flex-1">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="mt-1 h-4 w-3/4" />
                </div>
              </div>
            </div>

            {/* Validation Feedback Skeleton */}
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-4 w-4 rounded-full" />
                  <Skeleton className="h-4 w-40" />
                </div>
                <div className="flex items-center gap-2">
                  <Skeleton className="h-4 w-4 rounded-full" />
                  <Skeleton className="h-4 w-36" />
                </div>
                <div className="flex items-center gap-2">
                  <Skeleton className="h-4 w-4 rounded-full" />
                  <Skeleton className="h-4 w-44" />
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - Order Summary */}
          <div className="lg:col-span-2">
            <OrderSummarySkeleton />
          </div>
        </div>

        {/* Navigation Buttons */}
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-between">
          <Skeleton className="order-2 h-10 w-full sm:order-1 sm:w-32" />
          <Skeleton className="order-1 h-10 w-full sm:order-2 sm:w-40" />
        </div>
      </div>
    </div>
  );
}
