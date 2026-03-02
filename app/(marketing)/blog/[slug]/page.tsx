import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/lib/db/prisma';
import { ArrowLeft, Clock, Eye } from 'lucide-react';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;

  const post = await prisma.blogPost.findUnique({
    where: { slug },
    select: {
      title:           true,
      metaTitle:       true,
      metaDescription: true,
      excerpt:         true,
      ogImage:         true,
      featuredImage:   { select: { url: true } },
    },
  });

  if (!post) return { title: 'Post Not Found | ArguFight' };

  const baseUrl    = process.env.NEXT_PUBLIC_APP_URL || 'https://www.argufight.com';
  const title      = post.metaTitle || post.title;
  const description = post.metaDescription || post.excerpt || 'Read this article on ArguFight';
  const image      = post.ogImage || post.featuredImage?.url || `${baseUrl}/og-image.png`;

  return {
    title: `${title} | ArguFight`,
    description,
    openGraph: {
      title,
      description,
      type: 'article',
      images: [{ url: image, width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card:        'summary_large_image',
      title,
      description,
      images:      [image],
    },
    alternates: {
      canonical: `${baseUrl}/blog/${slug}`,
    },
  };
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const post = await prisma.blogPost.findUnique({
    where: { slug },
    include: {
      author:        { select: { id: true, username: true, avatarUrl: true } },
      featuredImage: { select: { url: true, alt: true } },
      categories:    { include: { category: true } },
      tags:          { include: { tag: true } },
    },
  });

  if (!post || post.status !== 'PUBLISHED') {
    notFound();
  }

  const baseUrl     = process.env.NEXT_PUBLIC_APP_URL || 'https://www.argufight.com';
  const wordCount   = post.content.replace(/<[^>]+>/g, '').split(/\s+/).length;
  const readingTime = Math.max(1, Math.ceil(wordCount / 200));

  const structuredData = {
    '@context':         'https://schema.org',
    '@type':            'BlogPosting',
    headline:           post.title,
    description:        post.metaDescription || post.excerpt || post.title,
    image:              post.ogImage || post.featuredImage?.url || `${baseUrl}/og-image.png`,
    datePublished:      post.publishedAt || post.createdAt,
    dateModified:       post.updatedAt,
    author:             { '@type': 'Person', name: post.author.username },
    publisher:          { '@type': 'Organization', name: 'ArguFight', logo: { '@type': 'ImageObject', url: `${baseUrl}/logo.png` } },
    mainEntityOfPage:   { '@type': 'WebPage', '@id': `${baseUrl}/blog/${slug}` },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />

      <article className="max-w-3xl mx-auto px-6 py-12 space-y-8">
        {/* Back link */}
        <Link
          href="/blog"
          className="inline-flex items-center gap-1.5 text-[14px] text-text-3 hover:text-text-2 transition-colors"
        >
          <ArrowLeft size={13} />
          Back to Blog
        </Link>

        {/* Header */}
        <header className="space-y-4">
          {/* Breadcrumb */}
          <nav className="flex items-center gap-1.5 text-[13px] text-text-3" aria-label="Breadcrumb">
            <Link href="/" className="hover:text-text-2 transition-colors">Home</Link>
            <span>/</span>
            <Link href="/blog" className="hover:text-text-2 transition-colors">Blog</Link>
            <span>/</span>
            <span className="text-text-2 truncate">{post.title}</span>
          </nav>

          {/* Categories */}
          {post.categories.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {post.categories.map((c) => (
                <Link
                  key={c.category.id}
                  href={`/blog?category=${c.category.slug}`}
                  className="px-2.5 py-0.5 text-[13px] font-[500] bg-accent/10 text-accent rounded-full hover:bg-accent/20 transition-colors"
                >
                  {c.category.name}
                </Link>
              ))}
            </div>
          )}

          <h1 className="text-3xl font-[600] text-text tracking-[-0.5px] leading-tight">
            {post.title}
          </h1>

          {post.excerpt && (
            <p className="text-[17px] text-text-2 leading-relaxed">{post.excerpt}</p>
          )}

          {/* Meta row */}
          <div className="flex flex-wrap items-center gap-4 text-[14px] text-text-3 pt-1">
            <span className="font-[500] text-text-2">{post.author.username}</span>

            {post.publishedAt && (
              <span>
                {new Date(post.publishedAt).toLocaleDateString('en-US', {
                  year:  'numeric',
                  month: 'long',
                  day:   'numeric',
                })}
              </span>
            )}

            <span className="flex items-center gap-1">
              <Clock size={11} />
              {readingTime} min read
            </span>

            {post.views > 0 && (
              <span className="flex items-center gap-1">
                <Eye size={11} />
                {post.views.toLocaleString()} views
              </span>
            )}
          </div>
        </header>

        {/* Featured Image */}
        {post.featuredImage && (
          <div className="w-full rounded-[var(--radius)] overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={post.featuredImage.url}
              alt={post.featuredImage.alt || post.title}
              className="w-full h-auto block"
            />
          </div>
        )}

        {/* Divider */}
        <div className="h-px bg-border" />

        {/* Content */}
        <div
          className={[
            'prose prose-sm max-w-none',
            /* text */
            'prose-headings:text-text prose-headings:font-[600] prose-headings:tracking-[-0.3px]',
            'prose-p:text-text-2 prose-p:leading-relaxed',
            'prose-strong:text-text',
            'prose-a:text-accent prose-a:no-underline hover:prose-a:underline',
            /* lists */
            'prose-ul:text-text-2 prose-ol:text-text-2 prose-li:text-text-2',
            /* blockquote */
            'prose-blockquote:border-l-accent prose-blockquote:text-text-2 prose-blockquote:not-italic',
            /* code */
            'prose-code:text-accent prose-code:bg-surface-2 prose-code:rounded prose-code:px-1 prose-code:py-0.5 prose-code:text-[0.85em] prose-code:before:content-none prose-code:after:content-none',
            'prose-pre:bg-surface-2 prose-pre:border prose-pre:border-border prose-pre:rounded-[var(--radius)]',
            /* images */
            'prose-img:rounded-[var(--radius)] prose-img:border prose-img:border-border',
            /* hr */
            'prose-hr:border-border',
          ].join(' ')}
          dangerouslySetInnerHTML={{ __html: post.content }}
        />

        {/* Tags */}
        {post.tags.length > 0 && (
          <div className="pt-6 border-t border-border space-y-3">
            <p className="text-[13px] font-[500] text-text-3 uppercase tracking-wide">Tags</p>
            <div className="flex flex-wrap gap-1.5">
              {post.tags.map((t) => (
                <Link
                  key={t.tag.id}
                  href={`/blog?tag=${t.tag.slug}`}
                  className="px-2.5 py-1 text-[13px] bg-surface-2 border border-border text-text-2 rounded-full hover:border-border-2 transition-colors"
                >
                  #{t.tag.name}
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Footer nav */}
        <div className="pt-6 border-t border-border flex items-center justify-between">
          <Link
            href="/blog"
            className="inline-flex items-center gap-1.5 text-[14px] text-text-3 hover:text-text-2 transition-colors"
          >
            <ArrowLeft size={13} />
            Back to Blog
          </Link>

          <Link
            href="/signup"
            className="px-4 py-2 text-[14px] font-[500] bg-accent text-bg rounded-[var(--radius)] hover:bg-accent-2 transition-colors"
          >
            Join ArguFight
          </Link>
        </div>
      </article>
    </>
  );
}
