function Bone({ w, h = 14, className = '' }: { w?: string; h?: number; className?: string }) {
  return (
    <div
      className={`skeleton flex-shrink-0 ${className}`}
      style={{ width: w ?? '100%', height: h }}
    />
  );
}

export function ProfilePanelSkeleton() {
  return (
    <aside
      className="border-r border-border px-5 py-6 overflow-y-auto"
      style={{ position: 'sticky', top: 58, height: 'calc(100vh - 58px)' }}
    >
      {/* Avatar + name + tier */}
      <div className="pb-5 mb-5 border-b border-border">
        <Bone w="40px" h={40} className="rounded-full mb-3" />
        <Bone w="120px" h={15} className="mb-1.5" />
        <Bone w="70px" h={11} className="mb-3" />
        <Bone w="140px" h={12} className="mb-4" />

        {/* 2×2 stats grid */}
        <div className="grid grid-cols-2 gap-1.5 mb-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="p-2.5 border border-border rounded-[var(--radius)] bg-surface">
              <Bone w="36px" h={22} className="mb-1" />
              <Bone w="48px" h={9} />
            </div>
          ))}
        </div>

        {/* Streak */}
        <div className="flex items-center justify-between px-3 py-2 border border-border rounded-[var(--radius)] bg-surface">
          <Bone w="40px" h={11} />
          <Bone w="52px" h={13} />
        </div>
      </div>

      {/* Recent debates header */}
      <div className="flex items-center justify-between mb-3">
        <Bone w="50px" h={10} />
        <Bone w="42px" h={10} />
      </div>

      {/* Recent debate rows */}
      {[...Array(5)].map((_, i) => (
        <div key={i} className="flex items-center gap-2 py-2">
          <Bone w="30px" h={10} />
          <Bone h={11} className="flex-1" />
          <Bone w="44px" h={10} />
        </div>
      ))}

      {/* CTA */}
      <div className="mt-5 pt-5 border-t border-border">
        <Bone h={34} className="rounded-[20px]" />
      </div>
    </aside>
  );
}
