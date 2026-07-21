import React, { useState, useMemo } from 'react';
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
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import * as Crypto from 'expo-crypto';
import Colors from '@/constants/colors';
import { useTransactions } from '@/lib/TransactionContext';
import { WALLET_ICONS, WALLET_COLORS } from '@/lib/categories';
import { CURRENCIES, CurrencyCode, getCurrencyInfo } from '@/lib/storage';
import { useLanguage } from '@/lib/LanguageContext';
import { useTheme } from '@/lib/ThemeContext';
import { getWalletIconLabel, getCurrencyName } from '@/lib/i18n';
import { FinancialPlan, saveFinancialPlan } from '@/lib/planStorage';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';

export default function AddWalletScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const { addWallet, selectWallet } = useTransactions();
  const { t, language } = useLanguage();

  const [name, setName] = useState('');
  const [currency, setCurrency] = useState<CurrencyCode>('EGP');
  const [selectedIcon, setSelectedIcon] = useState('account-balance-wallet');
  const [selectedColor, setSelectedColor] = useState('#0D7C66');
  const [cardStyle, setCardStyle] = useState<'classic' | 'glass' | 'futuristic' | 'minimal'>('classic');
  const [isSaving, setIsSaving] = useState(false);

  const [isShared, setIsShared] = useState(false);
  const [shareWithUser, setShareWithUser] = useState('');

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert(t.error, t.enterWalletName);
      return;
    }
    setIsSaving(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const wallet = await addWallet(
      name.trim(),
      currency,
      selectedIcon,
      selectedColor,
      cardStyle,
      isShared ? shareWithUser.trim() : undefined
    );

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
    router.back();
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      <View style={styles.container}>
        <View style={[styles.headerRow, { backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border, paddingBottom: 12, zIndex: 10, elevation: 10 }]}>
          <Text style={styles.sheetTitle}>{t.newWallet}</Text>
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
          {/* Card Preview */}
          <View style={[
            {
              height: 170,
              borderRadius: 16,
              marginTop: 8,
              marginBottom: 20,
              position: 'relative',
              overflow: 'hidden',
              alignItems: 'stretch',
              justifyContent: 'space-between',
            },
            cardStyle === 'classic' && { backgroundColor: selectedColor },
            cardStyle === 'glass' && { backgroundColor: 'rgba(255, 255, 255, 0.03)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
            cardStyle === 'futuristic' && { backgroundColor: '#090D1A', borderWidth: 2, borderColor: selectedColor },
            cardStyle === 'minimal' && { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: selectedColor }
          ]}>
            {cardStyle === 'classic' && (
              <LinearGradient
                colors={[selectedColor, '#060B18']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFillObject}
              />
            )}
            {cardStyle === 'glass' && (
              <BlurView intensity={35} tint="dark" style={StyleSheet.absoluteFillObject} />
            )}

            {/* Card Content with absolute layout control */}
            <View style={{ flex: 1, justifyContent: 'space-between', paddingTop: 18, paddingBottom: 22, paddingHorizontal: 22 }}>
              {/* Top Header Row */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View>
                  <Text style={[
                    { fontFamily: 'Cairo_700Bold', fontSize: 16, color: '#fff' },
                    cardStyle === 'minimal' && { color: selectedColor }
                  ]} numberOfLines={1}>
                    {(name || t.walletName).toUpperCase()}
                  </Text>
                  <Text style={[
                    { fontFamily: 'Cairo_600SemiBold', fontSize: 9, color: 'rgba(255,255,255,0.6)' },
                    cardStyle === 'minimal' && { color: selectedColor + 'aa' }
                  ]}>
                    MIZAN PLATINUM
                  </Text>
                </View>
                <MaterialIcons name={selectedIcon as any} size={24} color={cardStyle === 'minimal' ? selectedColor : '#fff'} />
              </View>

              {/* Middle Balance Row (VERY LARGE & CLEAR) */}
              <View style={{ marginVertical: 2 }}>
                <Text style={{ fontFamily: 'Cairo_400Regular', fontSize: 8, color: cardStyle === 'minimal' ? selectedColor + 'aa' : 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: 1 }}>
                  {language === 'ar' ? 'الرصيد المتاح' : 'Available Balance'}
                </Text>
                <Text style={[
                  { fontFamily: 'Cairo_700Bold', fontSize: 26, color: '#fff', lineHeight: 32 },
                  cardStyle === 'minimal' && { color: selectedColor }
                ]} numberOfLines={1}>
                  0.00 <Text style={{ fontSize: 13, fontFamily: 'Cairo_600SemiBold' }}>{currency}</Text>
                </Text>
              </View>

              {/* Bottom Footer Row */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={[
                  { fontFamily: 'Cairo_600SemiBold', fontSize: 11, color: 'rgba(255,255,255,0.8)', letterSpacing: 1.5 },
                  cardStyle === 'minimal' && { color: selectedColor }
                ]}>
                  ••••  ••••  ••••  0000
                </Text>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={[
                    { fontFamily: 'Cairo_600SemiBold', fontSize: 10, color: '#fff' },
                    cardStyle === 'minimal' && { color: selectedColor }
                  ]}>
                    07/31
                  </Text>
                </View>
              </View>
            </View>
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

          <View style={styles.section}>
            <Text style={styles.label}>{language === 'ar' ? 'تصميم البطاقة' : 'Card Design'}</Text>
            <View style={styles.styleRow}>
              {([
                { key: 'classic', label: language === 'ar' ? 'كلاسيكي' : 'Classic' },
                { key: 'glass', label: language === 'ar' ? 'زجاجي' : 'Glass' },
                { key: 'futuristic', label: language === 'ar' ? 'مستقبلي' : 'Futuristic' },
                { key: 'minimal', label: language === 'ar' ? 'بسيط' : 'Minimal' }
              ] as const).map(s => (
                <Pressable
                  key={s.key}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setCardStyle(s.key);
                  }}
                  style={[
                    styles.styleChip,
                    cardStyle === s.key && { backgroundColor: selectedColor + '15', borderColor: selectedColor, borderWidth: 1.5 }
                  ]}
                >
                  <Text style={[styles.styleText, cardStyle === s.key && { color: selectedColor, fontFamily: 'Cairo_700Bold' }]}>
                    {s.label}
                  </Text>
                </Pressable>
              ))}
            </View>
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
            <Text style={styles.saveText}>{t.createWallet}</Text>
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
