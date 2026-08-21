import React, { useState, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  Pressable,
  Platform,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useLanguage } from '@/lib/LanguageContext';
import { useTheme } from '@/lib/ThemeContext';
import { useTransactions } from '@/lib/TransactionContext';
import { joinSharedWallet } from '@/lib/sharingService';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function JoinWalletScreen() {
  const { colors } = useTheme();
  const { language } = useLanguage();
  const { refresh, selectWallet } = useTransactions();
  const isAr = language === 'ar';
  const styles = useMemo(() => getStyles(colors, isAr), [colors, isAr]);

  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);

  const handleBack = () => {
    try { Haptics.selectionAsync(); } catch {}
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)' as any);
    }
  };

  const handleJoin = async () => {
    const trimmed = code.trim().toUpperCase();
    if (trimmed.length < 3) {
      Alert.alert(
        isAr ? 'تنبيه' : 'Notice',
        isAr ? 'الرجاء إدخال كود المشاركة' : 'Please enter a share code',
      );
      return;
    }

    setLoading(true);
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch {}

    try {
      const result = await joinSharedWallet(trimmed);
      setLoading(false);

      if (result.success) {
        await refresh();
        // Activate the joined wallet automatically
        try {
          const rawWallets = await AsyncStorage.getItem('@mizan_wallets');
          if (rawWallets) {
            const list = JSON.parse(rawWallets);
            const joined = list.find((w: any) => w.shareCode === trimmed || w.id === `w_shared_${trimmed.toLowerCase()}` || w.name === result.walletName);
            if (joined && selectWallet) {
              await selectWallet(joined.id);
            }
          }
        } catch (e) {
          console.warn('Could not auto-select joined wallet:', e);
        }
        await refresh();

        try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch {}
        
        // Immediate redirect to Home tab
        router.replace('/(tabs)' as any);
      } else {
        try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); } catch {}
        Alert.alert(
          isAr ? 'تعذر الانضمام' : 'Failed to Join',
          result.error || (isAr ? 'الكود غير صحيح' : 'Invalid code'),
        );
      }
    } catch (err) {
      setLoading(false);
      console.error('handleJoin error:', err);
      // Fail-proof fallback redirect
      router.replace('/(tabs)' as any);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable
            onPress={handleBack}
            style={styles.backBtn}
          >
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </Pressable>
          <Text style={styles.headerTitle}>
            {isAr ? 'الانضمام لمحفظة' : 'Join Wallet'}
          </Text>
          <View style={{ width: 44 }} />
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.content}>
            {/* Illustration */}
            <View style={styles.illustrationContainer}>
              <View style={styles.illustrationCircle}>
                <Ionicons name="people" size={48} color={colors.primary} />
              </View>
            </View>

            <Text style={styles.title}>
              {isAr ? 'انضم لمحفظة مشتركة' : 'Join a Shared Wallet'}
            </Text>
            <Text style={styles.subtitle}>
              {isAr
                ? 'أدخل كود المشاركة الذي حصلت عليه من صاحب المحفظة'
                : 'Enter the share code you received from the wallet owner'}
            </Text>

            {/* Code Input */}
            <View style={styles.codeInputContainer}>
              <TextInput
                style={styles.codeInput}
                value={code}
                onChangeText={(text) => setCode(text.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
                placeholder="XXXXXX"
                placeholderTextColor={colors.textTertiary}
                maxLength={6}
                autoCapitalize="characters"
                autoCorrect={false}
                autoFocus
                textAlign="center"
              />
            </View>

            {/* Join Button */}
            <Pressable
              onPress={handleJoin}
              disabled={loading || code.trim().length < 1}
              style={({ pressed }) => [
                styles.joinBtn,
                (loading || code.trim().length < 1) && styles.joinBtnDisabled,
                pressed && { opacity: 0.9 },
              ]}
            >
              {loading ? (
                <ActivityIndicator color="#FFF" size="small" />
              ) : (
                <>
                  <Ionicons name="enter-outline" size={20} color="#FFF" />
                  <Text style={styles.joinBtnText}>
                    {isAr ? 'انضمام' : 'Join'}
                  </Text>
                </>
              )}
            </Pressable>
          </View>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

const getStyles = (colors: any, isAr: boolean) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: isAr ? 'row-reverse' : 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 16,
    color: colors.text,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  content: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  illustrationContainer: {
    marginBottom: 24,
  },
  illustrationCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.primary + '30',
  },
  title: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 22,
    color: colors.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 32,
    paddingHorizontal: 20,
    lineHeight: 20,
  },
  codeInputContainer: {
    width: '100%',
    marginBottom: 24,
  },
  codeInput: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 32,
    color: colors.primary,
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 20,
    borderWidth: 2,
    borderColor: colors.border,
    letterSpacing: 12,
    textAlign: 'center',
  },
  joinBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 40,
    width: '100%',
  },
  joinBtnDisabled: {
    opacity: 0.5,
  },
  joinBtnText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 16,
    color: '#FFF',
  },
});
