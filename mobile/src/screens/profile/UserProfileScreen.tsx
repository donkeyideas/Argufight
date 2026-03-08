import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Zap } from 'lucide-react-native';
import { useQuery } from '@tanstack/react-query';
import { useTheme } from '../../theme';
import { Avatar } from '../../components/ui/Avatar';
import { StatCard } from '../../components/ui/StatCard';
import { Button } from '../../components/ui/Button';
import { usersApi } from '../../api/users';

export function UserProfileScreen({ navigation, route }: any) {
  const { colors } = useTheme();
  const { id } = route.params;

  const { data: profile } = useQuery({
    queryKey: ['userProfile', id],
    queryFn: () => usersApi.getUserProfile(id),
  });

  const p = profile?.user ?? profile;

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
            <StatCard
              value={p?.totalDebates > 0 ? Math.round(((p?.debatesWon ?? p?.wins ?? 0) / p.totalDebates) * 100) + '%' : '—'}
              label="Win Rate"
              color={colors.accent}
            />
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
});
