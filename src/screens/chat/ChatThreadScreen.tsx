import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Linking,
  Animated,
  Easing,
  Keyboard,
  type TextStyle,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRoute, RouteProp } from '@react-navigation/native';
import { useHeaderHeight } from '@react-navigation/elements';
import { supabase } from '../../lib/supabase';
import {
  apiFetchWithAuth,
  API_CONFIG,
  isSubscriptionRequiredError,
  CHAT_TIMEOUT_MS,
} from '../../lib/api';
import { MarkdownText } from '../../components/MarkdownText';
import { CoffeeLoading } from '../../components/CoffeeLoading';
import { StaggeredZoomIn, useReduceMotion } from '../../components/StaggeredZoomIn';
import { colors, spacing, radii, typography, shadows } from '../../theme/tokens';
import { errorMessage } from '../../lib/errorCopy';

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

/** `failed` = the request errored, `stopped` = she tapped stop. Both offer a retry. */
type SendStatus = 'failed' | 'stopped';

type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
  follow_up_links?: FollowUpLink[];
  status?: SendStatus;
};

/** The local-only opening line. Never sent back as conversation history. */
const GREETING_ID = 'greeting';

/** A hung request must not strand her on a spinner forever. */
const REQUEST_TIMEOUT_MS = 90_000;

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

const STRINGS = {
  loadingConversation: 'Loading your conversation...',
  emptyTitle: 'Start the conversation',
  emptySubtitle: "Say hi to Lisa-she's here to listen and help.",
  placeholder: 'Ask Lisa anything...',
  lisa: 'Lisa',
  followUpLabel: 'You might also like:',
  sendFailed: "Couldn't send",
  sendStopped: 'Stopped',
  retry: 'Retry',
  dismiss: 'Dismiss',
  symptomLogged: 'Symptom Logged',
  severityUnknown: 'Unknown',
  networkError:
    "Could not reach the server. Check your connection and try again.",
  timeoutError: 'Lisa is taking too long to answer. Tap retry to ask again.',
  loadError: 'We could not load this conversation.',
  sendError: 'We could not send that message.',
  a11ySend: 'Send message',
  a11yStop: 'Stop generating',
};

/** Monotonic so two messages created in the same millisecond can never share an id. */
let messageSeq = 0;
function nextMessageId(prefix: string): string {
  messageSeq += 1;
  return `${prefix}-${Date.now().toString(36)}-${messageSeq}`;
}

/**
 * Serialize the thread for the model. Trimming happens on whole turns — slicing
 * the joined text would hand the model half a sentence under the wrong role label.
 */
