/**
 * In-App Review Service (lib/reviewService.ts)
 * 
 * Prompts users to rate the app on Google Play / App Store
 * after meeting usage criteria: 7+ days AND 10+ transactions.
 * Uses expo-store-review for native review dialog.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const REVIEW_REQUESTED_KEY = '@mizan_review_requested';
const FIRST_OPEN_KEY = '@mizan_first_open_date';

/**
 * Records the first time the app is opened (called once on first launch).
 */
export async function recordFirstOpen(): Promise<void> {
  const existing = await AsyncStorage.getItem(FIRST_OPEN_KEY);
  if (!existing) {
    await AsyncStorage.setItem(FIRST_OPEN_KEY, new Date().toISOString());
  }
}

/**
 * Checks if the user meets the criteria for an in-app review prompt:
 * - At least 7 days since first open
 * - At least 10 transactions recorded
 * - Review has not already been requested
 * 
 * If criteria are met, triggers the native review dialog.
 */
export async function checkAndPromptReview(transactionCount: number): Promise<void> {
  try {
    // Skip on web
    if (Platform.OS === 'web') return;

    // Check if already prompted
    const alreadyRequested = await AsyncStorage.getItem(REVIEW_REQUESTED_KEY);
    if (alreadyRequested) return;

    // Check minimum transactions
    if (transactionCount < 10) return;

    // Check minimum days since first open
    const firstOpenStr = await AsyncStorage.getItem(FIRST_OPEN_KEY);
    if (!firstOpenStr) {
      await recordFirstOpen();
      return;
    }

    const firstOpenDate = new Date(firstOpenStr);
    const now = new Date();
    const daysSinceFirstOpen = (now.getTime() - firstOpenDate.getTime()) / (1000 * 60 * 60 * 24);

    if (daysSinceFirstOpen < 7) return;

    // All criteria met — request review
    try {
      // @ts-ignore
      const StoreReview = await import('expo-store-review');
      const isAvailable = await StoreReview.isAvailableAsync();
      if (isAvailable) {
        await StoreReview.requestReview();
        // Mark as requested so we don't prompt again
        await AsyncStorage.setItem(REVIEW_REQUESTED_KEY, new Date().toISOString());
      }
    } catch (reviewErr) {
      // expo-store-review might not be installed yet — fail silently
      console.warn('Store review not available:', reviewErr);
    }
  } catch (err) {
    // Never crash for review logic
    console.warn('Review check error:', err);
  }
}

/**
 * Resets the review prompt flag (useful for testing or after major updates).
 */
export async function resetReviewPrompt(): Promise<void> {
  await AsyncStorage.removeItem(REVIEW_REQUESTED_KEY);
}
