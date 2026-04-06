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
  Animated,
  Easing,
  Keyboard,
  type TextStyle,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRoute, RouteProp } from '@react-navigation/native';
import { useHeaderHeight } from '@react-navigation/elements';
import { supabase } from '../../lib/supabase';
import { apiFetchWithAuth, API_CONFIG, getApiUrl, openAccountBillingEntry } from '../../lib/api';
import { useTrialStatus } from '../../hooks/useTrialStatus';
import { AccessEndedView } from '../../components/AccessEndedView';
import { MarkdownText } from '../../components/MarkdownText';
import { CoffeeLoading } from '../../components/CoffeeLoading';
import { StaggeredZoomIn, useReduceMotion } from '../../components/StaggeredZoomIn';
import { colors, spacing, radii, typography, shadows } from '../../theme/tokens';

type ChatStackParamList = {
  ChatList: undefined;
  ChatThread: { sessionId: string };
};
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

const ASSISTANT_EMPTY_FALLBACK =
  'I could not load this reply. Please tap send again.';

/** Matches `/api/langchain-rag` non-streaming `tool_notifications` and SSE `tool_result` for in-chat toasts */
type ChatToolNotification = {
  tool_name: string;
  tool_args?: Record<string, unknown>;
  success?: boolean;
};

function applyChatToolNotifications(
  items: ChatToolNotification[] | undefined,
  showToolToast: (title: string, message: string) => void,
) {
  if (!items?.length) return;
  for (const item of items) {
    if (item.tool_name !== 'log_symptom' || item.success === false) continue;
    const toolArgs = item.tool_args ?? {};
    const sevRaw = toolArgs.severity;
    const sev = sevRaw
      ? String(sevRaw).charAt(0).toUpperCase() + String(sevRaw).slice(1)
      : 'Unknown';
    const name = typeof toolArgs.name === 'string' ? toolArgs.name : '';
    let message = [name, `Severity: ${sev}`].filter(Boolean).join(' | ');
    const triggers = toolArgs.triggers;
    if (Array.isArray(triggers) && triggers.length > 0) {
      message += ` | Triggers: ${triggers.map(String).join(', ')}`;
    }
    if (message) showToolToast('Symptom Logged', message);
  }
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

export function ChatThreadScreen() {
  const route = useRoute<RouteProps>();
  const { sessionId } = route.params;
  const trialStatus = useTrialStatus();
  const trialExpired = trialStatus.expired;
  const reduceMotion = useReduceMotion();
  const insets = useSafeAreaInsets();

  // ──────────────────────────────────────────────────────
  // FIX 1: Get the navigation header height for iOS offset
  // ──────────────────────────────────────────────────────
  let headerHeight = 0;
  try {
    // useHeaderHeight throws if no header exists; guard it
    headerHeight = useHeaderHeight();
  } catch {
    headerHeight = 0;
  }

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
  const toolToastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [toolToast, setToolToast] = useState<{ title: string; message: string } | null>(null);
  const [forcePaywall, setForcePaywall] = useState(false);

  // ──────────────────────────────────────────────────────
  // FIX 5: Track whether user has manually scrolled up
  // ──────────────────────────────────────────────────────
  const isNearBottomRef = useRef(true);

  const MIN_INPUT_HEIGHT = SEND_BTN_SIZE;
  const MAX_INPUT_HEIGHT = 120;

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
    if (toolToastTimeoutRef.current) clearTimeout(toolToastTimeoutRef.current);
    setToolToast({ title, message });
    toolToastTimeoutRef.current = setTimeout(() => {
      setToolToast(null);
      toolToastTimeoutRef.current = null;
    }, 4000);
  }, []);

  useEffect(() => {
    return () => {
      if (toolToastTimeoutRef.current) clearTimeout(toolToastTimeoutRef.current);
    };
  }, []);

  // ──────────────────────────────────────────────────────
  // FIX 4: Use keyboardWillShow on iOS (fires before the
  // keyboard animation begins, so the layout is in sync)
  // ──────────────────────────────────────────────────────
  useEffect(() => {
    const eventName = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const showSub = Keyboard.addListener(eventName, () => {
      requestAnimationFrame(() => {
        if (isNearBottomRef.current) {
          flatListRef.current?.scrollToEnd({ animated: true });
        }
      });
    });
    return () => {
      showSub.remove();
    };
  }, []);

  const sendMessage = useCallback(
    async (textOverride?: string) => {
      const text = (textOverride ?? input).trim();
      if (!text || !userId || sending) return;

      if (trialExpired) {
        Alert.alert(
          'Trial ended',
          "I'm just getting to know your patterns. Continue with Lisa to keep the insights coming.",
          [
            { text: 'OK', style: 'cancel' },
            {
              text: 'Continue with Lisa',
              onPress: () => {
                if (Platform.OS === 'ios') {
                  setForcePaywall(true);
                  return;
                }
                openAccountBillingEntry().catch(() => {});
              },
            },
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

      // Reset scroll-tracking so new messages auto-scroll
      isNearBottomRef.current = true;

      const placeholderAssistant: Message = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: '',
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, placeholderAssistant]);

      const history = buildHistory([...messages, userMsg]);

      const applyAssistantReply = (content: string, followUpLinks?: FollowUpLink[]) => {
        const normalized = normalizeMarkdown(content);
        const safeContent = normalized || ASSISTANT_EMPTY_FALLBACK;
        setMessages((prev) => {
          const next = [...prev];
          const last = next[next.length - 1];
          if (last?.role === 'assistant') {
            next[next.length - 1] = { ...last, content: safeContent, follow_up_links: followUpLinks };
          } else {
            next.push({
              id: `assistant-${Date.now()}`,
              role: 'assistant',
              content: safeContent,
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
              // Prevent gzip/brotli compression - compressed SSE breaks \n\n splitting on iOS
              'Accept-Encoding': 'identity',
            },
            body: JSON.stringify({
              user_id: userId,
              sessionId,
              userInput: text,
              history,
              // Disable SSE streaming on iOS: React Native's NSURLSession buffers aggressively
              // and can drop the final `done` event, leaving fullResponse empty.
              // Non-streaming returns a single JSON response which is reliable on all platforms.
              stream: false,
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
            applyChatToolNotifications(fallbackRes?.tool_notifications as ChatToolNotification[] | undefined, showToolToast);
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

          const processSSELine = (line: string) => {
              if (!line.trim() || !line.startsWith('data: ')) return false;
              const jsonStr = line.slice(6).trim();
              if (!jsonStr) return false;
              try {
                const data = JSON.parse(jsonStr);
                if (data.type === 'chunk' && data.content !== undefined) {
                  fullResponse = data.content;
                  setStreamingContent(fullResponse);
                } else if (data.type === 'follow_up_links' && data.links) {
                  lastFollowUpLinks = data.links;
                } else if (data.type === 'tool_result' && data.success) {
                  applyChatToolNotifications(
                    [
                      {
                        tool_name: String(data.tool_name ?? ''),
                        tool_args: (data.tool_args as Record<string, unknown>) ?? {},
                        success: true,
                      },
                    ],
                    showToolToast,
                  );
                } else if (data.type === 'done') {
                  return true; // signal caller to finalize
                } else if (data.type === 'error') {
                  throw new Error(data.error || 'Streaming error');
                }
              } catch (parseErr) {
                if (jsonStr !== '[DONE]' && !jsonStr.startsWith(':')) {
                  // ignore malformed lines
                }
              }
              return false;
            };

          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) {
                // Flush any bytes still held inside the TextDecoder (iOS can leave
                // incomplete multibyte sequences buffered until the stream closes).
                buffer += decoder.decode();
                break;
              }
              buffer += decoder.decode(value, { stream: true });
              const parts = buffer.split('\n\n');
              buffer = parts.pop() || '';

              for (const line of parts) {
                const isDone = processSSELine(line);
                if (isDone) {
                  const reply = normalizeMarkdown(fullResponse) || ASSISTANT_EMPTY_FALLBACK;
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
                }
              }
            }

            // Process any remaining bytes in the buffer that didn't end with \n\n.
            // On iOS the network stack may close the TCP connection before the server
            // flushes the final \n\n, leaving the last SSE event (often the 'done'
            // event or the final chunk) stranded in the buffer.
            if (buffer.trim()) {
              for (const line of buffer.split('\n')) {
                processSSELine(line);
              }
            }

            if (fullResponse) {
              const reply = normalizeMarkdown(fullResponse) || ASSISTANT_EMPTY_FALLBACK;
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
          let data: {
            content?: string;
            message?: string;
            reply?: string;
            outputs?: { output_0?: string };
            tool_notifications?: ChatToolNotification[];
            follow_up_links?: FollowUpLink[];
          } = {};
          try {
            data = JSON.parse(raw);
          } catch {}
          applyChatToolNotifications(data.tool_notifications, showToolToast);
          const content =
            data?.content ??
            data?.message ??
            data?.reply ??
            (typeof data?.outputs?.output_0 === 'string' ? data.outputs.output_0 : '') ??
            '';
          const followUpLinks =
            Array.isArray(data.follow_up_links) && data.follow_up_links.length > 0
              ? data.follow_up_links
              : undefined;
          const safeContent = normalizeMarkdown(content) || ASSISTANT_EMPTY_FALLBACK;
          setMessages((prev) => {
            const next = [...prev];
            const last = next[next.length - 1];
            if (last?.role === 'assistant' && !last.content) {
              next[next.length - 1] = {
                ...last,
                content: safeContent,
                follow_up_links: followUpLinks,
              };
            } else {
              next.push({
                id: `assistant-${Date.now()}`,
                role: 'assistant',
                content: safeContent,
                created_at: new Date().toISOString(),
                follow_up_links: followUpLinks,
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

  if (trialExpired || forcePaywall) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <AccessEndedView
          variant="fullScreen"
          reduceMotion={reduceMotion}
          onSubscriptionSuccess={() => {
            setForcePaywall(false);
            trialStatus.refetch().catch(() => {});
          }}
        />
      </SafeAreaView>
    );
  }

  const displayMessages = messages.length === 0 && !sending
    ? []
    : messages;
  const isStreaming = sending && displayMessages.some((m) => m.role === 'assistant' && !m.content);

  return (
    // ──────────────────────────────────────────────────────
    // FIX 2: Add 'bottom' edge so home-indicator inset is
    // respected on modern iPhones
    // ──────────────────────────────────────────────────────
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {toolToast && (
        <View style={[styles.toolToast, { top: insets.top + spacing.sm }]}>
          <Ionicons name="checkmark-circle" size={20} color={colors.success} style={styles.toolToastIcon} />
          <View style={styles.toolToastContent}>
            <Text style={styles.toolToastTitle}>{toolToast.title}</Text>
            <Text style={styles.toolToastMessage} numberOfLines={2}>{toolToast.message}</Text>
          </View>
        </View>
      )}
      {/* ──────────────────────────────────────────────────
          FIX 1: Wrap the entire chat area (list + input)
          inside KeyboardAvoidingView so the FlatList shrinks
          when the keyboard opens, and use the header height
          as the vertical offset on iOS.
          ────────────────────────────────────────────────── */}
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? headerHeight : 0}
      >
        {error && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}
        <StaggeredZoomIn delayIndex={0} reduceMotion={reduceMotion} style={styles.flex}>
          <FlatList
            ref={flatListRef}
            style={styles.flex}
            data={displayMessages}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.messageList}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
            removeClippedSubviews={Platform.OS === 'android'}
            // ──────────────────────────────────────────────
            // FIX 5: Track scroll position so we only
            // auto-scroll when the user is near the bottom
            // ──────────────────────────────────────────────
            onScroll={(e) => {
              const { contentOffset, layoutMeasurement, contentSize } = e.nativeEvent;
              const distanceFromBottom =
                contentSize.height - layoutMeasurement.height - contentOffset.y;
              isNearBottomRef.current = distanceFromBottom < 120;
            }}
            scrollEventThrottle={100}
            ListEmptyComponent={
              <View style={styles.empty}>
                <View style={styles.emptyIconWrap}>
                  <Ionicons name="chatbubble-ellipses" size={36} color={CHAT.emptyIcon} />
                </View>
                <Text style={styles.emptyText}>Start the conversation</Text>
                <Text style={styles.emptySubtext}>Say hi to Lisa-she's here to listen and help.</Text>
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
            // ──────────────────────────────────────────────
            // FIX 5: Only auto-scroll when user hasn't
            // scrolled away from the bottom
            // ──────────────────────────────────────────────
            onContentSizeChange={() => {
              if (isNearBottomRef.current) {
                flatListRef.current?.scrollToEnd({ animated: false });
              }
            }}
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
                      item.role === 'assistant' && (Platform.OS === 'ios' || Platform.OS === 'web') && styles.bubbleAssistantWide,
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
                        ) : !showStreaming && !item.content?.trim() ? (
                          <Text style={[styles.bubbleText, styles.bubbleTextAssistant, styles.assistantFallbackText]}>
                            {ASSISTANT_EMPTY_FALLBACK}
                          </Text>
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
        </StaggeredZoomIn>

        {/* Input area - now INSIDE KAV so it moves with the keyboard */}
        <View>
          <Text style={styles.chatDisclaimer}>
            AI responses are generated by <Text style={styles.chatDisclaimerLink} onPress={() => Linking.openURL('https://openai.com/policies/privacy-policy')} accessibilityRole="link">OpenAI</Text> and are for informational purposes only - not medical advice. Sources:{' '}
            <Text style={styles.chatDisclaimerLink} onPress={() => Linking.openURL('https://www.nhs.uk/conditions/menopause/')} accessibilityRole="link">NHS</Text>
            {', '}
            <Text style={styles.chatDisclaimerLink} onPress={() => Linking.openURL('https://www.mayoclinic.org/diseases-conditions/menopause/symptoms-causes/syc-20353397')} accessibilityRole="link">Mayo Clinic</Text>
            {', '}
            <Text style={styles.chatDisclaimerLink} onPress={() => Linking.openURL('https://menopause.org')} accessibilityRole="link">The Menopause Society</Text>
          </Text>
          <View style={styles.inputRow}>
            <View style={styles.composerContainer}>
              <TextInput
                style={[
                  styles.input,
                  {
                    // ──────────────────────────────────────
                    // FIX 3: Simplified height - let the
                    // platform's contentSize be the source
                    // of truth, clamped to min/max.
                    // ──────────────────────────────────────
                    height: Math.max(
                      MIN_INPUT_HEIGHT,
                      Math.min(MAX_INPUT_HEIGHT, inputHeight)
                    ),
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
                  requestAnimationFrame(() => {
                    flatListRef.current?.scrollToEnd({ animated: true });
                  });
                }}
                // ──────────────────────────────────────────
                // FIX 3: Use contentSize.height directly -
                // iOS already includes internal padding, so
                // adding extra padding caused the input to
                // grow taller every keystroke.
                // ──────────────────────────────────────────
                onContentSizeChange={(e) => {
                  const h = e.nativeEvent.contentSize.height;
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
                  style={[StyleSheet.absoluteFillObject, styles.sendBtnContent, { opacity: sendIconOpacity, pointerEvents: 'none' }]}
                >
                  <Ionicons name="send" size={22} color={colors.textInverse} />
                </Animated.View>
                <Animated.View
                  style={[StyleSheet.absoluteFillObject, styles.sendBtnContent, { opacity: sendSpinnerOpacity, pointerEvents: 'none' }]}
                >
                  <ActivityIndicator size="small" color={colors.textInverse} />
                </Animated.View>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/* Chat UI theme: calm, readable, 40+ friendly */
const CHAT = {
  screenBg: colors.background,
  userBubble: colors.primary,
  userBubbleText: colors.textInverse,
  lisaBubble: colors.card,
  lisaBubbleBorder: 'rgba(249, 184, 200, 0.27)',
  lisaBubbleShadow: 'rgba(0,0,0,0.04)',
  lisaLabel: colors.textMuted,
  bodyFontSize: 17,
  lineHeight: 24,
  composerBg: colors.card,
  composerBorder: 'rgba(249, 184, 200, 0.3)',
  chipBg: 'rgba(249, 184, 200, 0.15)',
  chipBorder: 'rgba(244, 124, 151, 0.35)',
  chipText: colors.primaryDark,
  emptyIcon: colors.primaryLight,
  errorBg: colors.dangerBg,
  errorBorder: 'rgba(200, 58, 84, 0.15)',
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
  toolToast: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.card,
  },
  toolToastIcon: {
    marginRight: spacing.sm,
  },
  toolToastContent: {
    flex: 1,
    minWidth: 0,
  },
  toolToastTitle: {
    ...typography.presets.label,
    color: colors.text,
  },
  toolToastMessage: {
    ...typography.presets.bodySmall,
    color: colors.textMuted,
    marginTop: 2,
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
    paddingHorizontal: spacing.sm,
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
    fontFamily: typography.display.semibold,
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
    maxWidth: '94%',
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
  assistantFallbackText: {
    color: colors.textMuted,
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
  chatDisclaimerLink: {
    color: colors.primary,
    textDecorationLine: 'underline',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
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