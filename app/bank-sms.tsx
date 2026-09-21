import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
  TextInput,
  Alert,
  Platform,
  Switch,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/lib/ThemeContext';
import { useLanguage } from '@/lib/LanguageContext';
import { useTransactions } from '@/lib/TransactionContext';
import { expenseCategories, incomeCategories, formatCurrency } from '@/lib/categories';
import { getCategoryName } from '@/lib/i18n';
import { parseBankSMS, ParsedBankSMS } from '@/lib/smsParser';
import {
  getClipboardSmsSettings,
  saveClipboardSmsSettings,
  saveParsedSmsTransaction,
  ClipboardSmsSettings,
} from '@/lib/clipboardSmsService';

const SAMPLE_PRESETS = [
  {
    title: 'CIB - مصر',
    text: 'CIB Purchase: EGP 450.00 at Carrefour on Card ***1234. Available balance: EGP 12,400.00.',
  },
  {
    title: 'مصرف الراجحي - السعودية',
    text: 'شراء بقيمة 45.00 ر.س لدى Starbucks من بطاقتك مدى ***9876 الرصيد المتاح 3,450.00 ر.س',
  },
  {
    title: 'InstaPay - إنستاباي',
    text: 'تم استلام تحويل بمبلغ 1,500.00 ج.م عبر انستاباي InstaPay من أحمد محمود في حسابك لدى البنك الأهلي المصري',
  },
  {
    title: 'NBK - بنك الكويت الوطني',
    text: 'NBK POS Purchase of KWD 18.500 at Lulu Hypermarket with card ending in 4321',
  },
  {
    title: 'فودافون كاش',
    text: 'تم خصم مبلغ 250.00 جنيه مصاريف شحن فواتير فوري من محفظة فودافون كاش الخاصة بك',
  },
];

