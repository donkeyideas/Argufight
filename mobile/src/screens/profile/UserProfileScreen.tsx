import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Zap, ChevronRight } from 'lucide-react-native';
import { useQuery } from '@tanstack/react-query';
import { useTheme } from '../../theme';
import { Avatar } from '../../components/ui/Avatar';
import { StatCard } from '../../components/ui/StatCard';
import { Button } from '../../components/ui/Button';
import { usersApi } from '../../api/users';
import { debatesApi } from '../../api/debates';
import { timeAgo } from '../../utils/notifications';

export function UserProfileScreen({ navigation, route }: any) {
  const { colors } = useTheme();
  const { id } = route.params;

  const { data: profile } = useQuery({
    queryKey: ['userProfile', id],
    queryFn: () => usersApi.getUserProfile(id),
  });

  const { data: debatesData } = useQuery({
    queryKey: ['userPublicDebates', id],
    queryFn: () => debatesApi.getUserPublicDebates(id),
    enabled: !!id,
  });

  const p = profile?.user ?? profile;
  const debates: any[] = Array.isArray(debatesData) ? debatesData : debatesData?.debates ?? [];

  function navigateToDebate(debateId: string) {
    navigation.navigate('Tabs', {
      screen: 'HomeTab',
      params: { screen: 'DebateRoom', params: { id: debateId } },
    });
  }

  function getDebateResult(debate: any) {
    if (!debate.winnerId) return { label: 'Draw', color: colors.amber };
    if (debate.winnerId === id) return { label: 'Win', color: colors.green };
    return { label: 'Loss', color: colors.red };
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={['top']}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <ArrowLeft size={20} color={colors.text2} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Profile</Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={styles.info}>
          <View style={styles.avatarWrap}>
            <Avatar src={p?.avatarUrl} fallback={p?.username ?? '?'} size="xl" />
          </View>
          <View style={styles.nameRow}>
            <Text style={[styles.name, { color: colors.text }]}>{p?.username ?? 'User'}</Text>
            <View style={[styles.eloBadge, { borderColor: colors.accent + '26', backgroundColor: colors.accent + '0F' }]}>
              <Zap size={12} color={colors.accent} />
              <Text style={{ color: colors.accent, fontSize: 13, fontWeight: '600' }}>
                {p?.eloRating ?? '—'} ELO
              </Text>
            </View>
          </View>
          <Text style={[styles.handle, { color: colors.text3 }]}>@{p?.username}</Text>
          {p?.bio && <Text style={[styles.bio, { color: colors.text2 }]}>{p.bio}</Text>}

          <View style={styles.statsGrid}>
            <StatCard value={p?.totalDebates ?? 0} label="Total" />
            <StatCard value={p?.debatesWon ?? p?.wins ?? 0} label="Wins" color={colors.green} />
            <StatCard value={p?.debatesLost ?? p?.losses ?? 0} label="Losses" color={colors.red} />
            <StatCard value={p?.debatesTied ?? 0} label="Draws" color={colors.amber} />
          </View>

          <View style={styles.actions}>
            <Button variant="accent" size="md" style={{ flex: 1 }} onPress={() => {}}>
              Challenge
            </Button>
            <Button variant="secondary" size="md" onPress={() => {}}>
              Follow
            </Button>
          </View>
        </View>

        {/* Recent public debates */}
        {debates.length > 0 && (
          <View style={styles.debatesSection}>
            <Text style={[styles.sectionTitle, { color: colors.text3 }]}>Recent Debates</Text>
            {debates.map((debate: any) => {
              const result = getDebateResult(debate);
              const opponent = debate.challengerId === id ? debate.opponent : debate.challenger;
              return (
                <TouchableOpacity
                  key={debate.id}
                  style={[styles.debateRow, { borderBottomColor: colors.border }]}
                  onPress={() => navigateToDebate(debate.id)}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.debateTopic, { color: colors.text }]} numberOfLines={2}>
                      {debate.topic}
                    </Text>
                    <View style={styles.debateMeta}>
                      {opponent && (
                        <Text style={[styles.debateOpponent, { color: colors.text3 }]}>
                          vs {opponent.username}
                        </Text>
                      )}
                      {debate.createdAt && (
                        <Text style={[styles.debateDate, { color: colors.text3 }]}>
                          · {timeAgo(debate.createdAt)}
                        </Text>
                      )}
                    </View>
                  </View>
                  <View style={styles.debateRight}>
                    <View style={[styles.resultBadge, { backgroundColor: result.color + '20' }]}>
                      <Text style={[styles.resultText, { color: result.color }]}>{result.label}</Text>
                    </View>
                    <ChevronRight size={14} color={colors.text3} />
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 },
  headerTitle: { fontSize: 17, fontWeight: '500' },
  avatarWrap: { marginBottom: 12, marginTop: 20 },
  info: { paddingHorizontal: 24, paddingTop: 8 },
  nameRow: { flexDirection: 'row', alignItems: 'center' },
  name: { fontSize: 20, fontWeight: '500' },
  eloBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20, borderWidth: 1, marginLeft: 8 },
  handle: { fontSize: 14, marginBottom: 8 },
  bio: { fontSize: 14, lineHeight: 20, marginBottom: 16 },
  statsGrid: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  actions: { flexDirection: 'row', gap: 8 },
  debatesSection: { marginTop: 24 },
  sectionTitle: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1, paddingHorizontal: 24, marginBottom: 4 },
  debateRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 24, borderBottomWidth: 1 },
  debateTopic: { fontSize: 14, fontWeight: '500', lineHeight: 19 },
  debateMeta: { flexDirection: 'row', gap: 4, marginTop: 3 },
  debateOpponent: { fontSize: 12 },
  debateDate: { fontSize: 12 },
  debateRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  resultBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  resultText: { fontSize: 11, fontWeight: '700' },
});
