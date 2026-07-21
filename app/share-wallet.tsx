import React, { useState, useEffect, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  Alert,
  Share,
  Platform,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useLanguage } from '@/lib/LanguageContext';
import { useTheme } from '@/lib/ThemeContext';
import { useTransactions } from '@/lib/TransactionContext';
import {
  getOrCreateShareCode,
  getSharedMembers,
  removeSharedMember,
  SharedMember,
} from '@/lib/sharingService';

export default function ShareWalletScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const { language } = useLanguage();
  const { wallets } = useTransactions();
  const params = useLocalSearchParams<{ walletId: string }>();
  const wallet = wallets.find(w => w.id === params.walletId);

  const [shareCode, setShareCode] = useState<string | null>(null);
  const [members, setMembers] = useState<SharedMember[]>([]);
  const [loading, setLoading] = useState(true);
  const isAr = language === 'ar';

  useEffect(() => {
    async function loadData() {
      if (!params.walletId) return;
      setLoading(true);
      const [code, membersList] = await Promise.all([
        getOrCreateShareCode(params.walletId),
        getSharedMembers(params.walletId),
      ]);
      setShareCode(code);
      setMembers(membersList);
      setLoading(false);
    }
    loadData();
  }, [params.walletId]);

  const handleCopyCode = async () => {
    if (!shareCode) return;
    await Clipboard.setStringAsync(shareCode);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert(
      isAr ? 'تم النسخ!' : 'Copied!',
      isAr ? 'تم نسخ كود المشاركة' : 'Share code copied to clipboard',
    );
  };

  const handleShareCode = async () => {
    if (!shareCode) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const message = isAr
      ? `🔗 انضم لمحفظتي "${wallet?.name}" في تطبيق ميزان!\n\nكود المشاركة: ${shareCode}\n\nحمّل التطبيق وأدخل الكود للانضمام.`
      : `🔗 Join my wallet "${wallet?.name}" on MIZAN app!\n\nShare code: ${shareCode}\n\nDownload the app and enter the code to join.`;

    try {
      await Share.share({ message });
    } catch {}
  };

  const handleRemoveMember = (member: SharedMember) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    Alert.alert(
      isAr ? 'إزالة عضو' : 'Remove Member',
      isAr
        ? `هل تريد إزالة ${member.username} من المحفظة المشتركة؟`
        : `Remove ${member.username} from the shared wallet?`,
      [
        { text: isAr ? 'إلغاء' : 'Cancel', style: 'cancel' },
        {
          text: isAr ? 'إزالة' : 'Remove',
          style: 'destructive',
          onPress: async () => {
            const success = await removeSharedMember(params.walletId!, member.userId);
            if (success) {
              setMembers(prev => prev.filter(m => m.userId !== member.userId));
            }
          },
        },
      ],
    );
  };

  const renderMember = ({ item }: { item: SharedMember }) => (
    <View style={styles.memberCard}>
      <View style={styles.memberAvatar}>
        <Text style={styles.memberAvatarText}>
          {item.username.charAt(0).toUpperCase()}
        </Text>
      </View>
      <View style={styles.memberInfo}>
        <Text style={styles.memberName}>{item.username}</Text>
        <Text style={styles.memberRole}>
          {item.role === 'owner'
            ? (isAr ? '👑 مالك المحفظة' : '👑 Wallet Owner')
            : (isAr ? '👤 عضو' : '👤 Member')}
        </Text>
      </View>
      {item.role !== 'owner' && (
        <Pressable
          onPress={() => handleRemoveMember(item)}
          style={({ pressed }) => [styles.removeMemberBtn, pressed && { opacity: 0.7 }]}
        >
          <Ionicons name="close-circle" size={22} color={colors.expense} />
        </Pressable>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          onPress={() => { Haptics.selectionAsync(); router.back(); }}
          style={styles.backBtn}
        >
          <Ionicons name={isAr ? 'arrow-forward' : 'arrow-back'} size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>
          {isAr ? 'مشاركة المحفظة' : 'Share Wallet'}
        </Text>
        <View style={{ width: 44 }} />
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={members}
          keyExtractor={item => item.id}
          renderItem={renderMember}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <View>
              {/* Wallet Info */}
              <View style={styles.walletInfo}>
                <MaterialIcons name={(wallet?.icon || 'account-balance-wallet') as any} size={32} color={wallet?.color || colors.primary} />
                <Text style={styles.walletName}>{wallet?.name || ''}</Text>
              </View>

              {/* Share Code Card */}
              <View style={styles.codeCard}>
                <Text style={styles.codeLabel}>
                  {isAr ? 'كود المشاركة' : 'Share Code'}
                </Text>
                <Text style={styles.codeText}>{shareCode}</Text>

                <View style={styles.codeActions}>
                  <Pressable
                    onPress={handleCopyCode}
                    style={({ pressed }) => [styles.codeActionBtn, pressed && { opacity: 0.8 }]}
                  >
                    <Ionicons name="copy-outline" size={18} color={colors.primary} />
                    <Text style={styles.codeActionText}>
                      {isAr ? 'نسخ' : 'Copy'}
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={handleShareCode}
                    style={({ pressed }) => [styles.codeActionBtn, styles.codeActionPrimary, pressed && { opacity: 0.8 }]}
                  >
                    <Ionicons name="share-social-outline" size={18} color="#FFF" />
                    <Text style={[styles.codeActionText, { color: '#FFF' }]}>
                      {isAr ? 'مشاركة' : 'Share'}
                    </Text>
                  </Pressable>
                </View>

                <Text style={styles.codeHint}>
                  {isAr
                    ? 'شارك هذا الكود مع عائلتك أو أصدقائك للانضمام لمحفظتك'
                    : 'Share this code with family or friends to join your wallet'}
                </Text>
              </View>

              {/* Members Header */}
              <Text style={styles.sectionTitle}>
                {isAr ? `الأعضاء (${members.length})` : `Members (${members.length})`}
              </Text>
            </View>
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="people-outline" size={48} color={colors.textTertiary} />
              <Text style={styles.emptyText}>
                {isAr
                  ? 'لا يوجد أعضاء بعد. شارك الكود لدعوة أشخاص!'
                  : 'No members yet. Share the code to invite people!'}
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const getStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
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
    color: colors.text,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    padding: 16,
    paddingBottom: 100,
  },
  walletInfo: {
    alignItems: 'center',
    gap: 8,
    marginBottom: 24,
    marginTop: 8,
  },
  walletName: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 20,
    color: colors.text,
  },
  codeCard: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 24,
  },
  codeLabel: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 8,
  },
  codeText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 36,
    color: colors.primary,
    letterSpacing: 8,
    marginBottom: 20,
  },
  codeActions: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  codeActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  codeActionPrimary: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  codeActionText: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 13,
    color: colors.primary,
  },
  codeHint: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 11,
    color: colors.textTertiary,
    textAlign: 'center',
  },
  sectionTitle: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 15,
    color: colors.text,
    marginBottom: 12,
  },
  memberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 14,
    marginBottom: 8,
    gap: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  memberAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary + '20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  memberAvatarText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 18,
    color: colors.primary,
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 14,
    color: colors.text,
  },
  memberRole: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 11,
    color: colors.textSecondary,
  },
  removeMemberBtn: {
    padding: 4,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 12,
  },
  emptyText: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 12,
    color: colors.textTertiary,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
});
