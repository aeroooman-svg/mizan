import React from 'react';
import { StyleSheet, Text, View, Pressable, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/lib/ThemeContext';
import { useLanguage } from '@/lib/LanguageContext';

interface ConfirmModalProps {
  visible: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmModal({
  visible,
  title,
  message,
  confirmText,
  cancelText,
  isDestructive = true,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const { colors } = useTheme();
  const { language } = useLanguage();
  const isAr = language === 'ar';

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <Pressable style={styles.overlay} onPress={onCancel}>
        <Pressable 
          style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={[styles.iconWrap, { backgroundColor: isDestructive ? 'rgba(239, 68, 68, 0.15)' : colors.primary + '15' }]}>
            <Ionicons
              name={isDestructive ? 'trash-outline' : 'help-circle-outline'}
              size={32}
              color={isDestructive ? '#EF4444' : colors.primary}
            />
          </View>

          <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
          <Text style={[styles.message, { color: colors.textSecondary }]}>{message}</Text>

          <View style={styles.btnRow}>
            <Pressable
              onPress={onCancel}
              style={({ pressed }) => [
                styles.btn,
                { backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border },
                pressed && { opacity: 0.8 }
              ]}
            >
              <Text style={[styles.btnText, { color: colors.textSecondary }]}>
                {cancelText || (isAr ? 'إلغاء' : 'Cancel')}
              </Text>
            </Pressable>

            <Pressable
              onPress={onConfirm}
              style={({ pressed }) => [
                styles.btn,
                { backgroundColor: isDestructive ? '#EF4444' : colors.primary },
                pressed && { opacity: 0.9 }
              ]}
            >
              <Text style={[styles.btnText, { color: '#FFFFFF', fontFamily: 'Cairo_700Bold' }]}>
                {confirmText || (isDestructive ? (isAr ? 'تأكيد' : 'Confirm') : (isAr ? 'موافق' : 'OK'))}
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    elevation: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  title: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 19,
    textAlign: 'center',
  },
  message: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 8,
  },
  btnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    width: '100%',
  },
  btn: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 14,
  },
});
