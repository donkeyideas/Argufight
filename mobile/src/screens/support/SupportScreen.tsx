import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, MessageCircle, Mail, Plus, ChevronRight, ChevronDown } from 'lucide-react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTheme } from '../../theme';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { supportApi } from '../../api/support';
import { timeAgo } from '../../utils/notifications';

const FAQS = [
  {
    q: 'How do debates work?',
    a: 'Two participants take turns submitting arguments over multiple rounds. After all rounds are complete, an AI judge evaluates the arguments and declares a winner.',
  },
  {
    q: 'How is ELO rating calculated?',
    a: 'Your ELO rating changes based on debate outcomes. Winning against higher-rated opponents earns more points, while losing to lower-rated opponents costs more.',
  },
  {
    q: 'How long do I have to respond?',
    a: 'Each round has a time limit set by the debate creator (typically 24–72 hours). Missing your turn may result in a forfeit.',
  },
  {
    q: 'What are tournaments?',
    a: 'Tournaments are structured competitions where debaters compete in brackets or round-robin formats to determine an overall winner.',
  },
  {
    q: 'How do I challenge someone?',
    a: 'Visit any user\'s profile and tap "Challenge" to send them a debate invite. You can set the topic, number of rounds, and round duration.',
  },
];

export function SupportScreen({ navigation }: any) {
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [showFaqs, setShowFaqs] = useState(false);
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const { data: tickets } = useQuery({
    queryKey: ['supportTickets'],
    queryFn: supportApi.getTickets,
  });

  const ticketList = Array.isArray(tickets) ? tickets : (tickets as any)?.tickets ?? [];

  async function handleCreateTicket() {
    if (!subject.trim() || !description.trim()) {
      Alert.alert('Error', 'Please fill in subject and description.');
      return;
    }
    setSubmitting(true);
    try {
      await supportApi.createTicket({ subject: subject.trim(), description: description.trim() });
      setSubject('');
      setDescription('');
      setShowCreate(false);
      queryClient.invalidateQueries({ queryKey: ['supportTickets'] });
      Alert.alert('Ticket created', 'We\'ll get back to you soon.');
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={['top']}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <ArrowLeft size={20} color={colors.text2} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>Help & Support</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
        {/* FAQs */}
        <TouchableOpacity onPress={() => setShowFaqs(!showFaqs)} activeOpacity={0.7}>
          <Card>
            <View style={styles.cardRow}>
              <MessageCircle size={20} color={colors.accent} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.cardTitle, { color: colors.text }]}>FAQs</Text>
                <Text style={{ color: colors.text3, fontSize: 13 }}>Find answers to common questions</Text>
              </View>
              <ChevronDown
                size={18}
                color={colors.text3}
                style={{ transform: [{ rotate: showFaqs ? '180deg' : '0deg' }] }}
              />
            </View>
          </Card>
        </TouchableOpacity>

        {showFaqs && (
          <Card>
            {FAQS.map((faq, i) => (
              <View key={i} style={[styles.faqItem, i < FAQS.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
                <TouchableOpacity
                  style={styles.faqQuestion}
                  onPress={() => setExpandedFaq(expandedFaq === i ? null : i)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.faqQ, { color: colors.text }]}>{faq.q}</Text>
                  <ChevronRight
                    size={16}
                    color={colors.text3}
                    style={{ transform: [{ rotate: expandedFaq === i ? '90deg' : '0deg' }] }}
                  />
                </TouchableOpacity>
                {expandedFaq === i && (
                  <Text style={[styles.faqA, { color: colors.text2 }]}>{faq.a}</Text>
                )}
              </View>
            ))}
          </Card>
        )}

        {/* Contact Us */}
        <TouchableOpacity onPress={() => Linking.openURL('mailto:info@donkeyideas.com')} activeOpacity={0.7}>
          <Card>
            <View style={styles.cardRow}>
              <Mail size={20} color={colors.accent} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.cardTitle, { color: colors.text }]}>Contact Us</Text>
                <Text style={{ color: colors.accent, fontSize: 13 }}>info@donkeyideas.com</Text>
              </View>
            </View>
          </Card>
        </TouchableOpacity>

        <Button
          variant="outline"
          size="md"
          fullWidth
          icon={<Plus size={16} color={colors.accent} />}
          onPress={() => setShowCreate(!showCreate)}
        >
          {showCreate ? 'Cancel' : 'Create Support Ticket'}
        </Button>

        {showCreate && (
          <Card>
            <Text style={{ color: colors.text, fontSize: 15, fontWeight: '500', marginBottom: 12 }}>New Ticket</Text>
            <Input
              placeholder="Subject"
              value={subject}
              onChangeText={setSubject}
              returnKeyType="next"
            />
            <Input
              placeholder="Describe your issue..."
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={5}
              style={{ minHeight: 100, textAlignVertical: 'top' }}
            />
            <Button variant="accent" size="md" fullWidth loading={submitting} onPress={handleCreateTicket}>
              Submit Ticket
            </Button>
          </Card>
        )}

        {ticketList.length > 0 && (
          <>
            <Text style={[styles.sectionTitle, { color: colors.text3 }]}>Your Tickets</Text>
            {ticketList.map((ticket: any) => (
              <Card key={ticket.id}>
                <View style={styles.ticketRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.text, fontSize: 14, fontWeight: '500' }}>{ticket.subject}</Text>
                    <View style={styles.ticketMeta}>
                      <Badge
                        color={ticket.status === 'OPEN' ? 'green' : ticket.status === 'CLOSED' ? 'muted' : 'amber'}
                      >
                        {ticket.status}
                      </Badge>
                      {ticket.createdAt && (
                        <Text style={{ color: colors.text3, fontSize: 11 }}>{timeAgo(ticket.createdAt)}</Text>
                      )}
                    </View>
                  </View>
                  <ChevronRight size={16} color={colors.text3} />
                </View>
              </Card>
            ))}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1 },
  title: { fontSize: 17, fontWeight: '500' },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  cardTitle: { fontSize: 15, fontWeight: '500' },
  faqItem: { paddingVertical: 12 },
  faqQuestion: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  faqQ: { fontSize: 14, fontWeight: '500', flex: 1, paddingRight: 8 },
  faqA: { fontSize: 13, lineHeight: 20, marginTop: 8 },
  sectionTitle: { fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1.5, marginTop: 8 },
  ticketRow: { flexDirection: 'row', alignItems: 'center' },
  ticketMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
});
