'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { BlogEditor, type BlogPost } from '@/components/features/admin/blog-editor';
import { useToast } from '@/components/ui/toast';

export default function BlogEditPage() {
  const { id }    = useParams<{ id: string }>();
  const router    = useRouter();
  const { toast } = useToast();

  const [post, setPost]       = useState<BlogPost | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchPost = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/blog/${id}`);
      if (!res.ok) throw new Error('Not found');
      const data = await res.json();
      // Normalise categories/tags shape that comes from the API
      const p = data.post;
      setPost({
        ...p,
        categories: (p.categories ?? []).map((c: { category?: { id: string; name: string; slug: string }; id?: string; name?: string; slug?: string }) =>
          c.category ?? c,
        ),
        tags: (p.tags ?? []).map((t: { tag?: { id: string; name: string; slug: string }; id?: string; name?: string; slug?: string }) =>
          t.tag ?? t,
        ),
      });
    } catch {
      toast({ type: 'error', title: 'Failed to load post' });
      router.push('/admin/blog');
    } finally {
      setLoading(false);
    }
  }, [id, router, toast]);

  useEffect(() => { fetchPost(); }, [fetchPost]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 rounded-full border-2 border-border border-t-accent animate-spin" />
      </div>
    );
  }

  if (!post) return null;

  return <BlogEditor postId={id} initialPost={post} />;
}
