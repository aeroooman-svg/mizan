import { QueryClientProvider } from "@tanstack/react-query";
import { Stack, router } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect, useState } from "react";
import { View, StyleSheet, Platform } from "react-native";
import { StatusBar } from "expo-status-bar";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { queryClient } from "@/lib/query-client";
import { TransactionProvider, useTransactions } from "@/lib/TransactionContext";
import { LanguageProvider } from "@/lib/LanguageContext";
import { SecurityProvider, useSecurity } from "@/lib/SecurityContext";
import PasscodeOverlay from "@/components/PasscodeOverlay";
import SplashLoadingScreen from "@/components/SplashLoadingScreen";
import { useFonts, Cairo_400Regular, Cairo_600SemiBold, Cairo_700Bold } from "@expo-google-fonts/cairo";
import { Amiri_400Regular, Amiri_700Bold } from "@expo-google-fonts/amiri";
import { scheduleDailyReminder } from "@/lib/NotificationService";
import { ThemeProvider, useTheme } from "@/lib/ThemeContext";
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { initCrashReporter } from "@/lib/crashReporter";

SplashScreen.preventAutoHideAsync();

// Helper: iOS uses formSheet with sheet detents, Android uses modal
const getSheetScreenOptions = (colors: any, detent: number = 0.85) => ({
  presentation: Platform.OS === 'ios' ? 'formSheet' as const : 'modal' as const,
  ...(Platform.OS === 'ios' ? { sheetAllowedDetents: [detent], sheetGrabberVisible: true } : {}),
  headerShown: false,
  contentStyle: { backgroundColor: colors.background },
  animation: Platform.OS === 'android' ? 'slide_from_bottom' as const : undefined,
});

function RootLayoutNav() {
  const { colors, theme } = useTheme();
  const { isPinEnabled, isUnlocked, isLoading: isSecurityLoading } = useSecurity();
  const { isInitialLoading: isTransactionsLoading } = useTransactions();
  const [showSplash, setShowSplash] = useState(true);
  const [minTimeElapsed, setMinTimeElapsed] = useState(false);
  const [isOnboardingChecked, setIsOnboardingChecked] = useState(false);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);

  // Determine StatusBar style based on theme
  const statusBarStyle = theme === 'light' ? 'dark' : 'light';

  useEffect(() => {
    async function checkOnboarding() {
      try {
        const completed = await AsyncStorage.getItem('@mizan_onboarding_completed');
        if (!completed) {
          setNeedsOnboarding(true);
        }
      } catch (e) {}
      setIsOnboardingChecked(true);
    }
    checkOnboarding();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setMinTimeElapsed(true);
    }, 6000); // 6.0 seconds for comfortably reading the Quranic verse
    return () => clearTimeout(timer);
  }, []);

  // Redirect to onboarding if needed once loaded
  useEffect(() => {
    if (minTimeElapsed && isOnboardingChecked && needsOnboarding) {
      router.replace('/onboarding');
    }
  }, [minTimeElapsed, isOnboardingChecked, needsOnboarding]);

  // Schedule daily transaction reminder on app load
  useEffect(() => {
    scheduleDailyReminder(21, 0); // 9:00 PM daily
  }, []);

  const isLoading = isSecurityLoading || isTransactionsLoading || !minTimeElapsed || !isOnboardingChecked;

  if (isLoading) {
    return (
      <>
        <StatusBar style="light" />
        <SplashLoadingScreen />
      </>
    );
  }

  if (isPinEnabled && !isUnlocked) {
    return (
      <>
        <StatusBar style={statusBarStyle} />
        <PasscodeOverlay />
      </>
    );
  }

  return (
    <>
      <StatusBar style={statusBarStyle} />
      <Stack screenOptions={{ headerShown: false, headerBackTitle: "Back" }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false, animation: 'fade' }} />
        <Stack.Screen
          name="add-transaction"
          options={getSheetScreenOptions(colors, 0.85)}
        />
        <Stack.Screen
          name="share-wallet"
          options={{
            presentation: "card",
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="join-wallet"
          options={{
            presentation: "card",
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="add-wallet"
          options={getSheetScreenOptions(colors, 0.7)}
        />
        <Stack.Screen
          name="settings"
          options={getSheetScreenOptions(colors, 0.85)}
        />
        <Stack.Screen
          name="recurring-list"
          options={getSheetScreenOptions(colors, 0.85)}
        />
        <Stack.Screen
          name="add-recurring"
          options={getSheetScreenOptions(colors, 0.85)}
        />
        {/* Previously unregistered screens — now properly configured */}
        <Stack.Screen
          name="ai-advisor"
          options={getSheetScreenOptions(colors, 0.92)}
        />
        <Stack.Screen
          name="auth"
          options={{ headerShown: false, animation: 'fade' }}
        />
        <Stack.Screen
          name="challenges"
          options={getSheetScreenOptions(colors, 0.85)}
        />
        <Stack.Screen
          name="debts"
          options={getSheetScreenOptions(colors, 0.85)}
        />
        <Stack.Screen
          name="envelope-budget"
          options={getSheetScreenOptions(colors, 0.85)}
        />
        <Stack.Screen
          name="import-statement"
          options={getSheetScreenOptions(colors, 0.85)}
        />
        <Stack.Screen
          name="installments"
          options={getSheetScreenOptions(colors, 0.92)}
        />
        <Stack.Screen
          name="jameya"
          options={getSheetScreenOptions(colors, 0.92)}
        />
        <Stack.Screen
          name="notifications"
          options={getSheetScreenOptions(colors, 0.85)}
        />
        <Stack.Screen
          name="savings-goals"
          options={getSheetScreenOptions(colors, 0.85)}
        />
        <Stack.Screen
          name="scan-receipt"
          options={getSheetScreenOptions(colors, 0.85)}
        />
        <Stack.Screen
          name="wallet-collaboration"
          options={{ presentation: "card", headerShown: false }}
        />
        <Stack.Screen
          name="widgets-setup"
          options={getSheetScreenOptions(colors, 0.85)}
        />
        <Stack.Screen
          name="zakat-calculator"
          options={getSheetScreenOptions(colors, 0.85)}
        />
        <Stack.Screen
          name="privacy-policy"
          options={getSheetScreenOptions(colors, 0.92)}
        />
      </Stack>
    </>
  );
}

function ThemeContainer() {
  const { theme } = useTheme();
  return (
    <GestureHandlerRootView key={theme} style={{ flex: 1 }}>
      <SafeAreaProvider>
        <KeyboardProvider>
          <RootLayoutNav />
        </KeyboardProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

import { WalletProvider } from "@/lib/WalletContext";
import { BudgetProvider } from "@/lib/BudgetContext";
import { RecurringProvider } from "@/lib/RecurringContext";

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Cairo_400Regular,
    Cairo_600SemiBold,
    Cairo_700Bold,
    Amiri_400Regular,
    Amiri_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
      initCrashReporter();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <LanguageProvider>
          <ThemeProvider>
            <SecurityProvider>
              <WalletProvider>
                <BudgetProvider>
                  <RecurringProvider>
                    <TransactionProvider>
                      <ThemeContainer />
                    </TransactionProvider>
                  </RecurringProvider>
                </BudgetProvider>
              </WalletProvider>
            </SecurityProvider>
          </ThemeProvider>
        </LanguageProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
