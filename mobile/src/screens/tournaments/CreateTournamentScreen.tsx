import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft } from 'lucide-react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTheme } from '../../theme';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { tournamentsApi } from '../../api/tournaments';

const MAX_PARTICIPANTS_OPTIONS = [4, 8, 16, 32];
const FORMAT_OPTIONS = [
  { value: 'BRACKET', label: 'Bracket', desc: 'Single-elimination bracket' },
  { value: 'KING_OF_THE_HILL', label: 'King of the Hill', desc: 'Last one standing wins' },
];

const DATE_OPTIONS = [
  { label: 'Tomorrow', days: 1 },
  { label: 'In 3 days', days: 3 },
  { label: 'In 1 week', days: 7 },
  { label: 'In 2 weeks', days: 14 },
];

function addDays(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(12, 0, 0, 0);
  return d;
}

export function CreateTournamentScreen({ navigation }: any) {
  const { colors } = useTheme();
  const queryClient = useQueryClient();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [maxParticipants, setMaxParticipants] = useState(8);
  const [format, setFormat] = useState('BRACKET');
  const [selectedDays, setSelectedDays] = useState(7);

  const mutation = useMutation({
    mutationFn: () =>
      tournamentsApi.create({
        name: name.trim(),
        description: description.trim() || undefined,
        maxParticipants,
        format,
        startDate: addDays(selectedDays).toISOString(),
      } as any),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['tournaments'] });
      Alert.alert('Tournament created!', `"${name}" is now open for registration.`, [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    },
    onError: (err: any) => {
      Alert.alert('Error', err.message || 'Failed to create tournament');
    },
  });

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={['top']}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <ArrowLeft size={20} color={colors.text2} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Create Tournament</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <Input
          label="Tournament Name"
          placeholder="e.g. Spring Championship 2026"
          value={name}
          onChangeText={setName}
        />

        <Input
          label="Description (optional)"
          placeholder="What is this tournament about?"
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={3}
          style={{ minHeight: 72, textAlignVertical: 'top' }}
        />

        {/* Format */}
        <Text style={[styles.sectionLabel, { color: colors.text3 }]}>Format</Text>
        <View style={styles.optionRow}>
          {FORMAT_OPTIONS.map((f) => (
            <TouchableOpacity
              key={f.value}
              style={[
                styles.optionCard,
                { borderColor: format === f.value ? colors.accent : colors.border, backgroundColor: colors.surface },
                format === f.value && { backgroundColor: colors.accent + '12' },
              ]}
              onPress={() => setFormat(f.value)}
            >
              <Text style={[styles.optionLabel, { color: format === f.value ? colors.accent : colors.text }]}>
                {f.label}
              </Text>
              <Text style={[styles.optionDesc, { color: colors.text3 }]}>{f.desc}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Max participants */}
        <Text style={[styles.sectionLabel, { color: colors.text3 }]}>Max Participants</Text>
        <View style={[styles.segmented, { borderColor: colors.border, backgroundColor: colors.surface }]}>
          {MAX_PARTICIPANTS_OPTIONS.map((n) => (
            <TouchableOpacity
              key={n}
              style={[
                styles.segment,
                maxParticipants === n && { backgroundColor: colors.accent },
              ]}
              onPress={() => setMaxParticipants(n)}
            >
              <Text style={[styles.segmentText, { color: maxParticipants === n ? colors.accentFg : colors.text2 }]}>
                {n}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Start date */}
        <Text style={[styles.sectionLabel, { color: colors.text3 }]}>Start Date</Text>
        <View style={styles.optionRow}>
          {DATE_OPTIONS.map((d) => (
            <TouchableOpacity
              key={d.days}
              style={[
                styles.dateChip,
                { borderColor: selectedDays === d.days ? colors.accent : colors.border, backgroundColor: colors.surface },
                selectedDays === d.days && { backgroundColor: colors.accent + '12' },
              ]}
              onPress={() => setSelectedDays(d.days)}
            >
              <Text style={[styles.dateChipText, { color: selectedDays === d.days ? colors.accent : colors.text2 }]}>
                {d.label}
              </Text>
              <Text style={[styles.dateChipDate, { color: colors.text3 }]}>
                {addDays(d.days).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={{ marginTop: 24 }}>
          <Button
            variant="accent"
            size="lg"
            fullWidth
            loading={mutation.isPending}
            onPress={() => {
              if (!name.trim()) {
                Alert.alert('Required', 'Please enter a tournament name.');
                return;
              }
              mutation.mutate();
            }}
          >
            Create Tournament
          </Button>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1 },
  headerTitle: { fontSize: 17, fontWeight: '500' },
  sectionLabel: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10, marginTop: 4 },
  optionRow: { flexDirection: 'row', gap: 10, marginBottom: 20, flexWrap: 'wrap' },
  optionCard: { flex: 1, minWidth: 130, borderWidth: 1.5, borderRadius: 10, padding: 12, gap: 3 },
  optionLabel: { fontSize: 14, fontWeight: '600' },
  optionDesc: { fontSize: 12 },
  segmented: { flexDirection: 'row', borderRadius: 10, borderWidth: 1, overflow: 'hidden', marginBottom: 20 },
  segment: { flex: 1, paddingVertical: 10, alignItems: 'center' },
  segmentText: { fontSize: 14, fontWeight: '600' },
  dateChip: { borderWidth: 1.5, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 14, alignItems: 'center', gap: 2 },
  dateChipText: { fontSize: 13, fontWeight: '600' },
  dateChipDate: { fontSize: 11 },
});
