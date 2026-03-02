import { Card } from '@/components/ui/card';
import { cn } from '@/lib/cn';

interface AdminStatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  accent?: boolean;
}

export function AdminStatCard({ label, value, sub, accent }: AdminStatCardProps) {
  return (
    <Card padding="md">
      <p className="text-2xl font-[200] text-text">{value}</p>
      <p className="text-[15px] text-text-3 mt-1">{label}</p>
      {sub && <p className={cn('text-[14px] mt-0.5', accent ? 'text-accent' : 'text-text-3')}>{sub}</p>}
    </Card>
  );
}
