import React, { useState, useEffect, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  ScrollView,
  Switch,
  ActivityIndicator,
  Alert,
  Platform,
  KeyboardAvoidingView,
  SafeAreaView,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useLanguage } from '@/lib/LanguageContext';
import { useTheme } from '@/lib/ThemeContext';
import { useSecurity } from '@/lib/SecurityContext';
import { useTransactions } from '@/lib/TransactionContext';
import { getLoggedInUser, performLogout, syncWithCloud } from '@/lib/syncService';
import { exportTransactionsToPDF } from '@/lib/pdfExporter';
import { exportTransactionsToCSV } from '@/lib/csvExporter';
import { createFullBackup, restoreFullBackup } from '@/lib/backupService';
import * as WebBrowser from 'expo-web-browser';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getAutoSmsSettings, setAutoSmsSettings, clearProcessedSmsHistory } from '@/lib/autoSmsListener';
import SmsAutomationGuideModal from '@/components/SmsAutomationGuideModal';
const safeHaptic = {
  selection: () => {
    try {
      Haptics.selectionAsync().catch(() => {});
    } catch (e) {}
  },
  impact: (style: Haptics.ImpactFeedbackStyle) => {
    try {
      Haptics.impactAsync(style).catch(() => {});
    } catch (e) {}
  },
  notification: (type: Haptics.NotificationFeedbackType) => {
    try {
      Haptics.notificationAsync(type).catch(() => {});
    } catch (e) {}
  }
};

