import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { prisma } from '@/lib/db/prisma';
import { Search } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Blog | ArguFight',
  description: 'Read the latest articles about debate, argumentation, critical thinking, and the ArguFight platform.',
  openGraph: {
    title: 'Blog | ArguFight',
    description: 'Read the latest articles about debate, argumentation, and critical thinking.',
    type: 'website',
  },
};

export default async function BlogPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; category?: string; tag?: string; search?: string }>;
}) {
  const params = await searchParams;
  const page  = Math.max(1, parseInt(params.page || '1'));
  const limit = 12;
  const skip  = (page - 1) * limit;

  const where: Record<string, unknown> = { status: 'PUBLISHED' };

  if (params.category) {
    where.categories = { some: { category: { slug: params.category } } };
  }

  if (params.tag) {
    where.tags = { some: { tag: { slug: params.tag } } };
  }

  if (params.search) {
    where.AND = [
      { status: 'PUBLISHED' },
      {
        OR: [
          { title:   { contains: params.search, mode: 'insensitive' } },
          { excerpt: { contains: params.search, mode: 'insensitive' } },
        ],
      },
    ];
    delete where.status;
  }

  const [posts, total, allCategories] = await Promise.all([
    prisma.blogPost.findMany({
      where,
      include: {
        author:        { select: { id: true, username: true } },
        featuredImage: { select: { url: true, alt: true } },
        categories:    { include: { category: true } },
        tags:          { include: { tag: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.blogPost.count({ where }),
    prisma.blogPostCategory.findMany({ orderBy: { name: 'asc' } }),
  ]);

  const totalPages = Math.ceil(total / limit);

  const buildHref = (p: number) => {
    const q = new URLSearchParams();
    if (p > 1)           q.set('page',     String(p));
    if (params.category) q.set('category', params.category);
    if (params.tag)      q.set('tag',      params.tag);
    if (params.search)   q.set('search',   params.search);
    const qs = q.toString();
    return `/blog${qs ? `?${qs}` : ''}`;
  };

  return (
    <div className="max-w-6xl mx-auto px-6 py-12 space-y-10">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-3xl font-[600] text-text tracking-[-0.5px]">Blog</h1>
        <p className="text-[16px] text-text-3">
          Articles about debate, argumentation, and critical thinking
        </p>
      </div>

      {/* Filters row */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <form method="get" action="/blog" className="relative">
          {params.category && <input type="hidden" name="category" value={params.category} />}
          {params.tag      && <input type="hidden" name="tag"      value={params.tag} />}
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-3 pointer-events-none" />
          <input
            name="search"
            defaultValue={params.search}
            placeholder="Search posts…"
            className="h-8 pl-8 pr-3 bg-surface-2 border border-border rounded-[var(--radius)] text-[14px] text-text placeholder:text-text-3 focus:outline-none focus:border-border-2 w-48"
          />
        </form>

        {/* Category pills */}
        {allCategories.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            <Link
              href={params.search ? `/blog?search=${encodeURIComponent(params.search)}` : '/blog'}
              className={`px-3 py-1 rounded-full text-[13px] font-[500] border transition-colors ${
                !params.category
                  ? 'bg-accent text-bg border-accent'
                  : 'bg-surface-2 text-text-2 border-border hover:border-border-2'
              }`}
            >
              All
            </Link>
            {allCategories.map((cat) => {
              const active = params.category === cat.slug;
              const href   = active
                ? (params.search ? `/blog?search=${encodeURIComponent(params.search)}` : '/blog')
                : `/blog?category=${cat.slug}${params.search ? `&search=${encodeURIComponent(params.search)}` : ''}`;
              return (
                <Link
                  key={cat.id}
                  href={href}
                  className={`px-3 py-1 rounded-full text-[13px] font-[500] border transition-colors ${
                    active
                      ? 'bg-accent text-bg border-accent'
                      : 'bg-surface-2 text-text-2 border-border hover:border-border-2'
                  }`}
                >
                  {cat.name}
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* Grid */}
      {posts.length === 0 ? (
        <div className="py-20 text-center">
          <p className="text-[16px] text-text-3">No posts found.</p>
          {(params.search || params.category || params.tag) && (
            <Link href="/blog" className="mt-3 inline-block text-[15px] text-accent hover:underline">
              Clear filters
            </Link>
          )}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {posts.map((post) => (
              <Link
                key={post.id}
                href={`/blog/${post.slug}`}
                className="group flex flex-col bg-surface border border-border rounded-[var(--radius)] overflow-hidden hover:border-border-2 transition-colors"
              >
                {/* Featured image */}
                {post.featuredImage ? (
                  <div className="relative w-full h-44 bg-surface-2 overflow-hidden">
                    {post.featuredImage.url.startsWith('data:') || post.featuredImage.url.includes('blob.vercel-storage') ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={post.featuredImage.url}
                        alt={post.featuredImage.alt || post.title}
                        className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
                      />
                    ) : (
                      <Image
                        src={post.featuredImage.url}
                        alt={post.featuredImage.alt || post.title}
                        fill
                        className="object-cover group-hover:scale-[1.02] transition-transform duration-300"
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      />
                    )}
                  </div>
                ) : (
                  <div className="w-full h-44 bg-surface-2 flex items-center justify-center">
                    <span className="text-[13px] text-text-3 uppercase tracking-wide">ArguFight</span>
                  </div>
                )}

                {/* Content */}
                <div className="flex flex-col flex-1 p-4 gap-3">
                  {/* Categories */}
                  {post.categories.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {post.categories.map((c) => (
                        <span
                          key={c.category.id}
                          className="px-2 py-0.5 text-[12px] font-[500] bg-accent/10 text-accent rounded-full"
                        >
                          {c.category.name}
                        </span>
                      ))}
                    </div>
                  )}

                  <h2 className="text-[16px] font-[500] text-text leading-snug group-hover:text-accent transition-colors line-clamp-2">
                    {post.title}
                  </h2>

                  {post.excerpt && (
                    <p className="text-[14px] text-text-3 line-clamp-2 flex-1">
                      {post.excerpt}
                    </p>
                  )}

                  <div className="flex items-center justify-between mt-auto pt-2 border-t border-border">
                    <span className="text-[13px] text-text-3">{post.author.username}</span>
                    <span className="text-[13px] text-text-3">
                      {post.publishedAt
                        ? new Date(post.publishedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                        : new Date(post.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-1 pt-4">
              {page > 1 && (
                <Link
                  href={buildHref(page - 1)}
                  className="px-3 py-1.5 text-[14px] bg-surface-2 border border-border rounded-[var(--radius)] text-text-2 hover:border-border-2 transition-colors"
                >
                  Previous
                </Link>
              )}

              {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                let n = i + 1;
                if (totalPages > 7) {
                  if (page <= 4)              n = i + 1;
                  else if (page >= totalPages - 3) n = totalPages - 6 + i;
                  else                        n = page - 3 + i;
                }
                return (
                  <Link
                    key={n}
                    href={buildHref(n)}
                    className={`px-3 py-1.5 text-[14px] rounded-[var(--radius)] border transition-colors ${
                      n === page
                        ? 'bg-accent text-bg border-accent font-[500]'
                        : 'bg-surface-2 border-border text-text-2 hover:border-border-2'
                    }`}
                  >
                    {n}
                  </Link>
                );
              })}

              {page < totalPages && (
                <Link
                  href={buildHref(page + 1)}
                  className="px-3 py-1.5 text-[14px] bg-surface-2 border border-border rounded-[var(--radius)] text-text-2 hover:border-border-2 transition-colors"
                >
                  Next
                </Link>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
