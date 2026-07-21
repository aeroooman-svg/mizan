import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { AppState, AppStateStatus, Platform } from 'react-native';
import { authenticateWithBiometrics } from './BiometricService';

interface SecurityContextValue {
  isPinEnabled: boolean;
  isBiometricEnabled: boolean;
  isUnlocked: boolean;
  isLoading: boolean;
  failedAttempts: number;
  lockoutEndTime: number | null;
  enablePin: (pin: string) => Promise<void>;
  disablePin: () => Promise<void>;
  verifyPin: (pin: string) => Promise<boolean>;
  enableBiometrics: (enabled: boolean) => Promise<boolean>;
  authenticateBiometric: (prompt?: string) => Promise<boolean>;
  lock: () => void;
}

const SecurityContext = createContext<SecurityContextValue | null>(null);

const PIN_ENABLED_KEY = '@masarif_pin_enabled';
const BIOMETRIC_ENABLED_KEY = '@masarif_biometric_enabled';
const PIN_CODE_SECURE_KEY = 'masarif_pin_code'; // SecureStore key (no @ prefix)
const PIN_CODE_LEGACY_KEY = '@masarif_pin_code'; // Old AsyncStorage key for migration
const FAILED_ATTEMPTS_KEY = '@masarif_pin_failed_attempts';
const LOCKOUT_END_KEY = '@masarif_pin_lockout_end';

const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 30 * 1000; // 30 seconds lockout

// Helper: Use SecureStore on native, fallback to AsyncStorage on web
async function secureSet(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web') {
    await AsyncStorage.setItem(`@secure_${key}`, value);
  } else {
    await SecureStore.setItemAsync(key, value);
  }
}

async function secureGet(key: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    return AsyncStorage.getItem(`@secure_${key}`);
  } else {
    return SecureStore.getItemAsync(key);
  }
}

async function secureDelete(key: string): Promise<void> {
  if (Platform.OS === 'web') {
    await AsyncStorage.removeItem(`@secure_${key}`);
  } else {
    await SecureStore.deleteItemAsync(key);
  }
}

