import React, { useState, useMemo, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  Pressable,
  ScrollView,
  Alert,
  Switch,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import * as Crypto from 'expo-crypto';
import Colors from '@/constants/colors';
import { useTransactions } from '@/lib/TransactionContext';
import { WALLET_ICONS, WALLET_COLORS } from '@/lib/categories';
import { CURRENCIES, CurrencyCode, CardStyle, getCurrencyInfo } from '@/lib/storage';
import { useLanguage } from '@/lib/LanguageContext';
import { useTheme } from '@/lib/ThemeContext';
import { getWalletIconLabel, getCurrencyName } from '@/lib/i18n';
import { FinancialPlan, saveFinancialPlan, getFinancialPlan } from '@/lib/planStorage';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';

import { getOrCreateShareCode, syncSharedWalletByCode } from '@/lib/sharingService';
import { normalizeAmountInput } from '@/lib/arabicNumbers';
import AsyncStorage from '@react-native-async-storage/async-storage';
import WalletCardRender from '@/components/home/WalletCardRender';

export default function AddWalletScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const { walletId } = useLocalSearchParams<{ walletId?: string }>();
  const { addWallet, updateWallet, selectWallet, wallets } = useTransactions();
  const { t, language } = useLanguage();

  const existingWallet = useMemo(() => wallets.find((w) => w.id === walletId), [wallets, walletId]);
  const isEditing = Boolean(existingWallet);

  const [name, setName] = useState('');
  const [currency, setCurrency] = useState<CurrencyCode>('EGP');
  const [selectedIcon, setSelectedIcon] = useState('account-balance-wallet');
  const [selectedColor, setSelectedColor] = useState('#0D7C66');
  const [cardStyle, setCardStyle] = useState<CardStyle>('classic');
  const [isSaving, setIsSaving] = useState(false);

  const [isShared, setIsShared] = useState(false);
  const [shareWithUser, setShareWithUser] = useState('');

  const [excludeFromTotal, setExcludeFromTotal] = useState(false);
  const [initialBalance, setInitialBalance] = useState('');

  useEffect(() => {
    if (existingWallet) {
      setName(existingWallet.name || '');
      setCurrency(existingWallet.currency || 'EGP');
      setSelectedIcon(existingWallet.icon || 'account-balance-wallet');
      setSelectedColor(existingWallet.color || '#0D7C66');
      setCardStyle(existingWallet.cardStyle || 'classic');
      setExcludeFromTotal(Boolean(existingWallet.excludeFromTotal));
      setInitialBalance(existingWallet.initialBalance ? existingWallet.initialBalance.toString() : '');
      if (existingWallet.sharedWith) {
        setIsShared(true);
        setShareWithUser(existingWallet.sharedWith);
      }
    }
  }, [existingWallet]);

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert(t.error, t.enterWalletName);
      return;
    }
    setIsSaving(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    let ownerName = 'مالك المحفظة الأصلي';
    try {
      const u = await AsyncStorage.getItem('@masarif_username');
      if (u) ownerName = u;
    } catch {}

    const partnerName = shareWithUser.trim() || 'عضو مشارك';
    const sharedMembersList = isShared ? [
      { id: `mem_owner_${Date.now()}`, userId: `owner_${Date.now()}`, username: ownerName, role: 'owner', joinedAt: new Date().toISOString() },
      { id: `mem_partner_${Date.now()}`, userId: `partner_${Date.now()}`, username: partnerName, role: 'editor', joinedAt: new Date().toISOString() }
    ] : null;

    const sharedWithJson = sharedMembersList ? JSON.stringify(sharedMembersList) : undefined;

    const initialBalNum = parseFloat(normalizeAmountInput(initialBalance)) || 0;

    if (isEditing && existingWallet) {
      let code = existingWallet.shareCode;
      if (isShared) {
        code = await getOrCreateShareCode(existingWallet.id);
      }

      const updated = {
        ...existingWallet,
        name: name.trim(),
        currency,
        icon: selectedIcon,
        color: selectedColor,
        cardStyle,
        shareCode: isShared ? code : existingWallet.shareCode,
        sharedWith: sharedWithJson,
        excludeFromTotal,
        initialBalance: initialBalNum,
      };
      await updateWallet(updated);

      if (isShared && code) {
        await syncSharedWalletByCode(code);
      }

      // Also sync financial plan currency if changed
      try {
        const plan = await getFinancialPlan(existingWallet.id);
        if (plan && plan.currency !== currency) {
          const currInfo = getCurrencyInfo(currency);
          await saveFinancialPlan({
            ...plan,
            currency: currency,
            currencySymbol: currInfo.symbol,
          });
        }
      } catch (e) {}

      setIsSaving(false);
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace('/');
      }
      return;
    }

    const wallet = await addWallet(
      name.trim(),
      currency,
      selectedIcon,
      selectedColor,
      cardStyle,
      sharedWithJson,
      excludeFromTotal,
      initialBalNum
    );

    if (isShared) {
      const code = await getOrCreateShareCode(wallet.id);
      await syncSharedWalletByCode(code);
    }

    const currInfo = getCurrencyInfo(currency);
    const defaultPlan: FinancialPlan = {
      id: Crypto.randomUUID(),
      goalName: language === 'ar' ? 'خطة ادخار' : 'Savings Plan',
      durationMonths: 12,
      monthlyIncome: 0,
      monthlyExpense: 0,
      monthlySaving: 0,
      savingsGoal: 0,
      currency: currency,
      currencySymbol: currInfo.symbol,
      createdAt: new Date().toISOString(),
      walletId: wallet.id,
    };
    await saveFinancialPlan(defaultPlan);
    await selectWallet(wallet.id);

    setIsSaving(false);
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      <View style={styles.container}>
        <View style={[styles.headerRow, { backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border, paddingBottom: 12, zIndex: 10, elevation: 10 }]}>
          <Text style={styles.sheetTitle}>
            {isEditing ? (language === 'ar' ? 'تعديل المحفظة' : 'Edit Wallet') : t.newWallet}
          </Text>
          <Pressable 
            onPress={() => {
              Haptics.selectionAsync();
              if (router.canGoBack()) {
                router.back();
              } else {
                router.replace('/');
              }
            }} 
            hitSlop={20}
          >
            <Ionicons name="close" size={24} color={colors.textSecondary} />
          </Pressable>
        </View>

        <ScrollView
          style={{ flex: 1 }}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: (insets?.bottom || 0) + 20 }]}
          keyboardShouldPersistTaps="handled"
        >
          {/* Card Preview with Metallic 3D & Artistic Themes */}
          <View style={{ marginTop: 4, marginBottom: 16 }}>
            <WalletCardRender
              name={name || t.walletName}
              balanceFormatted={(parseFloat(normalizeAmountInput(initialBalance)) || 0).toFixed(2)}
              currencySymbol={currency}
              cardStyle={cardStyle}
              color={selectedColor}
              icon={selectedIcon}
              height={180}
            />
          </View>

          {/* Join shared wallet option */}
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push('/join-wallet' as any);
            }}
            style={styles.joinOptionCard}
          >
            <Ionicons name="people-outline" size={20} color={colors.primary} />
            <Text style={styles.joinOptionText}>
              {language === 'ar' ? 'لديك كود مشاركة؟ انضم لمحفظة عائلية' : 'Have a share code? Join a family wallet'}
            </Text>
            <Ionicons name={language === 'ar' ? 'chevron-back' : 'chevron-forward'} size={18} color={colors.primary} />
          </Pressable>

          <View style={styles.section}>
            <Text style={styles.label}>{t.walletName}</Text>
            <TextInput
              style={styles.input}
              placeholder={t.walletNamePlaceholder}
              placeholderTextColor={Colors.textTertiary}
              value={name}
              onChangeText={setName}
            />
          </View>

          {/* Initial Balance Input */}
          <View style={styles.section}>
            <Text style={styles.label}>
              {language === 'ar' ? `الرصيد الافتتاحي / المبلغ القديم (${currency})` : `Initial Balance / Pre-existing Funds (${currency})`}
            </Text>
            <Text style={{ fontFamily: 'Cairo_400Regular', fontSize: 11, color: colors.textSecondary, marginBottom: 6 }}>
              {language === 'ar'
                ? '💡 أدخل المبلغ الموجود معك سابقاً في هذه المحفظة (لا يُحسب كـ "دخل جديد")'
                : '💡 Enter pre-existing funds in this wallet (not counted as new monthly income)'}
            </Text>
            <TextInput
              style={styles.input}
              placeholder="0.00"
              placeholderTextColor={Colors.textTertiary}
              value={initialBalance}
              onChangeText={setInitialBalance}
              keyboardType="decimal-pad"
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>{language === 'ar' ? 'تصميم البطاقة' : 'Card Design'}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
              {([
                { key: 'classic', label: language === 'ar' ? '🏆 بنكي واقعي' : '🏆 Real Bank' },
                { key: 'royal', label: language === 'ar' ? '✨ ملكي مزخرف' : '✨ Royal Arabesque' },
                { key: 'cosmic', label: language === 'ar' ? '🌌 مجري فلكي' : '🌌 Cosmic Galaxy' },
                { key: 'glass', label: language === 'ar' ? '💎 كريستال زجاجي' : '💎 Frosted Glass' },
                { key: 'futuristic', label: language === 'ar' ? '🚀 سايبر مستقبلي' : '🚀 Cyber Laser' },
                { key: 'minimal', label: language === 'ar' ? '🖤 بلاتينيوم بسيط' : '🖤 Platinum Stealth' },
              ] as const).map(s => (
                <Pressable
                  key={s.key}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setCardStyle(s.key);
                  }}
                  style={[
                    styles.styleChip,
                    cardStyle === s.key && { backgroundColor: selectedColor + '20', borderColor: selectedColor, borderWidth: 1.5 }
                  ]}
                >
                  <Text style={[styles.styleText, cardStyle === s.key && { color: selectedColor, fontFamily: 'Cairo_700Bold' }]}>
                    {s.label}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>{t.currency}</Text>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.currencyScrollContent}
            >
              {CURRENCIES.map(cur => (
                <Pressable
                  key={cur.code}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setCurrency(cur.code);
                  }}
                  style={[
                    styles.currencyChip,
                    currency === cur.code && { backgroundColor: Colors.primary, borderColor: Colors.primary },
                  ]}
                >
                  <Text style={[
                    styles.currencySymbol,
                    currency === cur.code && { color: '#fff' },
                  ]}>
                    {cur.symbol}
                  </Text>
                  <Text style={[
                    styles.currencyName,
                    currency === cur.code && { color: '#fff' },
                  ]}>
                    {getCurrencyName(cur.code, language)}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>

          {/* Exclude from Consolidated Financial Picture Toggle */}
          <View style={[styles.section, {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: colors.surface,
            padding: 16,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: colors.border,
            marginBottom: 16,
          }]}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 14, color: colors.text, textAlign: 'left' }}>
                {language === 'ar' ? 'استبعاد من إجمالي الوضع المالي' : 'Exclude from Total Net Worth'}
              </Text>
              <Text style={{ fontFamily: 'Cairo_400Regular', fontSize: 11, color: colors.textSecondary, marginTop: 2, textAlign: 'left', lineHeight: 16 }}>
                {language === 'ar'
                  ? 'عند التفعيل، لن يدخل رصيد هذه المحفظة في الإجمالي الشامل لـ "الصورة الكاملة للوضع المالي"'
                  : 'Exclude this wallet balance from consolidated total'}
              </Text>
            </View>
            <Switch
              value={excludeFromTotal}
              onValueChange={(val) => {
                Haptics.selectionAsync();
                setExcludeFromTotal(val);
              }}
              trackColor={{ false: colors.border, true: colors.primary + '80' }}
              thumbColor={excludeFromTotal ? colors.primary : '#F4F3F4'}
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>{t.icon}</Text>
            <View style={styles.iconRow}>
              {WALLET_ICONS.map(item => (
                <Pressable
                  key={item.icon}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setSelectedIcon(item.icon);
                  }}
                  style={[
                    styles.iconItem,
                    selectedIcon === item.icon && { borderColor: selectedColor, borderWidth: 2 },
                  ]}
                >
                  <MaterialIcons name={item.icon as any} size={24} color={selectedIcon === item.icon ? selectedColor : Colors.textSecondary} />
                  <Text style={[styles.iconLabel, selectedIcon === item.icon && { color: selectedColor }]}>
                    {getWalletIconLabel(item.icon, language)}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>{t.color}</Text>
            <View style={styles.colorRow}>
              {WALLET_COLORS.map(color => (
                <Pressable
                  key={color}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setSelectedColor(color);
                  }}
                  style={[
                    styles.colorDot,
                    { backgroundColor: color },
                    selectedColor === color && styles.colorDotSelected,
                  ]}
                >
                  {selectedColor === color && (
                    <Ionicons name="checkmark" size={16} color="#fff" />
                  )}
                </Pressable>
              ))}
            </View>
          </View>

          {/* Shared Wallet Section */}
          <View style={styles.section}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <Text style={styles.label}>
                {language === 'ar' ? 'مشاركة المحفظة (عائلي / مشترك)' : 'Shared Wallet (Family / Joint)'}
              </Text>
              <Switch
                value={isShared}
                onValueChange={(val) => {
                  Haptics.selectionAsync();
                  setIsShared(val);
                }}
                trackColor={{ false: Colors.border, true: selectedColor }}
                thumbColor={Platform.OS === 'android' ? Colors.text : undefined}
              />
            </View>
            
            {isShared && (
              <TextInput
                style={{
                  backgroundColor: Colors.surfaceAlt,
                  borderRadius: 12,
                  height: 48,
                  paddingHorizontal: 12,
                  color: '#FFF',
                  fontFamily: 'Cairo_400Regular',
                  fontSize: 14,
                  borderWidth: 1,
                  borderColor: Colors.border,
                  textAlign: language === 'ar' ? 'right' : 'left',
                  marginTop: 4,
                }}
                placeholder={language === 'ar' ? 'اسم المستخدم للشريك' : 'Partner\'s username'}
                placeholderTextColor={Colors.textTertiary}
                value={shareWithUser}
                onChangeText={setShareWithUser}
                autoCapitalize="none"
                autoCorrect={false}
              />
            )}
          </View>

          <Pressable
            onPress={handleSave}
            disabled={isSaving || !name.trim()}
            style={({ pressed }) => [
              styles.saveButton,
              {
                backgroundColor: selectedColor,
                opacity: (isSaving || !name.trim()) ? 0.5 : pressed ? 0.9 : 1,
                transform: [{ scale: pressed ? 0.98 : 1 }],
              },
            ]}
          >
            <Ionicons name="checkmark" size={22} color="#fff" />
            <Text style={styles.saveText}>
              {isEditing ? (language === 'ar' ? 'حفظ التعديلات' : 'Save Changes') : t.createWallet}
            </Text>
          </Pressable>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

const getStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 8,
  },
  sheetTitle: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 20,
    color: colors.text,
  },
  scrollContent: {
    paddingHorizontal: 20,
  },
  previewCard: {
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    borderRadius: 16,
    paddingVertical: 20,
    marginTop: 8,
    marginBottom: 20,
    gap: 6,
  },
  previewIcon: {
    width: 60,
    height: 60,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  previewName: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 18,
    color: colors.text,
  },
  previewCurrency: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 14,
    color: colors.textSecondary,
  },
  section: {
    marginBottom: 18,
  },
  label: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 8,
  },
  input: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 16,
    color: colors.text,
  },
  currencyScrollContent: {
    flexDirection: 'row',
    gap: 8,
  },
  currencyChip: {
    width: 78,
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    borderRadius: 12,
    paddingVertical: 12,
    borderWidth: 2,
    borderColor: 'transparent',
    gap: 2,
  },
  currencySymbol: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 16,
    color: colors.text,
  },
  currencyName: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 11,
    color: colors.textSecondary,
  },
  iconRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  iconItem: {
    width: '30%',
    flexGrow: 1,
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    borderRadius: 12,
    paddingVertical: 10,
    gap: 4,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  iconLabel: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 11,
    color: colors.textSecondary,
  },
  colorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  colorDot: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorDotSelected: {
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.5)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 14,
    gap: 8,
    marginTop: 8,
    marginBottom: 20,
  },
  saveText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 17,
    color: colors.text,
  },
  styleRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 4,
  },
  styleChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  styleText: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 12,
    color: colors.textSecondary,
  },
  joinOptionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    gap: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  joinOptionText: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 13,
    color: colors.primary,
    flex: 1,
    textAlign: 'left',
  },
});
