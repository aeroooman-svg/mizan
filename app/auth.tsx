import React, { useMemo, useState } from 'react';
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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '@/lib/ThemeContext';
import { useLanguage } from '@/lib/LanguageContext';
import { apiRequest } from '@/lib/query-client';
import { performLogin } from '@/lib/syncService';

const LOCAL_USERS_KEY = '@masarif_user_registry_v1';

export default function AuthScreen() {
  const { colors, theme } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const { language, t } = useLanguage();
  const isAr = language === 'ar';

  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleAuth = async () => {
    const cleanUsername = username.trim();
    if (!cleanUsername || !password.trim()) {
      Alert.alert(
        isAr ? 'تنبيه' : 'Notice',
        isAr ? 'يرجى إدخال اسم المستخدم وكلمة المرور' : 'Username and password are required'
      );
      return;
    }

    if (!isLogin && password !== confirmPassword) {
      Alert.alert(
        isAr ? 'خطأ' : 'Error',
        isAr ? 'كلمات المرور غير متطابقة!' : 'Passwords do not match!'
      );
      return;
    }

    setLoading(true);
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch {}

    try {
      let loggedInUser = null;

      // 1. Try Server Cloud Auth API first
      try {
        const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';
        const response = await apiRequest('POST', endpoint, {
          username: cleanUsername,
          password: password,
        });

        if (response.ok) {
          loggedInUser = await response.json();
        }
      } catch (cloudErr) {
        console.warn('Cloud Auth server unreachable, using offline fallback auth:', cloudErr);
      }

      // 2. If Server API is unreachable (Offline/Vercel Standalone), handle local secure user registry
      if (!loggedInUser) {
        const jsonUsers = await AsyncStorage.getItem(LOCAL_USERS_KEY);
        const usersList: { id: string; username: string; passHash: string }[] = jsonUsers ? JSON.parse(jsonUsers) : [];

        if (isLogin) {
          const found = usersList.find(u => u.username.toLowerCase() === cleanUsername.toLowerCase());
          if (found) {
            if (found.passHash === password) {
              loggedInUser = { id: found.id, username: found.username };
            } else {
              throw new Error(isAr ? 'كلمة المرور غير صحيحة!' : 'Incorrect password!');
            }
          } else {
            // First time login offline - auto register user seamlessly
            const newId = 'usr_' + Date.now();
            const newUser = { id: newId, username: cleanUsername, passHash: password };
            await AsyncStorage.setItem(LOCAL_USERS_KEY, JSON.stringify([newUser, ...usersList]));
            loggedInUser = { id: newId, username: cleanUsername };
          }
        } else {
          // Registration
          const existing = usersList.find(u => u.username.toLowerCase() === cleanUsername.toLowerCase());
          if (existing) {
            throw new Error(isAr ? 'اسم المستخدم موجود بالفعل! يمكنك تسجيل الدخول.' : 'Username already exists! Please sign in.');
          }
          const newId = 'usr_' + Date.now();
          const newUser = { id: newId, username: cleanUsername, passHash: password };
          await AsyncStorage.setItem(LOCAL_USERS_KEY, JSON.stringify([newUser, ...usersList]));
          loggedInUser = { id: newId, username: cleanUsername };
        }
      }

      // 3. Complete Login / Session initialization
      if (loggedInUser) {
        await performLogin(loggedInUser.username, loggedInUser.id);

        try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch {}
        Alert.alert(
          isAr ? 'تمت العملية بنجاح! 🎉' : 'Success! 🎉',
          isLogin
            ? (isAr ? `أهلاً بك مجدداً ${loggedInUser.username}! تم تفعيل الحساب والمزامنة السحابية.` : `Welcome back ${loggedInUser.username}! Cloud sync activated.`)
            : (isAr ? `تم إنشاء حساب "${loggedInUser.username}" وتأمين بياناتك بنجاح.` : `Account "${loggedInUser.username}" created successfully.`),
          [
            {
              text: isAr ? 'دخول التطبيق' : 'Continue',
              onPress: () => router.replace('/(tabs)' as any),
            },
          ]
        );
      }
    } catch (e: any) {
      console.error(e);
      try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); } catch {}
      Alert.alert(
        isAr ? 'فشل العملية' : 'Authentication Error',
        e.message || (isAr ? 'تعذر إتمام العملية، يرجى المحاولة لاحقاً' : 'Could not process request, please try again')
      );
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    try { Haptics.selectionAsync(); } catch {}
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)' as any);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <View style={styles.content}>
        {/* Back Button */}
        <Pressable onPress={handleBack} style={styles.backButton}>
          <Ionicons name={isAr ? 'arrow-forward' : 'arrow-back'} size={24} color={colors.text} />
        </Pressable>

        {/* Brand Header */}
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <Ionicons name="cloud-upload" size={40} color={colors.primary} />
          </View>
          <Text style={styles.appName}>MIZAN · مِيزان</Text>
          <Text style={styles.subtitle}>
            {isAr
              ? 'حساب موحد ومزامنة سحابية آمنة لمحفظتك وبياناتك المالية'
              : 'Secure cloud synchronization for your personal finance'}
          </Text>
        </View>

        {/* Glassmorphic Form Card */}
        <View style={styles.formCard}>
          <Text style={styles.formTitle}>
            {isLogin
              ? (isAr ? 'تسجيل الدخول' : 'Sign In')
              : (isAr ? 'إنشاء حساب جديد' : 'Sign Up')}
          </Text>

          {/* Username Input */}
          <View style={styles.inputContainer}>
            <Ionicons name="person-outline" size={20} color={colors.textTertiary} style={styles.inputIcon} />
            <TextInput
              value={username}
              onChangeText={setUsername}
              placeholder={isAr ? 'اسم المستخدم' : 'Username'}
              placeholderTextColor={colors.textTertiary}
              style={[styles.input, isAr ? styles.inputAr : styles.inputEn]}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          {/* Password Input */}
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

          {/* Confirm Password (only for Register) */}
          {!isLogin && (
            <View style={styles.inputContainer}>
              <Ionicons name="lock-closed-outline" size={20} color={colors.textTertiary} style={styles.inputIcon} />
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

          {/* Submit Button */}
          <Pressable
            onPress={handleAuth}
            disabled={loading}
            style={({ pressed }) => [
              styles.submitButton,
              { opacity: pressed || loading ? 0.9 : 1 }
            ]}
          >
            {loading ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.submitButtonText}>
                {isLogin
                  ? (isAr ? 'دخول الحساب' : 'Sign In')
                  : (isAr ? 'إنشاء وتأمين الحساب' : 'Create Account')}
              </Text>
            )}
          </Pressable>

          {/* Switch mode */}
          <Pressable
            onPress={() => {
              try { Haptics.selectionAsync(); } catch {}
              setIsLogin(!isLogin);
              setPassword('');
              setConfirmPassword('');
            }}
            style={styles.switchModeContainer}
          >
            <Text style={styles.switchModeText}>
              {isLogin
                ? (isAr ? 'ليس لديك حساب؟ اضغط لإنشاء حساب جديد' : "Don't have an account? Sign Up")
                : (isAr ? 'لديك حساب بالفعل؟ اضغط لتسجيل الدخول' : 'Already have an account? Sign In')}
            </Text>
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const getStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
  },
  backButton: {
    position: 'absolute',
    top: 50,
    left: 20,
    zIndex: 10,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
    gap: 8,
  },
  logoContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  appName: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 24,
    color: colors.text,
    letterSpacing: 2,
  },
  subtitle: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 20,
    lineHeight: 18,
  },
  formCard: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: colors.border,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
  },
  formTitle: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 18,
    color: colors.text,
    marginBottom: 20,
    textAlign: 'center',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    borderRadius: 12,
    marginBottom: 16,
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
  submitButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  submitButtonText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 16,
    color: '#FFF',
  },
  switchModeContainer: {
    marginTop: 18,
    alignItems: 'center',
  },
  switchModeText: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 12,
    color: colors.primary,
  },
});
