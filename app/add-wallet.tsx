import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  Pressable,
  ScrollView,
  Alert,
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
import { getWalletIconLabel, getCurrencyName } from '@/lib/i18n';
import { FinancialPlan, saveFinancialPlan } from '@/lib/planStorage';

export default function AddWalletScreen() {
  const insets = useSafeAreaInsets();
  const { addWallet } = useTransactions();
  const { t, language } = useLanguage();

  const [name, setName] = useState('');
  const [currency, setCurrency] = useState<CurrencyCode>('EGP');
  const [selectedIcon, setSelectedIcon] = useState('account-balance-wallet');
  const [selectedColor, setSelectedColor] = useState('#0D7C66');
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert(t.error, t.enterWalletName);
      return;
    }
    setIsSaving(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const wallet = await addWallet(name.trim(), currency, selectedIcon, selectedColor);

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

    setIsSaving(false);
    router.back();
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.sheetTitle}>{t.newWallet}</Text>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="close" size={24} color={Colors.textSecondary} />
        </Pressable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 20 }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.previewCard}>
          <View style={[styles.previewIcon, { backgroundColor: selectedColor + '20' }]}>
            <MaterialIcons name={selectedIcon as any} size={32} color={selectedColor} />
          </View>
          <Text style={styles.previewName}>{name || t.walletName}</Text>
          <Text style={styles.previewCurrency}>
            {getCurrencyName(currency, language)}
          </Text>
        </View>

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
          <Text style={styles.label}>{t.currency}</Text>
          <View style={styles.currencyRow}>
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
          </View>
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
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.surface,
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
    color: Colors.text,
  },
  scrollContent: {
    paddingHorizontal: 20,
  },
  previewCard: {
    alignItems: 'center',
    backgroundColor: Colors.surfaceAlt,
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
    color: Colors.text,
  },
  previewCurrency: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 14,
    color: Colors.textSecondary,
  },
  section: {
    marginBottom: 18,
  },
  label: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 8,
  },
  input: {
    backgroundColor: Colors.surfaceAlt,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 16,
    color: Colors.text,
  },
  currencyRow: {
    flexDirection: 'row',
    gap: 8,
  },
  currencyChip: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: Colors.surfaceAlt,
    borderRadius: 12,
    paddingVertical: 12,
    borderWidth: 2,
    borderColor: 'transparent',
    gap: 2,
  },
  currencySymbol: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 16,
    color: Colors.text,
  },
  currencyName: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 11,
    color: Colors.textSecondary,
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
    backgroundColor: Colors.surfaceAlt,
    borderRadius: 12,
    paddingVertical: 10,
    gap: 4,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  iconLabel: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 11,
    color: Colors.textSecondary,
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
    color: '#fff',
  },
});
