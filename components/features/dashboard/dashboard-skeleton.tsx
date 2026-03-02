function Bone({ w, h = 14, className = '' }: { w?: string; h?: number; className?: string }) {
  return (
    <div
      className={`skeleton flex-shrink-0 ${className}`}
      style={{ width: w ?? '100%', height: h }}
    />
  );
}

export function DashboardSkeleton() {
  return (
    <div className="px-7 py-6 min-w-0">

      {/* ── Daily Challenge ── */}
      <div className="mb-8 pb-8 border-b border-border">
        {/* Label */}
        <Bone w="110px" h={10} className="mb-3" />
        {/* Headline line 1 */}
        <Bone w="88%" h={34} className="mb-2" />
        {/* Headline line 2 */}
        <Bone w="64%" h={34} className="mb-4" />
        {/* Meta row */}
        <div className="flex items-center gap-3 mb-4">
          <Bone w="110px" h={12} />
          <Bone w="4px" h={12} />
          <Bone w="120px" h={12} />
          <Bone w="4px" h={12} />
          <Bone w="68px" h={20} className="rounded-[20px]" />
        </div>
        {/* Button */}
        <Bone w="130px" h={32} className="rounded-[20px]" />
      </div>

      {/* ── Open Challenges ── */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <Bone w="140px" h={10} />
          <Bone w="46px" h={10} />
        </div>
        {[...Array(4)].map((_, i) => (
          <div key={i} className="flex items-center gap-3.5 py-3 border-b border-border first:border-t first:border-border">
            <Bone w="18px" h={11} />
            <Bone w="64px" h={10} />
            <Bone h={13} className="flex-1" />
            <Bone w="65px" h={11} />
            <Bone w="28px" h={11} />
            <Bone w="56px" h={24} className="rounded-[20px]" />
          </div>
        ))}
      </div>

      {/* ── Live Debates ── */}
      {/* Tabs */}
      <div className="flex gap-6 border-b border-border mb-3.5">
        {[80, 66, 72].map((w, i) => (
          <Bone key={i} w={`${w}px`} h={11} className="mb-3" />
        ))}
      </div>
      {/* Filter chips */}
      <div className="flex gap-1.5 flex-wrap mb-4">
        {[38, 60, 56, 76, 56, 98, 50, 46].map((w, i) => (
          <Bone key={i} w={`${w}px`} h={22} className="rounded-[20px]" />
        ))}
      </div>
      {/* Debate rows */}
      {[...Array(5)].map((_, i) => (
        <div key={i} className="py-3 border-b border-border grid gap-2" style={{ gridTemplateColumns: '1fr auto' }}>
          <div>
            <Bone w="72px" h={10} className="mb-2" />
            <div className="flex items-center gap-2 mb-2">
              <Bone w="28px" h={28} className="rounded-full" />
              <Bone w="16px" h={10} />
              <Bone w="28px" h={28} className="rounded-full" />
            </div>
            <Bone w={`${60 + (i % 3) * 10}%`} h={13} />
          </div>
          <div className="flex flex-col items-end gap-1.5 justify-center">
            <Bone w="50px" h={20} className="rounded-[20px]" />
            <Bone w="68px" h={10} />
          </div>
        </div>
      ))}
    </div>
  );
}
