import React, { useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Modal,
  Pressable,
  Platform,
} from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { ParsedBankSMS } from '@/lib/smsParser';
import { getCategoryById } from '@/lib/categories';
import { useTheme } from '@/lib/ThemeContext';
import { useLanguage } from '@/lib/LanguageContext';
import * as Haptics from 'expo-haptics';

interface SmartSmsModalProps {
  visible: boolean;
  smsData: ParsedBankSMS | null;
  onSave: () => void;
  onEdit: () => void;
  onDismiss: () => void;
}

export default function SmartSmsModal({
  visible,
  smsData,
  onSave,
  onEdit,
  onDismiss,
}: SmartSmsModalProps) {
  const { colors } = useTheme();
  const { language } = useLanguage();
  const isAr = language === 'ar';

  const category = useMemo(() => {
    if (!smsData) return null;
    return getCategoryById(smsData.category) || {
      name: 'Other',
      nameAr: 'أخرى',
      icon: 'more-horiz',
      color: '#78909C',
    };
  }, [smsData]);

  if (!smsData) return null;

  const handleSavePress = () => {
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch (e) {}
    onSave();
  };

  const handleEditPress = () => {
    try {
      Haptics.selectionAsync().catch(() => {});
    } catch (e) {}
    onEdit();
  };

  const handleDismissPress = () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    } catch (e) {}
    onDismiss();
  };

  const isExpense = smsData.type === 'expense';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onDismiss}
    >
      <View style={styles.overlay}>
        <View style={[styles.cardContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {/* Header Badge */}
          <View style={styles.headerRow}>
            <View style={[styles.bankBadge, { backgroundColor: colors.primary + '1F' }]}>
              <Ionicons name="card-outline" size={16} color={colors.primary} />
              <Text style={[styles.bankBadgeText, { color: colors.primary }]}>
                {smsData.bankName}
              </Text>
            </View>

            <Pressable
              onPress={handleDismissPress}
              style={({ pressed }) => [styles.closeBtn, pressed && { opacity: 0.6 }]}
            >
              <Ionicons name="close" size={20} color={colors.subtext} />
            </Pressable>
          </View>

          {/* Title */}
          <Text style={[styles.title, { color: colors.text }]}>
            {isAr ? '📱 رسالة بنكية جديدة مكتشفة!' : '📱 New Bank SMS Detected!'}
          </Text>

          {/* Transaction Summary Card */}
          <View style={[styles.summaryCard, { backgroundColor: colors.background }]}>
            <View style={styles.row}>
              <View style={[styles.iconCircle, { backgroundColor: category?.color || colors.primary }]}>
                <MaterialIcons name={(category?.icon as any) || 'receipt'} size={22} color="#FFF" />
              </View>

              <View style={styles.textDetails}>
                <Text style={[styles.merchantName, { color: colors.text }]} numberOfLines={1}>
                  {smsData.merchant}
                </Text>
                <Text style={[styles.categoryName, { color: colors.subtext }]}>
                  {isAr ? (category?.nameAr || 'عام') : (category?.name || 'General')}
                </Text>
              </View>

              <View style={styles.amountContainer}>
                <Text style={[styles.amountText, { color: isExpense ? '#FF5252' : '#4CAF50' }]}>
                  {isExpense ? '-' : '+'}{smsData.amount}
                </Text>
                <Text style={[styles.currencyText, { color: colors.subtext }]}>
                  {smsData.currency}
                </Text>
              </View>
            </View>
          </View>

          {/* Raw Text Snippet */}
          <View style={[styles.rawTextContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.rawText, { color: colors.subtext }]} numberOfLines={2}>
              "{smsData.rawText}"
            </Text>
          </View>

          {/* Action Buttons */}
          <View style={styles.actionsRow}>
            <Pressable
              onPress={handleSavePress}
              style={({ pressed }) => [
                styles.saveBtn,
                { backgroundColor: colors.primary },
                pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
              ]}
            >
              <Ionicons name="checkmark-circle" size={18} color="#FFF" style={{ marginRight: isAr ? 0 : 6, marginLeft: isAr ? 6 : 0 }} />
              <Text style={styles.saveBtnText}>
                {isAr ? 'تسجيل فوري' : 'Save Now'}
              </Text>
            </Pressable>

            <Pressable
              onPress={handleEditPress}
              style={({ pressed }) => [
                styles.editBtn,
                { borderColor: colors.border, backgroundColor: colors.card },
                pressed && { opacity: 0.8 },
              ]}
            >
              <Ionicons name="create-outline" size={18} color={colors.text} />
              <Text style={[styles.editBtnText, { color: colors.text }]}>
                {isAr ? 'تعديل' : 'Edit'}
              </Text>
            </Pressable>

            <Pressable
              onPress={handleDismissPress}
              style={({ pressed }) => [
                styles.dismissBtn,
                pressed && { opacity: 0.6 },
              ]}
            >
              <Text style={[styles.dismissBtnText, { color: colors.subtext }]}>
                {isAr ? 'تجاهل' : 'Ignore'}
              </Text>
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
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
    alignItems: 'center',
    padding: 16,
  },
  cardContainer: {
    width: '100%',
    borderRadius: 24,
    borderWidth: 1,
    padding: 20,
    marginBottom: Platform.OS === 'ios' ? 24 : 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 10,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  bankBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    gap: 6,
  },
  bankBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  closeBtn: {
    padding: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 14,
    textAlign: 'left',
  },
  summaryCard: {
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  textDetails: {
    flex: 1,
  },
  merchantName: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  categoryName: {
    fontSize: 13,
  },
  amountContainer: {
    alignItems: 'flex-end',
  },
  amountText: {
    fontSize: 18,
    fontWeight: '800',
  },
  currencyText: {
    fontSize: 11,
    fontWeight: '600',
  },
  rawTextContainer: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    marginBottom: 16,
  },
  rawText: {
    fontSize: 12,
    fontStyle: 'italic',
    lineHeight: 16,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  saveBtn: {
    flex: 2,
    height: 46,
    borderRadius: 14,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveBtnText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
  },
  editBtn: {
    flex: 1,
    height: 46,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
  },
  editBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
  dismissBtn: {
    paddingHorizontal: 12,
    height: 46,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dismissBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
