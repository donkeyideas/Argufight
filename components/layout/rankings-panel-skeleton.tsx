function Bone({ w, h = 14, className = '' }: { w?: string; h?: number; className?: string }) {
  return (
    <div
      className={`skeleton flex-shrink-0 ${className}`}
      style={{ width: w ?? '100%', height: h }}
    />
  );
}

export function RankingsPanelSkeleton() {
  return (
    <aside
      className="border-l border-border px-5 py-6 overflow-y-auto"
      style={{ position: 'sticky', top: 58, height: 'calc(100vh - 58px)' }}
    >
      {/* Rankings */}
      <div className="mb-6 pb-5 border-b border-border">
        <div className="flex items-center justify-between mb-3">
          <Bone w="70px" h={10} />
          <Bone w="24px" h={10} />
        </div>
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-center gap-2.5 py-1.5 border-b border-border last:border-none">
            <Bone w="16px" h={12} />
            <Bone w="28px" h={28} className="rounded-full" />
            <Bone h={11} className="flex-1" />
            <Bone w="36px" h={12} />
          </div>
        ))}
      </div>

      {/* Belts */}
      <div className="mb-6 pb-5 border-b border-border">
        <div className="flex items-center justify-between mb-3">
          <Bone w="40px" h={10} />
          <Bone w="34px" h={10} />
        </div>
        {[...Array(2)].map((_, i) => (
          <div key={i} className="flex items-center gap-2 py-2 border-b border-border last:border-none">
            <div className="flex-1">
              <Bone h={12} className="mb-1" />
              <Bone w="70px" h={10} />
            </div>
            <Bone w="48px" h={20} className="rounded-[20px]" />
          </div>
        ))}
      </div>

      {/* Tournaments */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <Bone w="80px" h={10} />
          <Bone w="24px" h={10} />
        </div>
        {[...Array(3)].map((_, i) => (
          <div key={i} className="flex items-center gap-2 py-2 border-b border-border last:border-none">
            <div className="flex-1">
              <Bone h={12} className="mb-1" />
              <Bone w="50px" h={10} />
            </div>
            <Bone w="40px" h={20} className="rounded-[20px]" />
          </div>
        ))}
      </div>

      {/* CTA */}
      <Bone h={34} className="rounded-[20px]" />
    </aside>
  );
}
