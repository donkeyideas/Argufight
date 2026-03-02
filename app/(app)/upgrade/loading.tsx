import { Skeleton } from '@/components/ui/skeleton';

export default function UpgradeLoading() {
  return (
    <div className="p-5 max-w-4xl mx-auto space-y-6">
      <div className="text-center space-y-2">
        <Skeleton className="h-9 w-56 rounded-[var(--radius)] mx-auto" />
        <Skeleton className="h-4 w-80 rounded-[var(--radius)] mx-auto" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-64 w-full rounded-[var(--radius)]" />
        ))}
      </div>
    </div>
  );
}
