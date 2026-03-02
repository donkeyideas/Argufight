import type { Metadata } from 'next';
import Link from 'next/link';
import { prisma } from '@/lib/db/prisma';
import { AdminStatCard } from '@/components/features/admin/admin-stat-card';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = { title: 'Admin — Blog' };
export const revalidate = 0;

type BadgeColor = 'green' | 'muted' | 'amber';

function postStatusColor(post: { status?: string | null; published?: boolean | null }): BadgeColor {
  if (post.status) {
    const s = post.status.toUpperCase();
    if (s === 'PUBLISHED') return 'green';
    if (s === 'DRAFT') return 'muted';
    if (s === 'SCHEDULED') return 'amber';
  }
  if (post.published) return 'green';
  return 'muted';
}

function postStatusLabel(post: { status?: string | null; published?: boolean | null }): string {
  if (post.status) {
    const s = post.status;
    return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
  }
  return post.published ? 'Published' : 'Draft';
}

export default async function AdminBlogPage() {
  const [total, published, drafts, posts] = await Promise.all([
    prisma.blogPost.count().catch(() => 0),
    prisma.blogPost.count({ where: { status: 'PUBLISHED' } }).catch(() => 0),
    prisma.blogPost.count({ where: { status: 'DRAFT' } }).catch(() => 0),
    prisma.blogPost.findMany({
      take: 50,
      orderBy: { createdAt: 'desc' },
      include: { author: { select: { username: true } } },
    }).catch(() => []),
  ]);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-[600] text-text tracking-[-0.3px]">Blog</h1>
          <p className="text-[17px] text-text-3 mt-0.5">{total.toLocaleString()} total posts</p>
        </div>
        <Button href="/admin/blog/new" variant="accent" size="sm">New post</Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
        <AdminStatCard label="Total"     value={total.toLocaleString()} />
        <AdminStatCard label="Published" value={published.toLocaleString()} accent={published > 0} />
        <AdminStatCard label="Drafts"    value={drafts.toLocaleString()} sub={drafts > 0 ? 'Not yet live' : 'None'} />
      </div>

      <Card padding="none" className="overflow-hidden">
        {/* Header */}
        <div className="grid grid-cols-[3fr_1fr_1fr_2fr_auto] gap-4 px-4 py-2.5 border-b border-border bg-surface-2">
          <p className="text-[15px] font-[500] text-text-3 uppercase tracking-wide">Title</p>
          <p className="text-[15px] font-[500] text-text-3 uppercase tracking-wide">Author</p>
          <p className="text-[15px] font-[500] text-text-3 uppercase tracking-wide">Status</p>
          <p className="text-[15px] font-[500] text-text-3 uppercase tracking-wide">Slug</p>
          <p className="text-[15px] font-[500] text-text-3 uppercase tracking-wide">Actions</p>
        </div>

        {posts.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <p className="text-[17px] text-text-3">No blog posts yet.</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {posts.map((post) => {
              const p = post as typeof post & { status?: string | null; published?: boolean | null; slug?: string | null };
              const color: BadgeColor = postStatusColor(p);
              const label = postStatusLabel(p);
              const slug = p.slug ?? null;

              return (
                <div
                  key={post.id}
                  className="grid grid-cols-[3fr_1fr_1fr_2fr_auto] gap-4 px-4 py-3 items-center hover:bg-surface-2 transition-colors duration-100"
                >
                  {/* Title */}
                  <div className="min-w-0">
                    <p className="text-[17px] text-text font-[450] line-clamp-1">{post.title}</p>
                    <p className="text-[15px] text-text-3 mt-0.5">
                      {new Date(post.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })}
                    </p>
                  </div>

                  {/* Author */}
                  <p className="text-[17px] text-text-2 truncate">{post.author?.username ?? '—'}</p>

                  {/* Status */}
                  <div><Badge color={color} size="sm" dot>{label}</Badge></div>

                  {/* Slug */}
                  <p className="text-[15px] text-text-3 font-mono truncate">{slug ?? '—'}</p>

                  {/* Actions */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Link
                      href={`/admin/blog/${post.id}/edit`}
                      className="px-2.5 py-1 text-[16px] font-[500] text-text-2 bg-surface-2 border border-border rounded-[var(--radius-sm)] hover:bg-surface-3 hover:text-text transition-colors"
                    >
                      Edit
                    </Link>
                    {slug && (
                      <Link
                        href={`/blog/${slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2.5 py-1 text-[16px] font-[500] text-text-3 hover:text-text-2 transition-colors"
                      >
                        View
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {posts.length === 50 && (
        <p className="text-[15px] text-text-3 text-center mt-4">Showing first 50 results.</p>
      )}
    </div>
  );
}
