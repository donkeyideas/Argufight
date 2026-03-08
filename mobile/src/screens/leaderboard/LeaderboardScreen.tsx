import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Bell, MessageCircle } from 'lucide-react-native';
import { useQuery } from '@tanstack/react-query';
import { useTheme } from '../../theme';
import { Avatar } from '../../components/ui/Avatar';
import { Skeleton } from '../../components/ui/Skeleton';
import { leaderboardApi } from '../../api/leaderboard';
import { LoadingScreen } from '../../components/ui/LoadingScreen';
import { useAuthStore } from '../../store/authStore';

const TIMEFRAMES = ['Weekly', 'Monthly', 'All Time'] as const;
type Timeframe = typeof TIMEFRAMES[number];

const MEDAL = ['#FFD700', '#C0C0C0', '#CD7F32'];

export function LeaderboardScreen({ navigation }: any) {
  const { colors } = useTheme();
  const user = useAuthStore((s) => s.user);
  const [timeframe, setTimeframe] = useState<Timeframe>('Weekly');

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['leaderboard', timeframe],
    queryFn: () => leaderboardApi.get(1, 50),
  });

  if (isLoading && !data) return <LoadingScreen />;

  const users: any[] = Array.isArray(data) ? data : data?.leaderboard ?? data?.users ?? [];

  const top3 = users.slice(0, 3);
  const rest = users.slice(3);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.text }]}>Rankings</Text>
        <View style={styles.headerIcons}>
          <TouchableOpacity onPress={() => navigation.navigate('Conversations')} style={styles.iconBtn}>
            <MessageCircle size={18} color={colors.text2} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate('Notifications')} style={styles.iconBtn}>
            <Bell size={18} color={colors.text2} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate('MyProfile')}>
            <Avatar src={user?.avatarUrl} fallback={user?.username ?? 'U'} size="sm" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Timeframe tabs */}
      <View style={[styles.tabBar, { borderBottomColor: colors.border }]}>
        {TIMEFRAMES.map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.tabItem, timeframe === t && { borderBottomColor: colors.accent }]}
            onPress={() => setTimeframe(t)}
          >
            <Text style={[styles.tabLabel, { color: timeframe === t ? colors.text : colors.text3 }]}>
              {t}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={rest}
        keyExtractor={(item: any) => item.id || item.userId || String(item.rank)}
        contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.accent} />}
        ListHeaderComponent={
          isLoading ? (
            <View style={{ padding: 16, gap: 8 }}>
              {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} height={52} />)}
            </View>
          ) : users.length === 0 ? null : (
            <>
              {/* Top 3 podium */}
              {top3.length > 0 && (
                <View style={[styles.podium, { borderBottomColor: colors.border }]}>
                  {/* 2nd place */}
                  {top3[1] && (
                    <View style={styles.podiumItem}>
                      <Text style={[styles.podiumRank, { color: MEDAL[1] }]}>2</Text>
                      <Avatar src={top3[1].avatarUrl} fallback={top3[1].username ?? '?'} size="lg" />
                      <Text style={[styles.podiumName, { color: colors.text }]} numberOfLines={1}>{top3[1].username}</Text>
                      <Text style={[styles.podiumElo, { color: MEDAL[1] }]}>{top3[1].eloRating ?? top3[1].elo ?? '—'}</Text>
                    </View>
                  )}
                  {/* 1st place */}
                  {top3[0] && (
                    <View style={[styles.podiumItem, styles.podiumFirst]}>
                      <Text style={[styles.podiumRank, { color: MEDAL[0], fontSize: 22 }]}>1</Text>
                      <Avatar src={top3[0].avatarUrl} fallback={top3[0].username ?? '?'} size="xl" />
                      <Text style={[styles.podiumName, { color: colors.text, fontSize: 15 }]} numberOfLines={1}>{top3[0].username}</Text>
                      <Text style={[styles.podiumElo, { color: MEDAL[0], fontSize: 16 }]}>{top3[0].eloRating ?? top3[0].elo ?? '—'}</Text>
                    </View>
                  )}
                  {/* 3rd place */}
                  {top3[2] && (
                    <View style={styles.podiumItem}>
                      <Text style={[styles.podiumRank, { color: MEDAL[2] }]}>3</Text>
                      <Avatar src={top3[2].avatarUrl} fallback={top3[2].username ?? '?'} size="lg" />
                      <Text style={[styles.podiumName, { color: colors.text }]} numberOfLines={1}>{top3[2].username}</Text>
                      <Text style={[styles.podiumElo, { color: MEDAL[2] }]}>{top3[2].eloRating ?? top3[2].elo ?? '—'}</Text>
                    </View>
                  )}
                </View>
              )}

              {/* Rest of list header label */}
              {rest.length > 0 && (
                <View style={[styles.listHeader, { borderBottomColor: colors.border }]}>
                  <Text style={[styles.listHeaderText, { color: colors.text3 }]}>RANK</Text>
                  <Text style={[styles.listHeaderText, { color: colors.text3, flex: 1, paddingLeft: 12 }]}>PLAYER</Text>
                  <Text style={[styles.listHeaderText, { color: colors.text3 }]}>ELO</Text>
                </View>
              )}
            </>
          )
        }
        ListEmptyComponent={
          isLoading ? null : (
            <View style={styles.emptyState}>
              <Text style={[styles.emptyTitle, { color: colors.text }]}>No rankings yet</Text>
              <Text style={[styles.emptySubtitle, { color: colors.text3 }]}>Win debates to earn your spot on the leaderboard</Text>
            </View>
          )
        }
        renderItem={({ item, index }: any) => {
          const rank = item.rank ?? index + 4;
          return (
            <TouchableOpacity
              style={[styles.row, { borderBottomColor: colors.border }]}
              onPress={() => navigation.navigate('ModalUserProfile', { id: item.id || item.userId })}
            >
              <Text style={[styles.rank, { color: colors.text3 }]}>{rank}</Text>
              <Avatar src={item.avatarUrl} fallback={item.username ?? '?'} size="sm" />
              <View style={{ flex: 1 }}>
                <Text style={[styles.username, { color: colors.text }]}>{item.username}</Text>
                {item.winRate != null && (
                  <Text style={{ color: colors.text3, fontSize: 12 }}>
                    {Math.round(item.winRate)}% win rate
                    {item.wins != null ? ` · ${item.wins}W ${item.losses ?? 0}L` : ''}
                  </Text>
                )}
              </View>
              <Text style={[styles.elo, { color: colors.accent }]}>
                {item.eloRating ?? item.elo ?? '—'}
              </Text>
            </TouchableOpacity>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerIcons: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 20, fontWeight: '500' },
  // Tabs
  tabBar: { flexDirection: 'row', borderBottomWidth: 1 },
  tabItem: { paddingHorizontal: 16, paddingBottom: 10, paddingTop: 10, borderBottomWidth: 2, borderBottomColor: 'transparent', marginBottom: -1 },
  tabLabel: { fontSize: 14, fontWeight: '500' },
  // Podium
  podium: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', paddingVertical: 24, gap: 12, borderBottomWidth: 1, paddingHorizontal: 16 },
  podiumItem: { flex: 1, alignItems: 'center', gap: 6 },
  podiumFirst: { marginBottom: 12 },
  crownEmoji: { fontSize: 20, marginBottom: -4 },
  podiumRank: { fontSize: 18, fontWeight: '700' },
  podiumName: { fontSize: 13, fontWeight: '500', textAlign: 'center' },
  podiumElo: { fontSize: 14, fontWeight: '600' },
  // List header
  listHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8, borderBottomWidth: 1 },
  listHeaderText: { fontSize: 11, fontWeight: '600', letterSpacing: 1 },
  // Rows
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 16, borderBottomWidth: 1 },
  rank: { fontSize: 14, width: 28, textAlign: 'center', fontWeight: '400' },
  username: { fontSize: 15, fontWeight: '500' },
  elo: { fontSize: 15, fontWeight: '600' },
  // Empty
  emptyState: { alignItems: 'center', paddingTop: 80, gap: 10, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 18, fontWeight: '500' },
  emptySubtitle: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
});
