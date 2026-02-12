import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Dimensions,
  Animated,
  Easing,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Image,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { supabase } from '../lib/supabase';
import { getApiUrl, API_CONFIG } from '../lib/api';
import { colors, radii, shadows, spacing, typography, minTouchTarget, landingGradient } from '../theme/tokens';

type NavigationProp = NativeStackNavigationProp<any>;

type Step = 'q1_problems' | 'q2_severity' | 'q5_doctor' | 'q6_goal' | 'q7_name';
type Phase = 'quiz' | 'results' | 'social_proof' | 'email';

const STEPS: Step[] = ['q1_problems', 'q2_severity', 'q5_doctor', 'q6_goal', 'q7_name'];

const { width } = Dimensions.get('window');

// Question options - matching web exactly
const PROBLEM_OPTIONS = [
  { id: 'hot_flashes', label: 'Hot flashes / Night sweats', icon: 'flame' },
  { id: 'sleep_issues', label: "Can't sleep well", icon: 'moon' },
  { id: 'brain_fog', label: 'Brain fog / Memory issues', icon: 'bulb' },
  { id: 'mood_swings', label: 'Mood swings / Irritability', icon: 'heart' },
  { id: 'weight_changes', label: 'Weight changes', icon: 'scale' },
  { id: 'low_energy', label: 'Low energy / Fatigue', icon: 'battery-half' },
  { id: 'anxiety', label: 'Anxiety', icon: 'alert-circle' },
  // Ionicons doesn't consistently expose "body" across sets; "walk" is safer.
  { id: 'joint_pain', label: 'Joint pain', icon: 'walk' },
];

const SEVERITY_OPTIONS = [
  { id: 'mild', label: 'Mild - Annoying but manageable', icon: 'flag' },
  { id: 'moderate', label: 'Moderate - Affecting my work/relationships', icon: 'bar-chart' },
  { id: 'severe', label: "Severe - I'm struggling every day", icon: 'warning' },
];

const TIMING_OPTIONS = [
  { id: 'just_started', label: 'Just started (0-6 months)', icon: 'time' },
  { id: 'been_while', label: 'Been a while (6-12 months)', icon: 'calendar' },
  { id: 'over_year', label: 'Over a year', icon: 'calendar-outline' },
  { id: 'several_years', label: 'Several years', icon: 'calendar-number' },
];

const TRIED_OPTIONS = [
  { id: 'nothing', label: 'Nothing yet', icon: 'close-circle' },
  { id: 'supplements', label: 'Supplements / Vitamins', icon: 'medical' },
  { id: 'diet', label: 'Diet changes', icon: 'restaurant' },
  { id: 'exercise', label: 'Exercise', icon: 'fitness' },
  { id: 'hrt', label: 'HRT / Medication', icon: 'medical-outline' },
  { id: 'doctor_talk', label: 'Talked to doctor', icon: 'chatbubbles' },
  { id: 'apps', label: 'Apps / Tracking', icon: 'phone-portrait' },
];

const DOCTOR_OPTIONS = [
  { id: 'yes_actively', label: 'Yes, actively', icon: 'medkit' },
  { id: 'yes_not_helpful', label: "Yes, but they're not helpful", icon: 'person-remove' },
  { id: 'no_planning', label: 'No, planning to', icon: 'heart' },
  { id: 'no_natural', label: 'No, prefer natural approaches', icon: 'leaf' },
];

const GOAL_OPTIONS = [
  { id: 'sleep_through_night', label: 'Sleep through the night', icon: 'moon' },
  { id: 'think_clearly', label: 'Think clearly again', icon: 'bulb' },
  { id: 'feel_like_myself', label: 'Feel like myself', icon: 'heart' },
  { id: 'understand_patterns', label: 'See what Lisa notices', icon: 'analytics' },
  { id: 'data_for_doctor', label: 'Have data for my doctor', icon: 'checkmark-circle' },
  { id: 'get_body_back', label: 'Get my body back', icon: 'battery-full' },
];


// Quality of Life Score calculation - same as web
const calculateQualityScore = (
  symptoms: string[],
  severity: string,
  timing: string,
  triedOptions: string[]
): number => {
  let score = 100;
  score -= symptoms.length * 7;
  
  const severityPenalty: Record<string, number> = {
    mild: 5,
    moderate: 15,
    severe: 25,
  };
  score -= severityPenalty[severity] || 10;
  
  const durationPenalty: Record<string, number> = {
    just_started: 0,
    been_while: 5,
    over_year: 10,
    several_years: 15,
  };
  score -= durationPenalty[timing] || 5;
  
  if (triedOptions.length > 0 && !triedOptions.includes('nothing')) {
    score += 3;
  }
  
  return Math.max(31, Math.min(52, Math.round(score)));
};

const getScoreColor = (score: number): string => {
  if (score < 40) return colors.danger;
  if (score < 50) return colors.warning;
  return colors.primary;
};

const getScoreLabel = (score: number): string => {
  if (score < 40) return 'Needs attention - symptoms are controlling your daily life';
  if (score < 50) return 'Below average - symptoms are significantly impacting daily life';
  return 'Room to improve - symptoms are affecting your quality of life';
};

/** Theme-based tint for score card and progress (low → mid → improving). */
const getScoreGradientColors = (score: number): readonly [string, string] => {
  if (score < 40) return [colors.danger, colors.primaryDark];
  if (score < 50) return [colors.warning, colors.primary];
  return [colors.primary, colors.blue];
};

const getSeverityHeadline = (severity: string, name: string): string => {
  const displayName = name || 'you';
  switch (severity) {
    case 'severe':
      return `${displayName}, this can't continue.`;
    case 'moderate':
      return `${displayName}, I need to be honest with you.`;
    case 'mild':
    default:
      return `${displayName}, let's talk about what's really going on.`;
  }
};

const getSeverityPainText = (severity: string, symptomCount: number, name: string): string => {
  const displayName = name || 'you';
  switch (severity) {
    case 'severe':
      return `${symptomCount} symptoms controlling your life. You've probably tried to explain it to people who don't get it. You've probably wondered if this is just your new normal. It's not. And ${displayName}, you don't have to keep living like this.`;
    case 'moderate':
      return `${symptomCount} symptoms. Affecting your work. Your mood. Your relationships. ${displayName}, you're spending so much energy just trying to function normally - energy you shouldn't have to spend.`;
    case 'mild':
    default:
      return `${displayName}, these ${symptomCount} symptoms might feel manageable now. But without understanding what's causing them, they often get worse. Let's figure this out before they do.`;
  }
};

