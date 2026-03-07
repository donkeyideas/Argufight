import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Modal, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { X, Search, ChevronDown, ChevronUp } from 'lucide-react-native';
import { useTheme } from '../../theme';
import { Avatar } from '../ui/Avatar';
import { Button } from '../ui/Button';
import { debatesApi } from '../../api/debates';
import { usersApi } from '../../api/users';

const CATEGORIES = ['POLITICS', 'SCIENCE', 'TECH', 'SPORTS', 'ENTERTAINMENT', 'MUSIC', 'OTHER'];
const ROUND_OPTIONS = [3, 5, 7];

interface CreateDebateSheetProps {
  visible: boolean;
  onClose: () => void;
  onCreated?: (debate: any) => void;
  prefillTopic?: string;
}

export function CreateDebateSheet({ visible, onClose, onCreated, prefillTopic }: CreateDebateSheetProps) {
  const { colors } = useTheme();
  const [topic, setTopic] = useState(prefillTopic ?? '');
  const [category, setCategory] = useState('POLITICS');
  const [position, setPosition] = useState<'FOR' | 'AGAINST'>('FOR');
  const [totalRounds, setTotalRounds] = useState(5);
  const [isPrivate, setIsPrivate] = useState(false);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);

  // Opponent search
  const [opponentQuery, setOpponentQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedOpponent, setSelectedOpponent] = useState<any>(null);
  const [searching, setSearching] = useState(false);

  const [submitting, setSubmitting] = useState(false);

  // Sync prefillTopic when sheet opens
  React.useEffect(() => {
    if (visible && prefillTopic) setTopic(prefillTopic);
    if (!visible) setTopic(prefillTopic ?? '');
  }, [visible, prefillTopic]);

  const searchUsers = useCallback(async (q: string) => {
    setOpponentQuery(q);
    if (q.length < 2) { setSearchResults([]); return; }
    setSearching(true);
    try {
      const res = await usersApi.search(q);
      setSearchResults((res as any)?.users ?? []);
    } catch { setSearchResults([]); }
    finally { setSearching(false); }
  }, []);

  async function handleCreate() {
    if (!topic.trim()) { Alert.alert('Error', 'Please enter a debate topic.'); return; }
    setSubmitting(true);
    try {
      const body: any = {
        topic: topic.trim(),
        category,
        challengerPosition: position,
        totalRounds,
        isPrivate,
        challengeType: selectedOpponent ? 'DIRECT' : 'OPEN',
      };
      if (selectedOpponent) body.invitedUserIds = [selectedOpponent.id];

      const debate = await debatesApi.create(body);
      onCreated?.(debate);
      resetForm();
      onClose();
    } catch (err: any) {
      Alert.alert('Error', err.message ?? 'Failed to create debate');
    } finally { setSubmitting(false); }
  }

  function resetForm() {
    setTopic(''); setCategory('POLITICS'); setPosition('FOR');
    setTotalRounds(5); setIsPrivate(false);
    setOpponentQuery(''); setSearchResults([]); setSelectedOpponent(null);
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={[styles.container, { backgroundColor: colors.bg }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={onClose}>
            <X size={20} color={colors.text2} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Create Debate</Text>
          <View style={{ width: 20 }} />
        </View>

        <ScrollView contentContainerStyle={{ padding: 20 }} keyboardShouldPersistTaps="handled">
          {/* Topic */}
          <Text style={[styles.label, { color: colors.text3 }]}>Topic</Text>
          <TextInput
            style={[styles.topicInput, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
            placeholder="What should be debated?"
            placeholderTextColor={colors.text3}
            value={topic}
            onChangeText={setTopic}
            multiline
            maxLength={200}
          />
          <Text style={[styles.charCount, { color: colors.text3 }]}>{topic.length}/200</Text>

          {/* Category */}
          <Text style={[styles.label, { color: colors.text3 }]}>Category</Text>
          <TouchableOpacity
            style={[styles.picker, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => setShowCategoryPicker(!showCategoryPicker)}
          >
            <Text style={{ color: colors.text, fontSize: 15 }}>{category}</Text>
            {showCategoryPicker ? <ChevronUp size={16} color={colors.text3} /> : <ChevronDown size={16} color={colors.text3} />}
          </TouchableOpacity>
          {showCategoryPicker && (
            <View style={[styles.categoryList, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              {CATEGORIES.map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={[styles.categoryItem, cat === category && { backgroundColor: colors.accent + '14' }]}
                  onPress={() => { setCategory(cat); setShowCategoryPicker(false); }}
                >
                  <Text style={{ color: cat === category ? colors.accent : colors.text, fontSize: 14 }}>{cat}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Position */}
          <Text style={[styles.label, { color: colors.text3 }]}>Your Position</Text>
          <View style={styles.row}>
            {(['FOR', 'AGAINST'] as const).map((pos) => (
              <TouchableOpacity
                key={pos}
                style={[
                  styles.chip,
                  { borderColor: position === pos ? colors.accent : colors.border,
                    backgroundColor: position === pos ? colors.accent + '14' : colors.surface },
                ]}
                onPress={() => setPosition(pos)}
              >
                <Text style={{ color: position === pos ? colors.accent : colors.text2, fontSize: 14, fontWeight: '500' }}>{pos}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Rounds */}
          <Text style={[styles.label, { color: colors.text3 }]}>Rounds</Text>
          <View style={styles.row}>
            {ROUND_OPTIONS.map((r) => (
              <TouchableOpacity
                key={r}
                style={[
                  styles.chip,
                  { borderColor: totalRounds === r ? colors.accent : colors.border,
                    backgroundColor: totalRounds === r ? colors.accent + '14' : colors.surface },
                ]}
                onPress={() => setTotalRounds(r)}
              >
                <Text style={{ color: totalRounds === r ? colors.accent : colors.text2, fontSize: 14, fontWeight: '500' }}>{r}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Private toggle */}
          <TouchableOpacity
            style={[styles.toggleRow, { borderColor: colors.border }]}
            onPress={() => setIsPrivate(!isPrivate)}
          >
            <Text style={{ color: colors.text, fontSize: 15 }}>Private Debate</Text>
            <View style={[styles.toggle, { backgroundColor: isPrivate ? colors.accent : colors.surface2 }]}>
              <View style={[styles.toggleDot, { left: isPrivate ? 20 : 2, backgroundColor: isPrivate ? colors.accentFg : colors.text3 }]} />
            </View>
          </TouchableOpacity>

          {/* Challenge User */}
          <Text style={[styles.label, { color: colors.text3 }]}>Challenge User (Optional)</Text>
          {selectedOpponent ? (
            <View style={[styles.selectedUser, { backgroundColor: colors.surface, borderColor: colors.accent + '33' }]}>
              <Avatar src={selectedOpponent.avatarUrl} fallback={selectedOpponent.username} size="sm" />
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontSize: 14, fontWeight: '500' }}>{selectedOpponent.username}</Text>
                <Text style={{ color: colors.text3, fontSize: 12 }}>{selectedOpponent.eloRating} ELO</Text>
              </View>
              <TouchableOpacity onPress={() => setSelectedOpponent(null)}>
                <X size={16} color={colors.text3} />
              </TouchableOpacity>
            </View>
          ) : (
            <View style={[styles.searchWrap, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Search size={16} color={colors.text3} />
              <TextInput
                style={[styles.searchInput, { color: colors.text }]}
                placeholder="Search by username..."
                placeholderTextColor={colors.text3}
                value={opponentQuery}
                onChangeText={searchUsers}
              />
            </View>
          )}
          {searchResults.length > 0 && !selectedOpponent && (
            <View style={[styles.searchResults, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              {searchResults.slice(0, 5).map((u: any) => (
                <TouchableOpacity
                  key={u.id}
                  style={[styles.userRow, { borderBottomColor: colors.border }]}
                  onPress={() => { setSelectedOpponent(u); setSearchResults([]); setOpponentQuery(''); }}
                >
                  <Avatar src={u.avatarUrl} fallback={u.username} size="sm" />
                  <Text style={{ color: colors.text, fontSize: 14, flex: 1 }}>{u.username}</Text>
                  <Text style={{ color: colors.text3, fontSize: 12 }}>{u.eloRating} ELO</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <View style={{ height: 24 }} />
          <Button variant="accent" size="lg" fullWidth loading={submitting} onPress={handleCreate}>
            Create Debate
          </Button>
          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1 },
  headerTitle: { fontSize: 17, fontWeight: '500' },
  label: { fontSize: 12, fontWeight: '500', letterSpacing: 0.96, textTransform: 'uppercase', marginBottom: 8, marginTop: 20 },
  topicInput: { borderWidth: 1, borderRadius: 10, padding: 14, fontSize: 15, minHeight: 80, textAlignVertical: 'top' },
  charCount: { fontSize: 12, textAlign: 'right', marginTop: 4 },
  picker: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: 44, paddingHorizontal: 14, borderWidth: 1, borderRadius: 10 },
  categoryList: { borderWidth: 1, borderRadius: 10, marginTop: 4, overflow: 'hidden' },
  categoryItem: { paddingHorizontal: 14, paddingVertical: 10 },
  row: { flexDirection: 'row', gap: 8 },
  chip: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20, borderWidth: 1 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14 },
  toggle: { width: 40, height: 22, borderRadius: 11, position: 'relative' },
  toggleDot: { position: 'absolute', top: 2, width: 18, height: 18, borderRadius: 9 },
  searchWrap: { flexDirection: 'row', alignItems: 'center', gap: 10, height: 44, paddingHorizontal: 14, borderWidth: 1, borderRadius: 10 },
  searchInput: { flex: 1, fontSize: 15, height: '100%' },
  searchResults: { borderWidth: 1, borderRadius: 10, marginTop: 4, overflow: 'hidden' },
  userRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderBottomWidth: 1 },
  selectedUser: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderWidth: 1, borderRadius: 10 },
});
