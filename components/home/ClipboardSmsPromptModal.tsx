import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Modal,
  Pressable,
  ScrollView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/lib/ThemeContext';
import { ParsedBankSMS } from '@/lib/smsParser';
import { Wallet } from '@/lib/storage';
import { getCategoryName } from '@/lib/i18n';

interface ClipboardSmsPromptModalProps {
  visible: boolean;
  data: { text: string; parsed: ParsedBankSMS } | null;
  onConfirm: (targetWalletId: string) => void;
  onDismiss: () => void;
  wallets: Wallet[];
  selectedWallet: Wallet | null;
  language: string;
}

export default function ClipboardSmsPromptModal({
  visible,
  data,
  onConfirm,
  onDismiss,
  wallets,
  selectedWallet,
  language,
}: ClipboardSmsPromptModalProps) {
  const { colors, theme } = useTheme();
  const isDark = theme === 'dark';
  const isAr = language === 'ar';

  const [targetWalletId, setTargetWalletId] = useState<string>(
    selectedWallet?.id || wallets[0]?.id || ''
  );

  useEffect(() => {
    if (selectedWallet?.id) {
      setTargetWalletId(selectedWallet.id);
    } else if (wallets[0]?.id) {
      setTargetWalletId(wallets[0].id);
    }
  }, [selectedWallet, wallets]);

  if (!visible || !data || !data.parsed) return null;

  const { parsed } = data;
  const isExpense = parsed.type === 'expense';
  const typeColor = isExpense ? '#EF4444' : '#10B981';

  const loc = (ar: string, en: string) => (isAr ? ar : en);

  const handleConfirm = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onConfirm(targetWalletId);
  };

  const handleDismiss = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onDismiss();
  };

  return (
    <Modal transparent visible={visible} animationType="slide" onRequestClose={handleDismiss}>
      <View style={styles.overlay}>
        <View style={[styles.sheetContent, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {/* Handle bar */}
          <View style={[styles.handleBar, { backgroundColor: colors.border }]} />

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.iconBadge}>
              <Ionicons name="chatbox-ellipses" size={20} color="#10B981" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.title, { color: colors.text }]}>
                {loc('رسالة بنكية مكتشفة في الحافظة 📋', 'Bank SMS Detected in Clipboard 📋')}
              </Text>
              <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                {loc('هل تريد تسجيل هذه المعاملة تلقائياً؟', 'Do you want to log this transaction?')}
              </Text>
            </View>
            <Pressable onPress={handleDismiss} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color={colors.textSecondary} />
            </Pressable>
          </View>

          {/* Details Card */}
          <View style={[styles.previewCard, { backgroundColor: isDark ? '#ffffff08' : '#00000005', borderColor: colors.border }]}>
            <View style={styles.previewTop}>
              <View style={styles.bankPill}>
                <Ionicons name="business-outline" size={14} color="#10B981" />
                <Text style={styles.bankPillText}>{parsed.bankName}</Text>
              </View>
              <View style={[styles.typePill, { backgroundColor: typeColor + '20' }]}>
                <Text style={[styles.typePillText, { color: typeColor }]}>
                  {isExpense ? loc('مصروف (شراء)', 'Expense') : loc('دخل (إيداع)', 'Income')}
                </Text>
              </View>
            </View>

            {/* Amount */}
            <View style={styles.amountRow}>
              <Text style={[styles.amountVal, { color: typeColor }]}>
                {parsed.amount?.toLocaleString()} {parsed.currency}
              </Text>
            </View>

            {/* Merchant / Description */}
            {parsed.merchant ? (
              <View style={styles.infoRow}>
                <Ionicons name="storefront-outline" size={14} color={colors.textSecondary} />
                <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>
                  {loc('الجهة:', 'Merchant:')}
                </Text>
                <Text style={[styles.infoVal, { color: colors.text }]}>{parsed.merchant}</Text>
              </View>
            ) : null}

            {/* Category */}
            <View style={styles.infoRow}>
              <Ionicons name="pricetag-outline" size={14} color={colors.textSecondary} />
              <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>
                {loc('التصنيف المقترح:', 'Category:')}
              </Text>
              <Text style={[styles.infoVal, { color: colors.primary }]}>
                {getCategoryName(parsed.category || 'other', language as any)}
              </Text>
            </View>
          </View>

          {/* Wallet Selection */}
          <View style={{ marginTop: 12 }}>
            <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
              {loc('تسجيل في محفظة:', 'Save into Wallet:')}
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 6 }}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {wallets.map(w => {
                  const isSelected = w.id === targetWalletId;
                  return (
                    <Pressable
                      key={w.id}
                      onPress={() => setTargetWalletId(w.id)}
                      style={[
                        styles.walletBtn,
                        { borderColor: colors.border },
                        isSelected && { borderColor: colors.primary, backgroundColor: colors.primary + '18' },
                      ]}
                    >
                      <View style={[styles.walletDot, { backgroundColor: w.color || colors.primary }]} />
                      <Text
                        style={[
                          styles.walletBtnText,
                          { color: colors.text },
                          isSelected && { color: colors.primary, fontFamily: 'Cairo_700Bold' },
                        ]}
                      >
                        {w.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>
          </View>

          {/* Action Buttons */}
          <View style={styles.actionsRow}>
            <Pressable
              style={[styles.dismissBtn, { borderColor: colors.border }]}
              onPress={handleDismiss}
            >
              <Text style={[styles.dismissBtnText, { color: colors.textSecondary }]}>
                {loc('تجاهل', 'Dismiss')}
              </Text>
            </Pressable>

            <Pressable style={styles.confirmBtn} onPress={handleConfirm}>
              <LinearGradient
                colors={['#10B981', '#059669']}
                style={styles.confirmGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Ionicons name="checkmark-circle-outline" size={18} color="#FFF" />
                <Text style={styles.confirmBtnText}>{loc('تسجيل فوري', 'Log Transaction')}</Text>
              </LinearGradient>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  sheetContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderBottomWidth: 0,
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
  },
  handleBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  iconBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#10B98120',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 15,
  },
  subtitle: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 11,
    marginTop: 1,
  },
  closeBtn: {
    padding: 4,
  },
  previewCard: {
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
  },
  previewTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  bankPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#10B98115',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 6,
  },
  bankPillText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 12,
    color: '#10B981',
  },
  typePill: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 6,
  },
  typePillText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 11,
  },
  amountRow: {
    marginVertical: 10,
    alignItems: 'center',
  },
  amountVal: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 26,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  infoLabel: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 12,
  },
  infoVal: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 12,
  },
  sectionLabel: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 12,
  },
  walletBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
  },
  walletDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  walletBtnText: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 12,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
  },
  dismissBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dismissBtnText: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 13,
  },
  confirmBtn: {
    flex: 2,
    borderRadius: 12,
    overflow: 'hidden',
  },
  confirmGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
  },
  confirmBtnText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 13,
    color: '#FFF',
  },
});
