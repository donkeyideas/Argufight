'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';

interface FollowButtonProps {
  targetId: string;
  isFollowing: boolean;
  currentUserId: string | null;
}

export function FollowButton({ targetId, isFollowing: initialIsFollowing, currentUserId }: FollowButtonProps) {
  const [following, setFollowing] = useState(initialIsFollowing);
  const [loading, setLoading] = useState(false);
  const { success, error } = useToast();

  if (!currentUserId) return null;

  async function handleToggle() {
    setLoading(true);
    try {
      const res = await fetch(`/api/users/${targetId}/follow`, {
        method: following ? 'DELETE' : 'POST',
      });
      if (res.ok) {
        setFollowing(!following);
        success(following ? 'Unfollowed' : 'Following');
      } else {
        error('Failed', 'Please try again');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      variant={following ? 'secondary' : 'accent'}
      size="sm"
      onClick={handleToggle}
      loading={loading}
    >
      {following ? 'Following' : 'Follow'}
    </Button>
  );
}
