/**
 * Crash Reporting Service (lib/crashReporter.ts)
 * 
 * Centralized error reporting service. Currently uses a local logging approach
 * that can be upgraded to Sentry or Firebase Crashlytics by setting the DSN.
 * 
 * To enable Sentry:
 * 1. Create a free account at https://sentry.io
 * 2. Create a React Native project
 * 3. Copy your DSN and set it below or in your .env as EXPO_PUBLIC_SENTRY_DSN
 * 4. Run: npx expo install @sentry/react-native
 * 5. Add "@sentry/react-native/expo" to plugins in app.json
 */

import { Platform } from 'react-native';

// Configure your Sentry DSN here or via environment variable
const SENTRY_DSN = process.env.EXPO_PUBLIC_SENTRY_DSN || '';

let sentryInitialized = false;
let SentryModule: any = null;

/**
 * Initialize the crash reporter. Call this once at app startup.
 */
export async function initCrashReporter(): Promise<void> {
  if (sentryInitialized) return;

  if (SENTRY_DSN) {
    try {
      SentryModule = await import('@sentry/react-native');
      SentryModule.init({
        dsn: SENTRY_DSN,
        debug: __DEV__,
        environment: __DEV__ ? 'development' : 'production',
        tracesSampleRate: __DEV__ ? 1.0 : 0.2,
        enableAutoSessionTracking: true,
        sessionTrackingIntervalMillis: 30000,
      });
      sentryInitialized = true;
      console.log('✅ Sentry crash reporting initialized');
    } catch (err) {
      console.warn('Sentry not available, using local crash logging:', err);
    }
  } else {
    if (__DEV__) {
      console.log('ℹ️ Sentry DSN not configured. Set EXPO_PUBLIC_SENTRY_DSN to enable crash reporting.');
    }
  }
}

/**
 * Report an error to the crash reporting service.
 */
export function reportError(error: Error, context?: Record<string, any>): void {
  // Always log locally
  console.error('[CrashReporter]', error.message, context || '');

  if (sentryInitialized && SentryModule) {
    if (context) {
      SentryModule.withScope((scope: any) => {
        Object.entries(context).forEach(([key, value]) => {
          scope.setExtra(key, value);
        });
        SentryModule.captureException(error);
      });
    } else {
      SentryModule.captureException(error);
    }
  }
}

/**
 * Report a non-fatal message/warning.
 */
export function reportMessage(message: string, level: 'info' | 'warning' | 'error' = 'info'): void {
  if (__DEV__) {
    console.log(`[CrashReporter:${level}]`, message);
  }

  if (sentryInitialized && SentryModule) {
    SentryModule.captureMessage(message, level);
  }
}

/**
 * Set user context for crash reports.
 */
export function setUser(userId: string, username?: string): void {
  if (sentryInitialized && SentryModule) {
    SentryModule.setUser({ id: userId, username: username || undefined });
  }
}

/**
 * Clear user context (on logout).
 */
export function clearUser(): void {
  if (sentryInitialized && SentryModule) {
    SentryModule.setUser(null);
  }
}

/**
 * Wrap a React component with error boundary reporting.
 * Use this as the HOC wrapper for your root component if Sentry is active.
 */
export function wrapWithCrashReporter(component: any): any {
  if (sentryInitialized && SentryModule?.wrap) {
    return SentryModule.wrap(component);
  }
  return component;
}
