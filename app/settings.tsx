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
  TextInput,
} from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLanguage } from '@/lib/LanguageContext';
import { useTheme } from '@/lib/ThemeContext';
import { useSecurity } from '@/lib/SecurityContext';
import { useTransactions } from '@/lib/TransactionContext';
import { getLoggedInUser, performLogout, syncWithCloud } from '@/lib/syncService';
import { exportTransactionsToPDF } from '@/lib/pdfExporter';
import { exportTransactionsToCSV } from '@/lib/csvExporter';
import { createFullBackup, restoreFullBackup } from '@/lib/backupService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ConfirmModal from '@/components/ConfirmModal';
import {
  getNotificationSettings,
  saveNotificationSettings,
  sendImmediateNotification,
  NotificationSettings,
  DEFAULT_NOTIFICATION_SETTINGS,
} from '@/lib/NotificationService';

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
  },
};

export default function SettingsScreen() {
  const { colors, theme, setTheme } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const { language, setLanguage, t } = useLanguage();
  const isAr = language === 'ar';

  const {
    isPinEnabled,
    isBiometricEnabled,
    enablePin,
    disablePin,
    enableBiometrics,
  } = useSecurity();

  const { transactions, wallets, selectedWallet, refresh, currencySymbol } = useTransactions();

  const [user, setUser] = useState<{ username: string; id: string } | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Custom PIN Modal States
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [pinStep, setPinStep] = useState<'enter' | 'confirm'>('enter');
  const [enteredPin, setEnteredPin] = useState('');
  const [confirmedPin, setConfirmedPin] = useState('');
  const [pinError, setPinError] = useState('');

  // Smart Notifications States
  const [notifSettings, setNotifSettings] = useState<NotificationSettings>(DEFAULT_NOTIFICATION_SETTINGS);

  // Restore Backup Modal States
  const [isRestoreModalOpen, setIsRestoreModalOpen] = useState(false);
  const [restoreJsonInput, setRestoreJsonInput] = useState('');
  const [isRestoring, setIsRestoring] = useState(false);

  // Confirm Modal State
  const [confirmModalState, setConfirmModalState] = useState<{
    visible: boolean;
    title: string;
    message: string;
    confirmText?: string;
    isDestructive?: boolean;
    onConfirm: () => void;
  }>({ visible: false, title: '', message: '', onConfirm: () => {} });

  useEffect(() => {
    async function loadData() {
      const [loggedUser, notif] = await Promise.all([
        getLoggedInUser().catch(() => null),
        getNotificationSettings().catch(() => DEFAULT_NOTIFICATION_SETTINGS),
      ]);
      setUser(loggedUser);
      setNotifSettings(notif);
    }
    loadData();
  }, []);

  const handleToggleDailyReminder = async (val: boolean) => {
    safeHaptic.selection();
    const updated = await saveNotificationSettings({ dailyReminderEnabled: val });
    setNotifSettings(updated);
  };

  const handleToggleBudgetAlerts = async (val: boolean) => {
    safeHaptic.selection();
    const updated = await saveNotificationSettings({ budgetAlertsEnabled: val });
    setNotifSettings(updated);
  };

  const handleToggleMonthlyDigest = async (val: boolean) => {
    safeHaptic.selection();
    const updated = await saveNotificationSettings({ monthlyDigestEnabled: val });
    setNotifSettings(updated);
  };

  const handleTestNotification = async () => {
    safeHaptic.impact(Haptics.ImpactFeedbackStyle.Medium);
    await sendImmediateNotification(
      isAr ? '🔔 تجربة تنبيه ميزان المالي' : '🔔 Mizan Notification Test',
      isAr
        ? 'نظام التنبيهات الذكي يعمل بكفاءة! ستصلك التذكيرات وتنبيهات الميزانية في مواعيدها.'
        : 'Smart notifications are working properly! You will receive timely budget alerts.'
    );
    Alert.alert(
      isAr ? 'تم الإرسال 🚀' : 'Sent 🚀',
      isAr ? 'تم إرسال إشعار تجريبي إلى جهازك بنجاح.' : 'A test notification has been dispatched to your device.'
    );
  };



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

  const handleLogout = () => {
    safeHaptic.selection();
    setConfirmModalState({
      visible: true,
      title: isAr ? 'تسجيل الخروج' : 'Logout',
      message: isAr ? 'هل أنت متأكد من رغبتك في تسجيل الخروج؟' : 'Are you sure you want to logout?',
      confirmText: isAr ? 'تسجيل الخروج' : 'Logout',
      isDestructive: true,
      onConfirm: async () => {
        setConfirmModalState(prev => ({ ...prev, visible: false }));
        await performLogout();
        setUser(null);
        safeHaptic.notification(Haptics.NotificationFeedbackType.Success);
      },
    });
  };

  // PIN & Biometrics Handlers
  const handleTogglePin = (value: boolean) => {
    safeHaptic.selection();
    if (value) {
      setEnteredPin('');
      setConfirmedPin('');
      setPinStep('enter');
      setPinError('');
      setIsPinModalOpen(true);
    } else {
      setConfirmModalState({
        visible: true,
        title: isAr ? 'تعطيل رمز PIN' : 'Disable PIN',
        message: isAr ? 'هل أنت متأكد من رغبتك في إيقاف قفل رمز PIN؟' : 'Are you sure you want to disable PIN lock?',
        confirmText: isAr ? 'تعطيل' : 'Disable',
        isDestructive: true,
        onConfirm: async () => {
          setConfirmModalState(prev => ({ ...prev, visible: false }));
          await disablePin();
          safeHaptic.notification(Haptics.NotificationFeedbackType.Success);
        },
      });
    }
  };

  const handleToggleBiometrics = async (value: boolean) => {
    safeHaptic.selection();
    if (value) {
      const ok = await enableBiometrics(true);
      if (!ok) {
        Alert.alert(
          isAr ? 'تنبيه' : 'Alert',
          isAr ? 'تعذر تفعيل البصمة. تأكد من إعدادها في إعدادات جهازك أولاً.' : 'Could not enable biometrics. Check your device settings.'
        );
      }
    } else {
      await enableBiometrics(false);
    }
  };

  const handlePinKeyPress = (digit: string) => {
    safeHaptic.impact(Haptics.ImpactFeedbackStyle.Light);
    setPinError('');
    if (pinStep === 'enter') {
      if (enteredPin.length < 4) {
        const next = enteredPin + digit;
        setEnteredPin(next);
        if (next.length === 4) {
          setTimeout(() => {
            setPinStep('confirm');
          }, 200);
        }
      }
    } else {
      if (confirmedPin.length < 4) {
        const next = confirmedPin + digit;
        setConfirmedPin(next);
        if (next.length === 4) {
          if (next === enteredPin) {
            enablePin(next);
            setIsPinModalOpen(false);
            safeHaptic.notification(Haptics.NotificationFeedbackType.Success);
          } else {
            setPinError(isAr ? 'الرمز غير متطابق، يرجى المحاولة ثانية' : 'PINs do not match, try again');
            safeHaptic.notification(Haptics.NotificationFeedbackType.Error);
            setConfirmedPin('');
          }
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

  // Export handlers
  const handleExportPDF = async () => {
    const targetWallet = selectedWallet || wallets[0] || ({ id: 'default', name: isAr ? 'المحفظة' : 'Wallet', currency: 'KWD', icon: 'wallet', color: '#10B981', createdAt: new Date().toISOString() });
    setExporting(true);
    safeHaptic.impact(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await exportTransactionsToPDF(transactions, targetWallet, language);
      safeHaptic.notification(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      Alert.alert(isAr ? 'خطأ' : 'Error', isAr ? 'فشل تصدير ملف PDF' : 'Failed to export PDF');
    } finally {
      setExporting(false);
    }
  };

  const handleExportCSV = async () => {
    const targetWallet = selectedWallet || wallets[0] || ({ id: 'default', name: isAr ? 'المحفظة' : 'Wallet', currency: 'KWD', icon: 'wallet', color: '#10B981', createdAt: new Date().toISOString() });
    setExporting(true);
    safeHaptic.impact(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await exportTransactionsToCSV(transactions, targetWallet, language);
      safeHaptic.notification(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      Alert.alert(isAr ? 'خطأ' : 'Error', isAr ? 'فشل تصدير ملف CSV' : 'Failed to export CSV');
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
      Alert.alert(isAr ? 'خطأ' : 'Error', isAr ? 'فشل إنشاء النسخة الاحتياطية' : 'Failed to create backup');
    }
  };

  const handlePerformRestore = async () => {
    if (!restoreJsonInput.trim()) {
      Alert.alert(isAr ? 'تنبيه' : 'Alert', isAr ? 'يرجى لصق نص كود النسخة الاحتياطية (JSON)' : 'Please paste backup JSON content');
      return;
    }
    setIsRestoring(true);
    safeHaptic.impact(Haptics.ImpactFeedbackStyle.Heavy);
    try {
      const ok = await restoreFullBackup(restoreJsonInput);
      if (ok) {
        await refresh();
        safeHaptic.notification(Haptics.NotificationFeedbackType.Success);
        setIsRestoreModalOpen(false);
        setRestoreJsonInput('');
        Alert.alert(
          isAr ? 'تمت الاستعادة بنجاح 🎉' : 'Restore Successful 🎉',
          isAr ? 'تم استرجاع كامل معاملاتك ومحافظك وخططك بنجاح!' : 'All transactions, wallets, and plans restored successfully!'
        );
      } else {
        safeHaptic.notification(Haptics.NotificationFeedbackType.Error);
        Alert.alert(isAr ? 'خطأ' : 'Error', isAr ? 'ملف النسخة الاحتياطية غير صالح أو تالف' : 'Invalid backup JSON file');
      }
    } catch (e) {
      Alert.alert(isAr ? 'خطأ' : 'Error', isAr ? 'حدث خطأ أثناء استعادة البيانات' : 'Failed to restore backup');
    } finally {
      setIsRestoring(false);
    }
  };

  const handleClearAllData = () => {
    safeHaptic.notification(Haptics.NotificationFeedbackType.Warning);
    setConfirmModalState({
      visible: true,
      title: isAr ? 'مسح جميع البيانات' : 'Clear All Data',
      message: isAr ? 'هل أنت متأكد تماماً؟ سيتم مسح كافة المعاملات والمحافظ نهائياً من هذا الجهاز.' : 'Are you sure? All transactions and wallets will be permanently deleted.',
      confirmText: isAr ? 'مسح نهائي' : 'Clear All',
      isDestructive: true,
      onConfirm: async () => {
        setConfirmModalState(prev => ({ ...prev, visible: false }));
        try {
          await AsyncStorage.clear();
          await refresh();
          safeHaptic.notification(Haptics.NotificationFeedbackType.Success);
          router.replace('/');
        } catch (e) {
          console.error(e);
        }
      },
    });
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
        <View style={[styles.headerRow, { paddingTop: (insets.top || (Platform.OS === 'web' ? 10 : 0)) + 12 }]}>
          <Text style={styles.sheetTitle}>{t.settings}</Text>
          <Pressable onPress={handleClose} hitSlop={14} style={styles.closeBtn}>
            <Ionicons name="close" size={22} color={colors.text} />
          </Pressable>
        </View>

        <ScrollView
          style={{ flex: 1 }}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
        >
          {/* 1. Account & Cloud Sync */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionIconBadge}>
                <Ionicons name="cloud-outline" size={18} color={colors.primary} />
              </View>
              <Text style={styles.sectionTitle}>{isAr ? 'الحساب والمزامنة السحابية' : 'Account & Cloud Sync'}</Text>
            </View>

            {user ? (
              <View style={styles.userCard}>
                <View style={styles.userInfoRow}>
                  <View style={styles.userAvatar}>
                    <Ionicons name="person" size={20} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.userName}>{user.username}</Text>
                    <Text style={styles.userSubtext}>
                      {isAr ? '🟢 حساب نشط ومتصل' : '🟢 Active & Synced'}
                    </Text>
                  </View>
                </View>

                <View style={styles.userActionsRow}>
                  <Pressable
                    onPress={handleSync}
                    disabled={syncing}
                    style={({ pressed }) => [styles.primaryActionBtn, pressed && { opacity: 0.8 }, { flex: 1 }]}
                  >
                    {syncing ? (
                      <ActivityIndicator size="small" color="#FFF" />
                    ) : (
                      <>
                        <Ionicons name="sync" size={16} color="#FFF" />
                        <Text style={styles.primaryActionBtnText}>{isAr ? 'مزامنة الآن' : 'Sync Now'}</Text>
                      </>
                    )}
                  </Pressable>

                  <Pressable onPress={handleLogout} style={({ pressed }) => [styles.secondaryActionBtn, pressed && { opacity: 0.8 }]}>
                    <Ionicons name="log-out-outline" size={16} color={colors.expense} />
                    <Text style={styles.secondaryActionBtnText}>{isAr ? 'خروج' : 'Logout'}</Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <View style={styles.noUserBox}>
                <Text style={styles.noUserText}>
                  {isAr ? 'سجل حسابك لحفظ بياناتك ومزامنتها سحابياً بأمان تام' : 'Login to secure and sync your data seamlessly'}
                </Text>
                <Pressable
                  onPress={() => {
                    safeHaptic.selection();
                    router.push('/auth' as any);
                  }}
                  style={({ pressed }) => [styles.primaryActionBtn, pressed && { opacity: 0.8 }, { width: '100%' }]}
                >
                  <Ionicons name="cloud-upload-outline" size={18} color="#FFF" />
                  <Text style={styles.primaryActionBtnText}>
                    {isAr ? 'تسجيل الدخول / إنشاء حساب' : 'Login / Register'}
                  </Text>
                </Pressable>
              </View>
            )}
          </View>

          {/* 2. Appearance & Personalization */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionIconBadge}>
                <Ionicons name="color-palette-outline" size={18} color={colors.primary} />
              </View>
              <Text style={styles.sectionTitle}>{isAr ? 'المظهر واللغة' : 'Appearance & Themes'}</Text>
            </View>

            {/* Language Selector */}
            <View style={styles.settingBlock}>
              <Text style={styles.settingBlockLabel}>{isAr ? 'لغة التطبيق' : 'App Language'}</Text>
              <View style={styles.langRow}>
                <Pressable
                  onPress={() => handleToggleLanguage('ar')}
                  style={[styles.langOption, language === 'ar' && styles.langOptionActive]}
                >
                  <Text style={[styles.langText, language === 'ar' && styles.langTextActive]}>
                    العربية 🇸🇦
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => handleToggleLanguage('en')}
                  style={[styles.langOption, language === 'en' && styles.langOptionActive]}
                >
                  <Text style={[styles.langText, language === 'en' && styles.langTextActive]}>
                    English 🇺🇸
                  </Text>
                </Pressable>
              </View>
            </View>

            {/* Theme Selector */}
            <View style={styles.settingBlock}>
              <Text style={styles.settingBlockLabel}>{isAr ? 'ثيم التطبيق' : 'Color Theme'}</Text>
              <View style={styles.themeGrid}>
                {[
                  { id: 'light', nameAr: 'نهاري', nameEn: 'Light', icon: 'sunny-outline', primary: '#10B981', bg: '#F8FAFC' },
                  { id: 'dark', nameAr: 'ليلي', nameEn: 'Dark', icon: 'moon-outline', primary: '#10B981', bg: '#090E17' },
                ].map(tItem => {
                  const isActive = theme === tItem.id;
                  return (
                    <Pressable
                      key={tItem.id}
                      onPress={() => handleToggleTheme(tItem.id as any)}
                      style={[styles.themeCardOption, isActive && styles.themeCardOptionActive]}
                    >
                      <View style={styles.themeCardHeader}>
                        <Ionicons
                          name={tItem.icon as any}
                          size={18}
                          color={isActive ? colors.primary : colors.textSecondary}
                        />
                        <View style={styles.themeDotContainer}>
                          <View style={[styles.themeDot, { backgroundColor: tItem.primary }]} />
                          <View style={[styles.themeDot, { backgroundColor: tItem.bg, borderWidth: 1, borderColor: colors.border }]} />
                        </View>
                      </View>
                      <Text numberOfLines={1} style={[styles.themeCardText, isActive && styles.themeCardTextActive]}>
                        {isAr ? tItem.nameAr : tItem.nameEn}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </View>

          {/* 3. Security & Permissions */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionIconBadge}>
                <Ionicons name="lock-closed-outline" size={18} color={colors.primary} />
              </View>
              <Text style={styles.sectionTitle}>{isAr ? 'الأمان والخصوصية' : 'Security & Privacy'}</Text>
            </View>

            <View style={styles.switchRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.switchLabel}>{isAr ? 'قفل رمز PIN' : 'PIN Lock'}</Text>
                <Text style={styles.switchSubtext}>{isAr ? 'حماية فتح التطبيق برمز سري' : 'Secure app opening with 4-digit PIN'}</Text>
              </View>
              <Switch
                value={isPinEnabled}
                onValueChange={handleTogglePin}
                trackColor={{ false: colors.border, true: colors.primary }}
              />
            </View>

            <View style={styles.switchRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.switchLabel}>{isAr ? 'البصمة البيومترية' : 'Biometrics (Face/Touch ID)'}</Text>
                <Text style={styles.switchSubtext}>{isAr ? 'فتح التطبيق ببصمة الوجه أو الأصبع' : 'Unlock using biometric sensor'}</Text>
              </View>
              <Switch
                value={isBiometricEnabled}
                onValueChange={handleToggleBiometrics}
                trackColor={{ false: colors.border, true: colors.primary }}
              />
            </View>

            <Pressable
              onPress={() => {
                safeHaptic.selection();
                router.push('/wallet-collaboration' as any);
              }}
              style={({ pressed }) => [styles.menuRowItem, pressed && { opacity: 0.7 }]}
            >
              <View style={styles.menuRowLeft}>
                <Ionicons name="people-outline" size={18} color={colors.primary} />
                <Text style={styles.menuRowText}>
                  {isAr ? 'إدارة مشاركة المحفظة والصلاحيات' : 'Shared Wallet & Member Permissions'}
                </Text>
              </View>
              <Ionicons name={isAr ? 'chevron-back' : 'chevron-forward'} size={16} color={colors.textTertiary} />
            </Pressable>
          </View>

          {/* 4. Smart Notifications & Reminders */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionIconBadge}>
                <Ionicons name="notifications-outline" size={18} color={colors.primary} />
              </View>
              <Text style={styles.sectionTitle}>{isAr ? 'الإشعارات والتذكيرات الذكية' : 'Smart Notifications & Alerts'}</Text>
            </View>

            <View style={styles.switchRow}>
              <View style={{ flex: 1, paddingRight: 8 }}>
                <Text style={styles.switchLabel}>{isAr ? 'التذكير اليومي المسائي' : 'Daily Logging Reminder'}</Text>
                <Text style={styles.switchSubtext}>
                  {isAr ? 'تنبيه لطيف الساعة 9:00 مساءً لتسجيل مصاريف اليوم' : 'Daily 9:00 PM nudge to log your transactions'}
                </Text>
              </View>
              <Switch
                value={notifSettings.dailyReminderEnabled}
                onValueChange={handleToggleDailyReminder}
                trackColor={{ false: colors.border, true: colors.primary }}
              />
            </View>

            <View style={styles.switchRow}>
              <View style={{ flex: 1, paddingRight: 8 }}>
                <Text style={styles.switchLabel}>{isAr ? 'تنبيهات تجاوز الميزانية' : 'Budget Limit Alerts'}</Text>
                <Text style={styles.switchSubtext}>
                  {isAr ? 'إشعار فوري عند الاقتراب أو تجاوز ميزانية أي فئة' : 'Instant alerts when nearing or exceeding category budget'}
                </Text>
              </View>
              <Switch
                value={notifSettings.budgetAlertsEnabled}
                onValueChange={handleToggleBudgetAlerts}
                trackColor={{ false: colors.border, true: colors.primary }}
              />
            </View>

            <View style={styles.switchRow}>
              <View style={{ flex: 1, paddingRight: 8 }}>
                <Text style={styles.switchLabel}>{isAr ? 'التقرير المالي الشهري' : 'Monthly Financial Digest'}</Text>
                <Text style={styles.switchSubtext}>
                  {isAr ? 'ملخص إنجازاتك ونسبة ادخارك أول كل شهر' : 'Monthly progress & savings rate digest on the 1st'}
                </Text>
              </View>
              <Switch
                value={notifSettings.monthlyDigestEnabled}
                onValueChange={handleToggleMonthlyDigest}
                trackColor={{ false: colors.border, true: colors.primary }}
              />
            </View>

            <Pressable
              onPress={handleTestNotification}
              style={({ pressed }) => [
                styles.menuRowItem,
                { backgroundColor: colors.primary + '10', borderRadius: 12 },
                pressed && { opacity: 0.7 },
              ]}
            >
              <View style={styles.menuRowLeft}>
                <Ionicons name="paper-plane-outline" size={16} color={colors.primary} />
                <Text style={[styles.menuRowText, { color: colors.primary, fontFamily: 'Cairo_700Bold' }]}>
                  {isAr ? 'إرسال إشعار تجريبي فوري' : 'Send Instant Test Notification'}
                </Text>
              </View>
              <Ionicons name={isAr ? 'chevron-back' : 'chevron-forward'} size={14} color={colors.primary} />
            </Pressable>
          </View>

          {/* 6. Home Screen Widgets */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionIconBadge}>
                <Ionicons name="apps-outline" size={18} color="#3B82F6" />
              </View>
              <Text style={styles.sectionTitle}>{isAr ? 'ودجت الشاشة الرئيسية' : 'Home Screen Widgets'}</Text>
            </View>

            <Pressable
              onPress={() => {
                safeHaptic.selection();
                router.push('/widgets-setup' as any);
              }}
              style={({ pressed }) => [
                styles.menuRowItem,
                { backgroundColor: '#3B82F615', borderColor: '#3B82F640', borderWidth: 1, borderRadius: 12 },
                pressed && { opacity: 0.7 },
              ]}
            >
              <View style={styles.menuRowLeft}>
                <Ionicons name="color-palette-outline" size={18} color="#3B82F6" />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.menuRowText, { color: '#3B82F6', fontFamily: 'Cairo_700Bold' }]}>
                    {isAr ? 'معاينة وإعداد ودجت الهاتف' : 'Preview & Setup Widgets'}
                  </Text>
                  <Text style={{ fontFamily: 'Cairo_500Medium', fontSize: 11, color: colors.textSecondary }}>
                    {isAr ? 'إضافة بطاقة رصيدك وصحتك المالية لشاشتك الرئيسية' : 'Add balance & health score card to Home Screen'}
                  </Text>
                </View>
              </View>
              <Ionicons name={isAr ? 'chevron-back' : 'chevron-forward'} size={16} color="#3B82F6" />
            </Pressable>
          </View>

          {/* 7. Data & Backup Management */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionIconBadge}>
                <Ionicons name="document-text-outline" size={18} color={colors.primary} />
              </View>
              <Text style={styles.sectionTitle}>{isAr ? 'تصدير وإدارة البيانات' : 'Data & Export'}</Text>
            </View>

            <View style={{ gap: 8 }}>
              <Pressable
                onPress={handleExportPDF}
                disabled={exporting}
                style={({ pressed }) => [styles.exportBtn, pressed && { opacity: 0.85 }]}
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
                style={({ pressed }) => [styles.exportBtnOutline, pressed && { opacity: 0.85 }]}
              >
                {exporting ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <>
                    <Ionicons name="grid-outline" size={18} color={colors.primary} />
                    <Text style={[styles.exportBtnText, { color: colors.text }]}>
                      {isAr ? 'تصدير كشف الحساب Excel / CSV' : 'Export Statement to Excel / CSV'}
                    </Text>
                  </>
                )}
              </Pressable>

              <View style={styles.backupRow}>
                <Pressable
                  onPress={handleCreateBackup}
                  style={({ pressed }) => [styles.backupBtn, { backgroundColor: colors.primary + '15', borderColor: colors.primary + '30' }, pressed && { opacity: 0.85 }]}
                >
                  <Ionicons name="cloud-download-outline" size={16} color={colors.primary} />
                  <Text style={[styles.backupBtnText, { color: colors.primary }]}>
                    {isAr ? 'إنشاء نسخة JSON' : 'Create Backup'}
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => {
                    safeHaptic.selection();
                    setIsRestoreModalOpen(true);
                  }}
                  style={({ pressed }) => [styles.backupBtn, { backgroundColor: '#3B82F615', borderColor: '#3B82F630' }, pressed && { opacity: 0.85 }]}
                >
                  <Ionicons name="cloud-upload-outline" size={16} color="#3B82F6" />
                  <Text style={[styles.backupBtnText, { color: '#3B82F6' }]}>
                    {isAr ? 'استعادة نسخة JSON' : 'Restore Backup'}
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>

          {/* 8. Danger Zone */}
          <View style={[styles.sectionCard, { borderColor: colors.expense + '30', backgroundColor: colors.expense + '06' }]}>
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionIconBadge, { backgroundColor: colors.expense + '15' }]}>
                <Ionicons name="alert-circle-outline" size={18} color={colors.expense} />
              </View>
              <Text style={[styles.sectionTitle, { color: colors.expense }]}>
                {isAr ? 'منطقة الخطر' : 'Danger Zone'}
              </Text>
            </View>

            <Text style={styles.dangerSubtext}>
              {isAr
                ? 'حذف جميع المعاملات والمحافظ والبيانات نهائياً وإعادة التطبيق للحالة الافتراضية.'
                : 'Permanently remove all data, transactions, and wallets, resetting app.'}
            </Text>

            <Pressable
              onPress={handleClearAllData}
              style={({ pressed }) => [styles.clearBtn, pressed && { opacity: 0.9 }]}
            >
              <Ionicons name="trash-outline" size={18} color="#FFF" />
              <Text style={styles.clearBtnText}>
                {isAr ? 'مسح جميع البيانات نهائياً' : 'Clear All Data'}
              </Text>
            </Pressable>
          </View>

          {/* 9. Privacy & Info */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionIconBadge}>
                <Ionicons name="information-circle-outline" size={18} color={colors.primary} />
              </View>
              <Text style={styles.sectionTitle}>{isAr ? 'الخصوصية والمعلومات' : 'Privacy & Info'}</Text>
            </View>

            <Pressable
              onPress={() => {
                safeHaptic.selection();
                router.push('/privacy-policy' as any);
              }}
              style={({ pressed }) => [styles.menuRowItem, pressed && { opacity: 0.7 }]}
            >
              <View style={styles.menuRowLeft}>
                <Ionicons name="shield-outline" size={18} color={colors.textSecondary} />
                <Text style={styles.menuRowText}>
                  {isAr ? 'سياسة الخصوصية وحماية البيانات' : 'Privacy Policy'}
                </Text>
              </View>
              <Ionicons name={isAr ? 'chevron-back' : 'chevron-forward'} size={16} color={colors.textSecondary} />
            </Pressable>
          </View>

          {/* App Branding Footer */}
          <View style={styles.aboutContainer}>
            <Text style={styles.aboutTitle}>{isAr ? 'ميزان - Mizan' : 'Mizan App'}</Text>
            <Text style={styles.aboutDesc}>
              {isAr
                ? 'إدارة مصاريفك وتخطيطك المالي بكل ذكاء وسهولة.'
                : 'Track expenses & plan your financial future mindfully.'}
            </Text>
            <Text style={styles.versionText}>
              {isAr ? 'الإصدار 1.0.0' : 'Version 1.0.0'}
            </Text>
          </View>
        </ScrollView>

        {/* PIN Creation Modal */}
        <Modal
          visible={isPinModalOpen}
          transparent
          animationType="slide"
          onRequestClose={() => setIsPinModalOpen(false)}
        >
          <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }}>
            <SafeAreaView style={{ flex: 1, width: '100%', maxWidth: 400, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
              {/* Close */}
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
                    : (isAr ? 'أعد كتابة رمز PIN للتأكيد:' : 'Re-enter your PIN code to confirm:')}
                </Text>
              </View>

              {/* Dots */}
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

              {/* Error */}
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
                    {row.map(num => (
                      <Pressable
                        key={num}
                        style={({ pressed }) => [
                          { width: 70, height: 70, borderRadius: 35, backgroundColor: colors.surfaceAlt, justifyContent: 'center', alignItems: 'center' },
                          pressed && { backgroundColor: colors.border },
                        ]}
                        onPress={() => handlePinKeyPress(num)}
                      >
                        <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 22, color: colors.text }}>{num}</Text>
                      </Pressable>
                    ))}
                  </View>
                ))}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', width: '100%' }}>
                  <View style={{ width: 70, height: 70 }} />
                  <Pressable
                    style={({ pressed }) => [
                      { width: 70, height: 70, borderRadius: 35, backgroundColor: colors.surfaceAlt, justifyContent: 'center', alignItems: 'center' },
                      pressed && { backgroundColor: colors.border },
                    ]}
                    onPress={() => handlePinKeyPress('0')}
                  >
                    <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 22, color: colors.text }}>0</Text>
                  </Pressable>
                  <Pressable
                    style={({ pressed }) => [
                      { width: 70, height: 70, borderRadius: 35, justifyContent: 'center', alignItems: 'center' },
                      pressed && { backgroundColor: colors.surfaceAlt },
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

        {/* Restore Backup Modal */}
        <Modal
          visible={isRestoreModalOpen}
          transparent
          animationType="fade"
          onRequestClose={() => setIsRestoreModalOpen(false)}
        >
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
            <View style={{ width: '100%', maxWidth: 450, backgroundColor: colors.surface, borderRadius: 24, padding: 20, borderWidth: 1, borderColor: colors.border, gap: 14 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Ionicons name="cloud-upload" size={22} color="#3B82F6" />
                  <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 16, color: colors.text }}>
                    {isAr ? 'استعادة النسخة الاحتياطية (JSON)' : 'Restore JSON Backup'}
                  </Text>
                </View>
                <Pressable onPress={() => setIsRestoreModalOpen(false)}>
                  <Ionicons name="close-circle" size={24} color={colors.textSecondary} />
                </Pressable>
              </View>

              <Text style={{ fontFamily: 'Cairo_400Regular', fontSize: 12, color: colors.textSecondary, lineHeight: 18 }}>
                {isAr
                  ? 'الصق كود الـ JSON الخفي أو محتوى ملف النسخة الاحتياطية هنا لاستعادة كافة البيانات فوراً:'
                  : 'Paste your JSON backup data string below to restore transactions and wallets:'}
              </Text>

              <TextInput
                style={{
                  backgroundColor: colors.surfaceAlt,
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: colors.border,
                  padding: 12,
                  fontFamily: 'Cairo_400Regular',
                  fontSize: 12,
                  color: colors.text,
                  minHeight: 120,
                  textAlignVertical: 'top',
                }}
                placeholder='{"version": "1.0.0", "transactions": [...] }'
                placeholderTextColor={colors.textSecondary + '80'}
                multiline
                value={restoreJsonInput}
                onChangeText={setRestoreJsonInput}
              />

              <View style={{ flexDirection: 'row', gap: 10, marginTop: 6 }}>
                <Pressable
                  onPress={() => setIsRestoreModalOpen(false)}
                  style={{ flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: colors.surfaceAlt, alignItems: 'center' }}
                >
                  <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 13, color: colors.textSecondary }}>
                    {isAr ? 'إلغاء' : 'Cancel'}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={handlePerformRestore}
                  disabled={isRestoring}
                  style={{ flex: 2, paddingVertical: 12, borderRadius: 12, backgroundColor: '#3B82F6', alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6 }}
                >
                  {isRestoring ? (
                    <ActivityIndicator size="small" color="#FFF" />
                  ) : (
                    <>
                      <Ionicons name="checkmark-circle" size={18} color="#FFF" />
                      <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 14, color: '#FFF' }}>
                        {isAr ? 'تأكيد الاستعادة' : 'Confirm Restore'}
                      </Text>
                    </>
                  )}
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>



        {/* Custom Confirmation Modal */}
        <ConfirmModal
          visible={confirmModalState.visible}
          title={confirmModalState.title}
          message={confirmModalState.message}
          confirmText={confirmModalState.confirmText}
          isDestructive={confirmModalState.isDestructive}
          onConfirm={confirmModalState.onConfirm}
          onCancel={() => setConfirmModalState(prev => ({ ...prev, visible: false }))}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

