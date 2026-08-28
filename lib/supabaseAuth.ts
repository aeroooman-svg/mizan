import AsyncStorage from '@react-native-async-storage/async-storage';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { Platform } from 'react-native';

// Complete WebBrowser auth session if returning from OAuth popup
WebBrowser.maybeCompleteAuthSession();

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://pykejhbazxzuqshjsfws.supabase.co';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_jCubdJRgn8gyF3k1bw3U-g_cXzkIQkZ';

const AUTH_URL = `${SUPABASE_URL}/auth/v1`;

export const AUTH_TOKEN_KEY = '@mizan_auth_access_token';
export const REFRESH_TOKEN_KEY = '@mizan_auth_refresh_token';
export const AUTH_USER_KEY = '@mizan_auth_user_data';
export const AUTH_PROVIDER_KEY = '@mizan_auth_provider';
export const LOCAL_USERS_KEY = '@mizan_user_registry_v1';
export const IS_GUEST_KEY = '@mizan_is_guest';

export interface SupabaseUser {
  id: string;
  email: string;
  user_metadata?: {
    full_name?: string;
    username?: string;
    avatar_url?: string;
    provider?: string;
    name?: string;
  };
  created_at?: string;
  is_local?: boolean;
}

export interface AuthSession {
  access_token: string;
  refresh_token: string;
  expires_in?: number;
  user: SupabaseUser;
}

export type OAuthProvider = 'google' | 'apple' | 'azure';

function getAuthHeaders(accessToken?: string): Record<string, string> {
  const headers: Record<string, string> = {
    'apikey': SUPABASE_ANON_KEY,
    'Content-Type': 'application/json',
  };
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  } else {
    headers['Authorization'] = `Bearer ${SUPABASE_ANON_KEY}`;
  }
  return headers;
}

/**
 * Parse OAuth tokens from callback URL (supports both hash fragment # and query params ?)
 */
function parseAuthUrl(url: string): { accessToken?: string; refreshToken?: string; error?: string } {
  try {
    let searchStr = '';
    const hashIndex = url.indexOf('#');
    const queryIndex = url.indexOf('?');

    if (hashIndex !== -1) {
      searchStr = url.substring(hashIndex + 1);
    } else if (queryIndex !== -1) {
      searchStr = url.substring(queryIndex + 1);
    }

    if (!searchStr) {
      return { error: 'لا توجد بيانات استجابة في رابط التوجيه' };
    }

    const params: Record<string, string> = {};
    const parts = searchStr.split('&');
    for (const part of parts) {
      const [k, v] = part.split('=');
      if (k && v) {
        params[decodeURIComponent(k)] = decodeURIComponent(v);
      }
    }

    if (params.error || params.error_description) {
      return { error: params.error_description || params.error };
    }

    return {
      accessToken: params.access_token,
      refreshToken: params.refresh_token,
    };
  } catch (e: any) {
    return { error: e?.message || 'خطأ في معالجة استجابة المصادقة' };
  }
}

/**
 * Fetch detailed user information using Supabase access token
 */
export async function supabaseGetUser(accessToken: string): Promise<SupabaseUser | null> {
  try {
    const res = await fetch(`${AUTH_URL}/user`, {
      method: 'GET',
      headers: getAuthHeaders(accessToken),
    });

    if (!res.ok) {
      return null;
    }

    const data = await res.json();
    return data as SupabaseUser;
  } catch {
    return null;
  }
}

/**
 * Real OAuth Sign-In for Google, Apple, and Microsoft/Hotmail/Outlook (Azure)
 */
export async function supabaseOAuthSignIn(
  provider: OAuthProvider
): Promise<{ user: SupabaseUser | null; session: AuthSession | null; error?: string }> {
  try {
    const redirectUrl = Linking.createURL('auth-callback');
    const authUrl = `${AUTH_URL}/authorize?provider=${provider}&redirect_to=${encodeURIComponent(redirectUrl)}`;

    // In native mobile app with WebBrowser
    if (Platform.OS !== 'web') {
      const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUrl, {
        showInRecents: true,
        preferEphemeralSession: false,
      });

      if (result.type === 'success' && result.url) {
        const { accessToken, refreshToken, error } = parseAuthUrl(result.url);

        if (error) {
          return { user: null, session: null, error };
        }

        if (accessToken) {
          const user = await supabaseGetUser(accessToken);
          if (user) {
            const session: AuthSession = {
              access_token: accessToken,
              refresh_token: refreshToken || '',
              user,
            };
            await saveSession(session, provider);
            return { user, session };
          }
        }
      } else if (result.type === 'cancel' || result.type === 'dismiss') {
        return { user: null, session: null, error: 'تم إلغاء عملية تسجيل الدخول' };
      }
    }

    // On Web or fallback, indicate fallback modal should be used
    return { user: null, session: null, error: 'USE_FALLBACK' };
  } catch (err: any) {
    return { user: null, session: null, error: err?.message || 'USE_FALLBACK' };
  }
}

/**
 * Register a new user with email and password via Supabase Auth
 */
