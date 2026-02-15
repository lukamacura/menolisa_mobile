import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Linking,
  useWindowDimensions,
  Animated,
  Easing,
  type TextStyle,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { getDefaultHeaderHeight } from '@react-navigation/elements';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { supabase } from '../../lib/supabase';
import { apiFetchWithAuth, API_CONFIG, getApiUrl, openWebDashboard } from '../../lib/api';
import { useTrialStatus } from '../../hooks/useTrialStatus';
import { MarkdownText } from '../../components/MarkdownText';
import { CoffeeLoading } from '../../components/CoffeeLoading';
import { StaggeredZoomIn, useReduceMotion } from '../../components/StaggeredZoomIn';
import { colors, spacing, radii, typography, shadows } from '../../theme/tokens';

type ChatStackParamList = {
  ChatList: undefined;
  ChatThread: { sessionId: string };
};
type NavProp = NativeStackNavigationProp<ChatStackParamList, 'ChatThread'>;
type RouteProps = RouteProp<ChatStackParamList, 'ChatThread'>;

type FollowUpLink = {
  persona: string;
  topic: string;
  subtopic: string;
  label: string;
};

type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
  follow_up_links?: FollowUpLink[];
};

const WELCOME_WITH_NAME = [
  'Hi there, (NAME)! How are you doing today?',
  "Hey, (NAME)! What can I help you with?",
  "Hey, (NAME)! What's going on?",
  "Hi, (NAME)! What would you like to talk about today?",
  "Hey there, (NAME)! What do you need today?",
  'Hi, (NAME)! How can I help?',
  "Hey, (NAME)! Good to hear from you. What's up?",
  "Hello, (NAME)! I'm here - what's on your mind?",
];

const WELCOME_GENERIC = [
  'Hi there! How are you doing today?',
  'Hey! What can I help you with?',
  "Hey! What's going on?",
  'Hi! What would you like to talk about today?',
  'Hey there! What do you need today?',
  'Hi! How can I help?',
  "Hey! Good to hear from you. What's up?",
  "Hello! I'm here - what's on your mind?",
];

