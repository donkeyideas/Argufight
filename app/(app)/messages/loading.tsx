import { Skeleton } from '@/components/ui/skeleton';

export default function MessagesLoading() {
  return (
    <div className="flex h-full">
      <div className="w-72 border-r border-border p-3 space-y-2">
        <Skeleton className="h-9 w-full rounded-[var(--radius)]" />
        {[...Array(8)].map((_, i) => (
          <Skeleton key={i} className="h-14 w-full rounded-[var(--radius)]" />
        ))}
      </div>
      <div className="flex-1 flex flex-col p-4 gap-3">
        {[...Array(6)].map((_, i) => (
          <Skeleton key={i} className={`h-12 rounded-[var(--radius)] ${i % 2 === 0 ? 'w-2/3' : 'w-1/2 self-end'}`} />
        ))}
        <Skeleton className="h-12 w-full rounded-[var(--radius)] mt-auto" />
      </div>
    </div>
  );
}
