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
import { useTheme } from '@/lib/ThemeContext';
import { useLanguage } from '@/lib/LanguageContext';
import { apiRequest } from '@/lib/query-client';
import { performLogin } from '@/lib/syncService';

export default function AuthScreen() {
  const { colors, theme } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const { language, t } = useLanguage();
  
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleAuth = async () => {
    if (!username.trim() || !password.trim()) {
      Alert.alert(
        language === 'ar' ? 'خطأ' : 'Error',
        language === 'ar' ? 'يرجى إدخال اسم المستخدم وكلمة المرور' : 'Username and password are required'
      );
      return;
    }

    if (!isLogin && password !== confirmPassword) {
      Alert.alert(
        language === 'ar' ? 'خطأ' : 'Error',
        language === 'ar' ? 'كلمات المرور غير متطابقة!' : 'Passwords do not match!'
      );
      return;
    }

    setLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';
      const response = await apiRequest('POST', endpoint, {
        username: username.trim(),
        password: password,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Request failed');
      }

      const userData = await response.json();
      await performLogin(userData.username, userData.id);

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        language === 'ar' ? 'نجاح' : 'Success',
        isLogin 
          ? (language === 'ar' ? 'تم تسجيل الدخول بنجاح!' : 'Logged in successfully!')
          : (language === 'ar' ? 'تم إنشاء الحساب بنجاح!' : 'Account created successfully!'),
        [
          {
            text: language === 'ar' ? 'موافق' : 'OK',
            onPress: () => router.replace('/'),
          },
        ]
      );
    } catch (e: any) {
      console.error(e);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(
        language === 'ar' ? 'خطأ' : 'Error',
        e.message || (language === 'ar' ? 'حدث خطأ غير متوقع' : 'An unexpected error occurred')
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <View style={styles.content}>
        {/* Back Button */}
        <Pressable
          onPress={() => {
            Haptics.selectionAsync();
            router.back();
          }}
          style={styles.backButton}
        >
          <Ionicons name={language === 'ar' ? 'arrow-forward' : 'arrow-back'} size={24} color={colors.textSecondary} />
        </Pressable>

        {/* Brand Header */}
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <Ionicons name="cloud-upload" size={40} color={colors.primary} />
          </View>
          <Text style={styles.appName}>MIZAN · مِيزان</Text>
          <Text style={styles.subtitle}>
            {language === 'ar' 
              ? 'مزامنة سحابية آمنة لمحفظتك وبياناتك المالية' 
              : 'Secure cloud synchronization for your personal finance'}
          </Text>
        </View>

        {/* Glassmorphic Form Card */}
        <View style={styles.formCard}>
          <Text style={styles.formTitle}>
            {isLogin 
              ? (language === 'ar' ? 'تسجيل الدخول' : 'Sign In')
              : (language === 'ar' ? 'إنشاء حساب جديد' : 'Sign Up')}
          </Text>

          {/* Username Input */}
          <View style={styles.inputContainer}>
            <Ionicons name="person-outline" size={20} color={colors.textTertiary} style={styles.inputIcon} />
            <TextInput
              value={username}
              onChangeText={setUsername}
              placeholder={language === 'ar' ? 'اسم المستخدم' : 'Username'}
              placeholderTextColor={colors.textTertiary}
              style={[styles.input, language === 'ar' ? styles.inputAr : styles.inputEn]}
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
              placeholder={language === 'ar' ? 'كلمة المرور' : 'Password'}
              placeholderTextColor={colors.textTertiary}
              secureTextEntry={!showPassword}
              style={[styles.input, language === 'ar' ? styles.inputAr : styles.inputEn]}
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
                placeholder={language === 'ar' ? 'تأكيد كلمة المرور' : 'Confirm Password'}
                placeholderTextColor={colors.textTertiary}
                secureTextEntry={!showPassword}
                style={[styles.input, language === 'ar' ? styles.inputAr : styles.inputEn]}
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
                  ? (language === 'ar' ? 'دخول' : 'Sign In')
                  : (language === 'ar' ? 'تسجيل الحساب' : 'Sign Up')}
              </Text>
            )}
          </Pressable>

          {/* Switch mode */}
          <Pressable
            onPress={() => {
              Haptics.selectionAsync();
              setIsLogin(!isLogin);
              setPassword('');
              setConfirmPassword('');
            }}
            style={styles.switchModeContainer}
          >
            <Text style={styles.switchModeText}>
              {isLogin
                ? (language === 'ar' ? 'ليس لديك حساب؟ سجل الآن' : "Don't have an account? Sign Up")
                : (language === 'ar' ? 'لديك حساب بالفعل؟ سجل دخولك' : 'Already have an account? Sign In')}
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
    color: '#FFF',
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
    borderColor: 'rgba(255, 255, 255, 0.04)',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
  },
  formTitle: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 18,
    color: '#FFF',
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
    color: '#FFF',
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
