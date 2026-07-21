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
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { RecurringTransaction } from '@/lib/recurringStorage';
import { formatCurrency } from '@/lib/categories';
import { getCategoryName } from '@/lib/i18n';

interface PendingRecurringSectionProps {
  walletPending: RecurringTransaction[];
  currencySymbol: string;
  language: 'ar' | 'en';
  colors: any;
  onApproveConfirm: (item: RecurringTransaction) => void;
  onApproveSkip: (item: RecurringTransaction) => void;
  onSaveAdjustedAmount: (item: RecurringTransaction, amount: number) => void;
}

export default function PendingRecurringSection({
  walletPending,
  currencySymbol,
  language,
  colors,
  onApproveConfirm,
  onApproveSkip,
  onSaveAdjustedAmount,
}: PendingRecurringSectionProps) {
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
        language === 'ar' ? 'خطأ' : 'Error',
        language === 'ar' ? 'الرجاء إدخال مبلغ صحيح' : 'Please enter a valid amount'
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
          {language === 'ar'
            ? 'لديك مصاريف معلقة للمراجعة والتأكيد!'
            : 'You have expenses pending confirmation!'}
        </Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.pendingScroll}
      >
        {walletPending.map((item) => (
          <View key={item.id} style={styles.pendingItemCard}>
            <View style={styles.pendingItemInfo}>
              <Text style={styles.pendingItemName}>
                {getCategoryName(item.category, language)}
              </Text>
              <Text style={styles.pendingItemAmount}>
                {formatCurrency(item.amount, language)} {currencySymbol}
              </Text>
            </View>
            <Text style={styles.pendingItemDate}>
              {language === 'ar' ? 'مستحق: ' : 'Due: '}
              {new Date(item.nextDueDate).toLocaleDateString(
                language === 'ar' ? 'ar-EG' : 'en-US'
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
                  {language === 'ar' ? 'تأكيد' : 'Confirm'}
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
                  {language === 'ar' ? 'تعديل' : 'Edit'}
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
                  {language === 'ar' ? 'تخطي' : 'Skip'}
                </Text>
              </Pressable>
            </View>
          </View>
        ))}
      </ScrollView>

      {/* Adjust Amount Modal */}
      {adjustingItem && (
        <Modal transparent visible animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.adjustModalContent}>
              <Text style={styles.adjustModalTitle}>
                {language === 'ar' ? 'تعديل قيمة الفاتورة' : 'Adjust Bill Amount'}
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
                    {language === 'ar' ? 'إلغاء' : 'Cancel'}
                  </Text>
                </Pressable>
                <Pressable
                  style={[styles.adjustBtn, styles.adjustBtnConfirm]}
                  onPress={handleSaveAdjust}
                >
                  <Text style={styles.adjustBtnTextConfirm}>
                    {language === 'ar' ? 'حفظ وتسجيل' : 'Save & Log'}
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
      width: 240,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.borderLight,
      borderRadius: 16,
      padding: 14,
      gap: 6,
      elevation: 3,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 4,
    },
    pendingItemInfo: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    pendingItemName: {
      fontFamily: 'Cairo_700Bold',
      fontSize: 15,
      color: colors.text,
    },
    pendingItemAmount: {
      fontFamily: 'Cairo_700Bold',
      fontSize: 15,
      color: colors.expense,
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
