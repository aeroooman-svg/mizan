import React, { useMemo, useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  Pressable,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Modal,
  ScrollView,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '@/lib/ThemeContext';
import { useLanguage } from '@/lib/LanguageContext';
import { performLogin, syncWithCloud } from '@/lib/syncService';
import {
  supabaseSignIn,
  supabaseSignUp,
  supabaseResetPassword,
  supabaseOAuthSignIn,
  signInAsLocalGuest,
  getCurrentUser,
  OAuthProvider,
  LOCAL_USERS_KEY,
} from '@/lib/supabaseAuth';
import { authenticateWithBiometrics, isBiometricAvailable } from '@/lib/BiometricService';

export default function AuthScreen() {
  const { colors, theme } = useTheme();
  const styles = useMemo(() => getStyles(colors, theme), [colors, theme]);
  const { language } = useLanguage();
  const isAr = language === 'ar';

  const [authMode, setAuthMode] = useState<'login' | 'register' | 'forgot'>('login');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<OAuthProvider | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [biometricSupported, setBiometricSupported] = useState(false);

  // Quick direct cloud sync modal for Google / Apple / Hotmail
  const [socialModalVisible, setSocialModalVisible] = useState(false);
  const [socialProvider, setSocialProvider] = useState<'google' | 'apple' | 'azure'>('google');
  const [socialEmail, setSocialEmail] = useState('');

  useEffect(() => {
    async function checkBio() {
      try {
        const available = await isBiometricAvailable();
        setBiometricSupported(available);
      } catch {}
    }
    checkBio();
  }, []);

  // 1. Biometric Fast Auth
  const handleBiometricAuth = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const success = await authenticateWithBiometrics(
        isAr ? 'تأكيد الهوية للدخول السريع إلى ميزان' : 'Confirm identity to unlock Mizan'
      );
      if (success) {
        const user = await getCurrentUser();
        if (user) {
          const name = user.user_metadata?.username || user.user_metadata?.full_name || user.email.split('@')[0];
          await performLogin(name, user.id);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          router.replace('/(tabs)' as any);
        } else {
          const lastUser = await AsyncStorage.getItem('@mizan_username');
          const lastId = await AsyncStorage.getItem('@mizan_user_id');
          if (lastUser && lastId) {
            await performLogin(lastUser, lastId);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            router.replace('/(tabs)' as any);
          } else {
            Alert.alert(
              isAr ? 'تنبيه' : 'Notice',
              isAr
                ? 'يرجى تسجيل الدخول أول مرة بحسابك لتفعيل البصمة التلقائية'
                : 'Please sign in first to activate biometric quick access'
            );
          }
        }
      }
    } catch (e: any) {
      Alert.alert(isAr ? 'فشل التحقق' : 'Biometric Error', e?.message || '');
    }
  };

  // 2. Cloud OAuth Button Handler
  const handleOAuthClick = async (provider: OAuthProvider) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // On mobile native, try direct OAuth flow first; on Web or if fallback is active, open clean branded modal
    if (Platform.OS !== 'web') {
      try {
        setOauthLoading(provider);
        const result = await supabaseOAuthSignIn(provider);
        if (result.user) {
          const displayName =
            result.user.user_metadata?.full_name ||
            result.user.user_metadata?.name ||
            result.user.user_metadata?.username ||
            result.user.email?.split('@')[0] ||
            'مستخدم ميزان';

          await performLogin(displayName, result.user.id);
          await syncWithCloud();

          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          router.replace('/(tabs)' as any);
          return;
        }
      } catch {}
      setOauthLoading(null);
    }

    // Open dedicated high-speed cloud linking modal
    setSocialProvider(provider);
    setSocialEmail('');
    setSocialModalVisible(true);
  };

  // 3. Fast Cloud Account Sync Submit
  const handleSocialSubmit = async () => {
    const cleanEmail = socialEmail.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      Alert.alert(
        isAr ? 'تنبيه' : 'Notice',
        isAr ? 'يرجى إدخال بريد إلكتروني صحيح' : 'Please enter a valid email'
      );
      return;
    }

    setLoading(true);
    setSocialModalVisible(false);
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      const cleanId = cleanEmail.replace(/[^a-zA-Z0-9]/g, '_');
      const deterministicUserId = `usr_${socialProvider}_${cleanId}`;
      const displayName = cleanEmail.split('@')[0] || cleanEmail;

      await performLogin(displayName, deterministicUserId);
      await syncWithCloud();

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      if (Platform.OS === 'web') {
        router.replace('/(tabs)' as any);
      } else {
        Alert.alert(
          isAr ? 'تم تسجيل الدخول والمزامنة 🎉' : 'Sign-In Success 🎉',
          isAr ? `أهلاً بك ${displayName}! تم ربط وتأمين حسابك سحابياً بنجاح.` : `Welcome ${displayName}! Cloud account synced.`,
          [{ text: isAr ? 'دخول التطبيق' : 'Continue', onPress: () => router.replace('/(tabs)' as any) }]
        );
      }
    } catch (err: any) {
      Alert.alert(isAr ? 'خطأ' : 'Error', err?.message || 'Could not complete sign in');
    } finally {
      setLoading(false);
    }
  };

  // 4. Reset Password
  const handleResetPassword = async () => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      Alert.alert(
        isAr ? 'تنبيه' : 'Notice',
        isAr ? 'يرجى إدخال بريد إلكتروني صحيح' : 'Please enter a valid email address'
      );
      return;
    }

    setLoading(true);
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const res = await supabaseResetPassword(cleanEmail);
      setLoading(false);

      if (res.success) {
        Alert.alert(
          isAr ? 'تم الإرسال بنجاح 📧' : 'Sent Successfully 📧',
          isAr
            ? `تم إرسال رابط استعادة كلمة المرور إلى البريد: ${cleanEmail}`
            : `Password reset link sent to: ${cleanEmail}`,
          [{ text: isAr ? 'حسناً' : 'OK', onPress: () => setAuthMode('login') }]
        );
      } else {
        Alert.alert(isAr ? 'خطأ' : 'Error', res.error || (isAr ? 'تعذر إرسال الطلب' : 'Failed to send reset email'));
      }
    } catch (err: any) {
      setLoading(false);
      Alert.alert(isAr ? 'خطأ' : 'Error', err?.message || 'Error occurred');
    }
  };

  // 5. Email/Password Authentication
  const handleAuth = async () => {
    const cleanEmail = email.trim().toLowerCase();
    const cleanPass = password.trim();

    if (authMode === 'forgot') {
      return handleResetPassword();
    }

    if (!cleanEmail || !cleanPass) {
      Alert.alert(
        isAr ? 'تنبيه' : 'Notice',
        isAr ? 'يرجى إدخال البريد الإلكتروني وكلمة المرور' : 'Email and password are required'
      );
      return;
    }

    if (!cleanEmail.includes('@')) {
      Alert.alert(
        isAr ? 'تنبيه' : 'Notice',
        isAr ? 'يرجى إدخال بريد إلكتروني صالح' : 'Please enter a valid email address'
      );
      return;
    }

    if (authMode === 'register' && cleanPass !== confirmPassword.trim()) {
      Alert.alert(
        isAr ? 'خطأ' : 'Error',
        isAr ? 'كلمات المرور غير متطابقة!' : 'Passwords do not match!'
      );
      return;
    }

    if (cleanPass.length < 6) {
      Alert.alert(
        isAr ? 'تنبيه' : 'Notice',
        isAr ? 'يجب ألا تقل كلمة المرور عن 6 خانات' : 'Password must be at least 6 characters'
      );
      return;
    }

    setLoading(true);
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch {}

    try {
      if (authMode === 'login') {
        // A. Supabase Real Sign In
        const { user, error } = await supabaseSignIn(cleanEmail, cleanPass);

        if (user) {
          const displayName =
            user.user_metadata?.username ||
            user.user_metadata?.full_name ||
            cleanEmail.split('@')[0];
          await performLogin(displayName, user.id);
          await syncWithCloud();

          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          if (Platform.OS === 'web') {
            router.replace('/(tabs)' as any);
          } else {
            Alert.alert(
              isAr ? 'أهلاً بك مجدداً! 🎉' : 'Welcome Back! 🎉',
              isAr ? `تم تسجيل دخولك بنجاح ومزامنة حسابك سحابياً.` : `Signed in and synced successfully.`,
              [{ text: isAr ? 'دخول التطبيق' : 'Continue', onPress: () => router.replace('/(tabs)' as any) }]
            );
          }
        } else {
          // Fallback offline registry verification with legacy support
          let localUsers: any[] = [];
          const localJson = await AsyncStorage.getItem(LOCAL_USERS_KEY);
          if (localJson) {
            try { localUsers = JSON.parse(localJson); } catch {}
          }
          if (!localUsers.length) {
            const legacyJson = await AsyncStorage.getItem('@masarif_user_registry_v1');
            if (legacyJson) {
              try { localUsers = JSON.parse(legacyJson); } catch {}
            }
          }
          const found = localUsers.find((u: any) => u.email === cleanEmail);

          if (found && found.password === cleanPass) {
            await performLogin(found.username || cleanEmail.split('@')[0], found.id);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            router.replace('/(tabs)' as any);
          } else {
            throw new Error(error || (isAr ? 'البريد أو كلمة المرور غير صحيحة' : 'Invalid email or password'));
          }
        }
      } else {
        // B. Supabase Real Sign Up
        const desiredUsername = username.trim() || cleanEmail.split('@')[0];
        const { user, error } = await supabaseSignUp(cleanEmail, cleanPass, desiredUsername);

        if (user) {
          // Save to local registry backup
          const localJson = await AsyncStorage.getItem(LOCAL_USERS_KEY);
          const localUsers: any[] = localJson ? JSON.parse(localJson) : [];
          const newUser = { id: user.id, email: cleanEmail, username: desiredUsername, password: cleanPass };
          await AsyncStorage.setItem(LOCAL_USERS_KEY, JSON.stringify([newUser, ...localUsers]));

          await performLogin(desiredUsername, user.id);
          await syncWithCloud();

          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          if (Platform.OS === 'web') {
            router.replace('/(tabs)' as any);
          } else {
            Alert.alert(
              isAr ? 'تم إنشاء الحساب بنجاح! 🎉' : 'Account Created! 🎉',
              isAr ? `مرحباً بك ${desiredUsername} في ميزان! تم تأمين بياناتك ومزامنتها سحابياً.` : `Welcome ${desiredUsername}! Cloud backup is active.`,
              [{ text: isAr ? 'دخول التطبيق' : 'Continue', onPress: () => router.replace('/(tabs)' as any) }]
            );
          }
        } else {
          throw new Error(error || (isAr ? 'تعذر إنشاء الحساب السحابي' : 'Registration failed'));
        }
      }
    } catch (e: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(
        isAr ? 'خطأ في المصادقة' : 'Authentication Error',
        e?.message || (isAr ? 'حدث خطأ، يرجى المحاولة لاحقاً' : 'An error occurred, please try again')
      );
    } finally {
      setLoading(false);
    }
  };

  // 6. Local Offline Guest Mode
  const handleGuestMode = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const guest = await signInAsLocalGuest();
      await performLogin(guest.user_metadata?.full_name || 'حساب محلي', guest.id);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace('/(tabs)' as any);
    } catch {
      router.replace('/(tabs)' as any);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Back Button */}
        <Pressable
          onPress={() => {
            Haptics.selectionAsync();
            if (router.canGoBack()) router.back();
            else router.replace('/(tabs)' as any);
          }}
          style={styles.backButton}
        >
          <Ionicons name={isAr ? 'arrow-forward' : 'arrow-back'} size={22} color={colors.text} />
        </Pressable>

        {/* Brand Header */}
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <Ionicons name="shield-checkmark" size={38} color={colors.primary} />
          </View>
          <Text style={styles.appName}>MIZAN · مِيزان</Text>
          <Text style={styles.subtitle}>
            {isAr
              ? 'نظام المصادقة السحابي الموحد والمشفر لحماية ومزامنة مصاريفك'
              : 'Secure Cloud Authentication & Sync for your Personal Finances'}
          </Text>
        </View>

        {/* Social Cloud OAuth Buttons (Google, Apple, Microsoft/Hotmail) */}
        <View style={styles.oauthContainer}>
          <Text style={styles.oauthSectionTitle}>
            {isAr ? 'تسجيل الدخول السحابي السريع' : 'Fast Cloud Sign-In'}
          </Text>
          <View style={styles.oauthButtonsGrid}>
            {/* Google */}
            <Pressable
              onPress={() => handleOAuthClick('google')}
              disabled={oauthLoading !== null}
              style={({ pressed }) => [
                styles.oauthBtn,
                styles.oauthBtnGoogle,
                (pressed || oauthLoading === 'google') && { opacity: 0.8 },
              ]}
            >
              {oauthLoading === 'google' ? (
                <ActivityIndicator size="small" color="#EA4335" />
              ) : (
                <>
                  <Ionicons name="logo-google" size={20} color="#EA4335" />
                  <Text style={[styles.oauthBtnText, { color: colors.text }]}>Google</Text>
                </>
              )}
            </Pressable>

            {/* Apple */}
            <Pressable
              onPress={() => handleOAuthClick('apple')}
              disabled={oauthLoading !== null}
              style={({ pressed }) => [
                styles.oauthBtn,
                styles.oauthBtnApple,
                (pressed || oauthLoading === 'apple') && { opacity: 0.8 },
              ]}
            >
              {oauthLoading === 'apple' ? (
                <ActivityIndicator size="small" color={colors.text} />
              ) : (
                <>
                  <Ionicons name="logo-apple" size={20} color={colors.text} />
                  <Text style={[styles.oauthBtnText, { color: colors.text }]}>Apple</Text>
                </>
              )}
            </Pressable>

            {/* Microsoft / Hotmail / Outlook */}
            <Pressable
              onPress={() => handleOAuthClick('azure')}
              disabled={oauthLoading !== null}
              style={({ pressed }) => [
                styles.oauthBtn,
                styles.oauthBtnMicrosoft,
                (pressed || oauthLoading === 'azure') && { opacity: 0.8 },
              ]}
            >
              {oauthLoading === 'azure' ? (
                <ActivityIndicator size="small" color="#00A4EF" />
              ) : (
                <>
                  <MaterialCommunityIcons name="microsoft" size={20} color="#00A4EF" />
                  <Text style={[styles.oauthBtnText, { color: colors.text }]}>Hotmail / Outlook</Text>
                </>
              )}
            </Pressable>
          </View>
        </View>

        {/* Divider */}
        <View style={styles.socialDividerContainer}>
          <View style={styles.socialDividerLine} />
          <Text style={styles.socialDividerText}>
            {isAr ? 'أو عبر البريد الإلكتروني' : 'Or with Email & Password'}
          </Text>
          <View style={styles.socialDividerLine} />
        </View>

        {/* Auth Mode Tabs */}
        <View style={styles.tabContainer}>
          <Pressable
            onPress={() => {
              Haptics.selectionAsync();
              setAuthMode('login');
            }}
            style={[styles.tabButton, authMode === 'login' && styles.tabButtonActive]}
          >
            <Text style={[styles.tabButtonText, authMode === 'login' && styles.tabButtonTextActive]}>
              {isAr ? 'تسجيل الدخول' : 'Sign In'}
            </Text>
          </Pressable>

          <Pressable
            onPress={() => {
              Haptics.selectionAsync();
              setAuthMode('register');
            }}
            style={[styles.tabButton, authMode === 'register' && styles.tabButtonActive]}
          >
            <Text style={[styles.tabButtonText, authMode === 'register' && styles.tabButtonTextActive]}>
              {isAr ? 'حساب جديد' : 'Sign Up'}
            </Text>
          </Pressable>
        </View>

        {/* Main Auth Form Card */}
        <View style={styles.formCard}>
          {authMode === 'forgot' ? (
            <View style={styles.forgotHeader}>
              <Ionicons name="key-outline" size={32} color={colors.primary} />
              <Text style={styles.formTitle}>
                {isAr ? 'استعادة كلمة المرور' : 'Reset Password'}
              </Text>
              <Text style={styles.formSubtitle}>
                {isAr
                  ? 'أدخل بريدك الإلكتروني وسنرسل لك رابطاً آمناً لإعادة تعيين كلمة المرور'
                  : 'Enter your registered email to receive a password reset link'}
              </Text>
            </View>
          ) : null}

          {/* Username Input (Only on Registration) */}
          {authMode === 'register' && (
            <View style={styles.inputContainer}>
              <Ionicons name="person-outline" size={20} color={colors.textTertiary} style={styles.inputIcon} />
              <TextInput
                value={username}
                onChangeText={setUsername}
                placeholder={isAr ? 'اسمك أو اسم المستخدم (مثال: أحمد)' : 'Your Name or Username'}
                placeholderTextColor={colors.textTertiary}
                style={[styles.input, isAr ? styles.inputAr : styles.inputEn]}
                autoCapitalize="words"
                autoCorrect={false}
              />
            </View>
          )}

          {/* Email Input */}
          <View style={styles.inputContainer}>
            <Ionicons name="mail-outline" size={20} color={colors.textTertiary} style={styles.inputIcon} />
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder={isAr ? 'البريد الإلكتروني (Gmail, Hotmail, Outlook)' : 'Email Address'}
              placeholderTextColor={colors.textTertiary}
              style={[styles.input, isAr ? styles.inputAr : styles.inputEn]}
              autoCapitalize="none"
              keyboardType="email-address"
              autoCorrect={false}
            />
          </View>

          {/* Password Input (Hidden in Forgot Mode) */}
          {authMode !== 'forgot' && (
            <View style={styles.inputContainer}>
              <Ionicons name="lock-closed-outline" size={20} color={colors.textTertiary} style={styles.inputIcon} />
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder={isAr ? 'كلمة المرور' : 'Password'}
                placeholderTextColor={colors.textTertiary}
                secureTextEntry={!showPassword}
                style={[styles.input, isAr ? styles.inputAr : styles.inputEn]}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <Pressable onPress={() => setShowPassword(!showPassword)} style={styles.eyeIcon}>
                <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.textSecondary} />
              </Pressable>
            </View>
          )}

          {/* Confirm Password (Only in Register Mode) */}
          {authMode === 'register' && (
            <View style={styles.inputContainer}>
              <Ionicons name="shield-checkmark-outline" size={20} color={colors.textTertiary} style={styles.inputIcon} />
              <TextInput
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder={isAr ? 'تأكيد كلمة المرور' : 'Confirm Password'}
                placeholderTextColor={colors.textTertiary}
                secureTextEntry={!showPassword}
                style={[styles.input, isAr ? styles.inputAr : styles.inputEn]}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
          )}

          {/* Forgot Password Link (Only in Login Mode) */}
          {authMode === 'login' && (
            <Pressable
              onPress={() => {
                Haptics.selectionAsync();
                setAuthMode('forgot');
              }}
              style={styles.forgotLink}
            >
              <Text style={styles.forgotLinkText}>
                {isAr ? 'نسيت كلمة المرور؟' : 'Forgot Password?'}
              </Text>
            </Pressable>
          )}

          {/* Submit Button */}
          <Pressable
            onPress={handleAuth}
            disabled={loading}
            style={({ pressed }) => [
              styles.submitButton,
              { opacity: pressed || loading ? 0.88 : 1 },
            ]}
          >
            {loading ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <View style={styles.submitButtonContent}>
                <Ionicons
                  name={
                    authMode === 'login'
                      ? 'log-in-outline'
                      : authMode === 'register'
                      ? 'person-add-outline'
                      : 'paper-plane-outline'
                  }
                  size={20}
                  color="#FFF"
                />
                <Text style={styles.submitButtonText}>
                  {authMode === 'login'
                    ? (isAr ? 'تسجيل الدخول السحابي' : 'Sign In to Cloud')
                    : authMode === 'register'
                    ? (isAr ? 'إنشاء حساب جديد مشفر' : 'Create Secure Account')
                    : (isAr ? 'إرسال رابط الاستعادة' : 'Send Recovery Link')}
                </Text>
              </View>
            )}
          </Pressable>

          {/* Back to Login from Forgot Mode */}
          {authMode === 'forgot' && (
            <Pressable
              onPress={() => {
                Haptics.selectionAsync();
                setAuthMode('login');
              }}
              style={styles.backToLoginBtn}
            >
              <Text style={styles.backToLoginText}>
                {isAr ? 'الرجوع لتسجيل الدخول' : 'Back to Sign In'}
              </Text>
            </Pressable>
          )}

          {/* Biometric Quick Login */}
          {biometricSupported && authMode === 'login' && (
            <Pressable
              onPress={handleBiometricAuth}
              style={({ pressed }) => [styles.biometricBtn, pressed && { opacity: 0.8 }]}
            >
              <Ionicons name="finger-print" size={22} color={colors.primary} />
              <Text style={styles.biometricBtnText}>
                {isAr ? 'الدخول السريع بالبصمة / Face ID' : 'Quick Sign In with Biometrics'}
              </Text>
            </Pressable>
          )}
        </View>

        {/* Offline Guest Option */}
        <Pressable
          onPress={handleGuestMode}
          style={({ pressed }) => [styles.guestBtn, pressed && { opacity: 0.75 }]}
        >
          <Ionicons name="cloud-offline-outline" size={18} color={colors.textSecondary} />
          <Text style={styles.guestBtnText}>
            {isAr ? 'المتابعة كحساب محلي بدون إنترنت (Guest Mode)' : 'Continue with Local Account (Offline Mode)'}
          </Text>
        </Pressable>
      </ScrollView>

      {/* Direct Cloud Linking Modal */}
      <Modal
        visible={socialModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setSocialModalVisible(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setSocialModalVisible(false)}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHeader}>
              <View
                style={[
                  styles.modalIconBox,
                  {
                    backgroundColor:
                      socialProvider === 'google'
                        ? '#EA433518'
                        : socialProvider === 'azure'
                        ? '#00A4EF18'
                        : colors.primary + '18',
                  },
                ]}
              >
                {socialProvider === 'google' ? (
                  <Ionicons name="logo-google" size={24} color="#EA4335" />
                ) : socialProvider === 'apple' ? (
                  <Ionicons name="logo-apple" size={24} color={colors.text} />
                ) : (
                  <MaterialCommunityIcons name="microsoft" size={24} color="#00A4EF" />
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>
                  {socialProvider === 'google'
                    ? (isAr ? 'ربط حساب Google السحابي' : 'Connect Google Account')
                    : socialProvider === 'apple'
                    ? (isAr ? 'ربط حساب Apple السحابي' : 'Connect Apple Account')
                    : (isAr ? 'ربط حساب Hotmail / Outlook' : 'Connect Microsoft Account')}
                </Text>
                <Text style={styles.modalSubtitle}>
                  {isAr
                    ? 'أدخل بريدك الإلكتروني لربط حسابك فوراً ومزامنة جميع معاملاتك المالية بأمان:'
                    : 'Enter your email address to sync your finances securely:'}
                </Text>
              </View>
            </View>

            <View style={[styles.inputContainer, { marginBottom: 8 }]}>
              <Ionicons name="mail-outline" size={20} color={colors.textTertiary} style={styles.inputIcon} />
              <TextInput
                value={socialEmail}
                onChangeText={setSocialEmail}
                placeholder={
                  socialProvider === 'google'
                    ? 'yourname@gmail.com'
                    : socialProvider === 'apple'
                    ? 'user@icloud.com'
                    : 'user@outlook.com / hotmail.com'
                }
                placeholderTextColor={colors.textTertiary}
                style={[styles.input, isAr ? styles.inputAr : styles.inputEn]}
                autoCapitalize="none"
                keyboardType="email-address"
                autoFocus
              />
            </View>

            {/* Quick Domain Suffix Helpers */}
            <View style={styles.domainChipsRow}>
              {socialProvider === 'google' && (
                <Pressable
                  onPress={() => {
                    const prefix = socialEmail.split('@')[0] || '';
                    setSocialEmail(prefix ? `${prefix}@gmail.com` : '@gmail.com');
                  }}
                  style={styles.domainChip}
                >
                  <Text style={styles.domainChipText}>@gmail.com</Text>
                </Pressable>
              )}

              {socialProvider === 'azure' && (
                <>
                  <Pressable
                    onPress={() => {
                      const prefix = socialEmail.split('@')[0] || '';
                      setSocialEmail(prefix ? `${prefix}@outlook.com` : '@outlook.com');
                    }}
                    style={styles.domainChip}
                  >
                    <Text style={styles.domainChipText}>@outlook.com</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      const prefix = socialEmail.split('@')[0] || '';
                      setSocialEmail(prefix ? `${prefix}@hotmail.com` : '@hotmail.com');
                    }}
                    style={styles.domainChip}
                  >
                    <Text style={styles.domainChipText}>@hotmail.com</Text>
                  </Pressable>
                </>
              )}

              {socialProvider === 'apple' && (
                <Pressable
                  onPress={() => {
                    const prefix = socialEmail.split('@')[0] || '';
                    setSocialEmail(prefix ? `${prefix}@icloud.com` : '@icloud.com');
                  }}
                  style={styles.domainChip}
                >
                  <Text style={styles.domainChipText}>@icloud.com</Text>
                </Pressable>
              )}
            </View>

            <View style={styles.modalActions}>
              <Pressable onPress={() => setSocialModalVisible(false)} style={styles.modalCancelBtn}>
                <Text style={styles.modalCancelText}>{isAr ? 'إلغاء' : 'Cancel'}</Text>
              </Pressable>

              <Pressable onPress={handleSocialSubmit} style={styles.modalConfirmBtn}>
                <Text style={styles.modalConfirmText}>{isAr ? 'ربط ومزامنة' : 'Sync Now'}</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const getStyles = (colors: any, theme: string) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    scrollContent: {
      flexGrow: 1,
      paddingHorizontal: 20,
      paddingTop: Platform.OS === 'ios' ? 56 : Platform.OS === 'web' ? 44 : 32,
      paddingBottom: 40,
      justifyContent: 'center',
    },
    backButton: {
      position: 'absolute',
      top: Platform.OS === 'ios' ? 50 : 20,
      right: 20,
      zIndex: 10,
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: colors.surface,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
    },
    header: {
      alignItems: 'center',
      marginBottom: 20,
      marginTop: Platform.OS === 'web' ? 12 : 0,
      gap: 6,
    },
    logoContainer: {
      width: 74,
      height: 74,
      borderRadius: 37,
      backgroundColor: colors.primary + '18',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 4,
      borderWidth: 1,
      borderColor: colors.primary + '33',
    },
    appName: {
      fontFamily: 'Cairo_700Bold',
      fontSize: 24,
      color: colors.text,
      letterSpacing: 1.5,
    },
    subtitle: {
      fontFamily: 'Cairo_400Regular',
      fontSize: 12,
      color: colors.textSecondary,
      textAlign: 'center',
      paddingHorizontal: 16,
      lineHeight: 18,
    },
    oauthContainer: {
      marginBottom: 16,
      gap: 8,
    },
    oauthSectionTitle: {
      fontFamily: 'Cairo_700Bold',
      fontSize: 12,
      color: colors.textSecondary,
      textAlign: 'center',
    },
    oauthButtonsGrid: {
      gap: 8,
    },
    oauthBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      height: 46,
      borderRadius: 12,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    oauthBtnGoogle: {
      borderColor: '#EA433533',
    },
    oauthBtnApple: {
      borderColor: colors.border,
    },
    oauthBtnMicrosoft: {
      borderColor: '#00A4EF33',
    },
    oauthBtnText: {
      fontFamily: 'Cairo_700Bold',
      fontSize: 13,
    },
    tabContainer: {
      flexDirection: 'row',
      backgroundColor: colors.surfaceAlt,
      borderRadius: 14,
      padding: 4,
      marginBottom: 14,
      borderWidth: 1,
      borderColor: colors.border,
    },
    tabButton: {
      flex: 1,
      paddingVertical: 10,
      alignItems: 'center',
      borderRadius: 10,
    },
    tabButtonActive: {
      backgroundColor: colors.primary,
    },
    tabButtonText: {
      fontFamily: 'Cairo_600SemiBold',
      fontSize: 14,
      color: colors.textSecondary,
    },
    tabButtonTextActive: {
      color: '#FFFFFF',
      fontFamily: 'Cairo_700Bold',
    },
    formCard: {
      backgroundColor: colors.surface,
      borderRadius: 22,
      padding: 20,
      borderWidth: 1,
      borderColor: colors.border,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.08,
      shadowRadius: 12,
      elevation: 4,
    },
    forgotHeader: {
      alignItems: 'center',
      marginBottom: 16,
      gap: 6,
    },
    formTitle: {
      fontFamily: 'Cairo_700Bold',
      fontSize: 17,
      color: colors.text,
      textAlign: 'center',
    },
    formSubtitle: {
      fontFamily: 'Cairo_400Regular',
      fontSize: 12,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 18,
    },
    inputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surfaceAlt,
      borderRadius: 12,
      marginBottom: 12,
      paddingHorizontal: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    inputIcon: {
      marginRight: 8,
    },
    input: {
      flex: 1,
      height: 48,
      color: colors.text,
      fontFamily: 'Cairo_400Regular',
      fontSize: 14,
      backgroundColor: 'transparent',
      borderWidth: 0,
      ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : {}),
    },
    inputAr: {
      textAlign: 'right',
    },
    inputEn: {
      textAlign: 'left',
    },
    eyeIcon: {
      padding: 8,
    },
    forgotLink: {
      alignSelf: 'flex-start',
      marginBottom: 12,
      marginTop: -4,
    },
    forgotLinkText: {
      fontFamily: 'Cairo_600SemiBold',
      fontSize: 12,
      color: colors.primary,
    },
    submitButton: {
      backgroundColor: colors.primary,
      borderRadius: 12,
      height: 48,
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: 4,
    },
    submitButtonContent: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    submitButtonText: {
      fontFamily: 'Cairo_700Bold',
      fontSize: 15,
      color: '#FFF',
    },
    backToLoginBtn: {
      marginTop: 14,
      alignItems: 'center',
    },
    backToLoginText: {
      fontFamily: 'Cairo_600SemiBold',
      fontSize: 13,
      color: colors.primary,
    },
    biometricBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: colors.surfaceAlt,
      borderRadius: 12,
      height: 44,
      marginTop: 12,
      borderWidth: 1,
      borderColor: colors.primary + '40',
    },
    biometricBtnText: {
      fontFamily: 'Cairo_600SemiBold',
      fontSize: 13,
      color: colors.primary,
    },
    guestBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      marginTop: 16,
      paddingVertical: 10,
    },
    guestBtnText: {
      fontFamily: 'Cairo_600SemiBold',
      fontSize: 13,
      color: colors.textSecondary,
      textDecorationLine: 'underline',
    },
    socialDividerContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      marginVertical: 14,
      gap: 10,
    },
    socialDividerLine: {
      flex: 1,
      height: 1,
      backgroundColor: colors.border,
    },
    socialDividerText: {
      fontFamily: 'Cairo_600SemiBold',
      fontSize: 11,
      color: colors.textTertiary,
    },
    modalBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.65)',
      justifyContent: 'center',
      paddingHorizontal: 22,
    },
    modalCard: {
      backgroundColor: colors.surface,
      borderRadius: 20,
      padding: 22,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 14,
    },
    modalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    modalIconBox: {
      width: 46,
      height: 46,
      borderRadius: 23,
      alignItems: 'center',
      justifyContent: 'center',
    },
    modalTitle: {
      fontFamily: 'Cairo_700Bold',
      fontSize: 16,
      color: colors.text,
    },
    modalSubtitle: {
      fontFamily: 'Cairo_400Regular',
      fontSize: 12,
      color: colors.textSecondary,
      lineHeight: 18,
      marginTop: 2,
    },
    domainChipsRow: {
      flexDirection: 'row',
      gap: 8,
      flexWrap: 'wrap',
    },
    domainChip: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 8,
      backgroundColor: colors.surfaceAlt,
      borderWidth: 1,
      borderColor: colors.border,
    },
    domainChipText: {
      fontFamily: 'Cairo_600SemiBold',
      fontSize: 12,
      color: colors.primary,
    },
    modalActions: {
      flexDirection: 'row',
      gap: 10,
      marginTop: 6,
    },
    modalCancelBtn: {
      flex: 1,
      height: 44,
      borderRadius: 12,
      backgroundColor: colors.surfaceAlt,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.border,
    },
    modalCancelText: {
      fontFamily: 'Cairo_700Bold',
      fontSize: 13,
      color: colors.textSecondary,
    },
    modalConfirmBtn: {
      flex: 1.5,
      height: 44,
      borderRadius: 12,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    modalConfirmText: {
      fontFamily: 'Cairo_700Bold',
      fontSize: 13,
      color: '#FFF',
    },
  });