export async function supabaseSignUp(
  email: string,
  password: string,
  username?: string
): Promise<{ user: SupabaseUser | null; session: AuthSession | null; error?: string }> {
  try {
    const cleanEmail = email.trim().toLowerCase();
    const res = await fetch(`${AUTH_URL}/signup`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        email: cleanEmail,
        password: password,
        data: {
          username: username?.trim() || cleanEmail.split('@')[0],
          full_name: username?.trim() || cleanEmail.split('@')[0],
        },
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      const msg = data.msg || data.error_description || data.message || 'فشل في إنشاء الحساب';
      return { user: null, session: null, error: msg };
    }

    if (data.access_token) {
      await saveSession(data, 'email');
      return { user: data.user, session: data };
    } else if (data.user) {
      await AsyncStorage.setItem(AUTH_USER_KEY, JSON.stringify(data.user));
      await AsyncStorage.setItem('@mizan_username', username || cleanEmail.split('@')[0]);
      await AsyncStorage.setItem('@mizan_user_id', data.user.id);
      return { user: data.user, session: null };
    }

    return { user: null, session: null, error: 'استجابة غير متوقعة من خادم المصادقة' };
  } catch (err: any) {
    return { user: null, session: null, error: err?.message || 'تعذر الاتصال بخادم المصادقة' };
  }
}

/**
 * Sign in existing user with email and password
 */
export async function supabaseSignIn(
  email: string,
  password: string
): Promise<{ user: SupabaseUser | null; session: AuthSession | null; error?: string }> {
  try {
    const cleanEmail = email.trim().toLowerCase();
    const res = await fetch(`${AUTH_URL}/token?grant_type=password`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        email: cleanEmail,
        password: password,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      const msg = data.error_description || data.msg || data.message || 'بيانات الدخول غير صحيحة';
      return { user: null, session: null, error: msg };
    }

    if (data.access_token && data.user) {
      await saveSession(data, 'email');
      return { user: data.user, session: data };
    }

    return { user: null, session: null, error: 'تعذر تسجيل الدخول، يرجى المحاولة مرة أخرى' };
  } catch (err: any) {
    return { user: null, session: null, error: err?.message || 'خطأ في الاتصال بالإنترنت' };
  }
}

/**
 * Send password reset email
 */
export async function supabaseResetPassword(email: string): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(`${AUTH_URL}/recover`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        email: email.trim().toLowerCase(),
      }),
    });

    if (!res.ok) {
      const data = await res.json();
      const msg = data.msg || data.message || data.error_description || 'فشل إرسال رابط استعادة كلمة المرور';
      return { success: false, error: msg };
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'خطأ في الاتصال' };
  }
}

/**
 * Refresh access token using refresh token
 */
export async function supabaseRefreshToken(): Promise<AuthSession | null> {
  try {
    const refreshToken = await AsyncStorage.getItem(REFRESH_TOKEN_KEY);
    if (!refreshToken) return null;

    const res = await fetch(`${AUTH_URL}/token?grant_type=refresh_token`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        refresh_token: refreshToken,
      }),
    });

    if (!res.ok) {
      return null;
    }

    const data = await res.json();
    if (data.access_token && data.user) {
      const currentProvider = (await AsyncStorage.getItem(AUTH_PROVIDER_KEY)) || 'email';
      await saveSession(data, currentProvider);
      return data;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Fast Local Offline / Guest Sign-In
 */
export async function signInAsLocalGuest(customName?: string): Promise<SupabaseUser> {
  const existingUserId = await AsyncStorage.getItem('@mizan_user_id');
  const guestId = existingUserId || `local_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const displayName = customName?.trim() || 'حساب محلي';

  const guestUser: SupabaseUser = {
    id: guestId,
    email: 'local@mizan.app',
    user_metadata: {
      full_name: displayName,
      username: displayName,
      provider: 'local',
    },
    is_local: true,
  };

  await AsyncStorage.setItem(AUTH_USER_KEY, JSON.stringify(guestUser));
  await AsyncStorage.setItem('@mizan_username', displayName);
  await AsyncStorage.setItem('@mizan_user_id', guestId);
  await AsyncStorage.setItem(AUTH_PROVIDER_KEY, 'local');
  await AsyncStorage.setItem(IS_GUEST_KEY, 'true');

  return guestUser;
}

/**
 * Get the currently logged-in user from local storage
 */
export async function getCurrentUser(): Promise<SupabaseUser | null> {
  try {
    const userData = await AsyncStorage.getItem(AUTH_USER_KEY);
    if (!userData) return null;
    return JSON.parse(userData);
  } catch {
    return null;
  }
}

/**
 * Save auth session to persistent storage
 */
export async function saveSession(session: AuthSession, provider: string = 'email'): Promise<void> {
  if (session.access_token) {
    await AsyncStorage.setItem(AUTH_TOKEN_KEY, session.access_token);
  }
  if (session.refresh_token) {
    await AsyncStorage.setItem(REFRESH_TOKEN_KEY, session.refresh_token);
  }
  if (session.user) {
    await AsyncStorage.setItem(AUTH_USER_KEY, JSON.stringify(session.user));
    const username =
      session.user.user_metadata?.username ||
      session.user.user_metadata?.full_name ||
      session.user.user_metadata?.name ||
      session.user.email?.split('@')[0] ||
      'مستخدم ميزان';

    await AsyncStorage.setItem('@mizan_username', username);
    await AsyncStorage.setItem('@mizan_user_id', session.user.id);
    await AsyncStorage.setItem(AUTH_PROVIDER_KEY, provider);
    await AsyncStorage.removeItem(IS_GUEST_KEY);
  }
}

/**
 * Sign out and clear stored session tokens
 */
export async function supabaseSignOut(): Promise<void> {
  try {
    const token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
    if (token) {
      fetch(`${AUTH_URL}/logout`, {
        method: 'POST',
        headers: getAuthHeaders(token),
      }).catch(() => {});
    }
  } catch {}

  await AsyncStorage.multiRemove([
    AUTH_TOKEN_KEY,
    REFRESH_TOKEN_KEY,
    AUTH_USER_KEY,
    AUTH_PROVIDER_KEY,
    IS_GUEST_KEY,
    '@mizan_user_id',
    '@mizan_username',
    '@masarif_user_id',
    '@masarif_username',
  ]);
}
