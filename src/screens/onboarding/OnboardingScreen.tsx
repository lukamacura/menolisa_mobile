/**
 * The welcome tour: four cards, shown once, that say what this app is for.
 *
 * She registered and paid on menolisa.com, so by the time she opens the app she
 * has bought something she has never seen. This is the handover — not a pitch,
 * and not a feature tour. One card names the promise, then one card each for
 * the three things the app actually does: the plan, Lisa, and tracking. That is
 * the same three-way split the tab bar and the daily loop are built on, so what
 * she reads here is the map she is about to be handed.
 *
 * Presented as an overlay from `MainTabs` rather than as a route, so the tab bar
 * is not sitting underneath it inviting her to tap away from the one screen that
 * explains what the tabs are. `useOnboardingTour` decides whether it mounts at
 * all and owns the "seen" marker; this component only reports that she is done.
 *
 * The motion is all scroll-driven: one shared `scrollX` feeds the parallax on
 * each card, the width of the dots, and the colour of the two washes behind
 * everything. That is what makes a swipe feel continuous rather than like four
 * screens taking turns — and it is why the whole thing runs on the UI thread
 * with no state updates per frame. Reduce Motion drops the transforms and keeps
 * the cross-fade, which is not motion.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  BackHandler,
  Platform,
  useWindowDimensions,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  interpolateColor,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import {
  colors,
  landingGradient,
  minTouchTarget,
  radii,
  shadows,
  spacing,
  typography,
} from '../../theme/tokens';
import { useReduceMotion } from '../../components/StaggeredZoomIn';

const logoSource = require('../../../assets/logo_transparent.png');

type Slide = {
  key: string;
  eyebrow: string;
  title: string;
  body: string;
  /** Ionicon for the well, or the brand mark on the opening card. */
  icon?: keyof typeof Ionicons.glyphMap;
  /** Ink of the glyph and the eyebrow. Dark enough to read on `tint`. */
  accent: string;
  /** Fill of the well, and of the halo ring around it. */
  tint: string;
  ring: string;
  /** The wash behind the whole screen while this card is centred. */
  wash: string;
};

/**
 * Every word she reads before the app starts, in one place.
 *
 * Written to the same rules as the rest of the product: no adherence numbers,
 * no trial language, no promise a plan cannot keep, and nothing that breaks if
 * we do not know her first name — which we usually do not.
 */
const SLIDES: Slide[] = [
  {
    key: 'welcome',
    eyebrow: 'Welcome',
    title: 'You’re in the right place',
    body:
      'Menopause isn’t something to push through on your own. MenoLisa turns what you’re feeling into a few small steps a day — and stays with you the whole way through.',
    accent: colors.primaryDark,
    tint: 'rgba(244, 124, 151, 0.14)',
    ring: 'rgba(244, 124, 151, 0.28)',
    wash: 'rgba(244, 124, 151, 0.22)',
  },
  {
    key: 'plan',
    eyebrow: 'Your plan',
    title: 'Eight weeks, one day at a time',
    body:
      'Movement, nutrition, calm and habits — chosen around your symptoms and your stage. Open the app and today’s short list is already waiting.',
    icon: 'leaf',
    accent: colors.cooldown,
    tint: 'rgba(99, 80, 200, 0.12)',
    ring: 'rgba(99, 80, 200, 0.26)',
    wash: 'rgba(99, 80, 200, 0.18)',
  },
  {
    key: 'lisa',
    eyebrow: 'Lisa',
    title: 'Someone to ask at 3am',
    body:
      'Lisa knows your plan and what you’ve been logging, so you never have to explain yourself from the beginning. Ask her anything, at any hour.',
    icon: 'chatbubbles',
    accent: colors.power,
    tint: 'rgba(14, 111, 96, 0.12)',
    ring: 'rgba(14, 111, 96, 0.26)',
    wash: 'rgba(58, 191, 163, 0.20)',
  },
  {
    key: 'tracking',
    eyebrow: 'Tracking',
    title: 'Your body, finally on the record',
    body:
      'Log a hot flash, a broken night, a low mood. Patterns show up that nobody could spot alone — and a hard day never counts against you.',
    icon: 'pulse',
    accent: colors.warmup,
    tint: 'rgba(184, 92, 56, 0.12)',
    ring: 'rgba(184, 92, 56, 0.26)',
    wash: 'rgba(255, 179, 138, 0.30)',
  },
];