const getStyles = (colors: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    headerRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingBottom: 14,
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderLight,
    },
    closeBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.surfaceAlt,
      justifyContent: 'center',
      alignItems: 'center',
    },
    sheetTitle: {
      fontFamily: 'Cairo_700Bold',
      fontSize: 20,
      color: colors.text,
    },
    content: {
      padding: 16,
      gap: 14,
    },
    sectionCard: {
      backgroundColor: colors.surface,
      borderRadius: 20,
      padding: 16,
      gap: 14,
      borderWidth: 1,
      borderColor: colors.borderLight,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.04,
      shadowRadius: 6,
      elevation: 2,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginBottom: 2,
    },
    sectionIconBadge: {
      width: 34,
      height: 34,
      borderRadius: 12,
      backgroundColor: colors.primary + '14',
      justifyContent: 'center',
      alignItems: 'center',
    },
    sectionTitle: {
      fontFamily: 'Cairo_700Bold',
      fontSize: 15,
      color: colors.text,
    },
    userCard: {
      gap: 12,
      backgroundColor: colors.surfaceAlt,
      borderRadius: 16,
      padding: 14,
      borderWidth: 1,
      borderColor: colors.borderLight,
    },
    userInfoRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    userAvatar: {
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: colors.primary + '18',
      justifyContent: 'center',
      alignItems: 'center',
    },
    userName: {
      fontFamily: 'Cairo_700Bold',
      fontSize: 15,
      color: colors.text,
    },
    userSubtext: {
      fontFamily: 'Cairo_400Regular',
      fontSize: 11,
      color: colors.textSecondary,
    },
    userActionsRow: {
      flexDirection: 'row',
      gap: 10,
      marginTop: 4,
    },
    primaryActionBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary,
      borderRadius: 14,
      paddingVertical: 12,
      paddingHorizontal: 16,
      gap: 8,
    },
    primaryActionBtnText: {
      fontFamily: 'Cairo_700Bold',
      fontSize: 14,
      color: '#FFF',
    },
    secondaryActionBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.expense + '15',
      borderRadius: 14,
      paddingVertical: 12,
      paddingHorizontal: 16,
      gap: 6,
      borderWidth: 1,
      borderColor: colors.expense + '30',
    },
    secondaryActionBtnText: {
      fontFamily: 'Cairo_700Bold',
      fontSize: 13,
      color: colors.expense,
    },
    noUserBox: {
      alignItems: 'center',
      gap: 12,
      paddingVertical: 8,
    },
    noUserText: {
      fontFamily: 'Cairo_600SemiBold',
      fontSize: 13,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 20,
    },
    settingBlock: {
      gap: 8,
    },
    settingBlockLabel: {
      fontFamily: 'Cairo_600SemiBold',
      fontSize: 13,
      color: colors.textSecondary,
    },
    langRow: {
      flexDirection: 'row',
      gap: 10,
    },
    langOption: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 12,
      borderRadius: 14,
      backgroundColor: colors.surfaceAlt,
      borderWidth: 1.5,
      borderColor: colors.borderLight,
    },
    langOptionActive: {
      backgroundColor: colors.primary + '14',
      borderColor: colors.primary,
    },
    langText: {
      fontFamily: 'Cairo_700Bold',
      fontSize: 14,
      color: colors.textSecondary,
    },
    langTextActive: {
      color: colors.primary,
    },
    themeGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      gap: 8,
    },
    themeCardOption: {
      width: '48%',
      padding: 12,
      borderRadius: 14,
      backgroundColor: colors.surfaceAlt,
      borderWidth: 1.5,
      borderColor: colors.borderLight,
      gap: 6,
    },
    themeCardOptionActive: {
      backgroundColor: colors.primary + '14',
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
      fontSize: 12,
      color: colors.text,
    },
    themeCardTextActive: {
      color: colors.primary,
    },
    menuRowItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 12,
      paddingHorizontal: 14,
      borderRadius: 14,
      backgroundColor: colors.surfaceAlt,
      borderWidth: 1,
      borderColor: colors.borderLight,
    },
    menuRowLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      flex: 1,
    },
    menuRowText: {
      fontFamily: 'Cairo_600SemiBold',
      fontSize: 13,
      color: colors.text,
    },
    switchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 6,
    },
    switchLabel: {
      fontFamily: 'Cairo_600SemiBold',
      fontSize: 14,
      color: colors.text,
    },
    switchSubtext: {
      fontFamily: 'Cairo_400Regular',
      fontSize: 11,
      color: colors.textSecondary,
      marginTop: 1,
    },
    exportBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary,
      borderRadius: 14,
      paddingVertical: 12,
      gap: 8,
    },
    exportBtnOutline: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surfaceAlt,
      borderRadius: 14,
      paddingVertical: 12,
      gap: 8,
      borderWidth: 1,
      borderColor: colors.borderLight,
    },
    exportBtnText: {
      fontFamily: 'Cairo_700Bold',
      fontSize: 13,
      color: '#FFF',
    },
    backupRow: {
      flexDirection: 'row',
      gap: 10,
    },
    backupBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 14,
      paddingVertical: 11,
      gap: 6,
      borderWidth: 1,
    },
    backupBtnText: {
      fontFamily: 'Cairo_700Bold',
      fontSize: 12,
    },
    dangerSubtext: {
      fontFamily: 'Cairo_400Regular',
      fontSize: 11,
      color: colors.textSecondary,
      lineHeight: 16,
    },
    clearBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.expense,
      borderRadius: 14,
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
      gap: 4,
      marginTop: 4,
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
    },
    versionText: {
      fontFamily: 'Cairo_600SemiBold',
      fontSize: 10,
      color: colors.textSecondary,
      marginTop: 2,
    },
  });
