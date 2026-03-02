import { Skeleton } from '@/components/ui/skeleton';

export default function SettingsLoading() {
  return (
    <div className="p-5 max-w-2xl mx-auto space-y-4">
      <Skeleton className="h-9 w-32 rounded-[var(--radius)]" />
      {[...Array(4)].map((_, i) => (
        <div key={i} className="space-y-3 p-4 border border-border rounded-[var(--radius)]">
          <Skeleton className="h-5 w-40 rounded-[var(--radius)]" />
          <Skeleton className="h-10 w-full rounded-[var(--radius)]" />
          <Skeleton className="h-10 w-full rounded-[var(--radius)]" />
        </div>
      ))}
    </div>
  );
}