/**
 * Art sizes, full and compact.
 *
 * The card is one column — halo, then words — and on a 4.7" screen the full
 * size plus four lines of body copy is taller than the space between the Skip
 * row and the button, which would centre-crop the title. The audience for this
 * app is not all on new phones, so the short-screen case is a real one.
 */
type ArtSize = {
  well: number;
  halo: number;
  logoWidth: number;
  logoHeight: number;
  glyph: number;
};

const ART: Record<'full' | 'compact', ArtSize> = {
  full: { well: 168, halo: 214, logoWidth: 132, logoHeight: 88, glyph: 56 },
  compact: { well: 132, halo: 172, logoWidth: 104, logoHeight: 70, glyph: 44 },
};

/**
 * The two wash palettes, hoisted out of the render.
 *
 * Both are read inside a worklet on every scroll frame, so they are plain
 * string arrays built once rather than a `.map` over `SLIDES` sixty times a
 * second on the UI thread.
 */
const WASH_COLORS = SLIDES.map((slide) => slide.wash);
const TINT_COLORS = SLIDES.map((slide) => slide.tint);

/** Below this window height the compact art is used. */
const COMPACT_HEIGHT = 720;
const COPY_MAX_WIDTH = 330;
/** How far the card content lags the page it sits on. 1 would be no parallax. */
const COPY_PARALLAX = 0.28;
const ART_PARALLAX = 0.5;

export type OnboardingScreenProps = {
  /** She finished or skipped. The caller writes the marker. */
  onDone: () => void;
};