export default function BankSmsScreen() {
  const { colors, theme } = useTheme();
  const styles = useMemo(() => getStyles(colors, theme), [colors, theme]);
  const insets = useSafeAreaInsets();
  const { language } = useLanguage();
  const isAr = language === 'ar';
  const { wallets, selectedWallet, refresh } = useTransactions();

  const loc = (ar: string, en: string, ml?: string) => {
    if (language === 'ml' || language === 'hi') return ml || en;
    if (language === 'ar') return ar;
    return en;
  };

  // State
  const [inputText, setInputText] = useState('');
  const [parsedResult, setParsedResult] = useState<ParsedBankSMS | null>(null);
  const [targetWalletId, setTargetWalletId] = useState<string>(selectedWallet?.id || wallets[0]?.id || '');
  const [selectedCategory, setSelectedCategory] = useState<string>('other');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [settings, setSettings] = useState<ClipboardSmsSettings>({
    autoDetect: true,
    notifyHaptic: true,
    lastProcessedText: '',
  });

  // Load Settings
  useEffect(() => {
    getClipboardSmsSettings().then(setSettings);
  }, []);

  // Update target wallet if selected wallet changes
  useEffect(() => {
    if (selectedWallet && !targetWalletId) {
      setTargetWalletId(selectedWallet.id);
    }
  }, [selectedWallet]);

  // Parse whenever input text changes
  useEffect(() => {
    if (!inputText.trim() || inputText.trim().length < 6) {
      setParsedResult(null);
      return;
    }

    const res = parseBankSMS(inputText);
    setParsedResult(res);
    if (res?.category) {
      setSelectedCategory(res.category);
    }
  }, [inputText]);

  // Read directly from Clipboard
  const handlePasteFromClipboard = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const text = await Clipboard.getStringAsync();
      if (!text || text.trim().length === 0) {
        Alert.alert(
          loc('الحافظة فارغة', 'Clipboard is Empty'),
          loc('لم يتم العثور على أي نص منسوخ في الحافظة.', 'No text was found in your clipboard.')
        );
        return;
      }
      setInputText(text.trim());
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      Alert.alert(loc('خطأ', 'Error'), loc('تعذر قراءة الحافظة', 'Failed to read clipboard'));
    }
  };

  // Save Transaction
  const handleSaveTransaction = async () => {
    if (!parsedResult || parsedResult.amount === null || parsedResult.amount <= 0) {
      Alert.alert(
        loc('بيانات غير مكتملة', 'Incomplete Data'),
        loc('يرجى التأكد من احتواء الرسالة على مبلغ صحيح.', 'Please ensure the message contains a valid amount.')
      );
      return;
    }

    const wallet = wallets.find(w => w.id === targetWalletId) || wallets[0];
    if (!wallet) {
      Alert.alert(loc('تنبيه', 'Notice'), loc('يرجى اختيار محفظة لحفظ المعاملة فيها.', 'Please select a wallet.'));
      return;
    }

    try {
      setIsSaving(true);
      await saveParsedSmsTransaction(parsedResult, wallet.id, selectedCategory);
      refresh();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      const msg = loc(
        `تم تسجيل ${parsedResult.type === 'expense' ? 'مصروف' : 'دخل'} بقيمة ${parsedResult.amount} ${wallet.currency} في محفظة ${wallet.name} بنجاح 🎉`,
        `Successfully logged ${parsedResult.amount} ${wallet.currency} in ${wallet.name} 🎉`
      );
      setSaveSuccessMsg(msg);
      setInputText('');
      setParsedResult(null);

      setTimeout(() => {
        setSaveSuccessMsg(null);
      }, 5000);
    } catch (e) {
      Alert.alert(loc('خطأ', 'Error'), loc('حدث خطأ أثناء حفظ المعاملة', 'Error saving transaction'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleAutoDetect = async (val: boolean) => {
    const updated = await saveClipboardSmsSettings({ autoDetect: val });
    setSettings(updated);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleToggleHaptic = async (val: boolean) => {
    const updated = await saveClipboardSmsSettings({ notifyHaptic: val });
    setSettings(updated);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleBack = () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/settings');
    }
  };

  const handleCloseToHome = () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    router.replace('/(tabs)');
  };

  const currentCategories = parsedResult?.type === 'income' ? incomeCategories : expenseCategories;

  return (
    <View style={[styles.container, { paddingTop: insets.top || (Platform.OS === 'web' ? 10 : 0) }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.7 }]}
          onPress={handleBack}
          hitSlop={14}
        >
          <Ionicons name={isAr ? 'chevron-forward' : 'chevron-back'} size={24} color={colors.text} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>{loc('قارئ رسائل البنك الذكي', 'Smart Bank SMS')}</Text>
          <Text style={styles.headerSubtitle}>{loc('تحليل فوري آمن ومحلي 100%', '100% Local & Secure')}</Text>
        </View>
        <Pressable
          style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.7 }]}
          onPress={handleCloseToHome}
          hitSlop={14}
        >
          <Ionicons name="close" size={22} color={colors.text} />
        </Pressable>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Success Banner */}
        {saveSuccessMsg && (
          <View style={styles.successBanner}>
            <Ionicons name="checkmark-circle" size={22} color="#10B981" />
            <Text style={styles.successBannerText}>{saveSuccessMsg}</Text>
          </View>
        )}

        {/* Security / Trust Card */}
        <LinearGradient
          colors={['#10B98115', '#05966908']}
          style={styles.trustCard}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={styles.trustHeader}>
            <View style={styles.trustIconWrap}>
              <Ionicons name="shield-checkmark" size={20} color="#10B981" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.trustTitle}>
                {loc('بديل الربط البنكي: أمان كامل وخصوصية تامة', 'Direct Bank Alternative: 100% Privacy')}
              </Text>
              <Text style={styles.trustDesc}>
                {loc(
                  'لا نطلب أبداً أي بيانات دخول أو كلمات سر. قراءة وتحليل نصوص الرسائل تتم محلياً على هاتفك فقط دون أي اتصال خارجي.',
                  'No credentials or passwords needed. SMS processing is 100% offline on your device.'
                )}
              </Text>
            </View>
          </View>
          <View style={styles.trustBadgesRow}>
            <View style={styles.trustBadge}>
              <Ionicons name="wifi-outline" size={13} color="#10B981" />
              <Text style={styles.trustBadgeText}>{loc('أوفلاين بالكامل', '100% Offline')}</Text>
            </View>
            <View style={styles.trustBadge}>
              <Ionicons name="key-outline" size={13} color="#10B981" />
              <Text style={styles.trustBadgeText}>{loc('بدون كلمات سر', 'No Passwords')}</Text>
            </View>
            <View style={styles.trustBadge}>
              <Ionicons name="card-outline" size={13} color="#10B981" />
              <Text style={styles.trustBadgeText}>{loc('يدعم كل البنوك', 'All Banks')}</Text>
            </View>
          </View>
        </LinearGradient>

        {/* SMS Input Box */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name="chatbox-ellipses-outline" size={20} color={colors.primary} />
              <Text style={styles.cardTitle}>
                {loc('الصق أو اكتب رسالة البنك هنا', 'Paste or Type Bank SMS Here')}
              </Text>
            </View>
            {inputText.length > 0 && (
              <Pressable onPress={() => setInputText('')}>
                <Text style={styles.clearText}>{loc('مسح', 'Clear')}</Text>
              </Pressable>
            )}
          </View>

          <TextInput
            style={styles.textInput}
            value={inputText}
            onChangeText={setInputText}
            placeholder={loc(
              'مثال: CIB Purchase: EGP 450 at Carrefour... أو تم خصم 100 ر.س لدى...',
              'e.g. CIB Purchase: EGP 450 at Carrefour...'
            )}
            placeholderTextColor={colors.textTertiary}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />

          {/* Action Row */}
          <View style={styles.inputActionsRow}>
            <Pressable
              style={({ pressed }) => [styles.pasteClipboardBtn, pressed && { opacity: 0.8 }]}
              onPress={handlePasteFromClipboard}
            >
              <Ionicons name="clipboard-outline" size={18} color="#FFF" />
              <Text style={styles.pasteClipboardBtnText}>
                {loc('لصق من الحافظة (Clipboard)', 'Paste from Clipboard')}
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Live Parsed Result Card */}
        {parsedResult && parsedResult.amount !== null && (
          <View style={styles.resultCard}>
            <View style={styles.resultHeader}>
              <View style={styles.resultBankBadge}>
                <Ionicons name="business" size={16} color="#10B981" />
                <Text style={styles.resultBankText}>{parsedResult.bankName}</Text>
              </View>

              <View
                style={[
                  styles.resultTypeBadge,
                  {
                    backgroundColor:
                      parsedResult.type === 'expense' ? '#EF444420' : '#10B98120',
                  },
                ]}
              >
                <Text
                  style={[
                    styles.resultTypeText,
                    {
                      color: parsedResult.type === 'expense' ? '#EF4444' : '#10B981',
                    },
                  ]}
                >
                  {parsedResult.type === 'expense'
                    ? loc('مصروف (خصم)', 'Expense (Debit)')
                    : loc('دخل (إيداع)', 'Income (Credit)')}
                </Text>
              </View>
            </View>

            {/* Amount */}
            <View style={styles.resultAmountRow}>
              <Text style={styles.resultAmountLabel}>{loc('المبلغ المكتشف:', 'Detected Amount:')}</Text>
              <Text
                style={[
                  styles.resultAmountValue,
                  {
                    color: parsedResult.type === 'expense' ? '#EF4444' : '#10B981',
                  },
                ]}
              >
                {parsedResult.amount.toLocaleString()} {parsedResult.currency}
              </Text>
            </View>

            {/* Merchant */}
            {parsedResult.merchant && (
              <View style={styles.resultDetailRow}>
                <Ionicons name="storefront-outline" size={16} color={colors.textSecondary} />
                <Text style={styles.resultDetailLabel}>{loc('التاجر / المتجر:', 'Merchant:')}</Text>
                <Text style={styles.resultDetailValue}>{parsedResult.merchant}</Text>
              </View>
            )}

            {/* Card Number if available */}
            {parsedResult.cardNumber && (
              <View style={styles.resultDetailRow}>
                <Ionicons name="card-outline" size={16} color={colors.textSecondary} />
                <Text style={styles.resultDetailLabel}>{loc('رقم البطاقة:', 'Card ending:')}</Text>
                <Text style={styles.resultDetailValue}>**** {parsedResult.cardNumber}</Text>
              </View>
            )}

            {/* Select Target Wallet */}
            <View style={{ marginTop: 12 }}>
              <Text style={styles.subSectionTitle}>
                {loc('إضافة إلى المحفظة:', 'Add to Wallet:')}
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 6 }}>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {wallets.map(w => {
                    const isSelected = w.id === targetWalletId;
                    return (
                      <Pressable
                        key={w.id}
                        onPress={() => {
                          setTargetWalletId(w.id);
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        }}
                        style={[
                          styles.walletChip,
                          isSelected && { borderColor: colors.primary, backgroundColor: colors.primary + '18' },
                        ]}
                      >
                        <View style={[styles.walletDot, { backgroundColor: w.color || colors.primary }]} />
                        <Text
                          style={[
                            styles.walletChipText,
                            isSelected && { color: colors.primary, fontFamily: 'Cairo_700Bold' },
                          ]}
                        >
                          {w.name} ({w.currency})
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </ScrollView>
            </View>

            {/* Select Category */}
            <View style={{ marginTop: 12 }}>
              <Text style={styles.subSectionTitle}>
                {loc('التصنيف المقترح:', 'Suggested Category:')}
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 6 }}>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {currentCategories.slice(0, 10).map(cat => {
                    const isSelected = selectedCategory === cat.id;
                    return (
                      <Pressable
                        key={cat.id}
                        onPress={() => {
                          setSelectedCategory(cat.id);
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        }}
                        style={[
                          styles.catChip,
                          isSelected && { backgroundColor: colors.primary, borderColor: colors.primary },
                        ]}
                      >
                        <Text
                          style={[
                            styles.catChipText,
                            isSelected && { color: '#FFF', fontFamily: 'Cairo_700Bold' },
                          ]}
                        >
                          {getCategoryName(cat.id, language)}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </ScrollView>
            </View>

            {/* Save Transaction Button */}
            <Pressable
              style={({ pressed }) => [styles.saveBtn, pressed && { opacity: 0.8 }]}
              onPress={handleSaveTransaction}
              disabled={isSaving}
            >
              <LinearGradient
                colors={['#10B981', '#059669']}
                style={styles.saveBtnGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Ionicons name="checkmark-circle-outline" size={20} color="#FFF" />
                <Text style={styles.saveBtnText}>
                  {loc('تسجيل المعاملة فوراً في المحفظة 🎉', 'Save Transaction to Wallet 🎉')}
                </Text>
              </LinearGradient>
            </Pressable>
          </View>
        )}

        {/* Presets to test */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            {loc('نماذج جاهزة لتجربة التحليل السريع:', 'Try Sample SMS Messages:')}
          </Text>
          <Text style={styles.presetHelpText}>
            {loc('اضغط على أي رسالة لتجربتها وملاحظة كيفية استخراج البيانات تلقائياً:', 'Tap any sample to test parsing:')}
          </Text>
          <View style={{ gap: 8, marginTop: 8 }}>
            {SAMPLE_PRESETS.map((preset, idx) => (
              <Pressable
                key={idx}
                style={({ pressed }) => [styles.presetItem, pressed && { opacity: 0.7 }]}
                onPress={() => {
                  setInputText(preset.text);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
              >
                <View style={styles.presetTop}>
                  <Ionicons name="flash-outline" size={14} color={colors.primary} />
                  <Text style={styles.presetTitle}>{preset.title}</Text>
                </View>
                <Text style={styles.presetText} numberOfLines={2}>
                  {preset.text}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Settings & Automation */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{loc('إعدادات الالتقاط الذكي', 'Smart Detection Settings')}</Text>

          <View style={styles.settingRow}>
            <View style={{ flex: 1, paddingRight: isAr ? 0 : 12, paddingLeft: isAr ? 12 : 0 }}>
              <Text style={styles.settingLabel}>
                {loc('الكشف التلقائي عن الحافظة عند فتح التطبيق', 'Auto-Detect Clipboard on App Open')}
              </Text>
              <Text style={styles.settingDesc}>
                {loc(
                  'عند نسخ رسالة بنكية وفتح التطبيق، يسألك تلقائياً لتسجيل المصروف بضغطة زر واحدة.',
                  'Automatically prompts you when a copied bank SMS is found upon opening the app.'
                )}
              </Text>
            </View>
            <Switch
              value={settings.autoDetect}
              onValueChange={handleToggleAutoDetect}
              trackColor={{ false: colors.border, true: '#10B981' }}
              thumbColor="#FFF"
            />
          </View>

          <View style={[styles.settingRow, { borderBottomWidth: 0, paddingBottom: 0 }]}>
            <View style={{ flex: 1, paddingRight: isAr ? 0 : 12, paddingLeft: isAr ? 12 : 0 }}>
              <Text style={styles.settingLabel}>
                {loc('الاهتزاز التفاعلي عند اكتشاف رسالة', 'Haptic Feedback on Detect')}
              </Text>
              <Text style={styles.settingDesc}>
                {loc('اهتزاز خفيف عند تأكيد صحة الرسالة البنكية.', 'Subtle vibration when a valid SMS is detected.')}
              </Text>
            </View>
            <Switch
              value={settings.notifyHaptic}
              onValueChange={handleToggleHaptic}
              trackColor={{ false: colors.border, true: '#10B981' }}
              thumbColor="#FFF"
            />
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

function getStyles(colors: any, theme: string) {
  const isDark = theme === 'dark';
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: colors.card,
    },
    backBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isDark ? '#ffffff10' : '#00000008',
    },
    headerCenter: {
      alignItems: 'center',
    },
    headerTitle: {
      fontFamily: 'Cairo_700Bold',
      fontSize: 17,
      color: colors.text,
    },
    headerSubtitle: {
      fontFamily: 'Cairo_400Regular',
      fontSize: 11,
      color: '#10B981',
      marginTop: -2,
    },
    scroll: {
      flex: 1,
    },
    scrollContent: {
      padding: 16,
      gap: 16,
    },
    successBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: '#10B98115',
      borderWidth: 1,
      borderColor: '#10B98140',
      borderRadius: 14,
      padding: 14,
    },
    successBannerText: {
      flex: 1,
      fontFamily: 'Cairo_700Bold',
      fontSize: 13,
      color: '#10B981',
      lineHeight: 20,
    },
    trustCard: {
      borderRadius: 16,
      padding: 16,
      borderWidth: 1,
      borderColor: '#10B98130',
    },
    trustHeader: {
      flexDirection: 'row',
      gap: 12,
    },
    trustIconWrap: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: '#10B98120',
      alignItems: 'center',
      justifyContent: 'center',
    },
    trustTitle: {
      fontFamily: 'Cairo_700Bold',
      fontSize: 14,
      color: colors.text,
    },
    trustDesc: {
      fontFamily: 'Cairo_400Regular',
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 4,
      lineHeight: 18,
    },
    trustBadgesRow: {
      flexDirection: 'row',
      gap: 8,
      marginTop: 12,
      flexWrap: 'wrap',
    },
    trustBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      backgroundColor: '#10B98115',
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 20,
    },
    trustBadgeText: {
      fontFamily: 'Cairo_600SemiBold',
      fontSize: 11,
      color: '#10B981',
    },
    card: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border,
    },
    cardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 10,
    },
    cardTitle: {
      fontFamily: 'Cairo_700Bold',
      fontSize: 14,
      color: colors.text,
    },
    clearText: {
      fontFamily: 'Cairo_600SemiBold',
      fontSize: 12,
      color: '#EF4444',
    },
    textInput: {
      backgroundColor: isDark ? '#ffffff08' : '#00000005',
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 12,
      color: colors.text,
      fontFamily: 'Cairo_400Regular',
      fontSize: 13,
      minHeight: 90,
      lineHeight: 20,
    },
    inputActionsRow: {
      flexDirection: 'row',
      marginTop: 12,
      gap: 10,
    },
    pasteClipboardBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: colors.primary,
      borderRadius: 12,
      paddingVertical: 12,
    },
    pasteClipboardBtnText: {
      fontFamily: 'Cairo_700Bold',
      fontSize: 13,
      color: '#FFF',
    },
    resultCard: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 16,
      borderWidth: 1.5,
      borderColor: '#10B98180',
    },
    resultHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    resultBankBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: '#10B98115',
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 8,
    },
    resultBankText: {
      fontFamily: 'Cairo_700Bold',
      fontSize: 12,
      color: '#10B981',
    },
    resultTypeBadge: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 8,
    },
    resultTypeText: {
      fontFamily: 'Cairo_700Bold',
      fontSize: 11,
    },
    resultAmountRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      marginTop: 14,
      paddingBottom: 10,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    resultAmountLabel: {
      fontFamily: 'Cairo_600SemiBold',
      fontSize: 13,
      color: colors.textSecondary,
    },
    resultAmountValue: {
      fontFamily: 'Cairo_700Bold',
      fontSize: 22,
    },
    resultDetailRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: 8,
    },
    resultDetailLabel: {
      fontFamily: 'Cairo_400Regular',
      fontSize: 12,
      color: colors.textSecondary,
    },
    resultDetailValue: {
      fontFamily: 'Cairo_700Bold',
      fontSize: 12,
      color: colors.text,
    },
    subSectionTitle: {
      fontFamily: 'Cairo_600SemiBold',
      fontSize: 12,
      color: colors.textSecondary,
    },
    walletChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
    },
    walletDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    walletChipText: {
      fontFamily: 'Cairo_600SemiBold',
      fontSize: 12,
      color: colors.text,
    },
    catChip: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: isDark ? '#ffffff08' : '#00000005',
    },
    catChipText: {
      fontFamily: 'Cairo_600SemiBold',
      fontSize: 11,
      color: colors.textSecondary,
    },
    saveBtn: {
      marginTop: 16,
      borderRadius: 14,
      overflow: 'hidden',
    },
    saveBtnGradient: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 14,
    },
    saveBtnText: {
      fontFamily: 'Cairo_700Bold',
      fontSize: 14,
      color: '#FFF',
    },
    presetHelpText: {
      fontFamily: 'Cairo_400Regular',
      fontSize: 11,
      color: colors.textTertiary,
      marginTop: 2,
    },
    presetItem: {
      backgroundColor: isDark ? '#ffffff06' : '#00000004',
      borderRadius: 10,
      padding: 10,
      borderWidth: 1,
      borderColor: colors.border,
    },
    presetTop: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: 4,
    },
    presetTitle: {
      fontFamily: 'Cairo_700Bold',
      fontSize: 12,
      color: colors.primary,
    },
    presetText: {
      fontFamily: 'Cairo_400Regular',
      fontSize: 11,
      color: colors.textSecondary,
      lineHeight: 16,
    },
    settingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    settingLabel: {
      fontFamily: 'Cairo_700Bold',
      fontSize: 13,
      color: colors.text,
    },
    settingDesc: {
      fontFamily: 'Cairo_400Regular',
      fontSize: 11,
      color: colors.textSecondary,
      marginTop: 2,
      lineHeight: 16,
    },
  });
}
