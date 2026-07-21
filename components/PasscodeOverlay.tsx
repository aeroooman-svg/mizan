import React, { useState, useEffect, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  Dimensions,
  SafeAreaView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/lib/ThemeContext';
import { useLanguage } from '@/lib/LanguageContext';
import { useSecurity } from '@/lib/SecurityContext';
import { useTransactions } from '@/lib/TransactionContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const PIN_LENGTH = 4;

export default function PasscodeOverlay() {
  const { colors, theme } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const { verifyPin, failedAttempts, lockoutEndTime, isBiometricEnabled, authenticateBiometric } = useSecurity();
  const { t, language } = useLanguage();
  const { selectedWallet } = useTransactions();
  const [pin, setPin] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [shake, setShake] = useState(false);
  const [lockoutRemaining, setLockoutRemaining] = useState(0);

  const themeColor = selectedWallet?.color || colors.primary;
  const isLockedOut = lockoutRemaining > 0;
  const MAX_ATTEMPTS = 5;

  // Countdown timer for lockout
  useEffect(() => {
    if (!lockoutEndTime) {
      setLockoutRemaining(0);
      return;
    }

    const updateRemaining = () => {
      const remaining = Math.max(0, Math.ceil((lockoutEndTime - Date.now()) / 1000));
      setLockoutRemaining(remaining);
    };

    updateRemaining();
    const interval = setInterval(updateRemaining, 1000);
    return () => clearInterval(interval);
  }, [lockoutEndTime]);

  // Automatically trigger biometric unlock on mount if enabled
  useEffect(() => {
    if (isBiometricEnabled && !isLockedOut) {
      const timer = setTimeout(() => {
        handleBiometricPrompt();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isBiometricEnabled, isLockedOut]);

  const handleBiometricPrompt = async () => {
    await authenticateBiometric(
      language === 'ar'
        ? 'قم بفتح تطبيق ميزان باستخدام البصمة'
        : 'Unlock MIZAN using Biometrics'
    );
  };

  const handleKeyPress = (num: string) => {
    if (pin.length >= PIN_LENGTH || isLockedOut) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setErrorMsg('');
    const newPin = pin + num;
    setPin(newPin);
  };

  const handleBackspace = () => {
    if (pin.length === 0 || isLockedOut) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPin(pin.slice(0, -1));
  };

  useEffect(() => {
    if (pin.length === PIN_LENGTH) {
      checkPin();
    }
  }, [pin]);

  const checkPin = async () => {
    const success = await verifyPin(pin);
    if (success) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      const attemptsLeft = MAX_ATTEMPTS - (failedAttempts + 1);
      if (attemptsLeft > 0) {
        setErrorMsg(
          language === 'ar'
            ? `${t.pinIncorrect} — ${attemptsLeft} محاولات متبقية`
            : `${t.pinIncorrect} — ${attemptsLeft} attempts remaining`
        );
      } else {
        setErrorMsg(
          language === 'ar'
            ? 'تم قفل التطبيق مؤقتاً. انتظر 30 ثانية.'
            : 'App locked temporarily. Wait 30 seconds.'
        );
      }
      setShake(true);
      setTimeout(() => setShake(false), 500);
      setPin('');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Header / Icon */}
        <View style={styles.header}>
          <View style={[styles.iconContainer, { backgroundColor: themeColor + '15' }]}>
            <Ionicons name="lock-closed" size={44} color={themeColor} />
          </View>
          <Text style={styles.title}>{t.securityLock}</Text>
          <Text style={styles.subtitle}>
            {isLockedOut
              ? (language === 'ar'
                  ? `محاولة مرة أخرى بعد ${lockoutRemaining} ثانية`
                  : `Try again in ${lockoutRemaining}s`)
              : t.enterPin}
          </Text>
        </View>

        {/* PIN Indicators */}
        <View style={[styles.dotsContainer, shake && styles.shake]}>
          {Array.from({ length: PIN_LENGTH }).map((_, i) => {
            const filled = i < pin.length;
            return (
              <View
                key={i}
                style={[
                  styles.dot,
                  filled
                    ? { backgroundColor: themeColor, borderColor: themeColor, transform: [{ scale: 1.15 }] }
                    : { borderColor: colors.border, borderWidth: 2 },
                ]}
              />
            );
          })}
        </View>

        {/* Error message */}
        <View style={styles.errorContainer}>
          {errorMsg ? <Text style={styles.errorText}>{errorMsg}</Text> : null}
        </View>

        {/* Keypad */}
        <View style={styles.keypad}>
          {/* Rows */}
          {[['1', '2', '3'], ['4', '5', '6'], ['7', '8', '9']].map((row, i) => (
            <View key={i} style={styles.keypadRow}>
              {row.map((num) => (
                <Pressable
                  key={num}
                  style={({ pressed }) => [styles.key, pressed && styles.keyPressed]}
                  onPress={() => handleKeyPress(num)}
                >
                  <Text style={styles.keyText}>{num}</Text>
                </Pressable>
              ))}
            </View>
          ))}
          {/* Last row with Backspace and Biometrics */}
          <View style={styles.keypadRow}>
            {isBiometricEnabled && !isLockedOut ? (
              <Pressable
                style={({ pressed }) => [styles.key, pressed && styles.keyPressed]}
                onPress={handleBiometricPrompt}
              >
                <Ionicons name="finger-print-outline" size={28} color={themeColor} />
              </Pressable>
            ) : (
              <View style={styles.keyPlaceholder} />
            )}
            <Pressable
              style={({ pressed }) => [styles.key, pressed && styles.keyPressed]}
              onPress={() => handleKeyPress('0')}
            >
              <Text style={styles.keyText}>0</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.key, pressed && styles.keyPressed]}
              onPress={handleBackspace}
            >
              <Ionicons name="backspace-outline" size={24} color={colors.text} />
            </Pressable>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const getStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 30,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
    gap: 12,
  },
  iconContainer: {
    width: 90,
    height: 90,
    borderRadius: 45,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 24,
    color: colors.text,
  },
  subtitle: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 16,
    color: colors.textSecondary,
  },
  dotsContainer: {
    flexDirection: 'row',
    gap: 20,
    justifyContent: 'center',
    alignItems: 'center',
    height: 30,
    marginBottom: 10,
  },
  dot: {
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  shake: {
    transform: [{ translateX: 10 }],
  },
  errorContainer: {
    height: 24,
    justifyContent: 'center',
    marginBottom: 40,
  },
  errorText: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 14,
    color: colors.expense,
  },
  keypad: {
    width: SCREEN_WIDTH * 0.85,
    maxWidth: 320,
    gap: 16,
  },
  keypadRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16,
  },
  key: {
    flex: 1,
    aspectRatio: 1.5,
    maxHeight: 60,
    borderRadius: 14,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  keyPressed: {
    backgroundColor: colors.surfaceAlt,
    transform: [{ scale: 0.96 }],
  },
  keyPlaceholder: {
    flex: 1,
  },
  keyText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 22,
    color: colors.text,
  },
});