export function OnboardingScreen({ onDone }: OnboardingScreenProps) {
  const { width, height } = useWindowDimensions();
  const art: ArtSize = height < COMPACT_HEIGHT ? ART.compact : ART.full;
  const reduceMotion = useReduceMotion();
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const scrollX = useSharedValue(0);
  const [index, setIndex] = useState(0);

  const lastIndex = SLIDES.length - 1;
  const isLast = index === lastIndex;

  const scrollHandler = useAnimatedScrollHandler((event) => {
    scrollX.value = event.contentOffset.x;
  });

  const goTo = useCallback(
    (next: number) => {
      scrollRef.current?.scrollTo({ x: next * width, animated: !reduceMotion });
      setIndex(next);
    },
    [scrollRef, width, reduceMotion]
  );

  const handleNext = useCallback(() => {
    Haptics.selectionAsync().catch(() => {});
    if (index < lastIndex) goTo(index + 1);
    else onDone();
  }, [index, lastIndex, goTo, onDone]);

  const handleSkip = useCallback(() => {
    Haptics.selectionAsync().catch(() => {});
    onDone();
  }, [onDone]);

  const handleMomentumEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const next = Math.round(event.nativeEvent.contentOffset.x / width);
      if (next !== index) {
        setIndex(next);
        Haptics.selectionAsync().catch(() => {});
      }
    },
    [index, width]
  );

  /**
   * Android back walks the cards backwards rather than doing nothing.
   *
   * On the first card the press is deliberately *not* claimed: this is the
   * root screen of the app, back means leave, and trapping a woman inside a
   * welcome screen is the opposite of a welcome. Skip is right there.
   */
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (index === 0) return false;
      goTo(index - 1);
      return true;
    });
    return () => subscription.remove();
  }, [index, goTo]);

  /** Card centres, in scroll offsets — the input range every wash reads. */
  const stops = useMemo(() => SLIDES.map((_, i) => i * width), [width]);

  const washTopStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(scrollX.value, stops, WASH_COLORS),
    transform: [
      {
        translateX: reduceMotion
          ? 0
          : interpolate(scrollX.value, [0, lastIndex * width], [0, -70], Extrapolation.CLAMP),
      },
    ],
  }));

  const washBottomStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(scrollX.value, stops, TINT_COLORS),
    transform: [
      {
        translateX: reduceMotion
          ? 0
          : interpolate(scrollX.value, [0, lastIndex * width], [0, 90], Extrapolation.CLAMP),
      },
    ],
  }));

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={landingGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {/* Two soft washes that change colour with the card. They are the only
          thing on screen that survives a swipe, which is what stops four cards
          reading as four different screens. */}
      <Animated.View pointerEvents="none" style={[styles.washTop, washTopStyle]} />
      <Animated.View pointerEvents="none" style={[styles.washBottom, washBottomStyle]} />

      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={handleSkip}
            activeOpacity={0.7}
            disabled={isLast}
            style={[styles.skip, isLast && styles.skipHidden]}
            accessibilityRole="button"
            accessibilityLabel="Skip the introduction"
          >
            <Text style={styles.skipText}>Skip</Text>
          </TouchableOpacity>
        </View>

        <Animated.ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          bounces={false}
          showsHorizontalScrollIndicator={false}
          onScroll={scrollHandler}
          scrollEventThrottle={16}
          onMomentumScrollEnd={handleMomentumEnd}
          style={styles.scroll}
        >
          {SLIDES.map((slide, i) => (
            <Card
              key={slide.key}
              slide={slide}
              index={i}
              scrollX={scrollX}
              width={width}
              art={art}
              reduceMotion={reduceMotion}
            />
          ))}
        </Animated.ScrollView>

        <View style={styles.footer}>
          <View style={styles.dots}>
            {SLIDES.map((slide, i) => (
              <Dot key={slide.key} slide={slide} index={i} scrollX={scrollX} width={width} />
            ))}
          </View>

          <TouchableOpacity
            onPress={handleNext}
            activeOpacity={0.85}
            style={styles.cta}
            accessibilityRole="button"
          >
            <Text style={styles.ctaText}>{isLast ? 'Start my first day' : 'Continue'}</Text>
            {!isLast ? (
              <Ionicons name="arrow-forward" size={18} color={colors.textInverse} />
            ) : null}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

type CardProps = {
  slide: Slide;
  index: number;
  scrollX: SharedValue<number>;
  width: number;
  art: ArtSize;
  reduceMotion: boolean;
};

function Card({ slide, index, scrollX, width, art, reduceMotion }: CardProps) {
  const range = [(index - 1) * width, index * width, (index + 1) * width];

  /**
   * The well moves slowest and the words move a little faster, both slower than
   * the page carrying them. Two speeds is all it takes to read as depth.
   */
  const artStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollX.value, range, [0, 1, 0], Extrapolation.CLAMP),
    transform: [
      {
        translateX: reduceMotion
          ? 0
          : interpolate(
              scrollX.value,
              range,
              [width * ART_PARALLAX, 0, -width * ART_PARALLAX],
              Extrapolation.CLAMP
            ),
      },
      {
        scale: reduceMotion
          ? 1
          : interpolate(scrollX.value, range, [0.82, 1, 0.82], Extrapolation.CLAMP),
      },
    ],
  }));

  const copyStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollX.value, range, [0, 1, 0], Extrapolation.CLAMP),
    transform: [
      {
        translateX: reduceMotion
          ? 0
          : interpolate(
              scrollX.value,
              range,
              [width * COPY_PARALLAX, 0, -width * COPY_PARALLAX],
              Extrapolation.CLAMP
            ),
      },
    ],
  }));

  return (
    <View style={[styles.card, { width }]}>
      <Animated.View style={[styles.art, { width: art.halo, height: art.halo }, artStyle]}>
        <View
          style={[
            styles.halo,
            { width: art.halo, height: art.halo, borderRadius: art.halo / 2, borderColor: slide.ring },
          ]}
        />
        <View
          style={[
            styles.well,
            {
              width: art.well,
              height: art.well,
              borderRadius: art.well / 2,
              backgroundColor: slide.tint,
              borderColor: slide.ring,
            },
          ]}
        >
          {slide.icon ? (
            <Ionicons name={slide.icon} size={art.glyph} color={slide.accent} />
          ) : (
            <Image
              source={logoSource}
              style={{ width: art.logoWidth, height: art.logoHeight }}
              resizeMode="contain"
              accessibilityRole="image"
              accessibilityLabel="MenoLisa"
            />
          )}
        </View>
      </Animated.View>

      <Animated.View style={[styles.copy, copyStyle]}>
        <Text style={[styles.eyebrow, { color: slide.accent }]}>{slide.eyebrow}</Text>
        <Text style={styles.title}>{slide.title}</Text>
        <Text style={styles.body}>{slide.body}</Text>
      </Animated.View>
    </View>
  );
}

