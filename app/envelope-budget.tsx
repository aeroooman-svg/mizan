import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/lib/ThemeContext';
import { useLanguage } from '@/lib/LanguageContext';
import { useTransactions } from '@/lib/TransactionContext';
import { formatCurrency, expenseCategories } from '@/lib/categories';
import { getCategoryName } from '@/lib/i18n';
import {
  Envelope,
  getEnvelopes,
  saveEnvelope,
  updateEnvelope,
  deleteEnvelope,
  calculateEnvelopeSpentFromTransactions,
} from '@/lib/envelopeBudgetStorage';

export default function EnvelopeBudgetScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const { language } = useLanguage();
  const { selectedWallet, walletTransactions, balance } = useTransactions();

  const [envelopes, setEnvelopes] = useState<Envelope[]>([]);
  const [modalVisible, setModalVisible] = useState(false);

  // New Envelope Form State
  const [title, setTitle] = useState('');
  const [allocatedAmount, setAllocatedAmount] = useState('');
  const [categoryId, setCategoryId] = useState('food');
  const [color, setColor] = useState('#10B981');

  const loadEnvelopesData = useCallback(async () => {
    if (!selectedWallet) return;
    const raw = await getEnvelopes(selectedWallet.id);
    const calculated = calculateEnvelopeSpentFromTransactions(raw, walletTransactions);
    setEnvelopes(calculated);
  }, [selectedWallet, walletTransactions]);

  useFocusEffect(
    useCallback(() => {
      loadEnvelopesData();
    }, [loadEnvelopesData])
  );

  const totalAllocated = envelopes.reduce((sum, e) => sum + e.allocatedAmount, 0);
  const unallocatedCash = Math.max(0, balance - totalAllocated);

  const handleAddEnvelope = async () => {
    if (!title.trim() || !allocatedAmount || !selectedWallet) {
      Alert.alert(
        language === 'ar' ? 'تنبيه' : 'Warning',
        language === 'ar' ? 'يرجى إدخال اسم الظرف والمبلغ المخصص' : 'Please fill all required fields'
      );
      return;
    }

    const numAlloc = parseFloat(allocatedAmount);
    if (isNaN(numAlloc) || numAlloc <= 0) {
      Alert.alert(
        language === 'ar' ? 'خطأ' : 'Error',
        language === 'ar' ? 'المبلغ المخصص يجب أن يكون رقماً موجباً' : 'Invalid allocated amount'
      );
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    await saveEnvelope({
      title: title.trim(),
      allocatedAmount: numAlloc,
      walletId: selectedWallet.id,
      icon: 'mail-outline',
      color,
      categoryId,
    });

    setTitle('');
    setAllocatedAmount('');
    setModalVisible(false);
    await loadEnvelopesData();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleDelete = (id: string) => {
    Alert.alert(
      language === 'ar' ? 'حذف الظرف' : 'Delete Envelope',
      language === 'ar' ? 'هل أنت تأكد من حذف هذا الظرف المالي؟' : 'Are you sure you want to delete this envelope?',
      [
        { text: language === 'ar' ? 'إلغاء' : 'Cancel', style: 'cancel' },
        {
          text: language === 'ar' ? 'حذف' : 'Delete',
          style: 'destructive',
          onPress: async () => {
            if (!selectedWallet) return;
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            await deleteEnvelope(selectedWallet.id, id);
            await loadEnvelopesData();
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.headerBar}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name={language === 'ar' ? 'arrow-forward' : 'arrow-back'} size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>
          {language === 'ar' ? '✉️ ميزانية الظروف المالية (Zero-Based)' : '✉️ Envelope Budgeting'}
        </Text>
        <Pressable onPress={() => setModalVisible(true)} style={styles.addBtn}>
          <Ionicons name="add" size={24} color="#FFF" />
        </Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Unallocated Cash Banner */}
        <View style={styles.cashBanner}>
          <View style={styles.cashBannerIcon}>
            <Ionicons name="wallet-outline" size={28} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.cashBannerTitle}>
              {language === 'ar' ? 'المال غير المخصص في المظاريف:' : 'Unallocated Cash:'}
            </Text>
            <Text style={styles.cashBannerAmount}>
              {formatCurrency(unallocatedCash)} {selectedWallet?.currency}
            </Text>
            <Text style={styles.cashBannerSub}>
              {language === 'ar'
                ? `إجمالي ميزانية المظاريف: ${formatCurrency(totalAllocated)} ${selectedWallet?.currency}`
                : `Total Envelopes Budget: ${formatCurrency(totalAllocated)} ${selectedWallet?.currency}`}
            </Text>
          </View>
        </View>

        {/* Envelopes List */}
        <Text style={styles.sectionTitle}>
          {language === 'ar' ? `المظاريف المخصصة (${envelopes.length})` : `Envelopes (${envelopes.length})`}
        </Text>

        {envelopes.map(env => {
          const remaining = env.allocatedAmount - env.spentAmount;
          const ratio = Math.min(1.0, env.spentAmount / env.allocatedAmount);
          const isOverspent = remaining < 0;

          return (
            <View key={env.id} style={styles.envCard}>
              <View style={styles.envHeader}>
                <View style={[styles.envIconCircle, { backgroundColor: env.color + '20' }]}>
                  <Ionicons name="mail" size={20} color={env.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.envTitle}>{env.title}</Text>
                  <Text style={styles.envCategory}>
                    {getCategoryName(env.categoryId, language)}
                  </Text>
                </View>
                <Pressable onPress={() => handleDelete(env.id)} hitSlop={10}>
                  <Ionicons name="trash-outline" size={18} color={colors.textTertiary} />
                </Pressable>
              </View>

              {/* Progress Bar */}
              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressBar,
                    {
                      width: `${Math.round(ratio * 100)}%`,
                      backgroundColor: isOverspent ? colors.expense : env.color,
                    },
                  ]}
                />
              </View>

              {/* Footer numbers */}
              <View style={styles.envFooter}>
                <View>
                  <Text style={styles.envNumberLabel}>
                    {language === 'ar' ? 'المستهلك:' : 'Spent:'}
                  </Text>
                  <Text style={styles.envNumberVal}>
                    {formatCurrency(env.spentAmount)} {selectedWallet?.currency}
                  </Text>
                </View>

                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.envNumberLabel}>
                    {language === 'ar' ? 'المتبقي في الظرف:' : 'Remaining:'}
                  </Text>
                  <Text style={[styles.envNumberVal, { color: isOverspent ? colors.expense : colors.income }]}>
                    {formatCurrency(remaining)} {selectedWallet?.currency}
                  </Text>
                </View>
              </View>
            </View>
          );
        })}
      </ScrollView>

      {/* Add Envelope Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {language === 'ar' ? 'إنشاء ظرف مالي جديد' : 'Create New Envelope'}
              </Text>
              <Pressable onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </Pressable>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>{language === 'ar' ? 'اسم الظرف (مثال: ظرف الطوارئ، ظرف الرحلات)' : 'Envelope Title'}</Text>
              <TextInput
                style={[styles.input, language === 'ar' ? styles.inputAr : styles.inputEn]}
                placeholder={language === 'ar' ? 'أدخل اسم الظرف...' : 'Envelope title...'}
                placeholderTextColor={colors.textTertiary}
                value={title}
                onChangeText={setTitle}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>{language === 'ar' ? 'المبلغ المخصص للظرف' : 'Allocated Amount'}</Text>
              <TextInput
                style={[styles.input, language === 'ar' ? styles.inputAr : styles.inputEn]}
                placeholder="0.00"
                keyboardType="decimal-pad"
                placeholderTextColor={colors.textTertiary}
                value={allocatedAmount}
                onChangeText={setAllocatedAmount}
              />
            </View>

            <Pressable onPress={handleAddEnvelope} style={styles.submitBtn}>
              <Text style={styles.submitBtnText}>
                {language === 'ar' ? 'إنشاء الظرف' : 'Create Envelope'}
              </Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const getStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 16,
    color: '#FFF',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
    gap: 16,
  },
  cashBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary + '12',
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.primary + '30',
    gap: 14,
  },
  cashBannerIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.primary + '20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cashBannerTitle: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 12,
    color: colors.textSecondary,
  },
  cashBannerAmount: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 20,
    color: colors.primary,
  },
  cashBannerSub: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 11,
    color: colors.textSecondary,
  },
  sectionTitle: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 15,
    color: '#FFF',
    textAlign: 'left',
  },
  envCard: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 12,
    marginBottom: 8,
  },
  envHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  envIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  envTitle: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 15,
    color: '#FFF',
    textAlign: 'left',
  },
  envCategory: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'left',
  },
  progressTrack: {
    height: 8,
    backgroundColor: colors.surfaceAlt,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 4,
  },
  envFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  envNumberLabel: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 11,
    color: colors.textSecondary,
  },
  envNumberVal: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 14,
    color: '#FFF',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    gap: 14,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  modalTitle: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 16,
    color: '#FFF',
  },
  formGroup: {
    gap: 6,
  },
  label: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'left',
  },
  input: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    height: 44,
    fontFamily: 'Cairo_400Regular',
    color: '#FFF',
    fontSize: 14,
  },
  inputAr: { textAlign: 'right' },
  inputEn: { textAlign: 'left' },
  submitBtn: {
    backgroundColor: colors.primary,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
  },
  submitBtnText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 15,
    color: '#FFF',
  },
});
