import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { supabase } from '../../lib/supabase';
import { apiFetchWithAuth, API_CONFIG } from '../../lib/api';
import { colors, spacing, radii, typography, shadows } from '../../theme/tokens';

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
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  const loadSessions = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user?.id) {
      setLoading(false);
      return;
    }
    setUserId(user.id);
    try {
      setError(null);
      const data = await apiFetchWithAuth(
        `${API_CONFIG.endpoints.chatSessions}?user_id=${encodeURIComponent(user.id)}&limit=20`
      );
      setSessions(data?.sessions ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load conversations');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  const startNewChat = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user?.id) return;
    const sessionId = uid();
    try {
      await apiFetchWithAuth(API_CONFIG.endpoints.chatSessions, {
        method: 'POST',
        body: JSON.stringify({
          user_id: user.id,
          session_id: sessionId,
          title: 'New chat',
        }),
      });
      navigation.navigate('ChatThread', { sessionId });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create chat');
    }
  };

  const deleteSession = useCallback(async (sessionId: string) => {
    try {
      await apiFetchWithAuth(
        `${API_CONFIG.endpoints.chatSessions}?session_id=${encodeURIComponent(sessionId)}`,
        { method: 'DELETE' }
      );
      setSessions((prev) => prev.filter((s) => s.session_id !== sessionId));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete conversation');
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
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Chat with Lisa</Text>
        <TouchableOpacity activeOpacity={1} style={styles.newChatBtn} onPress={startNewChat}>
          <Ionicons name="add" size={24} color="#fff" />
          <Text style={styles.newChatBtnText}>New chat</Text>
        </TouchableOpacity>
      </View>
      {error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}
      <FlatList
        data={sessions}
        keyExtractor={(item) => item.session_id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="chatbubbles-outline" size={48} color={colors.textMuted} />
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: spacing.sm,
    fontSize: 16,
    fontFamily: typography.family.regular,
    color: colors.textMuted,
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
    textTransform: 'uppercase',
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
    marginTop: spacing['2xl'],
  },
  emptyText: {
    fontSize: 16,
    fontFamily: typography.family.medium,
    color: colors.textMuted,
    marginTop: spacing.md,
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
    fontFamily: typography.family.semibold,
    color: colors.text,
  },
  rowMeta: {
    fontSize: 12,
    fontFamily: typography.family.regular,
    color: colors.textMuted,
    marginTop: 2,
  },
});
