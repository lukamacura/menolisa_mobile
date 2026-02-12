import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Dimensions,
  TouchableOpacity,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors } from '../theme/tokens';

type AuthNav = { Landing: undefined; Register: undefined; Login: undefined };
const { width } = Dimensions.get('window');

function GetStartedButton() {
  const navigation = useNavigation<NativeStackNavigationProp<AuthNav, 'Landing'>>();
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      style={buttonStyles.btn}
      onPress={() => navigation.navigate('Register')}
    >
      <Text style={buttonStyles.btnText}>Get started</Text>
    </TouchableOpacity>
  );
}

const buttonStyles = StyleSheet.create({
  btn: {
    backgroundColor: colors.primary,
    paddingVertical: 16,
    marginHorizontal: 24,
    marginBottom: 24,
    borderRadius: 14,
    alignItems: 'center',
  },
  btnText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
  },
});

// Simple version without LinearGradient (in case that's causing issues)
export function LandingScreenSimple() {
  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
    >
      {/* Hero Section 1 - MenoLisa */}
      <View style={styles.heroSection}>
        <View style={styles.heroContent}>
          <Text style={styles.mainHeadline}>
            Smart AI Coach for Women in Menopause
          </Text>
          <Text style={styles.subheadline}>Feel like yourself again</Text>

          {/* Trust copy */}
          <View style={styles.trustCard}>
            <Text style={styles.trustText}>
              Powered by{' '}
              <Text style={styles.trustBold}>
                evidence-based menopause research
              </Text>
              , your coach builds a{' '}
              <Text style={styles.trustBold}>long-term understanding</Text> of
              your symptoms and needs, while keeping every conversation{' '}
              <Text style={styles.trustBold}>fully private</Text>.
            </Text>

            {/* Badges */}
            <View style={styles.badgesContainer}>
              <View style={[styles.badge, styles.badgePink]}>
                <Text style={styles.badgeText}>Evidence informed</Text>
              </View>
              <View style={[styles.badge, styles.badgeYellow]}>
                <Text style={[styles.badgeText, styles.badgeTextDark]}>
                  Private & secure
                </Text>
              </View>
              <View style={[styles.badge, styles.badgeBlue]}>
                <Text style={styles.badgeText}>3 days free</Text>
              </View>
            </View>
          </View>
        </View>
      </View>

      {/* Hero Section 2 - MenopauseReset */}
      <View style={styles.secondHeroSection}>
        <View style={styles.secondHeroContent}>
          <View style={styles.eyebrow}>
            <Text style={styles.eyebrowText}>
              Everything you need to feel like yourself again
            </Text>
          </View>

          <Text style={styles.secondTitle}>
            Your Complete Menopause Support System
          </Text>
          <Text style={styles.secondIntro}>
            Beyond Lisa, your personal AI coach, you get a full ecosystem
            designed to help you track, understand, and manage every aspect of
            your menopause journey.
          </Text>

          {/* Feature Pills */}
          <View style={styles.pillsContainer}>
            <View style={styles.pill}>
              <Text style={styles.pillText}>AI-Powered Coaching</Text>
            </View>
            <View style={styles.pill}>
              <Text style={styles.pillText}>Research-informed</Text>
            </View>
            <View style={styles.pill}>
              <Text style={styles.pillText}>Private & secure</Text>
            </View>
            <View style={styles.pill}>
              <Text style={styles.pillText}>Track symptoms and see what Lisa notices</Text>
            </View>
          </View>

          <View style={styles.bulletsContainer}>
            <Text style={styles.bullet}>
              • Track symptoms, nutrition, and fitness in one place
            </Text>
            <Text style={styles.bullet}>
              • Get weekly notes from Lisa based on your tracking
            </Text>
            <Text style={styles.bullet}>
              • Access research-informed guidance anytime, anywhere
            </Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

export function LandingScreenSimpleWithButton() {
  return (
    <View style={{ flex: 1 }}>
      <LandingScreenSimple />
      <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0 }}>
        <GetStartedButton />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  contentContainer: {
    paddingBottom: 100,
  },
  heroSection: {
    minHeight: 600,
    paddingTop: 60,
    paddingBottom: 40,
    backgroundColor: '#ffb4d5',
  },
  heroContent: {
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  mainHeadline: {
    fontSize: 32,
    fontWeight: '800',
    textAlign: 'center',
    color: '#1F2937',
    marginBottom: 16,
    paddingHorizontal: 10,
    lineHeight: 40,
  },
  subheadline: {
    fontSize: 24,
    fontWeight: '500',
    textAlign: 'center',
    color: '#1D3557',
    opacity: 0.7,
    marginBottom: 30,
    fontStyle: 'italic',
  },
  trustCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 24,
    padding: 20,
    marginTop: 20,
    width: width - 40,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.5)',
  },
  trustText: {
    fontSize: 14,
    lineHeight: 22,
    color: '#1F2937',
    textAlign: 'center',
    marginBottom: 16,
  },
  trustBold: {
    fontWeight: '600',
  },
  badgesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    margin: 4,
  },
  badgePink: {
    backgroundColor: '#ff8da1',
  },
  badgeYellow: {
    backgroundColor: '#ffeb76',
  },
  badgeBlue: {
    backgroundColor: '#65dbff',
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
  },
  badgeTextDark: {
    color: '#1D3557',
  },
  secondHeroSection: {
    backgroundColor: '#FDF2F8',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  secondHeroContent: {
    alignItems: 'center',
  },
  eyebrow: {
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 141, 161, 0.3)',
  },
  eyebrowText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#ff8da1',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  secondTitle: {
    fontSize: 28,
    fontWeight: '600',
    textAlign: 'center',
    color: '#1D3557',
    marginBottom: 16,
    lineHeight: 36,
  },
  secondIntro: {
    fontSize: 16,
    textAlign: 'center',
    color: '#1D3557',
    opacity: 0.7,
    marginBottom: 24,
    lineHeight: 24,
  },
  pillsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginBottom: 32,
  },
  pill: {
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 141, 161, 0.3)',
    margin: 4,
  },
  pillText: {
    fontSize: 12,
    color: '#1D3557',
    fontWeight: '500',
  },
  bulletsContainer: {
    width: '100%',
    maxWidth: 400,
  },
  bullet: {
    fontSize: 16,
    color: '#1D3557',
    marginBottom: 12,
    lineHeight: 24,
  },
});