export default function SettingsScreen() {
  const { colors, theme, setTheme } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const { language, setLanguage, t } = useLanguage();
  const isAr = language === 'ar';

  const {
    isPinEnabled,
    isBiometricEnabled,
    enablePin,
    disablePin,
    enableBiometrics,
  } = useSecurity();

  const { transactions, selectedWallet, refresh } = useTransactions();

  const [user, setUser] = useState<{ username: string; id: string } | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Custom PIN Modal States
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [pinStep, setPinStep] = useState<'enter' | 'confirm'>('enter');
  const [enteredPin, setEnteredPin] = useState('');
  const [confirmedPin, setConfirmedPin] = useState('');
  const [pinError, setPinError] = useState('');

  // Auto SMS Automation States
  const [autoSmsEnabled, setAutoSmsEnabledState] = useState(true);
  const [autoSmsAutoSave, setAutoSmsAutoSaveState] = useState(false);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [userGoal, setUserGoal] = useState<string>('saving');

  useEffect(() => {
    async function loadUserGoal() {
      try {
        const saved = await AsyncStorage.getItem('@mizan_user_goal');
        if (saved) setUserGoal(saved);
      } catch (e) {}
    }
    loadUserGoal();
  }, []);

  const handleGoalChange = async (goal: string) => {
    safeHaptic.selection();
    setUserGoal(goal);
    await AsyncStorage.setItem('@mizan_user_goal', goal);
  };

  useEffect(() => {
    async function loadAutoSmsSettings() {
      const s = await getAutoSmsSettings();
      setAutoSmsEnabledState(s.enabled);
      setAutoSmsAutoSaveState(s.autoSave);
    }
    loadAutoSmsSettings();
  }, []);

  const handleToggleAutoSms = async (value: boolean) => {
    safeHaptic.selection();
    setAutoSmsEnabledState(value);
    await setAutoSmsSettings({ enabled: value });
  };

  const handleToggleAutoSmsAutoSave = async (value: boolean) => {
    safeHaptic.selection();
    setAutoSmsAutoSaveState(value);
    await setAutoSmsSettings({ autoSave: value });
  };

  const handleClearSmsHistory = async () => {
    safeHaptic.notification(Haptics.NotificationFeedbackType.Warning);
    Alert.alert(
      isAr ? 'مسح سجل الرسائل' : 'Clear SMS History',
      isAr ? 'سيتم إعادة السماح بالتقاط الرسائل البنكية السابقة التي تم قراءتها.' : 'Reset processed SMS log so previously read SMS can be parsed again.',
      [
        { text: isAr ? 'إلغاء' : 'Cancel', style: 'cancel' },
        {
          text: isAr ? 'مسح' : 'Clear',
          onPress: async () => {
            await clearProcessedSmsHistory();
            safeHaptic.notification(Haptics.NotificationFeedbackType.Success);
            Alert.alert(isAr ? 'نجاح' : 'Success', isAr ? 'تم مسح سجل الرسائل بنجاح' : 'SMS log cleared');
          }
        }
      ]
    );
  };

  // Load user status
  useEffect(() => {
    async function checkUser() {
      const loggedUser = await getLoggedInUser();
      setUser(loggedUser);
    }
    checkUser();
  }, []);

  const handleToggleLanguage = async (lang: 'ar' | 'en') => {
    safeHaptic.selection();
    await setLanguage(lang);
  };

  const handleToggleTheme = async (mode: any) => {
    safeHaptic.selection();
    await setTheme(mode);
  };

  const handleSync = async () => {
    safeHaptic.impact(Haptics.ImpactFeedbackStyle.Medium);
    setSyncing(true);
    const result = await syncWithCloud();
    setSyncing(false);
    if (result) {
      safeHaptic.notification(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        isAr ? 'تمت المزامنة' : 'Synced',
        isAr ? 'تمت مزامنة البيانات السحابية بنجاح!' : 'Cloud data synced successfully!'
      );
    } else {
      safeHaptic.notification(Haptics.NotificationFeedbackType.Error);
      Alert.alert(
        isAr ? 'خطأ' : 'Error',
        isAr ? 'فشلت المزامنة، يرجى التحقق من اتصالك بالإنترنت' : 'Sync failed, please check your connection'
      );
    }
  };

  const handleLogout = async () => {
    safeHaptic.selection();
    Alert.alert(
      isAr ? 'تسجيل الخروج' : 'Logout',
      isAr ? 'هل أنت متأكد من رغبتك في تسجيل الخروج؟ سيتم مسح الكاش المحلي للتطبيق.' : 'Are you sure you want to logout? Local cache will be cleared.',
      [
        { text: isAr ? 'إلغاء' : 'Cancel', style: 'cancel' },
        {
          text: isAr ? 'خروج' : 'Logout',
          style: 'destructive',
          onPress: async () => {
            await performLogout();
            setUser(null);
            router.replace('/auth' as any);
          }
        }
      ]
    );
  };

  const handleTogglePin = async (value: boolean) => {
    safeHaptic.selection();
    if (value) {
      setPinStep('enter');
      setEnteredPin('');
      setConfirmedPin('');
      setPinError('');
      setIsPinModalOpen(true);
    } else {
      await disablePin();
      Alert.alert(isAr ? 'تنبيه' : 'Alert', isAr ? 'تم تعطيل قفل PIN.' : 'PIN Lock disabled.');
    }
  };

  const handlePinKeyPress = async (num: string) => {
    safeHaptic.impact(Haptics.ImpactFeedbackStyle.Light);
    setPinError('');
    
    if (pinStep === 'enter') {
      const nextPin = enteredPin + num;
      if (nextPin.length <= 4) {
        setEnteredPin(nextPin);
      }
      if (nextPin.length === 4) {
        setTimeout(() => {
          setPinStep('confirm');
        }, 250);
      }
    } else {
      const nextPin = confirmedPin + num;
      if (nextPin.length <= 4) {
        setConfirmedPin(nextPin);
      }
      if (nextPin.length === 4) {
        if (enteredPin === nextPin) {
          try {
            await enablePin(nextPin);
            safeHaptic.notification(Haptics.NotificationFeedbackType.Success);
            setIsPinModalOpen(false);
            Alert.alert(isAr ? 'نجاح' : 'Success', isAr ? 'تم تفعيل قفل PIN بنجاح!' : 'PIN Lock activated successfully!');
          } catch (e) {
            setPinError(isAr ? 'فشل حفظ رمز PIN' : 'Failed to save PIN');
            setEnteredPin('');
            setConfirmedPin('');
            setPinStep('enter');
          }
        } else {
          safeHaptic.notification(Haptics.NotificationFeedbackType.Error);
          setPinError(isAr ? 'الرموز غير متطابقة! أعد المحاولة.' : 'PIN codes do not match! Try again.');
          setEnteredPin('');
          setConfirmedPin('');
          setPinStep('enter');
        }
      }
    }
  };

  const handlePinBackspace = () => {
    safeHaptic.impact(Haptics.ImpactFeedbackStyle.Light);
    if (pinStep === 'enter') {
      setEnteredPin(prev => prev.slice(0, -1));
    } else {
      setConfirmedPin(prev => prev.slice(0, -1));
    }
  };

  const handleToggleBiometrics = async (value: boolean) => {
    safeHaptic.selection();
    const success = await enableBiometrics(value);
    if (value && !success) {
      Alert.alert(
        isAr ? 'تنبيه' : 'Alert',
        isAr 
          ? 'فشل تفعيل القفل البيومتري. تأكد من أن جهازك يدعم البصمة/الوجه ومن تفعيلها في إعدادات النظام.' 
          : 'Failed to enable biometric lock. Make sure your device supports FaceID/Fingerprint and it is set up in system settings.'
      );
    }
  };

  const handleExportPDF = async () => {
    if (!selectedWallet) {
      Alert.alert(isAr ? 'خطأ' : 'Error', isAr ? 'يرجى اختيار محفظة أولاً' : 'Please select a wallet first');
      return;
    }
    setExporting(true);
    safeHaptic.impact(Haptics.ImpactFeedbackStyle.Light);
    try {
      const walletTxns = transactions.filter(t => t.walletId === selectedWallet.id);
      await exportTransactionsToPDF(walletTxns, selectedWallet, language);
    } catch (e) {
      console.error(e);
      Alert.alert(isAr ? 'خطأ' : 'Error', isAr ? 'فشل تصدير كشف الحساب' : 'Failed to export statement');
    } finally {
      setExporting(false);
    }
  };

  const handleExportCSV = async () => {
    if (!selectedWallet) {
      Alert.alert(isAr ? 'خطأ' : 'Error', isAr ? 'يرجى اختيار محفظة أولاً' : 'Please select a wallet first');
      return;
    }
    setExporting(true);
    safeHaptic.impact(Haptics.ImpactFeedbackStyle.Light);
    try {
      const walletTxns = transactions.filter(t => t.walletId === selectedWallet.id);
      await exportTransactionsToCSV(walletTxns, selectedWallet, language);
    } catch (e) {
      console.error(e);
      Alert.alert(isAr ? 'خطأ' : 'Error', isAr ? 'فشل تصدير كشف الحساب' : 'Failed to export statement');
    } finally {
      setExporting(false);
    }
  };

  const handleCreateBackup = async () => {
    safeHaptic.impact(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await createFullBackup();
      safeHaptic.notification(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      console.error(e);
      Alert.alert(isAr ? 'خطأ' : 'Error', isAr ? 'فشل إنشاء النسخة الاحتياطية' : 'Failed to create backup');
    }
  };

  const handleClearAllData = () => {
    safeHaptic.notification(Haptics.NotificationFeedbackType.Warning);
    const title = isAr ? 'مسح جميع البيانات' : 'Clear All Data';
    const message = isAr ? 'هل أنت متأكد؟ سيتم مسح جميع المعاملات والمحافظ نهائياً.' : 'Are you sure? All transactions and wallets will be permanently deleted.';
    
    if (Platform.OS === 'web') {
      const confirmed = window.confirm(message);
      if (confirmed) {
        (async () => {
          try {
            await AsyncStorage.clear();
            await refresh();
            safeHaptic.notification(Haptics.NotificationFeedbackType.Success);
            window.alert(isAr ? 'تم مسح البيانات بنجاح' : 'Data cleared successfully');
            router.replace('/');
          } catch (e) {
            console.error(e);
            window.alert(isAr ? 'خطأ: فشل مسح البيانات' : 'Error: Failed to clear data');
          }
        })();
      }
    } else {
      Alert.alert(
        title,
        message,
        [
          { text: isAr ? 'إلغاء' : 'Cancel', style: 'cancel' },
          {
            text: isAr ? 'مسح' : 'Clear',
            style: 'destructive',
            onPress: async () => {
              try {
                await AsyncStorage.clear();
                await refresh();
                safeHaptic.notification(Haptics.NotificationFeedbackType.Success);
                Alert.alert(
                  isAr ? 'نجاح' : 'Success',
                  isAr ? 'تم مسح البيانات بنجاح' : 'Data cleared successfully',
                  [
                    {
                      text: 'OK',
                      onPress: () => {
                        router.replace('/');
                      }
                    }
                  ]
                );
              } catch (e) {
                console.error(e);
                Alert.alert(isAr ? 'خطأ' : 'Error', isAr ? 'فشل مسح البيانات' : 'Failed to clear data');
              }
            }
          }
        ]
      );
    }
  };



  const handleClose = () => {
    safeHaptic.selection();
    router.replace('/');
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.headerRow}>
          <Text style={styles.sheetTitle}>{t.settings}</Text>
          <Pressable onPress={handleClose} hitSlop={20} style={({ pressed }) => [pressed && { opacity: 0.6 }]}>
            <Ionicons name="close" size={24} color={colors.textSecondary} />
          </Pressable>
        </View>

        <ScrollView
          style={{ flex: 1 }}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
        >
          {/* Cloud Sync Section */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionLabelRow}>
              <Ionicons name="cloud-outline" size={18} color={colors.primary} />
              <Text style={styles.sectionLabel}>{isAr ? 'المزامنة السحابية' : 'Cloud Sync'}</Text>
            </View>

            {user ? (
              <View style={styles.userStatus}>
                <View style={styles.userInfo}>
                  <Ionicons name="person-circle" size={32} color={colors.primary} />
                  <View style={{ marginLeft: 8, alignItems: 'flex-start' }}>
                    <Text style={[styles.menuButtonText, { fontFamily: 'Cairo_700Bold' }]}>{user.username}</Text>
                    <Text style={{ fontSize: 11, color: colors.textSecondary, fontFamily: 'Cairo_400Regular' }}>
                      {isAr ? 'حساب نشط ومتصل' : 'Account active & connected'}
                    </Text>
                  </View>
                </View>
                
                <Pressable
                  onPress={handleSync}
                  disabled={syncing}
                  style={styles.syncBtn}
                >
                  {syncing ? (
                    <ActivityIndicator size="small" color="#FFF" />
                  ) : (
                    <>
                      <Ionicons name="sync" size={16} color="#FFF" />
                      <Text style={styles.syncBtnText}>{isAr ? 'مزامنة الآن' : 'Sync Now'}</Text>
                    </>
                  )}
                </Pressable>

                <Pressable onPress={handleLogout} style={styles.logoutBtn}>
                  <Ionicons name="log-out-outline" size={16} color={colors.expense} />
                  <Text style={styles.logoutBtnText}>{isAr ? 'تسجيل الخروج' : 'Logout'}</Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.noUserBox}>
                <Text style={styles.noUserText}>
                  {isAr ? 'سجل دخولك لمزامنة وحفظ بياناتك سحابياً' : 'Login to sync and secure your data in the cloud'}
                </Text>
                <Pressable
                  onPress={() => {
                    safeHaptic.selection();
                    router.push('/auth' as any);
                  }}
                  style={styles.loginBtn}
                >
                  <Ionicons name="cloud-upload-outline" size={18} color="#FFF" />
                  <Text style={styles.loginBtnText}>
                    {isAr ? 'إنشاء حساب / تسجيل دخول' : 'Login / Register'}
                  </Text>
                </Pressable>
              </View>
            )}
          </View>

          {/* Security PIN Lock Section */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionLabelRow}>
              <Ionicons name="shield-checkmark-outline" size={18} color={colors.primary} />
              <Text style={styles.sectionLabel}>{isAr ? 'الحماية والأمان' : 'Security & Protection'}</Text>
            </View>

            <View style={styles.settingItem}>
              <Text style={styles.settingLabel}>{isAr ? 'قفل رمز PIN' : 'PIN Lock'}</Text>
              <Switch
                value={isPinEnabled}
                onValueChange={handleTogglePin}
                trackColor={{ false: colors.border, true: colors.primary }}
              />
            </View>

            <View style={styles.settingItem}>
              <Text style={styles.settingLabel}>{isAr ? 'البصمة البيومترية' : 'Biometric Lock'}</Text>
              <Switch
                value={isBiometricEnabled}
                onValueChange={handleToggleBiometrics}
                trackColor={{ false: colors.border, true: colors.primary }}
              />
            </View>
          </View>

          {/* Financial Tools & Importers Section */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionLabelRow}>
              <Ionicons name="apps-outline" size={18} color={colors.primary} />
              <Text style={styles.sectionLabel}>{isAr ? 'الأدوات والخدمات المالية' : 'Financial Tools & Imports'}</Text>
            </View>

            <Pressable
              onPress={() => {
                safeHaptic.selection();
                router.push('/installments' as any);
              }}
              style={({ pressed }) => [styles.menuButton, pressed && { opacity: 0.7 }]}
            >
              <Ionicons name="card-outline" size={20} color={colors.primary} />
              <Text style={styles.menuButtonText}>
                {isAr ? 'الأقساط والبطاقات الائتمانية (Valu/Tabby)' : 'Installments & Credit Cards'}
              </Text>
              <Ionicons name={isAr ? 'chevron-back' : 'chevron-forward'} size={16} color={colors.textTertiary} />
            </Pressable>

            <Pressable
              onPress={() => {
                safeHaptic.selection();
                router.push('/import-statement' as any);
              }}
              style={({ pressed }) => [styles.menuButton, pressed && { opacity: 0.7 }]}
            >
              <Ionicons name="document-text-outline" size={20} color={colors.primary} />
              <Text style={styles.menuButtonText}>
                {isAr ? 'استيراد كشف حساب بنكي (CSV/نص)' : 'Import Bank Statement (CSV)'}
              </Text>
              <Ionicons name={isAr ? 'chevron-back' : 'chevron-forward'} size={16} color={colors.textTertiary} />
            </Pressable>

            <Pressable
              onPress={() => {
                safeHaptic.selection();
                router.push('/envelope-budget' as any);
              }}
              style={({ pressed }) => [styles.menuButton, pressed && { opacity: 0.7 }]}
            >
              <Ionicons name="mail-outline" size={20} color={colors.primary} />
              <Text style={styles.menuButtonText}>
                {isAr ? 'ميزانية الظروف المالية (Envelope Budget)' : 'Envelope Budgeting System'}
              </Text>
              <Ionicons name={isAr ? 'chevron-back' : 'chevron-forward'} size={16} color={colors.textTertiary} />
            </Pressable>

            <Pressable
              onPress={() => {
                safeHaptic.selection();
                router.push('/wallet-collaboration' as any);
              }}
              style={({ pressed }) => [styles.menuButton, pressed && { opacity: 0.7 }]}
            >
              <Ionicons name="people-outline" size={20} color={colors.primary} />
              <Text style={styles.menuButtonText}>
                {isAr ? 'مشاركة وتظافر المحفظة والصلاحيات' : 'Shared Wallet & Member Permissions'}
              </Text>
              <Ionicons name={isAr ? 'chevron-back' : 'chevron-forward'} size={16} color={colors.textTertiary} />
            </Pressable>

            <Pressable
              onPress={() => {
                safeHaptic.selection();
                router.push('/widgets-setup' as any);
              }}
              style={({ pressed }) => [styles.menuButton, pressed && { opacity: 0.7 }]}
            >
              <Ionicons name="hardware-chip-outline" size={20} color={colors.primary} />
              <Text style={styles.menuButtonText}>
                {isAr ? 'ودجت الشاشة الرئيسية (iOS & Android)' : 'Home Screen Widget Setup'}
              </Text>
              <Ionicons name={isAr ? 'chevron-back' : 'chevron-forward'} size={16} color={colors.textTertiary} />
            </Pressable>

            <Pressable
              onPress={() => {
                safeHaptic.selection();
                router.push('/zakat-calculator' as any);
              }}
              style={({ pressed }) => [styles.menuButton, pressed && { opacity: 0.7 }]}
            >
              <Ionicons name="sparkles-outline" size={20} color="#FFD700" />
              <Text style={styles.menuButtonText}>
                {isAr ? 'حاسبة الزكاة الشرعية (أسعار مباشرة)' : 'Zakat Calculator (Live Rates)'}
              </Text>
              <Ionicons name={isAr ? 'chevron-back' : 'chevron-forward'} size={16} color={colors.textTertiary} />
            </Pressable>
          </View>

          {/* Bank SMS Automation Section */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionLabelRow}>
              <Ionicons name="sparkles-outline" size={18} color={colors.primary} />
              <Text style={styles.sectionLabel}>{isAr ? 'أتمتة الرسائل البنكية' : 'Bank SMS Automation'}</Text>
            </View>

            <View style={styles.settingItem}>
              <View style={{ flex: 1, paddingRight: 10 }}>
                <Text style={styles.settingLabel}>{isAr ? 'التقاط الرسائل البنكية' : 'Bank SMS Auto-Detection'}</Text>
                <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 2 }}>
                  {isAr ? 'فحص وتحليل الرسائل البنكية تلقائياً فور النسخ أو الفتح' : 'Automatically parse bank messages'}
                </Text>
              </View>
              <Switch
                value={autoSmsEnabled}
                onValueChange={handleToggleAutoSms}
                trackColor={{ false: colors.border, true: colors.primary }}
              />
            </View>

            {autoSmsEnabled && (
              <View style={styles.settingItem}>
                <View style={{ flex: 1, paddingRight: 10 }}>
                  <Text style={styles.settingLabel}>{isAr ? 'التسجيل التلقائي الفوري' : 'Auto-Save Mode'}</Text>
                  <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 2 }}>
                    {isAr ? 'حفظ المعاملات البنكية فوراً بدون طلب تأكيد' : 'Save bank transactions directly without confirmation popup'}
                  </Text>
                </View>
                <Switch
                  value={autoSmsAutoSave}
                  onValueChange={handleToggleAutoSmsAutoSave}
                  trackColor={{ false: colors.border, true: colors.primary }}
                />
              </View>
            )}

            <Pressable
              onPress={() => {
                safeHaptic.selection();
                setIsGuideOpen(true);
              }}
              style={({ pressed }) => [
                styles.menuButton,
                { marginTop: 8, backgroundColor: colors.primary + '12', borderRadius: 12, padding: 12 },
                pressed && { opacity: 0.7 },
              ]}
            >
              <Ionicons name="help-circle-outline" size={20} color={colors.primary} />
              <Text style={[styles.menuButtonText, { color: colors.primary, fontFamily: 'Cairo_700Bold', flex: 1 }]}>
                {isAr ? 'دليل إعداد الأتمتة الكاملة (Android / iOS)' : 'Full Automation Guide (Android / iOS)'}
              </Text>
              <Ionicons name={isAr ? 'chevron-back' : 'chevron-forward'} size={16} color={colors.primary} />
            </Pressable>

            <Pressable
              onPress={handleClearSmsHistory}
              style={({ pressed }) => [
                styles.menuButton,
                { marginTop: 6 },
                pressed && { opacity: 0.7 },
              ]}
            >
              <Ionicons name="refresh-outline" size={18} color={colors.textSecondary} />
              <Text style={[styles.menuButtonText, { color: colors.textSecondary, fontSize: 12 }]}>
                {isAr ? 'إعادة ضبط سجل الرسائل المقروءة' : 'Reset processed SMS log'}
              </Text>
            </Pressable>
          </View>

          {/* Language Selection Section */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionLabelRow}>
              <Ionicons name="language" size={18} color={colors.primary} />
              <Text style={styles.sectionLabel}>{t.language}</Text>
            </View>
            <View style={styles.langRow}>
              <Pressable
                onPress={() => handleToggleLanguage('ar')}
                style={[
                  styles.langOption,
                  language === 'ar' && styles.langOptionActive,
                ]}
              >
                <Text style={[styles.langText, language === 'ar' && styles.langTextActive]}>
                  العربية
                </Text>
              </Pressable>
              <Pressable
                onPress={() => handleToggleLanguage('en')}
                style={[
                  styles.langOption,
                  language === 'en' && styles.langOptionActive,
                ]}
              >
                <Text style={[styles.langText, language === 'en' && styles.langTextActive]}>
                  English
                </Text>
              </Pressable>
            </View>
          </View>

          {/* Primary Financial Goal Section */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionLabelRow}>
              <Ionicons name="compass-outline" size={18} color={colors.primary} />
              <Text style={styles.sectionLabel}>
                {isAr ? 'الهدف المالي الرئيسي' : 'Primary Financial Goal'}
              </Text>
            </View>
            <View style={{ gap: 10, marginTop: 4 }}>
              {[
                { id: 'saving', labelAr: '🎯 توفير المال وبناء الأمان', labelEn: '🎯 Build Savings & Security', color: '#10B981' },
                { id: 'debts', labelAr: '💳 سداد الديون والالتزامات', labelEn: '💳 Pay Off Debts & Obligations', color: '#EF4444' },
                { id: 'tracking', labelAr: '📊 ضبط النفقات والسيولة اليومية', labelEn: '📊 Control Daily Expenses', color: '#6366F1' },
              ].map((g) => {
                const isActive = userGoal === g.id;
                return (
                  <Pressable
                    key={g.id}
                    onPress={() => handleGoalChange(g.id)}
                    style={[
                      styles.menuButton,
                      isActive && { backgroundColor: g.color + '15', borderColor: g.color, borderWidth: 1 },
                    ]}
                  >
                    <Text style={[styles.menuButtonText, isActive && { color: g.color, fontFamily: 'Cairo_700Bold' }]}>
                      {isAr ? g.labelAr : g.labelEn}
                    </Text>
                    {isActive && <Ionicons name="checkmark-circle" size={18} color={g.color} />}
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Theme Mode Section */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionLabelRow}>
              <Ionicons name="color-palette-outline" size={18} color={colors.primary} />
              <Text style={styles.sectionLabel}>{isAr ? 'المظهر / الثيم' : 'Appearance / Theme'}</Text>
            </View>
            <View style={styles.themeGrid}>
              {[
                { id: 'light', nameAr: 'نهاري / لايت', nameEn: 'Light Mode', icon: 'sunny-outline', primary: '#10B981', bg: '#F9FAFB' },
                { id: 'dark', nameAr: 'ليلي / دارك', nameEn: 'Dark Mode', icon: 'moon-outline', primary: '#10B981', bg: '#090E17' },
                { id: 'midnight', nameAr: 'أزرق الليل / ميدنايت', nameEn: 'Midnight Blue', icon: 'sparkles-outline', primary: '#6366F1', bg: '#0B0F19' },
                { id: 'emerald', nameAr: 'الزمرد الأخضر', nameEn: 'Emerald Green', icon: 'leaf-outline', primary: '#059669', bg: '#061B14' },
                { id: 'rose', nameAr: 'الوردي الأنيق / روز', nameEn: 'Rose Gold', icon: 'flower-outline', primary: '#EC4899', bg: '#0F0712' },
              ].map((t) => {
                const isActive = theme === t.id;
                return (
                  <Pressable
                    key={t.id}
                    onPress={() => handleToggleTheme(t.id as any)}
                    style={[
                      styles.themeCardOption,
                      isActive && styles.themeCardOptionActive,
                    ]}
                  >
                    <View style={styles.themeCardHeader}>
                      <Ionicons
                        name={t.icon as any}
                        size={18}
                        color={isActive ? colors.primary : colors.textSecondary}
                      />
                      <View style={styles.themeDotContainer}>
                        <View style={[styles.themeDot, { backgroundColor: t.primary }]} />
                        <View style={[styles.themeDot, { backgroundColor: t.bg, borderWidth: 1, borderColor: colors.border }]} />
                      </View>
                    </View>
                    <Text style={[styles.themeCardText, isActive && styles.themeCardTextActive]}>
                      {isAr ? t.nameAr : t.nameEn}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Export Statement Section */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionLabelRow}>
              <Ionicons name="document-text-outline" size={18} color={colors.primary} />
              <Text style={styles.sectionLabel}>{isAr ? 'تصدير البيانات' : 'Export Data'}</Text>
            </View>
            <View style={{ gap: 10 }}>
              <Pressable
                onPress={handleExportPDF}
                disabled={exporting}
                style={({ pressed }) => [
                  styles.exportBtn,
                  pressed && { opacity: 0.9 }
                ]}
              >
                {exporting ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <>
                    <Ionicons name="document-text-outline" size={18} color="#FFF" />
                    <Text style={styles.exportBtnText}>
                      {isAr ? 'تصدير كشف الحساب بصيغة PDF' : 'Export Statement to PDF'}
                    </Text>
                  </>
                )}
              </Pressable>

              <Pressable
                onPress={handleExportCSV}
                disabled={exporting}
                style={({ pressed }) => [
                  styles.exportBtn,
                  { backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border },
                  pressed && { opacity: 0.9 }
                ]}
              >
                {exporting ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <>
                    <Ionicons name="grid-outline" size={18} color={colors.primary} />
                    <Text style={[styles.exportBtnText, { color: colors.text }]}>
                      {isAr ? 'تصدير كشف الحساب بصيغة Excel / CSV' : 'Export Statement to Excel / CSV'}
                    </Text>
                  </>
                )}
              </Pressable>

              <Pressable
                onPress={handleCreateBackup}
                style={({ pressed }) => [
                  styles.exportBtn,
                  { backgroundColor: colors.primary + '15', borderWidth: 1, borderColor: colors.primary + '30' },
                  pressed && { opacity: 0.9 }
                ]}
              >
                <Ionicons name="cloud-download-outline" size={18} color={colors.primary} />
                <Text style={[styles.exportBtnText, { color: colors.primary }]}>
                  {isAr ? 'تصدير نسخة احتياطية كاملة (JSON Backup)' : 'Create Full Backup (JSON)'}
                </Text>
              </Pressable>
            </View>
          </View>

          {/* Clear All Data Section */}
          <View style={[styles.sectionCard, { borderColor: colors.expense + '20' }]}>
            <View style={styles.sectionLabelRow}>
              <Ionicons name="trash-outline" size={18} color={colors.expense} />
              <Text style={[styles.sectionLabel, { color: colors.expense }]}>
                {isAr ? 'منطقة الخطر' : 'Danger Zone'}
              </Text>
            </View>
            <Text style={[styles.settingLabel, { fontSize: 12, color: colors.textSecondary, fontFamily: 'Cairo_400Regular', textAlign: 'left', lineHeight: 18 }]}>
              {isAr 
                ? 'سيتم حذف جميع المعاملات والمحافظ والتأملات والخطط نهائياً من جهازك وجعل التطبيق جديد تماماً.' 
                : 'This will permanently delete all transactions, wallets, reflections, and plans from this device, resetting the app to a clean state.'}
            </Text>
            <Pressable
              onPress={handleClearAllData}
              style={({ pressed }) => [
                styles.clearBtn,
                { backgroundColor: colors.expense },
                pressed && { opacity: 0.9 }
              ]}
            >
              <Ionicons name="trash-outline" size={18} color="#FFF" />
              <Text style={styles.clearBtnText}>
                {isAr ? 'مسح جميع البيانات' : 'Clear All Data'}
              </Text>
            </Pressable>
          </View>

          {/* Privacy Policy Section */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionLabelRow}>
              <Ionicons name="shield-checkmark-outline" size={18} color={colors.primary} />
              <Text style={styles.sectionLabel}>{isAr ? 'الخصوصية والأمان' : 'Privacy & Security'}</Text>
            </View>
            <Pressable
              onPress={async () => {
                safeHaptic.selection();
                try {
                  await WebBrowser.openBrowserAsync('https://mizan-app.com/privacy-policy');
                } catch (e) {
                  Alert.alert(
                    isAr ? 'سياسة الخصوصية' : 'Privacy Policy',
                    isAr 
                      ? 'جميع بياناتك المالية محفوظة بنسبة 100% محلياً على جهازك ولا نطلع عليها مطلقاً.' 
                      : 'All your financial data is stored 100% locally on your device securely.'
                  );
                }
              }}
              style={({ pressed }) => [
                styles.menuButton,
                pressed && { backgroundColor: colors.surfaceAlt }
              ]}
            >
              <View style={styles.menuButtonLeft}>
                <Ionicons name="document-text-outline" size={20} color={colors.textSecondary} />
                <Text style={styles.menuButtonText}>
                  {isAr ? 'سياسة الخصوصية وحماية البيانات' : 'Privacy Policy & Data Protection'}
                </Text>
              </View>
              <Ionicons name={isAr ? "chevron-back" : "chevron-forward"} size={18} color={colors.textSecondary} />
            </Pressable>
          </View>

          {/* About App Section */}
          <View style={styles.aboutContainer}>
            <Text style={styles.aboutTitle}>
              {isAr ? 'عن التطبيق' : 'About Mizan'}
            </Text>
            <Text style={styles.aboutDesc}>
              {isAr 
                ? 'تطبيق ميزان لإدارة مصاريفك وتخطيطك المالي بكل ذكاء وسهولة.' 
                : 'Mizan helps you track expenses, organize savings, and plan your financial future mindfully.'}
            </Text>
            <Text style={styles.versionText}>
              {isAr ? 'الإصدار 1.0.0 (بيتا)' : 'Version 1.0.0 (Beta)'}
            </Text>
          </View>
        </ScrollView>

        {/* Custom PIN Creation Modal */}
        <Modal
          visible={isPinModalOpen}
          transparent
          animationType="slide"
          onRequestClose={() => setIsPinModalOpen(false)}
        >
          <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }}>
            <SafeAreaView style={{ flex: 1, width: '100%', maxWidth: 400, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
              {/* Header / Close */}
              <View style={{ width: '100%', flexDirection: 'row', justifyContent: 'flex-end', paddingBottom: 20 }}>
                <Pressable onPress={() => setIsPinModalOpen(false)} hitSlop={12}>
                  <Ionicons name="close" size={26} color={colors.textSecondary} />
                </Pressable>
              </View>

              {/* Title & Instructions */}
              <View style={{ alignItems: 'center', marginBottom: 30, gap: 12 }}>
                <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: colors.primary + '15', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="lock-closed" size={36} color={colors.primary} />
                </View>
                <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 20, color: colors.text }}>
                  {pinStep === 'enter' 
                    ? (isAr ? 'إنشاء رمز PIN الجديد' : 'Create New PIN') 
                    : (isAr ? 'تأكيد رمز PIN' : 'Confirm PIN Code')}
                </Text>
                <Text style={{ fontFamily: 'Cairo_600SemiBold', fontSize: 13, color: colors.textSecondary, textAlign: 'center', paddingHorizontal: 20, lineHeight: 18 }}>
                  {pinStep === 'enter'
                    ? (isAr ? 'أدخل رمز PIN المكون من 4 أرقام لحماية بياناتك:' : 'Enter a 4-digit PIN code to secure your data:')
                    : (isAr ? 'أعيدوا كتابة رمز PIN للتأكيد:' : 'Re-enter your PIN code to confirm:')}
                </Text>
              </View>

              {/* Dots Indicator */}
              <View style={{ flexDirection: 'row', gap: 20, justifyContent: 'center', alignItems: 'center', height: 30, marginBottom: 10 }}>
                {Array.from({ length: 4 }).map((_, i) => {
                  const currentLen = pinStep === 'enter' ? enteredPin.length : confirmedPin.length;
                  const filled = i < currentLen;
                  return (
                    <View
                      key={i}
                      style={[
                        { width: 16, height: 16, borderRadius: 8 },
                        filled
                          ? { backgroundColor: colors.primary, transform: [{ scale: 1.15 }] }
                          : { borderColor: colors.border, borderWidth: 2 },
                      ]}
                    />
                  );
                })}
              </View>

              {/* Error Box */}
              <View style={{ height: 24, justifyContent: 'center', marginBottom: 20 }}>
                {pinError ? (
                  <Text style={{ fontFamily: 'Cairo_600SemiBold', fontSize: 13, color: colors.expense }}>
                    {pinError}
                  </Text>
                ) : null}
              </View>

              {/* Keypad */}
              <View style={{ width: '100%', gap: 16, paddingHorizontal: 20 }}>
                {[['1', '2', '3'], ['4', '5', '6'], ['7', '8', '9']].map((row, i) => (
                  <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', width: '100%' }}>
                    {row.map((num) => (
                      <Pressable
                        key={num}
                        style={({ pressed }) => [
                          { width: 70, height: 70, borderRadius: 35, backgroundColor: colors.surfaceAlt, justifyContent: 'center', alignItems: 'center' },
                          pressed && { backgroundColor: colors.border }
                        ]}
                        onPress={() => handlePinKeyPress(num)}
                      >
                        <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 22, color: colors.text }}>{num}</Text>
                      </Pressable>
                    ))}
                  </View>
                ))}
                {/* Last Row */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', width: '100%' }}>
                  <View style={{ width: 70, height: 70 }} />
                  <Pressable
                    style={({ pressed }) => [
                      { width: 70, height: 70, borderRadius: 35, backgroundColor: colors.surfaceAlt, justifyContent: 'center', alignItems: 'center' },
                      pressed && { backgroundColor: colors.border }
                    ]}
                    onPress={() => handlePinKeyPress('0')}
                  >
                    <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 22, color: colors.text }}>0</Text>
                  </Pressable>
                  <Pressable
                    style={({ pressed }) => [
                      { width: 70, height: 70, borderRadius: 35, justifyContent: 'center', alignItems: 'center' },
                      pressed && { backgroundColor: colors.surfaceAlt }
                    ]}
                    onPress={handlePinBackspace}
                  >
                    <Ionicons name="backspace-outline" size={24} color={colors.text} />
                  </Pressable>
                </View>
              </View>
            </SafeAreaView>
          </View>
        </Modal>

        {/* Bank SMS Automation Guide Modal */}
        <SmsAutomationGuideModal
          visible={isGuideOpen}
          onClose={() => setIsGuideOpen(false)}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

const getStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  sheetTitle: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 20,
    color: colors.text,
  },
  content: {
    padding: 16,
    gap: 16,
    paddingBottom: 40,
  },
  sectionCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sectionLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  sectionLabel: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 15,
    color: colors.text,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  settingLabel: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 14,
    color: colors.text,
  },
  langRow: {
    flexDirection: 'row',
    gap: 10,
  },
  langOption: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  langOptionActive: {
    backgroundColor: colors.primary + '12',
    borderColor: colors.primary,
  },
  langText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 15,
    color: colors.textSecondary,
  },
  langTextActive: {
    color: colors.primary,
  },
  themeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  themeCardOption: {
    width: '45%',
    flexGrow: 1,
    padding: 12,
    borderRadius: 12,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 2,
    borderColor: 'transparent',
    gap: 8,
  },
  themeCardOptionActive: {
    backgroundColor: colors.primary + '12',
    borderColor: colors.primary,
  },
  themeCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  themeDotContainer: {
    flexDirection: 'row',
    gap: 4,
  },
  themeDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  themeCardText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 13,
    color: colors.textSecondary,
  },
  themeCardTextActive: {
    color: colors.primary,
  },
  userStatus: {
    gap: 10,
    alignItems: 'stretch',
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuButtonText: {
    fontSize: 15,
    color: colors.text,
    fontFamily: 'Cairo_600SemiBold',
  },
  syncBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 10,
    gap: 8,
  },
  syncBtnText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 14,
    color: '#FFF',
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.expense + '12',
    borderRadius: 12,
    paddingVertical: 10,
    gap: 8,
    borderWidth: 1,
    borderColor: colors.expense + '30',
  },
  logoutBtnText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 14,
    color: colors.expense,
  },
  noUserBox: {
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
  },
  noUserText: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  menuButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: colors.surfaceAlt,
  },
  menuButtonLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  loginBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 20,
    width: '100%',
    gap: 8,
  },
  loginBtnText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 14,
    color: '#FFF',
  },
  exportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 12,
    gap: 8,
  },
  exportBtnText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 14,
    color: '#FFF',
  },
  clearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    paddingVertical: 12,
    gap: 8,
  },
  clearBtnText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 14,
    color: '#FFF',
  },
  aboutContainer: {
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    paddingHorizontal: 20,
  },
  aboutTitle: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 14,
    color: colors.text,
  },
  aboutDesc: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 11,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 16,
  },
  versionText: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 10,
    color: colors.textSecondary,
    marginTop: 4,
  },
});
