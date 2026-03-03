import { Skeleton } from '@/components/ui/skeleton';

export default function LeaderboardLoading() {
  return (
    <div className="p-5 max-w-3xl mx-auto">
      <div className="mb-6">
        <Skeleton height={20} width={140} className="mb-2" />
        <Skeleton height={10} width={260} />
      </div>
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[0, 1, 2].map((i) => (
          <div key={i} className="bg-surface border border-border rounded-[var(--radius)] p-4 flex flex-col items-center gap-2">
            <Skeleton height={16} width={24} />
            <Skeleton width={36} height={36} rounded />
            <Skeleton height={10} width={60} />
          </div>
        ))}
      </div>
      <div className="bg-surface border border-border rounded-[var(--radius)]">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-5 py-3 border-b border-border last:border-0">
            <Skeleton width={16} height={12} />
            <Skeleton width={28} height={28} rounded />
            <div className="flex-1">
              <Skeleton height={11} width="40%" className="mb-1" />
              <Skeleton height={9} width="30%" />
            </div>
            <Skeleton height={12} width={40} />
          </div>
        ))}
      </div>
    </div>
  );
}