type DotProps = {
  slide: Slide;
  index: number;
  scrollX: SharedValue<number>;
  width: number;
};

/**
 * Stretches into a pill as its card arrives, in that card's own colour.
 *
 * Driven by the scroll rather than by the committed page, so it is already
 * halfway through the change while her finger is still on the screen — the
 * difference between a control that follows her and one that reports on her.
 */
function Dot({ slide, index, scrollX, width }: DotProps) {
  const range = [(index - 1) * width, index * width, (index + 1) * width];

  const style = useAnimatedStyle(() => ({
    width: interpolate(scrollX.value, range, [8, 26, 8], Extrapolation.CLAMP),
    backgroundColor: interpolateColor(scrollX.value, range, [
      colors.borderStrong,
      slide.accent,
      colors.borderStrong,
    ]),
  }));

  return <Animated.View style={[styles.dot, style]} />;
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.background,
    // Android z-orders by elevation, not by render order, and the tab bar
    // underneath carries elevation 8. Without this the tour renders behind it.
    elevation: 24,
    zIndex: 100,
  },
  washTop: {
    position: 'absolute',
    top: -170,
    right: -120,
    width: 380,
    height: 380,
    borderRadius: 190,
  },
  washBottom: {
    position: 'absolute',
    bottom: -150,
    left: -140,
    width: 340,
    height: 340,
    borderRadius: 170,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
  },
  skip: {
    minHeight: minTouchTarget,
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  skipHidden: {
    opacity: 0,
  },
  skipText: {
    ...typography.presets.label,
    color: colors.textMuted,
  },
  scroll: {
    flex: 1,
  },
  card: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    gap: spacing['2xl'],
  },
  art: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  halo: {
    position: 'absolute',
    borderWidth: 1,
  },
  well: {
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.card,
  },
  copy: {
    alignItems: 'center',
    maxWidth: COPY_MAX_WIDTH,
  },
  eyebrow: {
    fontFamily: typography.family.semibold,
    fontSize: 11,
    lineHeight: 16,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
  },
  title: {
    fontFamily: typography.display.bold,
    fontSize: 28,
    lineHeight: 36,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  body: {
    fontFamily: typography.family.regular,
    fontSize: 16,
    lineHeight: 26,
    color: colors.textMuted,
    textAlign: 'center',
  },
  footer: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.lg,
    paddingTop: spacing.md,
    gap: spacing.lg,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.xs,
  },
  dot: {
    height: 8,
    borderRadius: radii.pill,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    backgroundColor: colors.primary,
    minHeight: minTouchTarget + 4,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.lg,
    ...shadows.buttonPrimary,
  },
  ctaText: {
    ...typography.presets.button,
    color: colors.textInverse,
  },
});

export default OnboardingScreen;
