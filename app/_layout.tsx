import { QueryClientProvider } from "@tanstack/react-query";
import { Stack, router } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect, useState } from "react";
import { View, StyleSheet } from "react-native";
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
import { scheduleDailyReminder } from "@/lib/NotificationService";
import { ThemeProvider, useTheme } from "@/lib/ThemeContext";
import { SafeAreaProvider } from 'react-native-safe-area-context';

SplashScreen.preventAutoHideAsync();

function RootLayoutNav() {
  const { colors } = useTheme();
  const { isPinEnabled, isUnlocked, isLoading: isSecurityLoading } = useSecurity();
  const { isInitialLoading: isTransactionsLoading } = useTransactions();
  const [showSplash, setShowSplash] = useState(true);
  const [minTimeElapsed, setMinTimeElapsed] = useState(false);
  const [isOnboardingChecked, setIsOnboardingChecked] = useState(false);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);

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
    }, 2200); // Minimum 2.2 seconds to show off the splash loading animation
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
    return <SplashLoadingScreen />;
  }

  if (isPinEnabled && !isUnlocked) {
    return <PasscodeOverlay />;
  }

  return (
    <Stack screenOptions={{ headerShown: false, headerBackTitle: "Back" }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="onboarding" options={{ headerShown: false, animation: 'fade' }} />
      <Stack.Screen
        name="add-transaction"
        options={{
          presentation: "formSheet",
          sheetAllowedDetents: [0.85],
          sheetGrabberVisible: true,
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
        }}
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
        options={{
          presentation: "formSheet",
          sheetAllowedDetents: [0.7],
          sheetGrabberVisible: true,
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
        }}
      />
      <Stack.Screen
        name="settings"
        options={{
          presentation: "formSheet",
          sheetAllowedDetents: [0.85],
          sheetGrabberVisible: true,
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
        }}
      />
      <Stack.Screen
        name="recurring-list"
        options={{
          presentation: "formSheet",
          sheetAllowedDetents: [0.85],
          sheetGrabberVisible: true,
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
        }}
      />
      <Stack.Screen
        name="add-recurring"
        options={{
          presentation: "formSheet",
          sheetAllowedDetents: [0.85],
          sheetGrabberVisible: true,
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
        }}
      />
    </Stack>
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
  });

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
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