function buildHistory(messages: Message[], maxChars = 4000): string {
  const lines = messages
    .filter((m) => m.id !== GREETING_ID && !m.status && m.content.trim())
    .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content.trim()}`);

  const kept: string[] = [];
  let total = 0;
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    const cost = lines[i].length + 1;
    if (total + cost > maxChars) break;
    kept.unshift(lines[i]);
    total += cost;
  }
  return kept.join('\n');
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

function isAbortError(err: unknown): boolean {
  if (typeof err === 'object' && err !== null && 'name' in err) {
    if ((err as { name?: string }).name === 'AbortError') return true;
  }
  const msg = err instanceof Error ? err.message : String(err);
  return /\baborted?\b/i.test(msg);
}

function isNetworkError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /failed to fetch|network request failed|network error|load failed|cleartext|connection/i.test(
    msg
  );
}

/** Matches `/api/langchain-rag` `tool_notifications` for in-chat toasts */
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
      : STRINGS.severityUnknown;
    const name = typeof toolArgs.name === 'string' ? toolArgs.name : '';
    let message = [name, `Severity: ${sev}`].filter(Boolean).join(' | ');
    const triggers = toolArgs.triggers;
    if (Array.isArray(triggers) && triggers.length > 0) {
      message += ` | Triggers: ${triggers.map(String).join(', ')}`;
    }
    if (message) showToolToast(STRINGS.symptomLogged, message);
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
      <Text style={styles.loadingText}>{STRINGS.loadingConversation}</Text>
    </Animated.View>
  );
}

type MessageBubbleProps = {
  message: Message;
  sending: boolean;
  onFollowUpPress: (subtopic: string) => void;
  onRetry: (message: Message) => void;
};

/**
 * Memoized so a reply landing at the bottom of a long thread does not re-render
 * every bubble above it.
 */
const MessageBubble = React.memo(function MessageBubble({
  message,
  sending,
  onFollowUpPress,
  onRetry,
}: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const hasContent = !!message.content.trim();

  return (
    <View style={styles.bubbleWrapper}>
      {!isUser && <Text style={styles.lisaLabel}>{STRINGS.lisa}</Text>}
      <View
        style={[
          styles.bubble,
          isUser ? styles.bubbleUser : styles.bubbleAssistant,
          !isUser &&
            (Platform.OS === 'ios' || Platform.OS === 'web') &&
            styles.bubbleAssistantWide,
          isUser && !!message.status && styles.bubbleUserFailed,
        ]}
      >
        {isUser ? (
          <Text style={[styles.bubbleText, styles.bubbleTextUser]}>{message.content}</Text>
        ) : hasContent ? (
          <MarkdownText textStyle={[styles.bubbleText, styles.bubbleTextAssistant]}>
            {message.content}
          </MarkdownText>
        ) : sending ? (
          <CoffeeLoading />
        ) : (
          <Text
            style={[
              styles.bubbleText,
              styles.bubbleTextAssistant,
              styles.assistantFallbackText,
            ]}
          >
            {ASSISTANT_EMPTY_FALLBACK}
          </Text>
        )}
      </View>

      {isUser && !!message.status && (
        <View style={styles.retryRow}>
          <Ionicons name="alert-circle-outline" size={15} color={colors.danger} />
          <Text style={styles.retryLabel}>
            {message.status === 'stopped' ? STRINGS.sendStopped : STRINGS.sendFailed}
          </Text>
          <TouchableOpacity
            activeOpacity={0.7}
            style={styles.retryButton}
            onPress={() => onRetry(message)}
            accessibilityRole="button"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="refresh" size={14} color={colors.primaryDark} />
            <Text style={styles.retryButtonText}>{STRINGS.retry}</Text>
          </TouchableOpacity>
        </View>
      )}

      {!isUser && !!message.follow_up_links?.length && (
        <View style={styles.followUpRow}>
          <Text style={styles.followUpLabel}>{STRINGS.followUpLabel}</Text>
          <View style={styles.followUpChips}>
            {message.follow_up_links.map((link, linkIdx) => (
              <TouchableOpacity
                key={`${link.subtopic}-${linkIdx}`}
                activeOpacity={0.7}
                style={[styles.followUpChip, sending && styles.followUpChipDisabled]}
                onPress={() => onFollowUpPress(link.subtopic)}
                disabled={sending}
                accessibilityRole="button"
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
});

export function ChatThreadScreen() {
  const route = useRoute<RouteProps>();
  const { sessionId } = route.params;
  const reduceMotion = useReduceMotion();
  const insets = useSafeAreaInsets();

  // useHeaderHeight throws if no header exists; guard it
  let headerHeight = 0;
  try {
    headerHeight = useHeaderHeight();
  } catch {
    headerHeight = 0;
  }

  const SEND_BTN_SIZE = 44;
  const MIN_INPUT_HEIGHT = SEND_BTN_SIZE;
  const MAX_INPUT_HEIGHT = 120;

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [inputHeight, setInputHeight] = useState(SEND_BTN_SIZE);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [toolToast, setToolToast] = useState<{ title: string; message: string } | null>(null);

  const flatListRef = useRef<FlatList<Message>>(null);
  const sendIconOpacity = useRef(new Animated.Value(1)).current;
  const sendSpinnerOpacity = useRef(new Animated.Value(0)).current;
  const toolToastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Mirrors of state so `sendMessage` stays referentially stable across renders. */
  const messagesRef = useRef<Message[]>(messages);
  const inputRef = useRef(input);
  /** Synchronous send lock — `sending` state lands a frame late, so a fast double
   *  tap (or a chip tap racing the send button) would otherwise fire twice. */
  const sendingRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);
  /** Auto-scroll only while she is parked at the bottom. */
  const stickToBottomRef = useRef(true);
  const didInitialScrollRef = useRef(false);

  messagesRef.current = messages;
  inputRef.current = input;

  useEffect(() => {
    mountedRef.current = true;
    // Deliberately does NOT abort an in-flight reply. The backend only writes the
    // turn to `conversations` once the request completes, so cancelling on unmount
    // would lose her answer when she backs out and returns. Every state write is
    // guarded by mountedRef instead, and the timeout still reclaims the socket.
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const loadMessages = useCallback(async () => {
    /** Two awaits deep, she may already have backed out — stop writing state then. */
    const isCurrent = () => mountedRef.current;

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!isCurrent()) return;
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
      if (!isCurrent()) return;

      const loaded: Message[] = (data?.messages ?? []).map(
        (m: { id: string; role: string; content: string; created_at: string }) => ({
          id: m.id,
          role: m.role === 'user' ? 'user' : 'assistant',
          content: m.role === 'assistant' ? normalizeMarkdown(m.content) : m.content,
          created_at: m.created_at,
        })
      );

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
        if (!isCurrent()) return;
        const idx = Math.floor(Math.random() * WELCOME_WITH_NAME.length);
        const greeting = userName
          ? WELCOME_WITH_NAME[idx].replace('(NAME)', userName)
          : WELCOME_GENERIC[idx];
        setMessages([
          {
            id: GREETING_ID,
            role: 'assistant',
            content: greeting,
            created_at: new Date().toISOString(),
          },
        ]);
      } else {
        setMessages(loaded);
      }
    } catch (e) {
      if (!isCurrent()) return;
      // A 403 means "no subscription" — AuthContext is already re-syncing the
      // navigator toward the paywall, so an error banner would only flash.
      if (isSubscriptionRequiredError(e)) return;
      // Its own network copy wins here; everything else goes through the
      // shared humaniser rather than putting `HTTP 500` in front of her.
      setError(isNetworkError(e) ? STRINGS.networkError : errorMessage(e, STRINGS.loadError));
    } finally {
      if (isCurrent()) setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  const showToolToast = useCallback((title: string, message: string) => {
    if (toolToastTimeoutRef.current) clearTimeout(toolToastTimeoutRef.current);
    setToolToast({ title, message });
    toolToastTimeoutRef.current = setTimeout(() => {
      if (mountedRef.current) setToolToast(null);
      toolToastTimeoutRef.current = null;
    }, 4000);
  }, []);

  useEffect(() => {
    return () => {
      if (toolToastTimeoutRef.current) clearTimeout(toolToastTimeoutRef.current);
    };
  }, []);

  const scrollToEnd = useCallback((animated: boolean) => {
    requestAnimationFrame(() => {
      flatListRef.current?.scrollToEnd({ animated });
    });
  }, []);

  // keyboardWillShow on iOS fires before the animation begins, so the list is
  // already at the bottom by the time the keyboard finishes sliding up.
  useEffect(() => {
    const eventName = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const showSub = Keyboard.addListener(eventName, () => {
      if (stickToBottomRef.current) scrollToEnd(true);
    });
    return () => showSub.remove();
  }, [scrollToEnd]);

  const sendMessage = useCallback(
    async (textOverride?: string) => {
      const fromComposer = textOverride === undefined;
      const text = (textOverride ?? inputRef.current).trim();
      if (!text || !userId || sendingRef.current) return;

      sendingRef.current = true;
      setSending(true);
      setError(null);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

      // Only clear the composer when the text actually came from it — a follow-up
      // chip must not wipe a half-typed question.
      if (fromComposer) {
        setInput('');
        setInputHeight(MIN_INPUT_HEIGHT);
      }

      const userMsg: Message = {
        id: nextMessageId('user'),
        role: 'user',
        content: text,
        created_at: new Date().toISOString(),
      };
      const placeholderId = nextMessageId('assistant');
      const history = buildHistory(messagesRef.current);

      setMessages((prev) => [
        ...prev,
        userMsg,
        {
          id: placeholderId,
          role: 'assistant',
          content: '',
          created_at: new Date().toISOString(),
        },
      ]);
      stickToBottomRef.current = true;

      /** Distinguishes "she tapped stop" from "we gave up waiting". */
      let timedOut = false;
      const controller = new AbortController();
      abortRef.current = controller;
      const timeoutId = setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, REQUEST_TIMEOUT_MS);

      /** Drops the empty reply bubble and flags her message so she can retry. */
      const markUnsent = (status: SendStatus) => {
        setMessages((prev) =>
          prev
            .filter((m) => m.id !== placeholderId)
            .map((m) => (m.id === userMsg.id ? { ...m, status } : m))
        );
      };

      try {
        const data = await apiFetchWithAuth(API_CONFIG.endpoints.chat, {
          method: 'POST',
          // Compressed SSE/JSON breaks chunk framing on iOS; ask for plain bytes.
          headers: { 'Accept-Encoding': 'identity' },
          body: JSON.stringify({
            user_id: userId,
            sessionId,
            userInput: text,
            history,
            // Streaming stays off: React Native's NSURLSession buffers aggressively
            // and can drop the final `done` event, leaving the reply empty.
            stream: false,
          }),
          signal: controller.signal,
          timeoutMs: CHAT_TIMEOUT_MS,
        });
        if (!mountedRef.current) return;

        applyChatToolNotifications(
          data?.tool_notifications as ChatToolNotification[] | undefined,
          showToolToast
        );

        const rawContent =
          typeof data?.content === 'string'
            ? data.content
            : typeof data?.message === 'string'
              ? data.message
              : typeof data?.reply === 'string'
                ? data.reply
                : '';
        const followUpLinks =
          Array.isArray(data?.follow_up_links) && data.follow_up_links.length > 0
            ? (data.follow_up_links as FollowUpLink[])
            : undefined;
        const reply = normalizeMarkdown(rawContent) || ASSISTANT_EMPTY_FALLBACK;

        setMessages((prev) =>
          prev.map((m) =>
            m.id === placeholderId
              ? { ...m, content: reply, follow_up_links: followUpLinks }
              : m
          )
        );
      } catch (e) {
        if (!mountedRef.current) return;

        if (isAbortError(e)) {
          markUnsent(timedOut ? 'failed' : 'stopped');
          if (timedOut) setError(STRINGS.timeoutError);
          return;
        }
        // 403 = no subscription. The navigator is already moving her to the
        // paywall; showing an error banner here would just flash and confuse.
        if (isSubscriptionRequiredError(e)) {
          setMessages((prev) => prev.filter((m) => m.id !== placeholderId));
          return;
        }

        markUnsent('failed');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
        setError(isNetworkError(e) ? STRINGS.networkError : errorMessage(e, STRINGS.sendError));
      } finally {
        clearTimeout(timeoutId);
        if (abortRef.current === controller) abortRef.current = null;
        sendingRef.current = false;
        if (mountedRef.current) setSending(false);
      }
    },
    [userId, sessionId, showToolToast, MIN_INPUT_HEIGHT]
  );

  const onFollowUpPress = useCallback(
    (subtopic: string) => {
      sendMessage(subtopic);
    },
    [sendMessage]
  );

  /** Re-send an unsent message: drop the old bubble, then send its text again. */
  const onRetry = useCallback(
    (message: Message) => {
      if (sendingRef.current) return;
      setMessages((prev) => prev.filter((m) => m.id !== message.id));
      setError(null);
      sendMessage(message.content);
    },
    [sendMessage]
  );

  const onStop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

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

  const onScroll = useCallback(
    (e: { nativeEvent: { contentOffset: { y: number }; layoutMeasurement: { height: number }; contentSize: { height: number } } }) => {
      const { contentOffset, layoutMeasurement, contentSize } = e.nativeEvent;
      const distanceFromBottom =
        contentSize.height - layoutMeasurement.height - contentOffset.y;
      stickToBottomRef.current = distanceFromBottom < 120;
    },
    []
  );

  const onContentSizeChange = useCallback(() => {
    if (!stickToBottomRef.current) return;
    // The very first layout jumps; everything after glides.
    if (!didInitialScrollRef.current) {
      didInitialScrollRef.current = true;
      scrollToEnd(false);
      return;
    }
    scrollToEnd(true);
  }, [scrollToEnd]);

  const renderItem = useCallback(
    ({ item }: { item: Message }) => (
      <MessageBubble
        message={item}
        sending={sending}
        onFollowUpPress={onFollowUpPress}
        onRetry={onRetry}
      />
    ),
    [sending, onFollowUpPress, onRetry]
  );

  const keyExtractor = useCallback((item: Message) => item.id, []);

  const composedInputHeight = useMemo(
    () => Math.max(MIN_INPUT_HEIGHT, Math.min(MAX_INPUT_HEIGHT, inputHeight)),
    [inputHeight, MIN_INPUT_HEIGHT, MAX_INPUT_HEIGHT]
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <ConversationLoader />
      </SafeAreaView>
    );
  }

  const canSend = input.trim().length > 0;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {toolToast && (
        <View style={[styles.toolToast, { top: insets.top + spacing.sm }]}>
          <Ionicons
            name="checkmark-circle"
            size={20}
            color={colors.success}
            style={styles.toolToastIcon}
          />
          <View style={styles.toolToastContent}>
            <Text style={styles.toolToastTitle}>{toolToast.title}</Text>
            <Text style={styles.toolToastMessage} numberOfLines={2}>
              {toolToast.message}
            </Text>
          </View>
        </View>
      )}

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? headerHeight : 0}
      >
        <StaggeredZoomIn delayIndex={0} reduceMotion={reduceMotion} style={styles.flex}>
          <FlatList
            ref={flatListRef}
            style={styles.flex}
            data={messages}
            keyExtractor={keyExtractor}
            renderItem={renderItem}
            contentContainerStyle={styles.messageList}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
            removeClippedSubviews={Platform.OS === 'android'}
            initialNumToRender={12}
            maxToRenderPerBatch={8}
            windowSize={11}
            onScroll={onScroll}
            scrollEventThrottle={16}
            onContentSizeChange={onContentSizeChange}
            ListEmptyComponent={
              <View style={styles.empty}>
                <View style={styles.emptyIconWrap}>
                  <Ionicons name="chatbubble-ellipses" size={36} color={CHAT.emptyIcon} />
                </View>
                <Text style={styles.emptyText}>{STRINGS.emptyTitle}</Text>
                <Text style={styles.emptySubtext}>{STRINGS.emptySubtitle}</Text>
              </View>
            }
          />
        </StaggeredZoomIn>

        {/* Error lives above the composer so it never reflows the message list. */}
        {error && (
          <TouchableOpacity
            activeOpacity={0.8}
            style={styles.errorBanner}
            onPress={() => setError(null)}
            accessibilityRole="button"
            accessibilityLabel={STRINGS.dismiss}
          >
            <Ionicons name="alert-circle" size={18} color={colors.danger} />
            <Text style={styles.errorText}>{error}</Text>
            <Ionicons name="close" size={16} color={colors.danger} />
          </TouchableOpacity>
        )}

        <View>
          <Text style={styles.chatDisclaimer}>
            AI responses are generated by{' '}
            <Text
              style={styles.chatDisclaimerLink}
              onPress={() => Linking.openURL('https://openai.com/policies/privacy-policy')}
              accessibilityRole="link"
            >
              OpenAI
            </Text>
            {/* No "not medical advice" clause here. That is said once, in the
                "Before you begin" gate, along with the fact that Lisa is an AI
                that can be wrong — repeating it above every message is how a
                safety line turns into wallpaper. What stays is attribution and
                the sources, which is a different job: who generated this, and
                what it was built on. */}
            {'. Sources: '}
            <Text
              style={styles.chatDisclaimerLink}
              onPress={() => Linking.openURL('https://www.nhs.uk/conditions/menopause/')}
              accessibilityRole="link"
            >
              NHS
            </Text>
            {', '}
            <Text
              style={styles.chatDisclaimerLink}
              onPress={() =>
                Linking.openURL(
                  'https://www.mayoclinic.org/diseases-conditions/menopause/symptoms-causes/syc-20353397'
                )
              }
              accessibilityRole="link"
            >
              Mayo Clinic
            </Text>
            {', '}
            <Text
              style={styles.chatDisclaimerLink}
              onPress={() => Linking.openURL('https://menopause.org')}
              accessibilityRole="link"
            >
              The Menopause Society
            </Text>
          </Text>
          <View style={styles.inputRow}>
            <View style={styles.composerContainer}>
              <TextInput
                style={[
                  styles.input,
                  { height: composedInputHeight },
                  Platform.OS === 'web' &&
                    ({
                      overflowY: inputHeight > MAX_INPUT_HEIGHT ? 'auto' : 'hidden',
                      scrollbarWidth: 'none',
                      msOverflowStyle: 'none',
                    } as Record<string, unknown>),
                ]}
                value={input}
                onChangeText={setInput}
                onFocus={() => {
                  stickToBottomRef.current = true;
                  scrollToEnd(true);
                }}
                // iOS already includes internal padding in contentSize, so adding
                // extra here would grow the box a little on every keystroke.
                onContentSizeChange={(e) => {
                  const h = e.nativeEvent.contentSize.height;
                  setInputHeight(Math.max(MIN_INPUT_HEIGHT, Math.min(MAX_INPUT_HEIGHT, h)));
                }}
                placeholder={STRINGS.placeholder}
                placeholderTextColor={colors.textMuted}
                multiline
                maxLength={2000}
                // Stays editable while Lisa replies — she can line up her next
                // thought instead of watching a dead composer.
                editable
                scrollEnabled={inputHeight >= MAX_INPUT_HEIGHT}
              />
              <TouchableOpacity
                activeOpacity={0.8}
                style={[
                  styles.sendBtn,
                  !sending && !canSend && styles.sendBtnDisabled,
                  sending && styles.stopBtn,
                ]}
                onPress={sending ? onStop : () => sendMessage()}
                disabled={!sending && !canSend}
                accessibilityRole="button"
                accessibilityLabel={sending ? STRINGS.a11yStop : STRINGS.a11ySend}
              >
                <Animated.View
                  style={[
                    StyleSheet.absoluteFillObject,
                    styles.sendBtnContent,
                    { opacity: sendIconOpacity, pointerEvents: 'none' },
                  ]}
                >
                  <Ionicons name="send" size={22} color={colors.textInverse} />
                </Animated.View>
                <Animated.View
                  style={[
                    StyleSheet.absoluteFillObject,
                    styles.sendBtnContent,
                    { opacity: sendSpinnerOpacity, pointerEvents: 'none' },
                  ]}
                >
                  <Ionicons name="stop" size={18} color={colors.textInverse} />
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: CHAT.errorBg,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginHorizontal: spacing.md,
    marginBottom: spacing.xs,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: CHAT.errorBorder,
  },
  errorText: {
    flex: 1,
    fontSize: 14,
    fontFamily: typography.family.regular,
    color: colors.danger,
    lineHeight: 20,
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
  bubbleUserFailed: {
    opacity: 0.6,
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
  retryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    gap: 6,
    marginTop: 6,
    marginRight: 4,
  },
  retryLabel: {
    fontSize: 13,
    fontFamily: typography.family.regular,
    color: colors.danger,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: CHAT.chipBg,
    borderWidth: 1,
    borderColor: CHAT.chipBorder,
  },
  retryButtonText: {
    fontSize: 13,
    fontFamily: typography.family.medium,
    color: CHAT.chipText,
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
  followUpChipDisabled: {
    opacity: 0.5,
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
  stopBtn: {
    backgroundColor: colors.primaryDark,
  },
  sendBtnContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendBtnDisabled: {
    opacity: 0.45,
  },
});
