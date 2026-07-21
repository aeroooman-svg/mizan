import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
  Platform,
  Alert,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import { useTheme } from '@/lib/ThemeContext';
import { useLanguage } from '@/lib/LanguageContext';
import { useTransactions } from '@/lib/TransactionContext';
import {
  SharedMember,
  getOrCreateShareCode,
  getSharedMembers,
  updateSharedMemberRole,
  removeSharedMember,
  leaveSharedWallet,
} from '@/lib/sharingService';

export default function WalletCollaborationScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const { language } = useLanguage();
  const { selectedWallet } = useTransactions();

  const [shareCode, setShareCode] = useState<string>('------');
  const [members, setMembers] = useState<SharedMember[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedMember, setSelectedMember] = useState<SharedMember | null>(null);
  const [roleModalVisible, setRoleModalVisible] = useState<boolean>(false);

  const loadData = useCallback(async () => {
    if (!selectedWallet) return;
    setLoading(true);
    try {
      const code = await getOrCreateShareCode(selectedWallet.id);
      setShareCode(code);

      const memList = await getSharedMembers(selectedWallet.id);
      if (memList.length === 0) {
        // Fallback default member view
        setMembers([
          { id: 'm1', userId: 'u1', username: language === 'ar' ? 'أنت (المالك)' : 'You (Owner)', role: 'owner', joinedAt: '2026-01-01' }
        ]);
      } else {
        setMembers(memList);
      }
    } catch (e) {
      console.warn('Failed to load shared wallet info', e);
    } finally {
      setLoading(false);
    }
  }, [selectedWallet, language]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const copyCode = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await Clipboard.setStringAsync(shareCode);
    Alert.alert(
      language === 'ar' ? 'تم النسخ' : 'Copied',
      language === 'ar' ? 'تم نسخ كود المشاركة إلى الحافظة' : 'Share code copied to clipboard'
    );
  };

  const handleRoleChange = async (newRole: 'owner' | 'editor' | 'viewer') => {
    if (!selectedMember || !selectedWallet) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    await updateSharedMemberRole(selectedWallet.id, selectedMember.userId, newRole);
    setMembers(prev => prev.map(m => m.userId === selectedMember.userId ? { ...m, role: newRole } : m));
    setRoleModalVisible(false);
    setSelectedMember(null);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleRemoveMember = (member: SharedMember) => {
    Alert.alert(
      language === 'ar' ? 'إزالة عضو' : 'Remove Member',
      language === 'ar' ? `هل أنت متأكد من إزالة ${member.username} من المحفظة؟` : `Remove ${member.username} from wallet?`,
      [
        { text: language === 'ar' ? 'إلغاء' : 'Cancel', style: 'cancel' },
        {
          text: language === 'ar' ? 'إزالة' : 'Remove',
          style: 'destructive',
          onPress: async () => {
            if (!selectedWallet) return;
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            await removeSharedMember(selectedWallet.id, member.userId);
            setMembers(prev => prev.filter(m => m.userId !== member.userId));
          },
        },
      ]
    );
  };

  const getRoleLabel = (role: SharedMember['role']) => {
    switch (role) {
      case 'owner': return language === 'ar' ? 'مالك المحفظة (Owner)' : 'Owner';
      case 'editor': return language === 'ar' ? 'محرر (يمكنه الإضافة والتعديل)' : 'Editor (Full Access)';
      case 'viewer': return language === 'ar' ? 'مشاهد فقط (قراءة)' : 'Viewer (Read Only)';
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.headerBar}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name={language === 'ar' ? 'arrow-forward' : 'arrow-back'} size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>
          {language === 'ar' ? '👥 مشاركة وتظافر المحفظة' : '👥 Wallet Collaboration'}
        </Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Wallet info card */}
        <View style={styles.infoCard}>
          <Ionicons name="people-circle-outline" size={40} color={colors.primary} />
          <Text style={styles.walletName}>{selectedWallet?.name || 'Shared Wallet'}</Text>
          <Text style={styles.infoSub}>
            {language === 'ar'
              ? 'أدر الأعضاء والصلاحيات التشاركية للمحفظة في الوقت الفعلي'
              : 'Manage live shared wallet members and access permissions'}
          </Text>
        </View>

        {/* Share Code Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            {language === 'ar' ? '🔑 كود الانضمام للمحفظة' : '🔑 Wallet Share Code'}
          </Text>
          <Text style={styles.cardSub}>
            {language === 'ar'
              ? 'شارك هذا الكود مع أفراد العائلة أو الشركاء للانضمام للمحفظة'
              : 'Share this code with family members or partners to join'}
          </Text>

          <View style={styles.codeBox}>
            <Text style={styles.codeText}>{shareCode}</Text>
            <Pressable onPress={copyCode} style={styles.copyBtn}>
              <Ionicons name="copy-outline" size={20} color="#FFF" />
              <Text style={styles.copyBtnText}>{language === 'ar' ? 'نسخ' : 'Copy'}</Text>
            </Pressable>
          </View>
        </View>

        {/* Members Section */}
        <Text style={styles.sectionTitle}>
          {language === 'ar' ? `أعضاء المحفظة الحاليين (${members.length})` : `Wallet Members (${members.length})`}
        </Text>

        {members.map(member => (
          <View key={member.id} style={styles.memberCard}>
            <View style={styles.avatarCircle}>
              <Ionicons name="person" size={20} color={colors.primary} />
            </View>

            <View style={{ flex: 1 }}>
              <Text style={styles.memberName}>{member.username}</Text>
              <Text style={styles.memberRole}>{getRoleLabel(member.role)}</Text>
            </View>

            {member.role !== 'owner' && (
              <View style={styles.memberActions}>
                <Pressable
                  onPress={() => {
                    setSelectedMember(member);
                    setRoleModalVisible(true);
                  }}
                  style={styles.roleBtn}
                >
                  <Ionicons name="shield-checkmark-outline" size={18} color={colors.primary} />
                </Pressable>

                <Pressable
                  onPress={() => handleRemoveMember(member)}
                  style={styles.removeBtn}
                >
                  <Ionicons name="trash-outline" size={18} color={colors.expense} />
                </Pressable>
              </View>
            )}
          </View>
        ))}
      </ScrollView>

      {/* Role Change Modal */}
      <Modal visible={roleModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {language === 'ar' ? `تعديل صلاحية ${selectedMember?.username}` : `Edit ${selectedMember?.username} Role`}
              </Text>
              <Pressable onPress={() => setRoleModalVisible(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </Pressable>
            </View>

            <Pressable
              onPress={() => handleRoleChange('editor')}
              style={[styles.roleOption, selectedMember?.role === 'editor' && styles.activeRoleOption]}
            >
              <Ionicons name="create-outline" size={22} color={colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={styles.roleOptionTitle}>
                  {language === 'ar' ? 'محرر كامل الصلاحية (Editor)' : 'Full Editor'}
                </Text>
                <Text style={styles.roleOptionSub}>
                  {language === 'ar' ? 'يمكنه إضافة وحذف وتعديل المعاملات والمصاريف' : 'Can add, edit, and delete transactions'}
                </Text>
              </View>
            </Pressable>

            <Pressable
              onPress={() => handleRoleChange('viewer')}
              style={[styles.roleOption, selectedMember?.role === 'viewer' && styles.activeRoleOption]}
            >
              <Ionicons name="eye-outline" size={22} color={colors.accent} />
              <View style={{ flex: 1 }}>
                <Text style={styles.roleOptionTitle}>
                  {language === 'ar' ? 'مشاهد فقط (Viewer)' : 'View Only'}
                </Text>
                <Text style={styles.roleOptionSub}>
                  {language === 'ar' ? 'يمكنه الاطلاع على التقارير دون إمكانية التعديل' : 'Can view reports and stats without edit access'}
                </Text>
              </View>
            </Pressable>
          </View>
        </View>
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
  infoCard: {
    backgroundColor: colors.surface,
    padding: 20,
    borderRadius: 20,
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  walletName: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 18,
    color: '#FFF',
  },
  infoSub: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 10,
  },
  cardTitle: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 15,
    color: '#FFF',
    textAlign: 'left',
  },
  cardSub: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'left',
  },
  codeBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: 4,
  },
  codeText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 22,
    color: colors.primary,
    letterSpacing: 4,
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  copyBtnText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 13,
    color: '#FFF',
  },
  sectionTitle: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 15,
    color: '#FFF',
    textAlign: 'left',
  },
  memberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 12,
  },
  avatarCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary + '20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  memberName: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 14,
    color: '#FFF',
  },
  memberRole: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 12,
    color: colors.textSecondary,
  },
  memberActions: {
    flexDirection: 'row',
    gap: 8,
  },
  roleBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.expense + '15',
    justifyContent: 'center',
    alignItems: 'center',
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
    marginBottom: 6,
  },
  modalTitle: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 16,
    color: '#FFF',
  },
  roleOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surfaceAlt,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  activeRoleOption: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + '15',
  },
  roleOptionTitle: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 14,
    color: '#FFF',
  },
  roleOptionSub: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 12,
    color: colors.textSecondary,
  },
});
