import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Settings, Zap, Trophy, X, Minus } from 'lucide-react-native';
import { useQuery } from '@tanstack/react-query';
import { useTheme } from '../../theme';
import { Avatar } from '../../components/ui/Avatar';
import { StatCard } from '../../components/ui/StatCard';
import { Button } from '../../components/ui/Button';
import { usersApi } from '../../api/users';
import { debatesApi } from '../../api/debates';
import { useAuthStore } from '../../store/authStore';

export function MyProfileScreen({ navigation }: any) {
  const { colors } = useTheme();
  const user = useAuthStore((s) => s.user);

  const { data: profileData } = useQuery({
    queryKey: ['myProfile'],
    queryFn: usersApi.getProfile,
  });

  const { data: historyData } = useQuery({
    queryKey: ['myDebateHistory'],
    queryFn: debatesApi.getHistory,
  });

  const p = profileData?.user ?? profileData ?? user;
  const wins = p?.debatesWon ?? (p as any)?.wins ?? 0;
  const losses = p?.debatesLost ?? (p as any)?.losses ?? 0;
  const total = p?.totalDebates ?? 0;
  const winRate = total > 0 ? Math.round((wins / total) * 100) + '%' : '0%';

  const recentDebates: any[] = (historyData?.debates ?? []).slice(0, 5);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={['top']}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <ArrowLeft size={20} color={colors.text2} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Profile</Text>
        <TouchableOpacity onPress={() => navigation.navigate('Settings')}>
          <Settings size={18} color={colors.text3} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Header bg */}
        <View style={[styles.headerBg, { backgroundColor: colors.accent + '0A' }]}>
          <View style={styles.avatarWrap}>
            <Avatar src={p?.avatarUrl} fallback={p?.username ?? 'U'} size="xl" />
          </View>
        </View>

        <View style={styles.info}>
          <View style={styles.nameRow}>
            <Text style={[styles.name, { color: colors.text }]}>{p?.username ?? 'User'}</Text>
            <View style={[styles.eloBadge, { borderColor: colors.accent + '26', backgroundColor: colors.accent + '0F' }]}>
              <Zap size={12} color={colors.accent} />
              <Text style={{ color: colors.accent, fontSize: 13, fontWeight: '600' }}>
                {p?.eloRating ?? 1000} ELO
              </Text>
            </View>
          </View>
          <Text style={[styles.handle, { color: colors.text3 }]}>@{p?.username}</Text>
          {p?.bio && <Text style={[styles.bio, { color: colors.text2 }]}>{p.bio}</Text>}

          {/* Stats grid */}
          <View style={styles.statsGrid}>
            <StatCard value={total} label="Total" />
            <StatCard value={wins} label="Wins" color={colors.green} />
            <StatCard value={losses} label="Losses" color={colors.red} />
            <StatCard value={winRate} label="Win Rate" color={colors.accent} />
          </View>

          <Button
            variant="accent"
            size="md"
            fullWidth
            onPress={() => navigation.navigate('EditProfile')}
          >
            Edit Profile
          </Button>

          {/* Recent Debates */}
          {recentDebates.length > 0 && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Recent Debates</Text>
              {recentDebates.map((debate) => {
                const opponent =
                  debate.challengerId === user?.id ? debate.opponent : debate.challenger;
                const isWin = debate.userWon;
                const isDraw = debate.status === 'COMPLETED' && !debate.winnerId;
                const badgeColor = isWin ? colors.green : isDraw ? colors.text3 : colors.red;
                const badgeLabel = isWin ? 'W' : isDraw ? 'D' : 'L';

                return (
                  <TouchableOpacity
                    key={debate.id}
                    style={[styles.debateRow, { borderColor: colors.border }]}
                    onPress={() => navigation.navigate('DebateRoom', { debateId: debate.id })}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.badge, { backgroundColor: badgeColor + '20', borderColor: badgeColor + '40' }]}>
                      <Text style={[styles.badgeText, { color: badgeColor }]}>{badgeLabel}</Text>
                    </View>
                    <View style={styles.debateInfo}>
                      <Text style={[styles.debateTopic, { color: colors.text }]} numberOfLines={1}>
                        {debate.topic}
                      </Text>
                      <Text style={[styles.debateMeta, { color: colors.text3 }]}>
                        vs {opponent?.username ?? 'Unknown'} · {new Date(debate.createdAt).toLocaleDateString()}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 },
  headerTitle: { fontSize: 17, fontWeight: '500' },
  headerBg: { height: 100, position: 'relative' },
  avatarWrap: { position: 'absolute', bottom: -36, left: 24 },
  info: { paddingTop: 44, paddingHorizontal: 24 },
  nameRow: { flexDirection: 'row', alignItems: 'center' },
  name: { fontSize: 20, fontWeight: '500' },
  eloBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20, borderWidth: 1, marginLeft: 8 },
  handle: { fontSize: 14, marginBottom: 8 },
  bio: { fontSize: 14, lineHeight: 20, marginBottom: 16 },
  statsGrid: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  section: { marginTop: 28 },
  sectionTitle: { fontSize: 16, fontWeight: '600', marginBottom: 12 },
  debateRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1 },
  badge: { width: 32, height: 32, borderRadius: 8, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  badgeText: { fontSize: 13, fontWeight: '700' },
  debateInfo: { flex: 1 },
  debateTopic: { fontSize: 14, fontWeight: '500', marginBottom: 2 },
  debateMeta: { fontSize: 12 },
});
