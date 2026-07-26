import React, { useState, useEffect, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Modal,
  Pressable,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Crypto from 'expo-crypto';
import { useTheme } from '@/lib/ThemeContext';
import { useLanguage } from '@/lib/LanguageContext';
import { useTransactions } from '@/lib/TransactionContext';
import { getExchangeRatesDetails, convertAmount, FALLBACK_RATES } from '@/lib/currencyApi';
import { saveRemittance, Remittance } from '@/lib/remittanceStorage';

interface SendRemittanceModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function SendRemittanceModal({
  visible,
  onClose,
  onSuccess,
}: SendRemittanceModalProps) {
  const { colors, theme } = useTheme();
  const { language } = useLanguage();
  const { wallets, addTransaction } = useTransactions();
  const styles = useMemo(() => getStyles(colors, theme), [colors, theme]);

  const [fromWalletId, setFromWalletId] = useState<string>('');
  const [toWalletId, setToWalletId] = useState<string>('');
  const [amount, setAmount] = useState<string>('300');
  const [note, setNote] = useState<string>('');
  const [rates, setRates] = useState<Record<string, number>>(FALLBACK_RATES);
  const [customRate, setCustomRate] = useState<string>('');
  const [isLive, setIsLive] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(false);

  // Initialize wallets
  useEffect(() => {
    const list = wallets || [];
    if (list.length > 0) {
      if (!fromWalletId) setFromWalletId(list[0].id);
      if (!toWalletId) {
        const target = list.find((w) => w.id !== list[0].id) || list[0];
        setToWalletId(target.id);
      }
    }
  }, [wallets]);

  // Fetch Live Rates
  useEffect(() => {
    async function loadRates() {
      try {
        const details = await getExchangeRatesDetails();
        setRates(details.rates || FALLBACK_RATES);
        setIsLive(!!details.isLive);
      } catch (e) {
        setRates(FALLBACK_RATES);
      }
    }
    if (visible) {
      loadRates();
    }
  }, [visible]);

  const fromWallet = useMemo(() => (wallets || []).find((w) => w.id === fromWalletId), [wallets, fromWalletId]);
  const toWallet = useMemo(() => (wallets || []).find((w) => w.id === toWalletId), [wallets, toWalletId]);

  const fromCurrency = fromWallet?.currency || 'USD';
  const toCurrency = toWallet?.currency || 'EGP';

  // Calculate Converted Amount
  const convertedAmount = useMemo(() => {
    const num = parseFloat(amount);
    if (isNaN(num) || num <= 0) return 0;
    if (customRate && parseFloat(customRate) > 0) {
      return num * parseFloat(customRate);
    }
    return convertAmount(num, fromCurrency, toCurrency, rates);
  }, [amount, fromCurrency, toCurrency, rates, customRate]);

  const effectiveRate = useMemo(() => {
    if (customRate && parseFloat(customRate) > 0) return parseFloat(customRate);
    return convertAmount(1, fromCurrency, toCurrency, rates);
  }, [fromCurrency, toCurrency, rates, customRate]);

  const handleSend = async () => {
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      Alert.alert(
        language === 'ar' ? 'خطأ' : 'Error',
        language === 'ar' ? 'يرجى إدخال مبلغ تحويل صحيح' : 'Please enter a valid transfer amount'
      );
      return;
    }

    if (!fromWallet || !toWallet || fromWallet.id === toWallet.id) {
      Alert.alert(
        language === 'ar' ? 'تنبيه' : 'Warning',
        language === 'ar' ? 'يرجى اختيار محفظتين مختلفين للحوالة' : 'Please select two different wallets'
      );
      return;
    }

    setLoading(true);
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      const remittanceId = 'rem_' + Crypto.randomUUID().slice(0, 8);
      const nowStr = new Date().toISOString();

      // 1. Deduct from Source Expat Wallet (KWD)
      await addTransaction({
        id: 'rem_exp_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
        type: 'expense',
        amount: numAmount,
        category: 'other',
        description: note
          ? `حوالة عائلية للبيت: ${note}`
          : `حوالة عائلية إلى (${toWallet.name})`,
        date: nowStr,
        createdAt: nowStr,
        walletId: fromWallet.id,
      });

      // 2. Add Income to Target Home Wallet (EGP)
      await addTransaction({
        id: 'rem_inc_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
        type: 'income',
        amount: convertedAmount,
        category: 'other',
        description: note
          ? `حوالة واردة من المغترب: ${note}`
          : `حوالة واردة من (${fromWallet.name})`,
        date: nowStr,
        createdAt: nowStr,
        walletId: toWallet.id,
      });

      // 3. Save Remittance metadata record
      const remittanceRecord: Remittance = {
        id: remittanceId,
        fromWalletId: fromWallet.id,
        toWalletId: toWallet.id,
        fromAmount: numAmount,
        fromCurrency,
        toAmount: convertedAmount,
        toCurrency,
        exchangeRate: effectiveRate,
        note: note || (language === 'ar' ? 'مصاريف عائلية' : 'Family Allowance'),
        date: nowStr,
      };

      await saveRemittance(remittanceRecord);

      if (onSuccess) onSuccess();
      onClose();
    } catch (e) {
      console.error('Error executing remittance:', e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={styles.iconCircle}>
                <Ionicons name="paper-plane" size={20} color="#3B82F6" />
              </View>
              <Text style={styles.title}>
                {language === 'ar' ? 'إرسال حوالة للبيت' : 'Send Family Remittance'}
              </Text>
            </View>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color={colors.textSecondary} />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 16 }}>
            {/* Wallets Selection Row */}
            <View style={styles.walletsCard}>
              <View style={styles.walletCol}>
                <Text style={styles.label}>{language === 'ar' ? 'المحفظة المصدر' : 'From Expat Wallet'}</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 4 }}>
                  {wallets.map((w) => (
                    <Pressable
                      key={'from_' + w.id}
                      onPress={() => setFromWalletId(w.id)}
                      style={[
                        styles.walletChip,
                        fromWalletId === w.id && { borderColor: w.color, backgroundColor: w.color + '15' },
                      ]}
                    >
                      <Text style={[styles.chipText, fromWalletId === w.id && { color: w.color, fontFamily: 'Cairo_700Bold' }]}>
                        {w.name} ({w.currency})
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>

              <View style={{ alignItems: 'center', marginVertical: 6 }}>
                <Ionicons name="arrow-down-circle" size={24} color="#3B82F6" />
              </View>

              <View style={styles.walletCol}>
                <Text style={styles.label}>{language === 'ar' ? 'محفظة البيت المستلمة' : 'To Home Wallet'}</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 4 }}>
                  {wallets.map((w) => (
                    <Pressable
                      key={'to_' + w.id}
                      onPress={() => setToWalletId(w.id)}
                      style={[
                        styles.walletChip,
                        toWalletId === w.id && { borderColor: w.color, backgroundColor: w.color + '15' },
                      ]}
                    >
                      <Text style={[styles.chipText, toWalletId === w.id && { color: w.color, fontFamily: 'Cairo_700Bold' }]}>
                        {w.name} ({w.currency})
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            </View>

            {/* Amount Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>
                {language === 'ar' ? `المبلغ المحول بـ (${fromCurrency})` : `Amount in (${fromCurrency})`}
              </Text>
              <TextInput
                style={styles.input}
                keyboardType="numeric"
                value={amount}
                onChangeText={setAmount}
                placeholder="300"
                placeholderTextColor={colors.textSecondary + '60'}
              />
            </View>

            {/* Live Exchange Rate Result Card */}
            <View style={styles.conversionCard}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={styles.conversionLabel}>
                  {language === 'ar' ? 'المبلغ المستلم بالبيت' : 'Amount Received in Home Wallet'}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <View style={[styles.statusDot, { backgroundColor: isLive ? '#10B981' : '#F59E0B' }]} />
                  <Text style={styles.statusText}>{isLive ? (language === 'ar' ? 'سعر حي' : 'Live') : 'Offline'}</Text>
                </View>
              </View>

              <Text style={styles.conversionAmount}>
                {convertedAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{' '}
                <Text style={{ fontSize: 18, fontFamily: 'Cairo_700Bold' }}>{toCurrency}</Text>
              </Text>

              <Text style={styles.rateSubtext}>
                1 {fromCurrency} = {effectiveRate.toFixed(2)} {toCurrency}
              </Text>
            </View>

            {/* Note Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>{language === 'ar' ? 'ملاحظة (اختياري)' : 'Note (optional)'}</Text>
              <TextInput
                style={[styles.input, { fontSize: 14 }]}
                value={note}
                onChangeText={setNote}
                placeholder={language === 'ar' ? 'مثال: مصاريف شهر يوليو والمدارس' : 'e.g. July Allowance & School'}
                placeholderTextColor={colors.textSecondary + '60'}
              />
            </View>

            {/* Send Button */}
            <Pressable
              onPress={handleSend}
              disabled={loading}
              style={({ pressed }) => [
                styles.sendBtn,
                pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
              ]}
            >
              {loading ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <>
                  <Ionicons name="paper-plane-outline" size={20} color="#FFF" />
                  <Text style={styles.sendBtnText}>
                    {language === 'ar' ? 'تأكيد وإرسال الحوالة' : 'Confirm & Send Remittance'}
                  </Text>
                </>
              )}
            </Pressable>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const getStyles = (colors: any, theme: string) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.65)',
      justifyContent: 'flex-end',
    },
    container: {
      backgroundColor: colors.card,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      padding: 20,
      maxHeight: '90%',
      borderWidth: 1,
      borderColor: colors.border,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 14,
    },
    iconCircle: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: '#3B82F618',
      alignItems: 'center',
      justifyContent: 'center',
    },
    title: {
      fontSize: 17,
      fontFamily: 'Cairo_700Bold',
      color: colors.text,
    },
    closeBtn: {
      padding: 6,
    },
    walletsCard: {
      backgroundColor: colors.background,
      borderRadius: 18,
      padding: 14,
      borderWidth: 1,
      borderColor: colors.border,
    },
    walletCol: {
      gap: 4,
    },
    label: {
      fontSize: 12,
      fontFamily: 'Cairo_600SemiBold',
      color: colors.textSecondary,
    },
    walletChip: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      marginRight: 6,
      backgroundColor: colors.surface,
    },
    chipText: {
      fontSize: 12,
      fontFamily: 'Cairo_600SemiBold',
      color: colors.textSecondary,
    },
    inputGroup: {
      gap: 6,
    },
    input: {
      backgroundColor: colors.background,
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 18,
      fontFamily: 'Cairo_700Bold',
      color: colors.text,
      borderWidth: 1,
      borderColor: colors.border,
    },
    conversionCard: {
      backgroundColor: '#3B82F610',
      borderRadius: 18,
      padding: 16,
      borderWidth: 1,
      borderColor: '#3B82F630',
      alignItems: 'center',
      gap: 4,
    },
    conversionLabel: {
      fontSize: 12,
      fontFamily: 'Cairo_600SemiBold',
      color: colors.textSecondary,
    },
    statusDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
    },
    statusText: {
      fontSize: 10,
      fontFamily: 'Cairo_600SemiBold',
      color: colors.textSecondary,
    },
    conversionAmount: {
      fontSize: 26,
      fontFamily: 'Cairo_700Bold',
      color: '#3B82F6',
      marginVertical: 4,
    },
    rateSubtext: {
      fontSize: 11,
      fontFamily: 'Cairo_600SemiBold',
      color: colors.textSecondary,
    },
    sendBtn: {
      backgroundColor: '#3B82F6',
      borderRadius: 16,
      paddingVertical: 14,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      marginTop: 6,
      elevation: 2,
    },
    sendBtnText: {
      fontSize: 15,
      fontFamily: 'Cairo_700Bold',
      color: '#FFFFFF',
    },
  });
