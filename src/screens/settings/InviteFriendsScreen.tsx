import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Share,
  ScrollView,
  Linking,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { apiFetchWithAuth, getApiUrl } from '../../lib/api';
import { colors, spacing, radii, typography } from '../../theme/tokens';

export function InviteFriendsScreen() {
  const [code, setCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const loadCode = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetchWithAuth('/api/referral/code');
      if (data?.code) setCode(data.code);
      else setCode(null);
    } catch {
      setCode(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCode();
  }, [loadCode]);

  const registerBase = getApiUrl('').replace(/\/$/, '');
  const link = code ? `${registerBase}/register?ref=${encodeURIComponent(code)}` : '';

  const copyLink = useCallback(() => {
    if (!link) return;
    Clipboard.setStringAsync(link).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [link]);

  const share = useCallback(() => {
    if (!link) return;
    Share.share({
      message: link,
      title: 'Try MenoLisa',
      url: link,
    }).catch((err) => {
      if (err?.message?.includes('cancel')) return;
      copyLink();
    });
  }, [link, copyLink]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.card}>
          <View style={styles.iconWrap}>
            <Ionicons name="gift" size={32} color={colors.orange} />
          </View>
          <Text style={styles.title}>Give 3 days free. Get 50% off.</Text>
          <Text style={styles.subtext}>
            Invite friends to try MenoLisa. They get 3 days free; you get 50% off your first subscription when you upgrade.
          </Text>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => Linking.openURL(getApiUrl('/terms'))}
            style={styles.termsLinkWrap}
          >
            <Text style={styles.termsLinkText}>Terms apply</Text>
          </TouchableOpacity>
          {loading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator size="small" color={colors.orange} />
            </View>
          ) : link ? (
            <View style={styles.actions}>
              <TouchableOpacity
                style={[styles.button, styles.buttonSecondary]}
                onPress={copyLink}
                activeOpacity={0.8}
              >
                <Ionicons name="copy-outline" size={20} color={colors.orange} />
                <Text style={styles.buttonSecondaryText}>
                  {copied ? 'Copied!' : 'Copy link'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, styles.buttonPrimary]}
                onPress={share}
                activeOpacity={0.8}
              >
                <Ionicons name="share-outline" size={20} color={colors.background} />
                <Text style={styles.buttonPrimaryText}>Share</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <Text style={styles.errorText}>Could not load your referral link. Please try again.</Text>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing['2xl'],
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    borderWidth: 2,
    borderColor: colors.orange + '90',
    padding: spacing.xl,
    alignItems: 'center',
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: radii.md,
    backgroundColor: colors.orangeLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  title: {
    fontSize: 18,
    fontFamily: typography.family.bold,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  subtext: {
    fontSize: 14,
    fontFamily: typography.family.regular,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: spacing.sm,
  },
  termsLinkWrap: {
    marginBottom: spacing.xl,
  },
  termsLinkText: {
    fontSize: 12,
    fontFamily: typography.family.medium,
    color: colors.orange,
    textAlign: 'center',
    textDecorationLine: 'underline',
  },
  loadingWrap: {
    paddingVertical: spacing.lg,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    justifyContent: 'center',
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
  },
  buttonSecondary: {
    backgroundColor: colors.orangeLight,
    borderWidth: 1.5,
    borderColor: colors.orange + '99',
  },
  buttonSecondaryText: {
    fontSize: 15,
    fontFamily: typography.family.medium,
    color: colors.orange,
  },
  buttonPrimary: {
    backgroundColor: colors.orange,
  },
  buttonPrimaryText: {
    fontSize: 15,
    fontFamily: typography.family.semibold,
    color: colors.background,
  },
  errorText: {
    fontSize: 14,
    fontFamily: typography.family.regular,
    color: colors.textMuted,
    textAlign: 'center',
  },
});