export function SecurityProvider({ children }: { children: ReactNode }) {
  const [isPinEnabled, setIsPinEnabled] = useState(false);
  const [isBiometricEnabled, setIsBiometricEnabled] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [backgroundTime, setBackgroundTime] = useState<number | null>(null);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutEndTime, setLockoutEndTime] = useState<number | null>(null);

  useEffect(() => {
    async function loadSecurityState() {
      try {
        const enabled = await AsyncStorage.getItem(PIN_ENABLED_KEY);
        const bioEnabled = await AsyncStorage.getItem(BIOMETRIC_ENABLED_KEY);

        // Migrate old plain-text PIN from AsyncStorage to SecureStore
        const legacyPin = await AsyncStorage.getItem(PIN_CODE_LEGACY_KEY);
        if (legacyPin) {
          await secureSet(PIN_CODE_SECURE_KEY, legacyPin);
          await AsyncStorage.removeItem(PIN_CODE_LEGACY_KEY);
        }

        // Load lockout state
        const storedAttempts = await AsyncStorage.getItem(FAILED_ATTEMPTS_KEY);
        const storedLockout = await AsyncStorage.getItem(LOCKOUT_END_KEY);

        if (storedAttempts) {
          setFailedAttempts(parseInt(storedAttempts, 10) || 0);
        }
        if (storedLockout) {
          const lockoutEnd = parseInt(storedLockout, 10);
          if (lockoutEnd > Date.now()) {
            setLockoutEndTime(lockoutEnd);
          } else {
            // Lockout expired, clear it
            await AsyncStorage.multiRemove([FAILED_ATTEMPTS_KEY, LOCKOUT_END_KEY]);
          }
        }

        if (bioEnabled === 'true') {
          setIsBiometricEnabled(true);
        }

        if (enabled === 'true') {
          setIsPinEnabled(true);
          setIsUnlocked(false);
        } else {
          setIsPinEnabled(false);
          setIsUnlocked(true);
        }
      } catch (e) {
      } finally {
        setIsLoading(false);
      }
    }
    loadSecurityState();
  }, []);

  // Monitor AppState changes to lock the app when returning from background
  useEffect(() => {
    const handleAppStateChange = async (nextAppState: AppStateStatus) => {
      if (nextAppState === 'background') {
        setBackgroundTime(Date.now());
      } else if (nextAppState === 'active') {
        if (isPinEnabled && backgroundTime) {
          const secondsAway = (Date.now() - backgroundTime) / 1000;
          // Auto lock if away for more than 10 seconds
          if (secondsAway > 10) {
            setIsUnlocked(false);
          }
        }
        setBackgroundTime(null);
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => {
      subscription.remove();
    };
  }, [isPinEnabled, backgroundTime]);

  const enablePin = useCallback(async (pin: string) => {
    await AsyncStorage.setItem(PIN_ENABLED_KEY, 'true');
    await secureSet(PIN_CODE_SECURE_KEY, pin);
    setIsPinEnabled(true);
    setIsUnlocked(true);
    // Reset any lockout state
    setFailedAttempts(0);
    setLockoutEndTime(null);
    await AsyncStorage.multiRemove([FAILED_ATTEMPTS_KEY, LOCKOUT_END_KEY]);
  }, []);

  const disablePin = useCallback(async () => {
    await AsyncStorage.removeItem(PIN_ENABLED_KEY);
    await secureDelete(PIN_CODE_SECURE_KEY);
    await AsyncStorage.removeItem(BIOMETRIC_ENABLED_KEY);
    setIsPinEnabled(false);
    setIsBiometricEnabled(false);
    setIsUnlocked(true);
    // Reset lockout state
    setFailedAttempts(0);
    setLockoutEndTime(null);
    await AsyncStorage.multiRemove([FAILED_ATTEMPTS_KEY, LOCKOUT_END_KEY]);
  }, []);

  const verifyPin = useCallback(async (pin: string): Promise<boolean> => {
    // Check if currently locked out
    if (lockoutEndTime && Date.now() < lockoutEndTime) {
      return false;
    }

    // If lockout expired, clear it
    if (lockoutEndTime && Date.now() >= lockoutEndTime) {
      setLockoutEndTime(null);
      setFailedAttempts(0);
      await AsyncStorage.multiRemove([FAILED_ATTEMPTS_KEY, LOCKOUT_END_KEY]);
    }

    const storedPin = await secureGet(PIN_CODE_SECURE_KEY);
    if (storedPin === pin) {
      setIsUnlocked(true);
      // Reset failed attempts on success
      setFailedAttempts(0);
      await AsyncStorage.multiRemove([FAILED_ATTEMPTS_KEY, LOCKOUT_END_KEY]);
      return true;
    }

    // Failed attempt
    const newAttempts = failedAttempts + 1;
    setFailedAttempts(newAttempts);
    await AsyncStorage.setItem(FAILED_ATTEMPTS_KEY, newAttempts.toString());

    // Trigger lockout after MAX_ATTEMPTS
    if (newAttempts >= MAX_ATTEMPTS) {
      const lockoutEnd = Date.now() + LOCKOUT_DURATION_MS;
      setLockoutEndTime(lockoutEnd);
      await AsyncStorage.setItem(LOCKOUT_END_KEY, lockoutEnd.toString());
    }

    return false;
  }, [lockoutEndTime, failedAttempts]);

  const enableBiometrics = useCallback(async (enabled: boolean): Promise<boolean> => {
    if (enabled) {
      const success = await authenticateWithBiometrics(
        Platform.OS === 'android' ? 'تأكيد البصمة لتفعيل القفل' : 'Confirm biometrics to enable lock'
      );
      if (success) {
        await AsyncStorage.setItem(BIOMETRIC_ENABLED_KEY, 'true');
        setIsBiometricEnabled(true);
        return true;
      }
      return false;
    } else {
      await AsyncStorage.removeItem(BIOMETRIC_ENABLED_KEY);
      setIsBiometricEnabled(false);
      return true;
    }
  }, []);

  const authenticateBiometric = useCallback(async (promptMessage?: string): Promise<boolean> => {
    if (!isBiometricEnabled) return false;
    const success = await authenticateWithBiometrics(promptMessage);
    if (success) {
      setIsUnlocked(true);
      setFailedAttempts(0);
      return true;
    }
    return false;
  }, [isBiometricEnabled]);

  const lock = useCallback(() => {
    if (isPinEnabled) {
      setIsUnlocked(false);
    }
  }, [isPinEnabled]);

  return (
    <SecurityContext.Provider
      value={{
        isPinEnabled,
        isBiometricEnabled,
        isUnlocked,
        isLoading,
        failedAttempts,
        lockoutEndTime,
        enablePin,
        disablePin,
        verifyPin,
        enableBiometrics,
        authenticateBiometric,
        lock,
      }}
    >
      {children}
    </SecurityContext.Provider>
  );
}

export function useSecurity() {
  const context = useContext(SecurityContext);
  if (!context) {
    throw new Error('useSecurity must be used within a SecurityProvider');
  }
  return context;
}

