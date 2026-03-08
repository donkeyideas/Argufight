import React from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Trophy, Users, Calendar, Lock, Bell, MessageCircle, Plus } from 'lucide-react-native';
import { useQuery } from '@tanstack/react-query';
import { useTheme } from '../../theme';
import { Avatar } from '../../components/ui/Avatar';
import { Skeleton } from '../../components/ui/Skeleton';
import { tournamentsApi } from '../../api/tournaments';
import { useAuthStore } from '../../store/authStore';

function StatusBadge({ status, colors }: { status: string; colors: any }) {
  const config: Record<string, { color: string; bg: string; label: string }> = {
    ACTIVE: { color: colors.green, bg: colors.green + '15', label: 'Live' },
    UPCOMING: { color: colors.amber, bg: colors.amber + '15', label: 'Upcoming' },
    COMPLETED: { color: colors.text3, bg: colors.surface, label: 'Ended' },
    REGISTRATION: { color: colors.accent, bg: colors.accent + '15', label: 'Open' },
  };
  const c = config[status] ?? { color: colors.text3, bg: colors.surface, label: status };
  return (
    <View style={[badgeStyles.badge, { backgroundColor: c.bg }]}>
      <Text style={[badgeStyles.text, { color: c.color }]}>{c.label}</Text>
    </View>
  );
}

const badgeStyles = StyleSheet.create({
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  text: { fontSize: 12, fontWeight: '600', letterSpacing: 0.3 },
});

export function TournamentsListScreen({ navigation }: any) {
  const { colors } = useTheme();
  const user = useAuthStore((s) => s.user);

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['tournaments'],
    queryFn: tournamentsApi.getAll,
  });

  const tournaments: any[] = Array.isArray(data) ? data : data?.tournaments ?? [];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={['top']}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.text }]}>Tournaments</Text>
        <View style={styles.headerIcons}>
          <TouchableOpacity onPress={() => navigation.navigate('CreateTournament')} style={styles.iconBtn}>
            <Plus size={20} color={colors.accent} />
          </TouchableOpacity>
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

      <FlatList
        data={tournaments}
        keyExtractor={(item: any) => item.id}
        contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.accent} />}
        ListEmptyComponent={
          isLoading ? (
            <View style={{ gap: 12 }}>
              {[1, 2, 3].map((i) => <Skeleton key={i} height={110} />)}
            </View>
          ) : (
            <View style={styles.emptyState}>
              <View style={[styles.emptyIcon, { backgroundColor: colors.accent + '0F', borderColor: colors.accent + '25' }]}>
                <Trophy size={40} color={colors.accent} strokeWidth={1.2} />
              </View>
              <Text style={[styles.emptyTitle, { color: colors.text }]}>No tournaments yet</Text>
              <Text style={[styles.emptySubtitle, { color: colors.text3 }]}>
                Tournaments are competitive bracket events where debaters compete for prizes and glory. Check back soon.
              </Text>
            </View>
          )
        }
        renderItem={({ item }: any) => (
          <TouchableOpacity
            style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => navigation.navigate('TournamentDetail', { id: item.id })}
            activeOpacity={0.7}
          >
            {/* Card header */}
            <View style={styles.cardHeader}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.cardCategory, { color: colors.text3 }]}>
                  {item.category?.toUpperCase() ?? 'GENERAL'}
                </Text>
                <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={2}>
                  {item.name}
                </Text>
              </View>
              <StatusBadge status={item.status} colors={colors} />
            </View>

            {/* Card stats */}
            <View style={[styles.cardStats, { borderTopColor: colors.border }]}>
              <View style={styles.statItem}>
                <Users size={13} color={colors.text3} />
                <Text style={[styles.statText, { color: colors.text3 }]}>
                  {item.participantCount ?? 0}/{item.maxParticipants ?? '∞'}
                </Text>
              </View>
              {item.startDate && (
                <View style={styles.statItem}>
                  <Calendar size={13} color={colors.text3} />
                  <Text style={[styles.statText, { color: colors.text3 }]}>
                    {new Date(item.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </Text>
                </View>
              )}
              {item.entryFee != null && (
                <View style={styles.statItem}>
                  <Lock size={13} color={item.entryFee === 0 ? colors.green : colors.amber} />
                  <Text style={[styles.statText, { color: item.entryFee === 0 ? colors.green : colors.amber }]}>
                    {item.entryFee === 0 ? 'Free entry' : `${item.entryFee} coins`}
                  </Text>
                </View>
              )}
              {item.prizePool && (
                <View style={styles.statItem}>
                  <Trophy size={13} color={colors.accent} />
                  <Text style={[styles.statText, { color: colors.accent }]}>
                    {item.prizePool} prize
                  </Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
        )}
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
  // Card
  card: { borderRadius: 12, borderWidth: 1, overflow: 'hidden' },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 14 },
  cardCategory: { fontSize: 11, fontWeight: '600', letterSpacing: 1, marginBottom: 4 },
  cardTitle: { fontSize: 16, fontWeight: '500', lineHeight: 22 },
  cardStats: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, paddingHorizontal: 14, paddingVertical: 10, borderTopWidth: 1 },
  statItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  statText: { fontSize: 13, fontWeight: '400' },
  // Empty
  emptyState: { alignItems: 'center', paddingTop: 60, gap: 16, paddingHorizontal: 32 },
  emptyIcon: { width: 88, height: 88, borderRadius: 24, alignItems: 'center', justifyContent: 'center', borderWidth: 1, marginBottom: 4 },
  emptyTitle: { fontSize: 20, fontWeight: '500' },
  emptySubtitle: { fontSize: 14, textAlign: 'center', lineHeight: 22, color: '#666' },
});
