import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Search, X } from 'lucide-react-native';
import { useQuery } from '@tanstack/react-query';
import { useTheme } from '../../theme';
import { Avatar } from '../../components/ui/Avatar';
import { Skeleton } from '../../components/ui/Skeleton';
import { debatesApi } from '../../api/debates';
import { timeAgo } from '../../utils/notifications';

const TIMEFRAMES = [
  { id: '24h' as const, label: '24h' },
  { id: '7d' as const, label: '7 days' },
  { id: '30d' as const, label: '30 days' },
];

export function TrendingScreen({ navigation }: any) {
  const { colors } = useTheme();
  const [timeframe, setTimeframe] = useState<'24h' | '7d' | '30d'>('24h');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['trending', timeframe],
    queryFn: () => debatesApi.getTrending(timeframe),
  });

  const { data: searchResults } = useQuery({
    queryKey: ['debateSearch', searchQuery],
    queryFn: () => debatesApi.search(searchQuery),
    enabled: searchQuery.length >= 2,
  });

  const debates = showSearch && searchQuery.length >= 2
    ? (Array.isArray(searchResults) ? searchResults : [])
    : (data ?? []);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={['top']}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <View style={styles.headerTop}>
          <Text style={[styles.title, { color: colors.text }]}>Arena</Text>
          <TouchableOpacity onPress={() => { setShowSearch(!showSearch); setSearchQuery(''); }}>
            {showSearch ? <X size={20} color={colors.text2} /> : <Search size={20} color={colors.text2} />}
          </TouchableOpacity>
        </View>
        {showSearch ? (
          <TextInput
            style={[styles.searchInput, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
            placeholder="Search debates..."
            placeholderTextColor={colors.text3}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoFocus
          />
        ) : (
          <View style={styles.chips}>
            {TIMEFRAMES.map((tf) => (
              <TouchableOpacity
                key={tf.id}
                onPress={() => setTimeframe(tf.id)}
                style={[
                  styles.chip,
                  {
                    borderColor: timeframe === tf.id ? colors.accent : colors.border,
                    backgroundColor: timeframe === tf.id ? colors.accent + '10' : 'transparent',
                  },
                ]}
              >
                <Text style={{ color: timeframe === tf.id ? colors.accent : colors.text3, fontSize: 12, fontWeight: '500' }}>
                  {tf.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      <FlatList
        data={debates}
        keyExtractor={(item: any) => item.id}
        contentContainerStyle={{ padding: 16 }}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.accent} />}
        ListEmptyComponent={
          isLoading ? (
            <View style={{ gap: 12 }}>{[1, 2, 3, 4].map((i) => <Skeleton key={i} height={80} />)}</View>
          ) : (
            <Text style={{ color: colors.text3, textAlign: 'center', marginTop: 40 }}>
              {showSearch ? 'No debates found' : 'No trending debates right now'}
            </Text>
          )
        }
        renderItem={({ item }: any) => (
          <TouchableOpacity
            style={[styles.card, { borderBottomColor: colors.border }]}
            onPress={() => navigation.navigate('DebateRoom', { id: item.id })}
          >
            <View style={{ flex: 1 }}>
              <View style={styles.cardMeta}>
                <Text style={[styles.category, { color: colors.text3 }]}>{item.category}</Text>
                {item.createdAt && (
                  <Text style={{ color: colors.text3, fontSize: 11 }}>{timeAgo(item.createdAt)}</Text>
                )}
              </View>
              <View style={styles.players}>
                <Avatar src={item.challenger?.avatarUrl} fallback={item.challenger?.username ?? '?'} size="xs" />
                <Text style={{ color: colors.text3, fontSize: 11 }}>vs</Text>
                <Avatar src={item.opponent?.avatarUrl} fallback={item.opponent?.username ?? '?'} size="xs" />
              </View>
              <Text style={[styles.topic, { color: colors.text }]} numberOfLines={1}>"{item.topic}"</Text>
            </View>
            <View style={styles.right}>
              <Text style={{ color: colors.text3, fontSize: 13 }}>
                {item.spectatorCount ?? 0} watching
              </Text>
              <Text style={[styles.statusBadge, {
                color: item.status === 'ACTIVE' ? colors.green
                  : item.status === 'WAITING' ? colors.amber
                  : item.status === 'VERDICT_READY' ? colors.accent
                  : colors.text3,
              }]}>
                {item.status === 'ACTIVE' ? 'Live'
                  : item.status === 'WAITING' ? 'Open'
                  : item.status === 'VERDICT_READY' ? 'Verdict Ready'
                  : item.status === 'COMPLETED' ? 'Completed'
                  : item.status === 'CANCELLED' ? 'Cancelled'
                  : item.status?.replace(/_/g, ' ')}
              </Text>
            </View>
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  title: { fontSize: 20, fontWeight: '500' },
  searchInput: { height: 40, borderWidth: 1, borderRadius: 20, paddingHorizontal: 14, fontSize: 14 },
  chips: { flexDirection: 'row', gap: 6 },
  chip: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20, borderWidth: 1 },
  card: { flexDirection: 'row', paddingVertical: 14, borderBottomWidth: 1, alignItems: 'center' },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  category: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1 },
  players: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  topic: { fontSize: 15 },
  right: { alignItems: 'flex-end', gap: 4 },
  statusBadge: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase' },
});
