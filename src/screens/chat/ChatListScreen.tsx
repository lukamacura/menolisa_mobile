import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { MessageCircleHeart } from 'lucide-react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { supabase } from '../../lib/supabase';
import { apiFetchWithAuth, API_CONFIG, isSubscriptionRequiredError } from '../../lib/api';
import { colors, spacing, radii, typography, shadows } from '../../theme/tokens';
import { StaggeredZoomIn, useReduceMotion } from '../../components/StaggeredZoomIn';
import { ListSkeleton, ContentTransition } from '../../components/skeleton';
import { errorMessage } from '../../lib/errorCopy';

type ChatStackParamList = {
  ChatList: undefined;
  ChatThread: { sessionId: string };
};
type NavProp = NativeStackNavigationProp<ChatStackParamList, 'ChatList'>;

type SessionItem = {
  session_id: string;
  title: string;
  created_at: string;
  updated_at: string;
  message_count: number;
};

function uid(): string {
  return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
}

export function ChatListScreen() {
  const navigation = useNavigation<NavProp>();
  const reduceMotion = useReduceMotion();
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);
  /** Synchronous lock — `New chat` taps land faster than React can disable the button. */
  const creatingRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  /** `silent` refreshes in place: no skeleton flash when returning from a thread. */
  const loadSessions = useCallback(async (silent = false) => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!mountedRef.current) return;
    if (!user?.id) {
      setLoading(false);
      return;
    }
    try {
      setError(null);
      const data = await apiFetchWithAuth(
        `${API_CONFIG.endpoints.chatSessions}?user_id=${encodeURIComponent(user.id)}&limit=20`
      );
      if (!mountedRef.current) return;
      setSessions(data?.sessions ?? []);
    } catch (e) {
      if (!mountedRef.current) return;
      // A 403 means "no subscription" — AuthContext routes her to the paywall.
      if (isSubscriptionRequiredError(e)) return;
      // A silent background refresh must not replace a good list with an error.
      if (!silent) {
        setError(errorMessage(e, 'We could not load your conversations.'));
      }
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  // Titles and message counts are written server-side while she chats, so the list
  // is stale the moment she comes back from a thread.
  useFocusEffect(
    useCallback(() => {
      loadSessions(true);
    }, [loadSessions])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadSessions();
    if (mountedRef.current) setRefreshing(false);
  }, [loadSessions]);

  const startNewChat = useCallback(async () => {
    if (creatingRef.current) return;
    creatingRef.current = true;
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user?.id) return;
      const sessionId = uid();
      await apiFetchWithAuth(API_CONFIG.endpoints.chatSessions, {
        method: 'POST',
        body: JSON.stringify({
          user_id: user.id,
          session_id: sessionId,
          title: 'New chat',
        }),
      });
      if (!mountedRef.current) return;
      navigation.navigate('ChatThread', { sessionId });
    } catch (e) {
      if (!mountedRef.current || isSubscriptionRequiredError(e)) return;
      setError(errorMessage(e, 'We could not start a new chat.'));
    } finally {
      creatingRef.current = false;
    }
  }, [navigation]);

  const deleteSession = useCallback(async (sessionId: string) => {
    try {
      await apiFetchWithAuth(
        `${API_CONFIG.endpoints.chatSessions}?session_id=${encodeURIComponent(sessionId)}`,
        { method: 'DELETE' }
      );
      setSessions((prev) => prev.filter((s) => s.session_id !== sessionId));
    } catch (e) {
      setError(errorMessage(e, 'We could not delete that conversation.'));
    }
  }, []);

  const onLongPressSession = (item: SessionItem) => {
    Alert.alert(
      'Delete conversation',
      `Delete "${(item.title && item.title.trim()) ? item.title.trim() : 'this conversation'}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => deleteSession(item.session_id) },
      ]
    );
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) return 'Today';
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return d.toLocaleDateString();
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <ListSkeleton headerTitleWidth={160} rowCount={4} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ContentTransition>
      <StaggeredZoomIn delayIndex={0} reduceMotion={reduceMotion}>
        <View style={styles.header}>
          <Text style={styles.title}>Chat with Lisa</Text>
          <TouchableOpacity activeOpacity={1} style={styles.newChatBtn} onPress={startNewChat}>
            <Ionicons name="add" size={24} color={colors.textInverse} />
            <Text style={styles.newChatBtnText}>New chat</Text>
          </TouchableOpacity>
        </View>
      </StaggeredZoomIn>
      <StaggeredZoomIn delayIndex={1} reduceMotion={reduceMotion}>
        <View style={styles.heroWrap} accessibilityRole="image" accessibilityLabel="Chat illustration">
          <View style={styles.heroIconWell}>
            <MessageCircleHeart size={50} color={colors.primary} strokeWidth={2} />
          </View>
        </View>
      </StaggeredZoomIn>
      {error && (
        <StaggeredZoomIn delayIndex={2} reduceMotion={reduceMotion}>
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        </StaggeredZoomIn>
      )}
      <StaggeredZoomIn delayIndex={3} reduceMotion={reduceMotion} style={{ flex: 1 }}>
      <FlatList
        data={sessions}
        keyExtractor={(item) => item.session_id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No conversations yet.</Text>
            <Text style={styles.emptySubtext}>Tap "New chat" to start.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            activeOpacity={1}
            style={styles.row}
            onPress={() => navigation.navigate('ChatThread', { sessionId: item.session_id })}
            onLongPress={() => onLongPressSession(item)}
          >
            <Ionicons name="chatbubble" size={22} color={colors.primary} />
            <View style={styles.rowText}>
              <Text style={styles.rowTitle} numberOfLines={1}>
                {(item.title && item.title.trim()) ? item.title.trim() : 'New conversation'}
              </Text>
              <Text style={styles.rowMeta}>
                {formatDate(item.updated_at)} · {item.message_count} messages
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
          </TouchableOpacity>
        )}
      />
      </StaggeredZoomIn>
      </ContentTransition>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: {
    fontSize: 20,
    fontFamily: typography.family.bold,
    color: colors.text,
  },
  heroWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.xs,
  },
  /** Same icon-well treatment as SegmentCard on Today, scaled to hero size (42/22 ratio). */
  heroIconWell: {
    width: 96,
    height: 96,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(244, 124, 151, 0.14)',
  },
  newChatBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.lg,
    gap: spacing.xs,
    ...shadows.buttonPrimary,
  },
  newChatBtnText: {
    fontSize: 17,
    fontFamily: typography.family.semibold,
    color: colors.background,
    letterSpacing: 0.5,
  },
  errorBanner: {
    backgroundColor: colors.dangerBg,
    padding: spacing.sm,
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
    borderRadius: radii.sm,
  },
  errorText: {
    fontSize: 14,
    fontFamily: typography.family.regular,
    color: colors.danger,
  },
  listContent: {
    padding: spacing.lg,
    paddingBottom: spacing['2xl'],
  },
  empty: {
    alignItems: 'center',
    marginTop: spacing.lg,
    paddingHorizontal: spacing.md,
  },
  emptyText: {
    fontSize: 16,
    fontFamily: typography.display.semibold,
    color: colors.textMuted,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    fontFamily: typography.family.regular,
    color: colors.textMuted,
    marginTop: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    padding: spacing.md,
    borderRadius: radii.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  rowText: {
    flex: 1,
  },
  rowTitle: {
    fontSize: 16,
    fontFamily: typography.display.semibold,
    color: colors.text,
  },
  rowMeta: {
    fontSize: 12,
    fontFamily: typography.family.regular,
    color: colors.textMuted,
    marginTop: 2,
  },
});
