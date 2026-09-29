import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
  Alert,
  Modal,
  TextInput,
} from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { RecurringTransaction } from '@/lib/recurringStorage';
import { Wallet } from '@/lib/storage';
import { formatCurrency, getCategoryById } from '@/lib/categories';
import { getCategoryName } from '@/lib/i18n';

interface PendingRecurringSectionProps {
  walletPending: RecurringTransaction[];
  currencySymbol: string;
  language: 'ar' | 'en' | 'ml' | 'hi';
  colors: any;
  wallets?: Wallet[];
  onApproveConfirm: (item: RecurringTransaction) => void;
  onApproveSkip: (item: RecurringTransaction) => void;
  onSaveAdjustedAmount: (item: RecurringTransaction, amount: number) => void;
}

export default function PendingRecurringSection({
  walletPending,
  currencySymbol,
  language,
  colors,
  wallets,
  onApproveConfirm,
  onApproveSkip,
  onSaveAdjustedAmount,
}: PendingRecurringSectionProps) {
  const loc = (ar: string, en: string, hi: string) => {
    if (language === 'hi') return hi;
    if (language === 'ar') return ar;
    return en;
  };

  const [adjustingItem, setAdjustingItem] = useState<RecurringTransaction | null>(null);
  const [adjustAmount, setAdjustAmount] = useState('');
  const styles = getStyles(colors);

  if (walletPending.length === 0) return null;

  const handleAdjustPress = (item: RecurringTransaction) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setAdjustingItem(item);
    setAdjustAmount(item.amount.toString());
  };

  const handleSaveAdjust = () => {
    const amt = parseFloat(adjustAmount);
    if (isNaN(amt) || amt <= 0) {
      Alert.alert(
        loc('خطأ', 'Error', 'त्रुटि'),
        loc('الرجاء إدخال مبلغ صحيح', 'Please enter a valid amount', 'कृपया एक मान्य राशि दर्ज करें')
      );
      return;
    }
    if (adjustingItem) {
      onSaveAdjustedAmount(adjustingItem, amt);
    }
    setAdjustingItem(null);
  };

  return (
    <View style={styles.pendingSection}>
      <View style={styles.pendingHeader}>
        <Ionicons name="alert-circle" size={20} color="#FF9800" />
        <Text style={styles.pendingTitle}>
          {loc('لديك مصاريف معلقة للمراجعة والتأكيد!', 'You have expenses pending confirmation!', 'आपके पास पुष्टि हेतु लंबित खर्च हैं!')}
        </Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.pendingScroll}
      >
        {walletPending.map((item) => {
          const isTransfer = item.type === 'transfer' || !!item.toWalletId;
          const targetWallet = isTransfer && item.toWalletId ? wallets?.find(w => w.id === item.toWalletId) : null;
          const cat = getCategoryById(item.category);
          const hasSpecificCategory = item.category && item.category !== 'transfer' && item.category !== 'transfers_out';
          const catName = hasSpecificCategory ? getCategoryName(item.category, language) : null;
          const itemColor = item.color || cat?.color || (isTransfer ? '#3b82f6' : (item.type === 'income' ? colors.income : colors.primary));
          const itemIcon = item.icon || cat?.icon || (isTransfer ? 'swap-horiz' : 'receipt');

          const transferLabel = isTransfer
            ? (targetWallet
                ? loc(`تحويل إلى ${targetWallet.name}`, `Transfer to ${targetWallet.name}`, `${targetWallet.name} को स्थानांतरण`)
                : loc('تحويل محفظة', 'Wallet Transfer', 'वॉलेट स्थानांतरण'))
            : null;

          const itemName = catName || transferLabel || loc('معاملة دورية', 'Recurring Item', 'ആവർത്തിച്ചുള്ള ഇടപാട്');

          return (
            <View key={item.id} style={styles.pendingItemCard}>
              <View style={styles.pendingItemTopRow}>
                <View style={[styles.pendingItemIconBadge, { backgroundColor: itemColor + '18' }]}>
                  <MaterialIcons name={itemIcon as any} size={22} color={itemColor} />
                </View>
                <View style={styles.pendingItemTextCol}>
                  <Text style={styles.pendingItemName} numberOfLines={1}>
                    {itemName}
                  </Text>
                  {transferLabel && catName ? (
                    <Text style={styles.pendingItemSub} numberOfLines={1}>
                      {transferLabel}
                    </Text>
                  ) : null}
                </View>
                <Text style={[styles.pendingItemAmount, { color: item.type === 'income' ? colors.income : colors.expense }]}>
                  {item.type === 'income' ? '+' : '-'}{formatCurrency(item.amount, language)} {currencySymbol}
                </Text>
              </View>
            <Text style={styles.pendingItemDate}>
              {loc('مستحق: ', 'Due: ', 'देय: ')}
              {new Date(item.nextDueDate).toLocaleDateString(
                language === 'ar' ? 'ar-EG' : language === 'hi' ? 'hi-IN' : 'en-US'
              )}
            </Text>
            <View style={styles.pendingItemActions}>
              <Pressable
                style={({ pressed }) => [
                  styles.pendingActionBtn,
                  styles.btnApprove,
                  pressed && { opacity: 0.8 },
                ]}
                onPress={() => onApproveConfirm(item)}
              >
                <Text style={styles.pendingActionText}>
                  {loc('تأكيد', 'Confirm', 'पुष्टि करें')}
                </Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  styles.pendingActionBtn,
                  styles.btnAdjust,
                  pressed && { opacity: 0.8 },
                ]}
                onPress={() => handleAdjustPress(item)}
              >
                <Text style={styles.pendingActionTextAdjust}>
                  {loc('تعديل', 'Edit', 'संशोधित करें')}
                </Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  styles.pendingActionBtn,
                  styles.btnSkip,
                  pressed && { opacity: 0.8 },
                ]}
                onPress={() => onApproveSkip(item)}
              >
                <Text style={styles.pendingActionTextSkip}>
                  {loc('تخطي', 'Skip', 'छोड़ें')}
                </Text>
              </Pressable>
            </View>
          </View>
        );
      })}
      </ScrollView>

      {/* Adjust Amount Modal */}
      {adjustingItem && (
        <Modal transparent visible animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.adjustModalContent}>
              <Text style={styles.adjustModalTitle}>
                {loc('تعديل قيمة الفاتورة', 'Adjust Bill Amount', 'बिल राशि संशोधित करें')}
              </Text>
              <Text style={styles.adjustModalSub}>
                {getCategoryName(adjustingItem.category, language)}
              </Text>
              <View style={styles.adjustInputRow}>
                <TextInput
                  style={styles.adjustInput}
                  keyboardType="decimal-pad"
                  autoFocus
                  value={adjustAmount}
                  onChangeText={setAdjustAmount}
                  textAlign="center"
                />
                <Text style={styles.adjustCurrency}>{currencySymbol}</Text>
              </View>
              <View style={styles.adjustModalActions}>
                <Pressable
                  style={[styles.adjustBtn, styles.adjustBtnCancel]}
                  onPress={() => setAdjustingItem(null)}
                >
                  <Text style={styles.adjustBtnTextCancel}>
                    {loc('إلغاء', 'Cancel', 'रद्द करें')}
                  </Text>
                </Pressable>
                <Pressable
                  style={[styles.adjustBtn, styles.adjustBtnConfirm]}
                  onPress={handleSaveAdjust}
                >
                  <Text style={styles.adjustBtnTextConfirm}>
                    {loc('حفظ وتسجيل', 'Save & Log', 'सहेजें और दर्ज करें')}
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

const getStyles = (colors: any) =>
  StyleSheet.create({
    pendingSection: {
      marginTop: 16,
      paddingHorizontal: 20,
      gap: 10,
    },
    pendingHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    pendingTitle: {
      fontFamily: 'Cairo_700Bold',
      fontSize: 15,
      color: colors.text,
    },
    pendingScroll: {
      gap: 12,
      paddingRight: 20,
      paddingVertical: 4,
    },
    pendingItemCard: {
      width: 275,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.borderLight,
      borderRadius: 18,
      padding: 14,
      gap: 8,
      elevation: 3,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 4,
    },
    pendingItemTopRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    pendingItemIconBadge: {
      width: 38,
      height: 38,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    pendingItemTextCol: {
      flex: 1,
      justifyContent: 'center',
    },
    pendingItemName: {
      fontFamily: 'Cairo_700Bold',
      fontSize: 14,
      color: colors.text,
      textAlign: 'left',
    },
    pendingItemSub: {
      fontFamily: 'Cairo_600SemiBold',
      fontSize: 10.5,
      color: colors.textSecondary,
      textAlign: 'left',
      marginTop: -2,
    },
    pendingItemAmount: {
      fontFamily: 'Cairo_700Bold',
      fontSize: 14,
    },
    pendingItemDate: {
      fontFamily: 'Cairo_400Regular',
      fontSize: 11,
      color: colors.textTertiary,
      textAlign: 'left',
    },
    pendingItemActions: {
      flexDirection: 'row',
      gap: 8,
      marginTop: 6,
    },
    pendingActionBtn: {
      flex: 1,
      paddingVertical: 8,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
    },
    btnApprove: {
      backgroundColor: colors.primary,
    },
    btnAdjust: {
      backgroundColor: colors.primary + '10',
      borderWidth: 1,
      borderColor: colors.primary + '30',
    },
    btnSkip: {
      backgroundColor: colors.expense + '10',
    },
    pendingActionText: {
      fontFamily: 'Cairo_700Bold',
      fontSize: 12,
      color: colors.text,
    },
    pendingActionTextAdjust: {
      fontFamily: 'Cairo_700Bold',
      fontSize: 12,
      color: colors.primary,
    },
    pendingActionTextSkip: {
      fontFamily: 'Cairo_700Bold',
      fontSize: 12,
      color: colors.expense,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    adjustModalContent: {
      width: '85%',
      backgroundColor: colors.surface,
      borderRadius: 24,
      padding: 24,
      alignItems: 'center',
      gap: 16,
      elevation: 10,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.25,
      shadowRadius: 15,
    },
    adjustModalTitle: {
      fontFamily: 'Cairo_700Bold',
      fontSize: 18,
      color: colors.text,
    },
    adjustModalSub: {
      fontFamily: 'Cairo_600SemiBold',
      fontSize: 14,
      color: colors.textSecondary,
      marginTop: -8,
    },
    adjustInputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surfaceAlt,
      borderRadius: 16,
      paddingHorizontal: 20,
      height: 60,
      width: '100%',
      gap: 10,
    },
    adjustInput: {
      flex: 1,
      fontFamily: 'Cairo_700Bold',
      fontSize: 22,
      color: colors.text,
    },
    adjustCurrency: {
      fontFamily: 'Cairo_700Bold',
      fontSize: 16,
      color: colors.textSecondary,
    },
    adjustModalActions: {
      flexDirection: 'row',
      gap: 12,
      width: '100%',
    },
    adjustBtn: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    adjustBtnCancel: {
      backgroundColor: colors.surfaceAlt,
    },
    adjustBtnConfirm: {
      backgroundColor: colors.primary,
    },
    adjustBtnTextCancel: {
      fontFamily: 'Cairo_700Bold',
      fontSize: 14,
      color: colors.textSecondary,
    },
    adjustBtnTextConfirm: {
      fontFamily: 'Cairo_700Bold',
      fontSize: 14,
      color: colors.text,
    },
  });