const SYMPTOM_LABELS: Record<string, string> = {
  hot_flashes: 'Hot flashes',
  sleep_issues: 'Sleep issues',
  brain_fog: 'Brain fog',
  mood_swings: 'Mood swings',
  weight_changes: 'Weight changes',
  low_energy: 'Fatigue',
  anxiety: 'Anxiety',
  joint_pain: 'Joint pain',
};

export function RegisterScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute();
  const [referralCode, setReferralCode] = useState<string | null>(null);

  useEffect(() => {
    const params = route.params as { ref?: string } | undefined;
    const fromParams = params?.ref;
    if (fromParams && fromParams.trim()) {
      setReferralCode(fromParams.trim());
      return;
    }
    Linking.getInitialURL().then((url) => {
      if (!url) return;
      try {
        const parsed = new URL(url.replace(/^menolisa:\/\//, 'https://menolisa.com/'));
        const ref = parsed.searchParams.get('ref');
        if (ref && ref.trim()) setReferralCode(ref.trim());
      } catch {
        // ignore
      }
    });
  }, [route.params]);

  const [phase, setPhase] = useState<Phase>('quiz');
  const [stepIndex, setStepIndex] = useState(0);
  const currentStep = STEPS[stepIndex];


  // Quiz answers
  const [topProblems, setTopProblems] = useState<string[]>([]);
  const [severity, setSeverity] = useState<string>('');
  const [timing, setTiming] = useState<string>('');
  const [triedOptions, setTriedOptions] = useState<string[]>([]);
  const [doctorStatus, setDoctorStatus] = useState<string>('');
  const [goal, setGoal] = useState<string[]>([]);
  const [firstName, setFirstName] = useState<string>('');

  // Email & Password state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userExists, setUserExists] = useState(false);

  // Results loading state
  const [isResultsLoading, setIsResultsLoading] = useState(true);
  const [messageIndex, setMessageIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [displayScore, setDisplayScore] = useState(0);

  // Animated values for step indicators
  const stepWidths = useRef(STEPS.map(() => new Animated.Value(8))).current;

  // Loading (quiz → results) animation: same spin + scale as LandingScreen
  const loadingSpinValue = useRef(new Animated.Value(0)).current;
  const loadingScaleValue = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    if (!isResultsLoading) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(loadingSpinValue, {
            toValue: 1,
            duration: 2000,
            useNativeDriver: true,
            easing: Easing.inOut(Easing.ease),
          }),
          Animated.timing(loadingScaleValue, {
            toValue: 1,
            duration: 2000,
            useNativeDriver: true,
            easing: Easing.out(Easing.cubic),
          }),
        ]),
        Animated.parallel([
          Animated.timing(loadingSpinValue, { toValue: 0, duration: 0, useNativeDriver: true }),
          Animated.timing(loadingScaleValue, {
            toValue: 0.4,
            duration: 2000,
            useNativeDriver: true,
            easing: Easing.in(Easing.cubic),
          }),
        ]),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [isResultsLoading, loadingSpinValue, loadingScaleValue]);

  const loadingSpin = loadingSpinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const loadingMessages = [
    'Taking it all in...',
    'Connecting the dots...',
    'Doing the math...',
    'Designing your plan...',
    'Getting ready to launch...',
    'Launching your plan...',
  ];


  // Animate step indicators
  useEffect(() => {
    stepWidths.forEach((width, index) => {
      Animated.spring(width, {
        toValue: index === stepIndex ? 40 : 8,
        useNativeDriver: false,
        damping: 30,
        stiffness: 200,
      }).start();
    });
  }, [stepIndex, stepWidths]);

  // Handle results loading animation
  useEffect(() => {
    if (phase === 'results') {
      setIsResultsLoading(true);
      setProgress(0);
      setMessageIndex(0);
      setDisplayScore(0);

      const messageInterval = setInterval(() => {
        setMessageIndex((prev) => (prev + 1) % loadingMessages.length);
      }, 600);

      const progressInterval = setInterval(() => {
        setProgress((prev) => Math.min(prev + 1.5, 100));
      }, 60);

      const loadingTimer = setTimeout(() => {
        setIsResultsLoading(false);
        clearInterval(messageInterval);
        clearInterval(progressInterval);
      }, 5000);

      return () => {
        clearInterval(messageInterval);
        clearInterval(progressInterval);
        clearTimeout(loadingTimer);
      };
    }
  }, [phase]);

  // Animate score counting up
  useEffect(() => {
    if (phase === 'results' && !isResultsLoading) {
      const targetScore = calculateQualityScore(topProblems, severity, timing, triedOptions);
      const duration = 1500;
      const steps = 30;
      const increment = targetScore / steps;
      let current = 0;

      const timer = setInterval(() => {
        current += increment;
        if (current >= targetScore) {
          setDisplayScore(targetScore);
          clearInterval(timer);
        } else {
          setDisplayScore(Math.round(current));
        }
      }, duration / steps);

      return () => clearInterval(timer);
    }
  }, [phase, isResultsLoading, topProblems, severity, timing, triedOptions]);

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const passwordValid = password.length >= 8;
  const canSubmit = emailValid && passwordValid && agreedToTerms && !loading;

  const termsUrl = `${API_CONFIG.baseURL}/terms`;
  const privacyUrl = `${API_CONFIG.baseURL}/privacy`;

  // Check if current step is answered - matching web logic exactly
  const stepIsAnswered = useCallback((step: Step) => {
    switch (step) {
      case 'q1_problems':
        return topProblems.length > 0; // Any number of symptoms (not limited to 3)
      case 'q2_severity':
        return severity !== '';
      case 'q5_doctor':
        return doctorStatus !== '';
      case 'q6_goal':
        return goal.length > 0;
      case 'q7_name':
        return firstName.trim().length > 0;
      default:
        return false;
    }
  }, [topProblems, severity, doctorStatus, goal, firstName]);

  const goNext = useCallback(() => {
    if (!stepIsAnswered(currentStep)) return;
    if (stepIndex < STEPS.length - 1) {
      setStepIndex(stepIndex + 1);
    } else {
      setPhase('results');
    }
  }, [currentStep, stepIndex, stepIsAnswered]);

  const goBack = useCallback(() => {
    if (stepIndex > 0) {
      setStepIndex(stepIndex - 1);
    } else {
      navigation.navigate('Landing');
    }
  }, [stepIndex, navigation]);

  // Toggle problem - allow ANY number (not limited to 3)
  const toggleProblem = (problemId: string) => {
    setTopProblems((prev) => {
      if (prev.includes(problemId)) {
        return prev.filter((id) => id !== problemId);
      }
      return [...prev, problemId];
    });
  };

  const toggleTriedOption = (optionId: string) => {
    setTriedOptions((prev) => {
      if (prev.includes(optionId)) {
        return prev.filter((id) => id !== optionId);
      }
      return [...prev, optionId];
    });
  };

  const toggleGoal = (goalId: string) => {
    setGoal((prev) => {
      if (prev.includes(goalId)) {
        return prev.filter((id) => id !== goalId);
      }
      return [...prev, goalId];
    });
  };

  // Handle registration with password
  const handleEmailSubmit = async () => {
    if (!canSubmit) return;

    setError(null);
    setUserExists(false);
    setLoading(true);

    try {
      const emailLower = email.toLowerCase().trim();
      
      // Create account with Supabase
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: emailLower,
        password,
        options: {
          data: {
            quiz_completed: true,
          },
        },
      });

      if (authError) {
        console.error('Registration error:', authError);
        
        // Handle specific Supabase error messages
        if (authError.message.includes('User already registered')) {
          setUserExists(true);
          setLoading(false);
          return;
        } else if (authError.message.includes('Password')) {
          setError('Password must be at least 8 characters long.');
        } else if (authError.message.includes('email')) {
          setError('Please enter a valid email address.');
        } else {
          setError(authError.message);
        }
        setLoading(false);
        return;
      }

      // If we have a user, save quiz answers
      if (authData.user) {
        try {
          // Save quiz answers via API
          const quizAnswers = {
            top_problems: topProblems,
            severity: severity,
            timing: timing,
            tried_options: triedOptions,
            doctor_status: doctorStatus,
            goal: goal,
            name: firstName.trim() || null,
          };

          await fetch(getApiUrl('/api/auth/save-quiz'), {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              userId: authData.user.id,
              quizAnswers,
              ...(referralCode ? { referralCode } : {}),
            }),
          });
        } catch (quizError) {
          console.warn('Failed to save quiz answers:', quizError);
          // Continue anyway - user is registered
        }

        // Registration successful! Auth listener will handle navigation
        console.log('Registration successful');
      }
      
      setLoading(false);
    } catch (err: any) {
      console.error('Unexpected registration error:', err);
      
      if (err instanceof TypeError && err.message.includes('fetch')) {
        setError('Network error. Please check your connection and try again.');
      } else {
        setError(err.message || 'Something went wrong. Please try again.');
      }
      setLoading(false);
    }
  };

  const renderStepIndicators = () => (
    <View style={styles.stepIndicatorsContainer}>
      {STEPS.map((_, index) => (
        <Animated.View
          key={index}
          style={[
            styles.stepIndicator,
            {
              width: stepWidths[index],
              backgroundColor: index === stepIndex ? colors.primary : 'rgba(0, 0, 0, 0.2)',
            },
          ]}
        />
      ))}
    </View>
  );

  const renderQuestion = () => {
    switch (currentStep) {
      case 'q1_problems':
        return (
          <View style={styles.questionContainer}>
            <Text style={styles.questionTitle}>What's making life hardest right now?</Text>
            <Text style={styles.questionSubtitle}>Select all that apply</Text>
            <View style={styles.optionsContainer}>
              {PROBLEM_OPTIONS.map((option) => {
                const isSelected = topProblems.includes(option.id);
                return (
                  <Pressable
                    key={option.id}
                    style={[
                      styles.optionCard,
                      isSelected && styles.optionCardSelected,
                    ]}
                    onPress={() => toggleProblem(option.id)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                  >
                    <View style={[styles.iconContainer, isSelected && styles.iconContainerSelected]}>
                      <Ionicons
                        name={option.icon as any}
                        size={18}
                        color={isSelected ? colors.primary : colors.textMuted}
                      />
                    </View>
                    <Text style={[styles.optionText, isSelected && styles.optionTextSelected]}>
                      {option.label}
                    </Text>
                    {isSelected && (
                      <Ionicons name="checkmark" size={18} color={colors.primary} style={styles.checkIcon} />
                    )}
                  </Pressable>
                );
              })}
            </View>
            {topProblems.length > 0 && (
              <Text style={styles.selectionCount}>
                {topProblems.length} {topProblems.length === 1 ? 'symptom' : 'symptoms'} selected
              </Text>
            )}
          </View>
        );

      case 'q2_severity':
        return (
          <View style={styles.questionContainer}>
            <Text style={styles.questionTitle}>How much is this affecting your daily life?</Text>
            <View style={styles.optionsContainer}>
              {SEVERITY_OPTIONS.map((option) => {
                const isSelected = severity === option.id;
                return (
                  <Pressable
                    key={option.id}
                    style={[
                      styles.optionCard,
                      isSelected && styles.optionCardSelected,
                    ]}
                    onPress={() => setSeverity(option.id)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                  >
                    <View style={[styles.iconContainer, isSelected && styles.iconContainerSelected]}>
                      <Ionicons
                        name={option.icon as any}
                        size={18}
                        color={isSelected ? colors.primary : colors.textMuted}
                      />
                    </View>
                    <Text style={[styles.optionText, isSelected && styles.optionTextSelected]}>
                      {option.label}
                    </Text>
                    {isSelected && (
                      <Ionicons name="checkmark" size={18} color={colors.primary} style={styles.checkIcon} />
                    )}
                  </Pressable>
                );
              })}
            </View>
          </View>
        );

      case 'q5_doctor':
        return (
          <View style={styles.questionContainer}>
            <Text style={styles.questionTitle}>Are you working with a doctor on this?</Text>
            <View style={styles.optionsContainer}>
              {DOCTOR_OPTIONS.map((option) => {
                const isSelected = doctorStatus === option.id;
                return (
                  <Pressable
                    key={option.id}
                    style={[
                      styles.optionCard,
                      isSelected && styles.optionCardSelected,
                    ]}
                    onPress={() => setDoctorStatus(option.id)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                  >
                    <View style={[styles.iconContainer, isSelected && styles.iconContainerSelected]}>
                      <Ionicons
                        name={option.icon as any}
                        size={18}
                        color={isSelected ? colors.primary : colors.textMuted}
                      />
                    </View>
                    <Text style={[styles.optionText, isSelected && styles.optionTextSelected]}>
                      {option.label}
                    </Text>
                    {isSelected && (
                      <Ionicons name="checkmark" size={18} color={colors.primary} style={styles.checkIcon} />
                    )}
                  </Pressable>
                );
              })}
            </View>
          </View>
        );

      case 'q6_goal':
        return (
          <View style={styles.questionContainer}>
            <Text style={styles.questionTitle}>What would success look like for you?</Text>
            <Text style={styles.questionSubtitle}>Pick any that apply:</Text>
            <View style={styles.optionsContainer}>
              {GOAL_OPTIONS.map((option) => {
                const isSelected = goal.includes(option.id);
                return (
                  <Pressable
                    key={option.id}
                    style={[
                      styles.optionCard,
                      isSelected && styles.optionCardSelected,
                    ]}
                    onPress={() => toggleGoal(option.id)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                  >
                    <View style={[styles.iconContainer, isSelected && styles.iconContainerSelected]}>
                      <Ionicons
                        name={option.icon as any}
                        size={18}
                        color={isSelected ? colors.primary : colors.textMuted}
                      />
                    </View>
                    <Text style={[styles.optionText, isSelected && styles.optionTextSelected]}>
                      {option.label}
                    </Text>
                    {isSelected && (
                      <Ionicons name="checkmark" size={18} color={colors.primary} style={styles.checkIcon} />
                    )}
                  </Pressable>
                );
              })}
            </View>
          </View>
        );

      case 'q7_name':
        return (
          <View style={styles.questionContainerCentered}>
            <Text style={styles.questionTitle}>What should Lisa call you?</Text>
            <Text style={styles.questionSubtitle}>Lisa will use this to personalize your experience</Text>
            <View style={styles.nameInputContainer}>
              <Ionicons name="person-circle" size={20} color={colors.textMuted} style={styles.nameInputIcon} />
              <TextInput
                style={[
                  styles.nameInput,
                  Platform.OS === 'web' && ({ outlineStyle: 'none', outlineWidth: 0 } as object),
                ]}
                placeholder="First name"
                placeholderTextColor="#9CA3AF"
                value={firstName}
                onChangeText={setFirstName}
                autoCapitalize="words"
                autoFocus
                returnKeyType="done"
                underlineColorAndroid="transparent"
              />
              {firstName.trim().length > 0 && (
                <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
              )}
            </View>
          </View>
        );

      default:
        return null;
    }
  };

  const renderResults = () => {
    if (isResultsLoading) {
      return (
        <SafeAreaView style={styles.resultsLoadingContainer}>
          <LinearGradient
            colors={landingGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <Animated.View
            style={[
              styles.loadingIconContainer,
              { transform: [{ rotate: loadingSpin }, { scale: loadingScaleValue }] },
            ]}
          >
            <Image
              source={require('../../assets/logo.png')}
              style={styles.loadingLogo}
              resizeMode="contain"
            />
          </Animated.View>
          <Text style={styles.loadingTitle}>Getting to know you better...</Text>
          <Text style={styles.loadingMessage}>{loadingMessages[messageIndex]}</Text>
          <View style={styles.loadingProgressContainer}>
            <LinearGradient
              colors={[colors.primary, '#ffeb76', colors.blue]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[styles.loadingProgressBar, { width: `${progress}%` }]}
            />
          </View>
        </SafeAreaView>
      );
    }

    const score = calculateQualityScore(topProblems, severity, timing, triedOptions);

    return (
      <SafeAreaView style={styles.resultsContainer}>
        <LinearGradient
          colors={landingGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <ScrollView
          style={styles.resultsScrollView}
          contentContainerStyle={styles.resultsContent}
          showsVerticalScrollIndicator={false}
          decelerationRate={0.98}
          scrollEventThrottle={16}
          bounces={true}
        >
          {/* Lisa Icon */}
          <View style={styles.resultsIconContainer}>
            <LinearGradient
              colors={[colors.primary, colors.primaryLight]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.resultsIcon}
            >
              <Ionicons name="pulse" size={28} color="#fff" />
            </LinearGradient>
          </View>

          <Text style={styles.resultsHeadline}>
            {getSeverityHeadline(severity, firstName || 'you')}
          </Text>

          <Text style={styles.resultsText}>
            {getSeverityPainText(severity, topProblems.length, firstName || 'you')}
          </Text>

          {/* Score Card - gradient, theme colors, interactive */}
          <Pressable
            style={({ pressed }) => [styles.scoreCardWrap, pressed && styles.scoreCardPressed]}
            accessibilityRole="none"
            accessibilityLabel="Your menopause quality of life score"
          >
            <LinearGradient
              colors={[colors.primaryLight + '40', colors.surface, colors.blueLight + '25'] as [string, string, string]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.scoreCard}
            >
              <View style={styles.scoreHeader}>
                <View style={[styles.scoreHeaderIconWrap, { backgroundColor: getScoreColor(score) + '22' }]}>
                  <Ionicons name="pulse" size={20} color={getScoreColor(score)} />
                </View>
                <Text style={styles.scoreTitle}>Your Menopause Score</Text>
              </View>

              <View style={styles.scoreDisplay}>
                <Text style={[styles.scoreNumber, { color: getScoreColor(score) }]}>
                  {displayScore}
                </Text>
                <Text style={styles.scoreMax}>/100</Text>
              </View>

              <Text style={[styles.scoreLabel, { color: getScoreColor(score) }]}>
                {getScoreLabel(score)}
              </Text>

              {/* Progress Bar - gradient fill by score tier */}
              <View style={styles.scoreProgressContainer}>
                <LinearGradient
                  colors={[...getScoreGradientColors(score)] as [string, string]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[styles.scoreProgressFill, { width: `${Math.min(score, 100)}%` }]}
                />
                <View style={styles.scoreProgressTarget} />
              </View>

              <View style={styles.targetContainer}>
                <View style={styles.targetIconWrap}>
                  <Ionicons name="flag" size={16} color={colors.success} />
                </View>
                <Text style={styles.targetText}>
                  Your target: <Text style={styles.targetBold}>80+</Text> (many women see improvement within 8 weeks)
                </Text>
              </View>
            </LinearGradient>
          </Pressable>

          {/* Symptom Pills - varied theme colors */}
          <View style={styles.symptomsContainer}>
            {topProblems.map((symptom, index) => {
              const pillColors = [
                { bg: colors.rowNavyBg, border: colors.navy + '40', text: colors.navy },
                { bg: 'rgba(255, 141, 161, 0.18)', border: colors.primary + '50', text: colors.primaryDark },
                { bg: colors.rowBlueBg, border: colors.blue + '50', text: colors.navy },
                { bg: colors.rowGoldBg, border: colors.gold + '99', text: colors.navy },
              ];
              const pill = pillColors[index % pillColors.length];
              return (
                <View key={symptom} style={[styles.symptomPill, { backgroundColor: pill.bg, borderColor: pill.border }]}>
                  <Text style={[styles.symptomPillText, { color: pill.text }]}>{SYMPTOM_LABELS[symptom]}</Text>
                </View>
              );
            })}
          </View>

          {/* Social Proof - theme colors */}
          <View style={styles.socialProofContainer}>
            <View style={styles.socialProofIconWrap}>
              <Ionicons name="people" size={18} color={colors.primary} />
            </View>
            <Text style={styles.socialProofText}>Join thousands of women on their menopause journey.</Text>
          </View>
          <Text style={styles.resultsDisclaimer}>This is for information only, not medical advice.</Text>
        </ScrollView>

        {/* Next Button - Fixed at bottom */}
        <View style={styles.resultsFooter}>
          <TouchableOpacity
            activeOpacity={1}
            style={styles.gradientButton}
            onPress={() => setPhase('social_proof')}
          >
            <View style={styles.gradientButtonInner}>
              <Text style={styles.gradientButtonText}>Next</Text>
              <Ionicons name="arrow-forward" size={20} color={colors.background} />
            </View>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  };

  const renderSocialProof = () => (
    <SafeAreaView style={styles.socialProofScreenContainer}>
      <LinearGradient
        colors={landingGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <ScrollView
        contentContainerStyle={styles.socialProofScrollContent}
        showsVerticalScrollIndicator={false}
        decelerationRate={0.98}
        scrollEventThrottle={16}
        bounces={true}
      >
        {/* Top image: same size as login/register. Replace source with your PNG when ready (e.g. assets/social-proof.png) */}
        <View style={styles.socialProofImageWrap}>
          <Image
            source={require('../../assets/social.png')}
            style={styles.socialProofImage}
            resizeMode="contain"
          />
        </View>

        <Text style={styles.socialProofHeadline}>
          You're not alone on this journey
        </Text>
        <Text style={styles.socialProofSubhead}>
          Women 40+ use MenoLisa to track symptoms, spot patterns, and get support from Lisa - their personal AI coach.
        </Text>

        {/* Trust badges - store-safe, no medical claims */}
        <View style={styles.socialProofBadges}>
          <View style={styles.socialProofBadge}>
            <View style={styles.socialProofBadgeIconWrap}>
              <Ionicons name="book" size={20} color={colors.navy} />
            </View>
            <Text style={styles.socialProofBadgeText}>Evidence-informed</Text>
          </View>
          <View style={styles.socialProofBadge}>
            <View style={[styles.socialProofBadgeIconWrap, styles.socialProofBadgeIconPrimary]}>
              <Ionicons name="lock-closed" size={20} color={colors.primary} />
            </View>
            <Text style={styles.socialProofBadgeText}>Private & secure</Text>
          </View>
          <View style={styles.socialProofBadge}>
            <View style={[styles.socialProofBadgeIconWrap, styles.socialProofBadgeIconGold]}>
              <Ionicons name="gift" size={20} color={colors.navy} />
            </View>
            <Text style={styles.socialProofBadgeText}>3-day free trial</Text>
          </View>
        </View>

        {/* Value props - marketing, no outcome claims */}
        <View style={styles.socialProofValues}>
          <View style={styles.socialProofValueRow}>
            <Ionicons name="checkmark-circle" size={22} color={colors.primary} />
            <Text style={styles.socialProofValueText}>Track symptoms and see what Lisa notices over time</Text>
          </View>
          <View style={styles.socialProofValueRow}>
            <Ionicons name="checkmark-circle" size={22} color={colors.primary} />
            <Text style={styles.socialProofValueText}>Research-informed guidance, tailored to you</Text>
          </View>
          <View style={styles.socialProofValueRow}>
            <Ionicons name="checkmark-circle" size={22} color={colors.primary} />
            <Text style={styles.socialProofValueText}>Your data stays private-always</Text>
          </View>
        </View>

        <Text style={styles.socialProofDisclaimer}>
          MenoLisa is for tracking and information only. It is not medical advice. Always consult a healthcare provider for medical decisions.
        </Text>
      </ScrollView>

      <View style={styles.socialProofFooter}>
        <TouchableOpacity
          activeOpacity={1}
          style={styles.gradientButton}
          onPress={() => setPhase('email')}
        >
          <View style={styles.gradientButtonInner}>
            <Text style={styles.gradientButtonText}>Continue</Text>
            <Ionicons name="arrow-forward" size={20} color={colors.background} />
          </View>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );

  const renderEmail = () => {
    // User already exists - show login prompt
    if (userExists) {
      return (
        <SafeAreaView style={styles.emailContainer}>
          <LinearGradient
            colors={landingGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <KeyboardAvoidingView
            style={styles.flex}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
          >
            <ScrollView contentContainerStyle={styles.emailContent} keyboardShouldPersistTaps="handled">
            <View style={styles.userExistsIcon}>
              <Ionicons name="checkmark-circle" size={48} color={colors.primary} />
            </View>
            <Text style={styles.emailTitle}>You already have an account!</Text>
            <Text style={styles.emailSubtitle}>
              An account with <Text style={styles.emailBold}>{email}</Text> already exists.
            </Text>
            <Text style={styles.emailSubtitleSmall}>Log in to continue your journey.</Text>
            
            <TouchableOpacity
              activeOpacity={1}
              style={styles.gradientButton}
              onPress={() => navigation.navigate('Login')}
            >
              <View style={styles.gradientButtonInner}>
                <Text style={styles.gradientButtonText}>Go to Login</Text>
                <Ionicons name="arrow-forward" size={20} color={colors.background} />
              </View>
            </TouchableOpacity>

            <TouchableOpacity activeOpacity={1} onPress={() => { setUserExists(false); setEmail(''); }}>
              <Text style={styles.linkText}>Use a different email</Text>
            </TouchableOpacity>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      );
    }

    return (
      <SafeAreaView style={styles.emailContainer}>
        <LinearGradient
          colors={landingGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
        >
          <ScrollView
            contentContainerStyle={styles.emailContent}
            keyboardShouldPersistTaps="handled"
            decelerationRate={0.98}
            scrollEventThrottle={16}
            bounces={true}
          >
          <Image
            source={require('../../assets/register.png')}
            style={styles.registerImage}
            resizeMode="contain"
          />
          <Text style={styles.emailTitle}>Create your account</Text>
          <Text style={styles.emailSubtitle}>
            Set up your login to start your free 3-day trial. No credit card required.
          </Text>
          <Text style={styles.emailTrialNote}>
            After 3 days you can subscribe on our website. You can cancel anytime.
          </Text>

          {/* Email Input */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Email</Text>
            <TextInput
              style={[styles.emailInput, !emailValid && email.length > 0 && styles.emailInputError]}
              placeholder="you@example.com"
              placeholderTextColor="#9CA3AF"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              autoCorrect={false}
              returnKeyType="next"
            />
          </View>

          {/* Password Input */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Password</Text>
            <View style={styles.passwordContainer}>
              <TextInput
                style={[styles.emailInput, styles.passwordInput, !passwordValid && password.length > 0 && styles.emailInputError]}
                placeholder="Create a password (8+ characters)"
                placeholderTextColor="#9CA3AF"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoComplete="new-password"
                autoCorrect={false}
                returnKeyType="done"
                onSubmitEditing={handleEmailSubmit}
              />
              <TouchableOpacity
                activeOpacity={1}
                style={styles.passwordToggle}
                onPress={() => setShowPassword(!showPassword)}
              >
                <Ionicons
                  name={showPassword ? 'eye-off' : 'eye'}
                  size={22}
                  color={colors.textMuted}
                />
              </TouchableOpacity>
            </View>
            {password.length > 0 && password.length < 8 && (
              <Text style={styles.helperText}>Password must be at least 8 characters</Text>
            )}
          </View>

          {error && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <View style={styles.termsRow}>
            <TouchableOpacity
              activeOpacity={1}
              onPress={() => setAgreedToTerms((v) => !v)}
              style={styles.termsCheckWrap}
            >
              <Ionicons
                name={agreedToTerms ? 'checkbox' : 'square-outline'}
                size={22}
                color={agreedToTerms ? colors.primary : colors.textMuted}
              />
            </TouchableOpacity>
            <View style={styles.termsTextWrap}>
              <Text style={styles.termsText}>I agree to the </Text>
              <TouchableOpacity activeOpacity={0.7} onPress={() => Linking.openURL(termsUrl)}>
                <Text style={styles.termsLink}>Terms</Text>
              </TouchableOpacity>
              <Text style={styles.termsText}> and </Text>
              <TouchableOpacity activeOpacity={0.7} onPress={() => Linking.openURL(privacyUrl)}>
                <Text style={styles.termsLink}>Privacy Policy</Text>
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            activeOpacity={1}
            style={[styles.gradientButton, !canSubmit && styles.buttonDisabled]}
            onPress={handleEmailSubmit}
            disabled={!canSubmit}
          >
            <View style={styles.gradientButtonInner}>
              {loading ? (
                <>
                  <ActivityIndicator color={colors.background} />
                  <Text style={styles.gradientButtonText}>Creating account...</Text>
                </>
              ) : (
                <>
                  <Text style={[styles.gradientButtonText, !canSubmit && styles.buttonTextDisabled]}>
                    Start my free trial
                  </Text>
                  <Ionicons name="arrow-forward" size={20} color={canSubmit ? colors.background : '#9CA3AF'} />
                </>
              )}
            </View>
          </TouchableOpacity>

          <View style={styles.loginTextContainer}>
            <Text style={styles.loginText}>Already have an account? </Text>
            <TouchableOpacity activeOpacity={1} onPress={() => navigation.navigate('Login')}>
              <Text style={styles.loginLink}>Log in</Text>
            </TouchableOpacity>
          </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  };

  if (phase === 'results') {
    return renderResults();
  }

  if (phase === 'social_proof') {
    return renderSocialProof();
  }

  if (phase === 'email') {
    return renderEmail();
  }

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={landingGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {/* Step Indicators */}
      <View style={styles.stepIndicatorsWrapper}>
        {renderStepIndicators()}
      </View>

      {/* Question Content */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        decelerationRate={0.98}
        scrollEventThrottle={16}
        bounces={true}
      >
        <View style={styles.questionCard}>
          {renderQuestion()}
        </View>
      </ScrollView>

      {/* Navigation Buttons */}
      <View style={styles.footer}>
        <TouchableOpacity 
          activeOpacity={1}
          onPress={goBack} 
          style={styles.backButton}
        >
          <Ionicons
            name="arrow-back"
            size={18}
            color="#1F2937"
          />
          <Text style={styles.backButtonText}>
            {stepIndex === 0 ? 'Back to home' : 'Back'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={1}
          style={[styles.nextButton, !stepIsAnswered(currentStep) && styles.nextButtonDisabled]}
          onPress={goNext}
          disabled={!stepIsAnswered(currentStep)}
        >
          <Text style={[styles.nextButtonText, !stepIsAnswered(currentStep) && styles.nextButtonTextDisabled]}>
            {stepIndex === STEPS.length - 1 ? 'Continue' : 'Next'}
          </Text>
          <Ionicons
            name="arrow-forward"
            size={16}
            color={stepIsAnswered(currentStep) ? '#fff' : '#9CA3AF'}
          />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  // Step indicators
  stepIndicatorsWrapper: {
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  stepIndicatorsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  stepIndicator: {
    height: 8,
    borderRadius: 6,
  },
  // Question styles
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.md,
    paddingTop: 0,
    paddingBottom: spacing.lg,
  },
  questionCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.7)',
    padding: spacing.lg,
    ...shadows.card,
  },
  questionContainer: {
    flex: 1,
  },
  questionContainerCentered: {
    flex: 1,
    justifyContent: 'center',
    paddingVertical: 40,
  },
  questionTitle: {
    fontSize: 22,
    fontFamily: typography.family.bold,
    color: colors.text,
    marginBottom: 6,
  },
  questionSubtitle: {
    fontSize: 14,
    fontFamily: typography.family.regular,
    color: colors.textMuted,
    marginBottom: spacing.md,
  },
  optionsContainer: {
    width: '100%',
    gap: 8,
  },
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    width: '100%',
    justifyContent: 'space-between',
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 10,
    minHeight: 54,
  },
  optionCardSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 8,
    width: '48%',
    minHeight: 56,
  },
  optionCardPressed: {
    transform: [{ scale: 0.99 }],
    opacity: 0.96,
  },
  optionCardSelected: {
    backgroundColor: 'rgba(255, 141, 161, 0.10)',
    borderColor: 'rgba(255, 141, 161, 0.35)',
    ...shadows.glowPrimary,
  },
  iconContainer: {
    padding: 7,
    borderRadius: 10,
    backgroundColor: 'rgba(17, 24, 39, 0.05)',
  },
  iconContainerSelected: {
    backgroundColor: 'rgba(255, 141, 161, 0.18)',
  },
  optionText: {
    fontSize: 14,
    fontFamily: typography.family.medium,
    color: colors.text,
    flex: 1,
  },
  optionTextSmall: {
    fontSize: 12,
    fontFamily: typography.family.medium,
    color: colors.text,
    flex: 1,
  },
  optionTextSelected: {
    color: colors.primary,
    fontFamily: typography.family.semibold,
  },
  checkIcon: {
    marginLeft: 'auto',
  },
  selectionCount: {
    textAlign: 'center',
    fontSize: 12,
    fontFamily: typography.family.medium,
    color: colors.textMuted,
    marginTop: spacing.md,
  },
  nameInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    marginTop: spacing.sm,
  },
  nameInputIcon: {
    marginRight: 10,
  },
  nameInput: {
    flex: 1,
    fontSize: 16,
    fontFamily: typography.family.medium,
    paddingVertical: 14,
    color: colors.text,
    borderWidth: 0,
    backgroundColor: 'transparent',
  },
  // Footer
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.65)',
    backgroundColor: 'rgba(255, 255, 255, 0.72)',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    gap: 6,
  },
  backButtonDisabled: {
    opacity: 0.4,
  },
  backButtonText: {
    fontSize: 14,
    fontFamily: typography.family.medium,
    color: colors.text,
  },
  backButtonTextDisabled: {
    color: '#D1D5DB',
  },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    minHeight: minTouchTarget,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radii.lg,
    gap: 6,
    ...shadows.buttonPrimary,
  },
  nextButtonDisabled: {
    backgroundColor: '#F3F4F6',
  },
  nextButtonText: {
    fontSize: 17,
    fontFamily: typography.family.semibold,
    color: colors.background,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  nextButtonTextDisabled: {
    color: '#9CA3AF',
  },
  // Results loading
  resultsLoadingContainer: {
    flex: 1,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  loadingIconContainer: {
    marginBottom: 24,
  },
  loadingLogo: {
    width: 80,
    height: 80,
  },
  loadingTitle: {
    fontSize: 20,
    fontFamily: typography.family.semibold,
    color: colors.text,
    marginBottom: 8,
  },
  loadingMessage: {
    fontSize: 16,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: 32,
  },
  loadingProgressContainer: {
    height: 6,
    backgroundColor: '#E5E7EB',
    borderRadius: 3,
    width: 200,
    overflow: 'hidden',
  },
  loadingProgressBar: {
    height: '100%',
    borderRadius: 3,
  },
  // Results
  resultsContainer: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  resultsScrollView: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  resultsContent: {
    padding: 20,
    paddingTop: 24,
    paddingBottom: 100,
  },
  resultsIconContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  resultsIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultsHeadline: {
    fontSize: 22,
    fontFamily: typography.family.bold,
    color: colors.text,
    textAlign: 'center',
    marginBottom: 14,
  },
  resultsText: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  scoreCardWrap: {
    marginBottom: 20,
    borderRadius: radii.xl,
    overflow: 'hidden',
    ...shadows.card,
  },
  scoreCardPressed: {
    opacity: 0.96,
    transform: [{ scale: 0.99 }],
  },
  scoreCard: {
    borderRadius: radii.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.7)',
    overflow: 'hidden',
  },
  scoreHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  scoreHeaderIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreTitle: {
    fontSize: 17,
    fontFamily: typography.family.semibold,
    color: colors.text,
  },
  scoreDisplay: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
    marginBottom: 8,
  },
  scoreNumber: {
    fontSize: 48,
    fontFamily: typography.family.bold,
  },
  scoreMax: {
    fontSize: 24,
    fontFamily: typography.family.semibold,
    color: colors.textMuted,
  },
  scoreLabel: {
    fontSize: 13,
    fontFamily: typography.family.medium,
    marginBottom: 16,
    lineHeight: 18,
  },
  scoreProgressContainer: {
    height: 22,
    backgroundColor: colors.border,
    borderRadius: radii.sm,
    overflow: 'hidden',
    marginBottom: 14,
    position: 'relative',
  },
  scoreProgressFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    height: '100%',
    borderRadius: radii.sm - 2,
  },
  scoreProgressTarget: {
    position: 'absolute',
    left: '80%',
    top: 0,
    width: 4,
    height: '100%',
    backgroundColor: colors.success,
    borderRadius: 2,
  },
  targetContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  targetIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.success + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  targetText: {
    fontSize: 13,
    fontFamily: typography.family.regular,
    color: colors.textMuted,
    flex: 1,
  },
  targetBold: {
    fontFamily: typography.family.bold,
    color: colors.text,
  },
  symptomsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 20,
    justifyContent: 'center',
  },
  symptomPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radii.pill,
    borderWidth: 1.5,
  },
  symptomPillText: {
    fontSize: 13,
    fontFamily: typography.family.semibold,
  },
  socialProofContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.primaryLight + '30',
    borderRadius: radii.lg,
    marginBottom: spacing.sm,
  },
  socialProofIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary + '25',
    alignItems: 'center',
    justifyContent: 'center',
  },
  socialProofText: {
    fontSize: 14,
    fontFamily: typography.family.medium,
    color: colors.text,
  },
  resultsDisclaimer: {
    fontSize: 12,
    fontFamily: typography.family.regular,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  resultsFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    paddingBottom: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.82)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.65)',
  },
  // Social proof screen (full screen)
  socialProofScreenContainer: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  socialProofScrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: 0,
    paddingBottom: 100,
    flexGrow: 1,
  },
  socialProofImageWrap: {
    width: '100%',
    maxHeight: 320,
    marginBottom: spacing.lg,
  },
  socialProofImage: {
    width: '100%',
    height: 280,
    maxHeight: 320,
  },
  socialProofHeadline: {
    fontSize: 26,
    fontFamily: typography.family.bold,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  socialProofSubhead: {
    fontSize: 14,
    fontFamily: typography.family.regular,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: spacing.xl,
    paddingHorizontal: spacing.xs,
  },
  socialProofBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.md,
    marginBottom: spacing['2xl'],
  },
  socialProofBadge: {
    alignItems: 'center',
    minWidth: 96,
  },
  socialProofBadgeIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.rowNavyBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  socialProofBadgeIconPrimary: {
    backgroundColor: colors.primaryLight + '99',
  },
  socialProofBadgeIconGold: {
    backgroundColor: colors.rowGoldBg,
  },
  socialProofBadgeText: {
    fontSize: 12,
    fontFamily: typography.family.semibold,
    color: colors.text,
    textAlign: 'center',
  },
  socialProofValues: {
    marginBottom: spacing.xl,
    paddingHorizontal: spacing.xs,
  },
  socialProofValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  socialProofValueText: {
    fontSize: 13,
    fontFamily: typography.family.medium,
    color: colors.text,
    flex: 1,
    lineHeight: 19,
  },
  socialProofDisclaimer: {
    fontSize: 12,
    fontFamily: typography.family.regular,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: spacing.sm,
  },
  socialProofFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.88)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.7)',
  },
  // Primary CTA button (Landing style + bottom shadow)
  gradientButton: {
    borderRadius: radii.lg,
    overflow: 'hidden',
    marginBottom: 16,
    backgroundColor: colors.primary,
    minHeight: minTouchTarget,
    justifyContent: 'center',
    ...shadows.buttonPrimary,
  },
  gradientButtonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  gradientButtonText: {
    fontSize: 17,
    fontFamily: typography.family.semibold,
    color: colors.background,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  buttonDisabled: {
    opacity: 0.6,
    backgroundColor: '#E5E7EB',
  },
  buttonTextDisabled: {
    color: '#9CA3AF',
  },
  // Email styles
  emailContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  emailContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
    flexGrow: 1,
  },
  registerImage: {
    width: '100%',
    maxHeight: 320,
    marginBottom: spacing.md,
  },
  userExistsIcon: {
    alignItems: 'center',
    marginBottom: 20,
    padding: 20,
    backgroundColor: 'rgba(255, 141, 161, 0.1)',
    borderRadius: 50,
    alignSelf: 'center',
  },
  emailTitle: {
    fontSize: 26,
    fontFamily: typography.family.bold,
    color: colors.text,
    marginBottom: 12,
    textAlign: 'center',
  },
  emailSubtitle: {
    fontSize: 15,
    color: colors.textMuted,
    marginBottom: 8,
    textAlign: 'center',
    lineHeight: 22,
  },
  emailTrialNote: {
    fontSize: 13,
    color: colors.textMuted,
    marginBottom: spacing.md,
    textAlign: 'center',
    lineHeight: 20,
  },
  emailSubtitleSmall: {
    fontSize: 14,
    color: colors.textMuted,
    marginBottom: 24,
    textAlign: 'center',
  },
  emailBold: {
    fontWeight: '700',
  },
  emailInput: {
    fontSize: 16,
    fontFamily: typography.family.medium,
    padding: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    marginBottom: 16,
  },
  emailInputError: {
    borderColor: '#EF4444',
  },
  inputGroup: {
    marginBottom: 8,
  },
  inputLabel: {
    fontSize: 14,
    fontFamily: typography.family.medium,
    color: colors.text,
    marginBottom: 8,
  },
  passwordContainer: {
    position: 'relative',
  },
  passwordInput: {
    paddingRight: 50,
  },
  passwordToggle: {
    position: 'absolute',
    right: 16,
    top: 16,
    paddingHorizontal: 4,
  },
  helperText: {
    fontSize: 12,
    fontFamily: typography.family.regular,
    color: colors.textMuted,
    marginTop: -8,
    marginBottom: 8,
  },
  errorContainer: {
    backgroundColor: colors.dangerBg,
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(220, 38, 38, 0.30)',
  },
  errorText: {
    color: colors.danger,
    fontSize: 14,
  },
  termsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  termsCheckWrap: {
    padding: 2,
  },
  termsTextWrap: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  termsText: {
    fontSize: 14,
    fontFamily: typography.family.regular,
    color: colors.textMuted,
  },
  termsLink: {
    fontSize: 14,
    fontFamily: typography.family.medium,
    color: colors.primary,
    textDecorationLine: 'underline',
  },
  loginTextContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loginText: {
    fontSize: 14,
    color: colors.textMuted,
  },
  loginLink: {
    fontSize: 14,
    color: colors.primary,
    fontFamily: typography.family.semibold,
    textDecorationLine: 'underline',
  },
  linkText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    textDecorationLine: 'underline',
  },
  // Email sent styles
  emailSentContainer: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  emailSentIcon: {
    marginBottom: 20,
    padding: 24,
    backgroundColor: 'rgba(255, 141, 161, 0.1)',
    borderRadius: 50,
  },
  emailSentTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 12,
  },
  emailSentText: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 8,
  },
  emailSentSubtext: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 22,
  },
});
