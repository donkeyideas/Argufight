import { Skeleton } from '@/components/ui/skeleton';

export default function TournamentsLoading() {
  return (
    <div className="p-5 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <Skeleton height={16} width={120} className="mb-1.5" />
          <Skeleton height={10} width={260} />
        </div>
        <Skeleton height={32} width={80} className="rounded-[20px]" />
      </div>
      <Skeleton height={10} width={90} className="mb-3" />
      <div className="grid sm:grid-cols-2 gap-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-surface border border-border rounded-[var(--radius)] p-5 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <Skeleton height={18} width={50} className="rounded-[20px]" />
              <Skeleton height={12} width={60} />
            </div>
            <Skeleton height={13} width="70%" />
            <Skeleton height={10} width="90%" />
            <div className="flex items-center gap-4 pt-3 border-t border-border">
              <Skeleton height={10} width={50} />
              <Skeleton height={10} width={60} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