function buildHistory(messages: Message[], maxChars = 4000): string {
  const lines = messages.map(
    (m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${(m.content || '').trim()}`
  );
  const text = lines.join('\n');
  if (text.length <= maxChars) return text;
  return text.slice(-maxChars);
}

function normalizeMarkdown(src: string): string {
  if (!src) return '';
  return src
    .replace(/\r\n?/g, '\n')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

const easeOut = Easing.bezier(0.33, 1, 0.68, 1);

function ConversationLoader() {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const dotAnims = useRef([0, 1, 2].map(() => new Animated.Value(0.45))).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 480,
      useNativeDriver: true,
      easing: easeOut,
    }).start();
  }, [fadeAnim]);

  useEffect(() => {
    const stagger = 180;
    const duration = 520;
    const loops = dotAnims.map((anim, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * stagger),
          Animated.timing(anim, {
            toValue: 1,
            duration,
            useNativeDriver: true,
            easing: easeOut,
          }),
          Animated.timing(anim, {
            toValue: 0.45,
            duration,
            useNativeDriver: true,
            easing: easeOut,
          }),
        ])
      )
    );
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [dotAnims]);

  return (
    <Animated.View style={[styles.centered, { opacity: fadeAnim }]}>
      <Image
        source={require('../../../assets/logo_transparent.png')}
        style={styles.loadingLogo}
        resizeMode="contain"
      />
      <View style={styles.loadingDotsRow}>
        {dotAnims.map((anim, i) => (
          <Animated.View
            key={i}
            style={[
              styles.loadingDot,
              {
                opacity: anim,
                transform: [
                  {
                    scale: anim.interpolate({
                      inputRange: [0.45, 1],
                      outputRange: [0.9, 1.2],
                    }),
                  },
                ],
              },
            ]}
          />
        ))}
      </View>
      <Text style={styles.loadingText}>Loading your conversations...</Text>
    </Animated.View>
  );
}

const KEYBOARD_OFFSET_EXTRA = 8;

export function ChatThreadScreen() {
  const navigation = useNavigation<NavProp>();
  const route = useRoute<RouteProps>();
  const { sessionId } = route.params;
  const { expired: trialExpired } = useTrialStatus();
  const reduceMotion = useReduceMotion();
  const insets = useSafeAreaInsets();
  const dimensions = useWindowDimensions();
  const keyboardVerticalOffset =
    getDefaultHeaderHeight(
      { width: dimensions.width, height: dimensions.height },
      false,
      insets.top
    ) + KEYBOARD_OFFSET_EXTRA;

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const SEND_BTN_SIZE = 44;
  const [inputHeight, setInputHeight] = useState(SEND_BTN_SIZE);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const flatListRef = useRef<FlatList>(null);
  const sendIconOpacity = useRef(new Animated.Value(1)).current;
  const sendSpinnerOpacity = useRef(new Animated.Value(0)).current;

  const MIN_INPUT_HEIGHT = SEND_BTN_SIZE;
  const MAX_INPUT_HEIGHT = 120;
  const INPUT_PADDING_V = 8;

  const loadMessages = useCallback(async () => {
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
        `${API_CONFIG.endpoints.chatSessions}?user_id=${encodeURIComponent(user.id)}&session_id=${encodeURIComponent(sessionId)}&limit=50`
      );
      const loaded: Message[] = (data?.messages ?? []).map((m: { id: string; role: string; content: string; created_at: string }) => ({
        id: m.id,
        role: m.role,
        content: m.role === 'assistant' ? normalizeMarkdown(m.content) : m.content,
        created_at: m.created_at,
      }));

      if (loaded.length === 0) {
        let userName: string | null = null;
        try {
          const { data: profile } = await supabase
            .from('user_profiles')
            .select('name')
            .eq('user_id', user.id)
            .single();
          if (profile?.name) {
            const first = profile.name.trim().split(/\s+/)[0];
            userName = first || profile.name;
          }
        } catch (_) {}
        const idx = Math.floor(Math.random() * WELCOME_WITH_NAME.length);
        const greeting = userName
          ? WELCOME_WITH_NAME[idx].replace('(NAME)', userName)
          : WELCOME_GENERIC[idx];
        setMessages([
          {
            id: 'greeting',
            role: 'assistant',
            content: greeting,
            created_at: new Date().toISOString(),
          },
        ]);
      } else {
        setMessages(loaded);
      }
    } catch (e) {
      let msg = e instanceof Error ? e.message : 'Failed to load messages';
      if (/failed to fetch|network request failed|network error|load failed/i.test(msg)) {
        msg = "Could not reach the server. Check your network and API URL (e.g. use your computer's IP when testing on a device).";
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  const showToolToast = useCallback((title: string, message: string) => {
    Alert.alert(title, message);
  }, []);

  const sendMessage = useCallback(
    async (textOverride?: string) => {
      const text = (textOverride ?? input).trim();
      if (!text || !userId || sending) return;

      if (trialExpired) {
        Alert.alert(
          'Trial Expired',
          'Your trial has ended. Manage your subscription at menolisa.com to continue.',
          [
            { text: 'OK', style: 'cancel' },
            { text: 'Manage subscription', onPress: () => openWebDashboard().catch(() => {}) },
          ]
        );
        return;
      }

      setInput('');
      setInputHeight(SEND_BTN_SIZE);
      const userMsg: Message = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: text,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, userMsg]);
      setSending(true);
      setStreamingContent('');
      setError(null);

      const placeholderAssistant: Message = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: '',
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, placeholderAssistant]);

      const history = buildHistory([...messages, userMsg]);

      const applyAssistantReply = (content: string, followUpLinks?: FollowUpLink[]) => {
        setMessages((prev) => {
          const next = [...prev];
          const last = next[next.length - 1];
          if (last?.role === 'assistant') {
            next[next.length - 1] = { ...last, content: normalizeMarkdown(content), follow_up_links: followUpLinks };
          } else {
            next.push({
              id: `assistant-${Date.now()}`,
              role: 'assistant',
              content: normalizeMarkdown(content),
              created_at: new Date().toISOString(),
              follow_up_links: followUpLinks,
            });
          }
          return next;
        });
      };

      const isNetworkError = (err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        return /failed to fetch|network request failed|network error|load failed|cleartext|connection/i.test(msg);
      };

      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) throw new Error('Not authenticated');

        const url = getApiUrl(API_CONFIG.endpoints.chat);
        let res: Response;
        try {
          res = await fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({
              user_id: userId,
              sessionId,
              userInput: text,
              history,
              stream: Platform.OS !== 'android',
            }),
          });
        } catch (fetchErr) {
          if (isNetworkError(fetchErr)) {
            const fallbackRes = await apiFetchWithAuth(API_CONFIG.endpoints.chat, {
              method: 'POST',
              body: JSON.stringify({
                user_id: userId,
                sessionId,
                userInput: text,
                history,
                stream: false,
              }),
            });
            const content = fallbackRes?.content ?? fallbackRes?.message ?? fallbackRes?.reply ?? fallbackRes?.outputs?.output_0 ?? '';
            const fallbackLinks = fallbackRes?.follow_up_links as FollowUpLink[] | undefined;
            applyAssistantReply(typeof content === 'string' ? content : JSON.stringify(content), fallbackLinks);
            return;
          }
          throw fetchErr;
        }

        if (!res.ok) {
          const errText = await res.text();
          let errData: { error?: string; message?: string } = {};
          try {
            errData = JSON.parse(errText);
          } catch {}
          throw new Error(errData?.error || errData?.message || `${res.status} ${res.statusText}`);
        }

        const contentType = res.headers.get('content-type');
        if (contentType?.includes('text/event-stream') && res.body) {
          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          let buffer = '';
          let fullResponse = '';
          let lastFollowUpLinks: FollowUpLink[] | null = null;

          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              buffer += decoder.decode(value, { stream: true });
              const parts = buffer.split('\n\n');
              buffer = parts.pop() || '';

              for (const line of parts) {
                if (!line.trim() || !line.startsWith('data: ')) continue;
                const jsonStr = line.slice(6).trim();
                if (!jsonStr) continue;
                try {
                  const data = JSON.parse(jsonStr);

                  if (data.type === 'chunk' && data.content !== undefined) {
                    fullResponse = data.content;
                    setStreamingContent(fullResponse);
                  } else if (data.type === 'follow_up_links' && data.links) {
                    lastFollowUpLinks = data.links;
                  } else if (data.type === 'tool_result' && data.success) {
                    const toolName = data.tool_name;
                    const toolArgs = data.tool_args || {};
                    let title = '';
                    let message = '';
                    if (toolName === 'log_symptom') {
                      title = 'Symptom Logged';
                      const sev = toolArgs.severity ? String(toolArgs.severity).charAt(0).toUpperCase() + String(toolArgs.severity).slice(1) : 'Unknown';
                      message = [toolArgs.name, `Severity: ${sev}`].filter(Boolean).join(' | ');
                      if (toolArgs.triggers?.length) message += ` | Triggers: ${toolArgs.triggers.join(', ')}`;
                    } else if (toolName === 'log_nutrition') {
                      title = 'Meal Logged';
                      message = `${toolArgs.food_item || ''} (${toolArgs.meal_type || ''})`;
                    } else if (toolName === 'log_fitness') {
                      title = 'Workout Logged';
                      message = `${toolArgs.exercise_name || ''} (${toolArgs.exercise_type || ''})`;
                    }
                    if (title && message) showToolToast(title, message);
                  } else if (data.type === 'done') {
                    const reply = normalizeMarkdown(fullResponse);
                    setMessages((prev) => {
                      const next = [...prev];
                      const last = next[next.length - 1];
                      if (last?.role === 'assistant') {
                        next[next.length - 1] = {
                          ...last,
                          content: reply,
                          follow_up_links: lastFollowUpLinks ?? undefined,
                        };
                      }
                      return next;
                    });
                    setStreamingContent('');
                    setSending(false);
                    return;
                  } else if (data.type === 'error') {
                    throw new Error(data.error || 'Streaming error');
                  }
                } catch (parseErr) {
                  if (jsonStr !== '[DONE]' && !jsonStr.startsWith(':')) {
                    // ignore malformed lines
                  }
                }
              }
            }

            if (fullResponse) {
              const reply = normalizeMarkdown(fullResponse);
              setMessages((prev) => {
                const next = [...prev];
                const last = next[next.length - 1];
                if (last?.role === 'assistant') {
                  next[next.length - 1] = {
                    ...last,
                    content: reply,
                    follow_up_links: lastFollowUpLinks ?? undefined,
                  };
                }
                return next;
              });
            }
          } finally {
            setStreamingContent('');
            setSending(false);
          }
        } else {
          const raw = await res.text();
          let data: { content?: string; message?: string; reply?: string } = {};
          try {
            data = JSON.parse(raw);
          } catch {}
          const content = data?.content ?? data?.message ?? data?.reply ?? '';
          setMessages((prev) => {
            const next = [...prev];
            const last = next[next.length - 1];
            if (last?.role === 'assistant' && !last.content) {
              next[next.length - 1] = { ...last, content: normalizeMarkdown(content) };
            } else {
              next.push({
                id: `assistant-${Date.now()}`,
                role: 'assistant',
                content: normalizeMarkdown(content),
                created_at: new Date().toISOString(),
              });
            }
            return next;
          });
        }
      } catch (e) {
        let msg = e instanceof Error ? e.message : 'Failed to send';
        if (/failed to fetch|network request failed|network error|load failed/i.test(msg)) {
          msg = "Could not reach the server. Check your network and that the API URL is correct (e.g. use your computer's IP instead of localhost when testing on a device).";
        }
        setError(msg);
        setMessages((prev) => prev.filter((m) => m.id !== userMsg.id && m.id !== placeholderAssistant.id));
        setInput(text);
      } finally {
        setSending(false);
        setStreamingContent('');
      }
    },
    [input, userId, sending, messages, trialExpired, sessionId, showToolToast]
  );

  const onFollowUpPress = useCallback(
    (subtopic: string) => {
      sendMessage(subtopic);
    },
    [sendMessage]
  );

  useEffect(() => {
    const duration = 220;
    Animated.parallel([
      Animated.timing(sendIconOpacity, {
        toValue: sending ? 0 : 1,
        duration,
        useNativeDriver: true,
        easing: easeOut,
      }),
      Animated.timing(sendSpinnerOpacity, {
        toValue: sending ? 1 : 0,
        duration,
        useNativeDriver: true,
        easing: easeOut,
      }),
    ]).start();
  }, [sending, sendIconOpacity, sendSpinnerOpacity]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <ConversationLoader />
      </SafeAreaView>
    );
  }

  const displayMessages = messages.length === 0 && !sending
    ? []
    : messages;
  const isStreaming = sending && displayMessages.some((m) => m.role === 'assistant' && !m.content);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StaggeredZoomIn delayIndex={0} reduceMotion={reduceMotion} style={styles.flex}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
        keyboardVerticalOffset={keyboardVerticalOffset}
      >
        {error && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}
        <FlatList
          ref={flatListRef}
          data={displayMessages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.messageList}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <View style={styles.empty}>
              <View style={styles.emptyIconWrap}>
                <Ionicons name="chatbubble-ellipses" size={36} color={CHAT.emptyIcon} />
              </View>
              <Text style={styles.emptyText}>Start the conversation</Text>
              <Text style={styles.emptySubtext}>Say hi to Lisa—she’s here to listen and help.</Text>
            </View>
          }
          ListFooterComponent={
            sending &&
            displayMessages.length > 0 &&
            displayMessages[displayMessages.length - 1].role === 'user' ? (
              <View style={styles.bubbleWrapper}>
                <Text style={styles.lisaLabel}>Lisa</Text>
                <View style={[styles.bubble, styles.bubbleAssistant]}>
                  <CoffeeLoading />
                </View>
              </View>
            ) : null
          }
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          renderItem={({ item, index }) => {
            const isLastAssistant = item.role === 'assistant' && index === displayMessages.length - 1;
            const showStreaming = isLastAssistant && isStreaming;

            return (
              <View style={styles.bubbleWrapper}>
                {item.role === 'assistant' && (
                  <Text style={styles.lisaLabel}>Lisa</Text>
                )}
                <View
                  style={[
                    styles.bubble,
                    item.role === 'user' ? styles.bubbleUser : styles.bubbleAssistant,
                    item.role === 'assistant' && Platform.OS === 'ios' && styles.bubbleAssistantWide,
                  ]}
                >
                  {item.role === 'user' ? (
                    <Text style={[styles.bubbleText, styles.bubbleTextUser]}>
                      {item.content}
                    </Text>
                  ) : (
                    <>
                      {showStreaming && !streamingContent ? (
                        <CoffeeLoading />
                      ) : (
                        <>
                          <MarkdownText
                            textStyle={[styles.bubbleText, styles.bubbleTextAssistant]}
                          >
                            {showStreaming && streamingContent ? streamingContent : item.content || ''}
                          </MarkdownText>
                          {showStreaming && streamingContent ? <View style={styles.cursor} /> : null}
                        </>
                      )}
                    </>
                  )}
                </View>
                {item.role === 'assistant' && item.follow_up_links && item.follow_up_links.length > 0 && (
                  <View style={styles.followUpRow}>
                    <Text style={styles.followUpLabel}>You might also like:</Text>
                    <View style={styles.followUpChips}>
                      {item.follow_up_links.map((link: FollowUpLink, linkIdx: number) => (
                        <TouchableOpacity
                          key={linkIdx}
                          activeOpacity={1}
                          style={styles.followUpChip}
                          onPress={() => onFollowUpPress(link.subtopic)}
                          disabled={sending}
                        >
                          <Ionicons name="link" size={16} color={colors.primary} />
                          <Text style={styles.followUpChipText}>{link.label}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}
              </View>
            );
          }}
        />
        <Text style={styles.chatDisclaimer}>Lisa is for support only, not medical advice.</Text>
        <View style={styles.inputRow}>
          <View style={styles.composerContainer}>
            <TextInput
              style={[
                styles.input,
                {
                  height: !input.trim()
                    ? MIN_INPUT_HEIGHT
                    : Math.max(MIN_INPUT_HEIGHT, Math.min(MAX_INPUT_HEIGHT, inputHeight)),
                },
                Platform.OS === 'web' && ({
                  overflowY: inputHeight > MAX_INPUT_HEIGHT ? 'auto' : 'hidden',
                  scrollbarWidth: 'none',
                  msOverflowStyle: 'none',
                } as Record<string, unknown>),
              ]}
              value={input}
              onChangeText={setInput}
              onFocus={() => {
                setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
              }}
              onContentSizeChange={(e) => {
                const raw = e.nativeEvent.contentSize.height;
                if (!input.trim() && raw > 60) return;
                const h = raw > 200 ? raw : raw + INPUT_PADDING_V * 2;
                setInputHeight(Math.max(MIN_INPUT_HEIGHT, Math.min(MAX_INPUT_HEIGHT, h)));
              }}
              placeholder="Ask Lisa anything..."
              placeholderTextColor={colors.textMuted}
              multiline
              maxLength={2000}
              editable={!sending}
              scrollEnabled={inputHeight >= MAX_INPUT_HEIGHT}
            />
            <TouchableOpacity
              activeOpacity={1}
              style={[styles.sendBtn, (!input.trim() || sending) && styles.sendBtnDisabled]}
              onPress={() => sendMessage()}
              disabled={!input.trim() || sending}
            >
              <Animated.View
                style={[StyleSheet.absoluteFillObject, styles.sendBtnContent, { opacity: sendIconOpacity }]}
                pointerEvents="none"
              >
                <Ionicons name="send" size={22} color="#fff" />
              </Animated.View>
              <Animated.View
                style={[StyleSheet.absoluteFillObject, styles.sendBtnContent, { opacity: sendSpinnerOpacity }]}
                pointerEvents="none"
              >
                <ActivityIndicator size="small" color="#fff" />
              </Animated.View>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
      </StaggeredZoomIn>
    </SafeAreaView>
  );
}

/* Chat UI theme: calm, readable, 40+ friendly */
const CHAT = {
  screenBg: '#FDF8FA',
  userBubble: colors.primary,
  userBubbleText: '#FFFFFF',
  lisaBubble: '#FFFFFF',
  lisaBubbleBorder: 'rgba(255, 141, 161, 0.18)',
  lisaBubbleShadow: 'rgba(0,0,0,0.04)',
  lisaLabel: colors.textMuted,
  bodyFontSize: 17,
  lineHeight: 24,
  composerBg: '#FFFFFF',
  composerBorder: 'rgba(255, 141, 161, 0.2)',
  chipBg: '#FFF5F9',
  chipBorder: 'rgba(255, 141, 161, 0.35)',
  chipText: colors.primaryDark,
  emptyIcon: colors.primaryLight,
  errorBg: '#FEF2F2',
  errorBorder: 'rgba(220, 38, 38, 0.15)',
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: CHAT.screenBg,
  },
  flex: {
    flex: 1,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingLogo: {
    width: 72,
    height: 72,
    marginBottom: spacing.lg,
  },
  loadingDotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginBottom: spacing.md,
  },
  loadingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primaryLight,
  },
  loadingText: {
    marginTop: 0,
    fontSize: 17,
    fontFamily: typography.family.regular,
    color: colors.textMuted,
  },
  errorBanner: {
    backgroundColor: CHAT.errorBg,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: CHAT.errorBorder,
  },
  errorText: {
    fontSize: 15,
    fontFamily: typography.family.regular,
    color: colors.danger,
    lineHeight: 22,
  },
  messageList: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  empty: {
    paddingVertical: spacing['2xl'],
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  emptyIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: CHAT.chipBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  emptyText: {
    fontSize: 17,
    fontFamily: typography.family.medium,
    color: colors.text,
    textAlign: 'center',
    lineHeight: 24,
  },
  emptySubtext: {
    fontSize: 15,
    fontFamily: typography.family.regular,
    color: colors.textMuted,
    marginTop: spacing.xs,
    textAlign: 'center',
    lineHeight: 22,
  },
  bubbleWrapper: {
    marginBottom: 14,
  },
  lisaLabel: {
    fontSize: 13,
    fontFamily: typography.family.medium,
    color: CHAT.lisaLabel,
    marginBottom: 4,
    marginLeft: 4,
  },
  bubble: {
    maxWidth: '88%',
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 20,
  },
  bubbleUser: {
    alignSelf: 'flex-end',
    backgroundColor: CHAT.userBubble,
    borderBottomRightRadius: 6,
  },
  bubbleAssistant: {
    alignSelf: 'flex-start',
    backgroundColor: CHAT.lisaBubble,
    borderBottomLeftRadius: 6,
    borderWidth: 1,
    borderColor: CHAT.lisaBubbleBorder,
    ...Platform.select({
      ios: {
        shadowColor: CHAT.lisaBubbleShadow,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 1,
        shadowRadius: 8,
      },
      android: { elevation: 2 },
      default: {},
    }),
  },
  bubbleAssistantWide: {
    maxWidth: '98%',
  },
  bubbleText: {
    fontSize: CHAT.bodyFontSize,
    fontFamily: typography.family.regular,
    lineHeight: CHAT.lineHeight,
  },
  bubbleTextUser: {
    color: CHAT.userBubbleText,
  },
  bubbleTextAssistant: {
    color: colors.text,
  },
  cursor: {
    width: 2,
    height: 20,
    backgroundColor: colors.primary,
    marginTop: 2,
    borderRadius: 1,
  },
  followUpRow: {
    marginTop: 12,
    marginLeft: 4,
    alignSelf: 'stretch',
    maxWidth: '100%',
  },
  followUpLabel: {
    fontSize: 14,
    fontFamily: typography.family.medium,
    color: colors.textMuted,
    marginBottom: 8,
  },
  followUpChips: {
    flexDirection: 'column',
    gap: 8,
  },
  followUpChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CHAT.chipBg,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: CHAT.chipBorder,
    gap: 6,
    minHeight: 40,
  },
  followUpChipText: {
    fontSize: 14,
    fontFamily: typography.family.medium,
    color: CHAT.chipText,
    flexShrink: 1,
  },
  chatDisclaimer: {
    fontSize: 11,
    fontFamily: typography.family.regular,
    color: colors.textMuted,
    textAlign: 'center',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    paddingBottom: spacing.lg,
    backgroundColor: CHAT.screenBg,
    borderTopWidth: 0,
  },
  composerContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    minHeight: 48,
    maxHeight: 128,
    paddingVertical: 8,
    paddingLeft: 18,
    paddingRight: 8,
    backgroundColor: CHAT.composerBg,
    borderRadius: 26,
    borderWidth: 1.5,
    borderColor: CHAT.composerBorder,
    ...Platform.select({
      ios: {
        shadowColor: CHAT.lisaBubbleShadow,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 1,
        shadowRadius: 10,
      },
      android: { elevation: 2 },
      default: {},
    }),
  },
  input: {
    flex: 1,
    paddingTop: 10,
    paddingBottom: 10,
    paddingHorizontal: 6,
    fontSize: 17,
    fontFamily: typography.family.regular,
    color: colors.text,
    outlineStyle: 'none',
    outlineWidth: 0,
  } as unknown as TextStyle,
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    ...shadows.buttonPrimary,
  },
  sendBtnContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendBtnDisabled: {
    opacity: 0.45,
  },
});
