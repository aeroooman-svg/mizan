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
  const { wallets, selectedWallet } = useTransactions();
  const params = useLocalSearchParams<{ walletId: string }>();

  const targetWalletId = params.walletId || selectedWallet?.id || (wallets.length > 0 ? wallets[0].id : null);
  const wallet = wallets.find(w => w.id === targetWalletId) || wallets[0];

  const [shareCode, setShareCode] = useState<string | null>(null);
  const [members, setMembers] = useState<SharedMember[]>([]);
  const [loading, setLoading] = useState(true);
  const isAr = language === 'ar';

  useEffect(() => {
    async function loadData() {
      if (!targetWalletId) {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const [code, membersList] = await Promise.all([
          getOrCreateShareCode(targetWalletId),
          getSharedMembers(targetWalletId),
        ]);
        setShareCode(code);
        setMembers(membersList);
      } catch (e) {
        console.warn('Failed to load share wallet data', e);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [targetWalletId]);

  const handleBack = () => {
    try { Haptics.selectionAsync(); } catch {}
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
  };

  const handleCopyCode = async () => {
    if (!shareCode) return;
    try {
      await Clipboard.setStringAsync(shareCode);
      try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch {}
      Alert.alert(
        isAr ? 'تم النسخ!' : 'Copied!',
        isAr ? 'تم نسخ كود المشاركة إلى الحافظة' : 'Share code copied to clipboard',
      );
    } catch (e) {
      console.error('Copy error:', e);
    }
  };

  const handleShareCode = async () => {
    if (!shareCode) return;
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch {}
    const walletName = wallet?.name || (isAr ? 'المحفظة' : 'Wallet');
    const message = isAr
      ? `🔗 انضم لمحفظتي "${walletName}" في تطبيق ميزان!\n\nكود المشاركة: ${shareCode}\n\nحمّل التطبيق وأدخل الكود للانضمام.`
      : `🔗 Join my wallet "${walletName}" on MIZAN app!\n\nShare code: ${shareCode}\n\nDownload the app and enter the code to join.`;

    try {
      if (Platform.OS === 'web') {
        if (typeof navigator !== 'undefined' && (navigator as any).share) {
          await (navigator as any).share({ title: 'Mizan Share Wallet', text: message });
          return;
        }
        await Clipboard.setStringAsync(message);
        Alert.alert(
          isAr ? 'تم النسخ!' : 'Copied!',
          isAr ? 'تم نسخ رسالة وكود المشاركة إلى الحافظة' : 'Share code and message copied to clipboard',
        );
      } else {
        await Share.share({ message });
      }
    } catch (e) {
      await Clipboard.setStringAsync(message);
      Alert.alert(
        isAr ? 'تم النسخ!' : 'Copied!',
        isAr ? 'تم نسخ كود المشاركة إلى الحافظة' : 'Share code copied to clipboard',
      );
    }
  };

  const handleRemoveMember = (member: SharedMember) => {
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy); } catch {}
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
            if (!targetWalletId) return;
            const success = await removeSharedMember(targetWalletId, member.userId);
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
          onPress={handleBack}
          style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.7 }]}
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
          ListFooterComponent={
            shareCode ? (
              <View style={{ marginTop: 24, gap: 12 }}>
                <Pressable
                  onPress={() => {
                    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy); } catch {}
                    Alert.alert(
                      isAr ? 'إيقاف مشاركة المحفظة' : 'Stop Sharing Wallet',
                      isAr
                        ? 'هل تريد بالتأكيد إيقاف المشاركة؟ سيتم تعطيل كود المشاركة وإزالة كافة الأعضاء وتصبح المحفظة شخصية فقط.'
                        : 'Are you sure you want to stop sharing? The share code will be revoked and members removed.',
                      [
                        { text: isAr ? 'إلغاء' : 'Cancel', style: 'cancel' },
                        {
                          text: isAr ? 'إيقاف المشاركة' : 'Stop Sharing',
                          style: 'destructive',
                          onPress: async () => {
                            if (!targetWalletId) return;
                            setLoading(true);
                            const { stopSharingWallet } = await import('@/lib/sharingService');
                            const ok = await stopSharingWallet(targetWalletId);
                            setLoading(false);
                            if (ok) {
                              try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch {}
                              Alert.alert(
                                isAr ? 'تم بنجاح' : 'Success',
                                isAr ? 'تم إيقاف مشاركة المحفظة بنجاح وأصبحت خاصة بك فقط.' : 'Wallet sharing stopped successfully.',
                                [{ text: isAr ? 'حسناً' : 'OK', onPress: () => router.back() }]
                              );
                            }
                          },
                        },
                      ]
                    );
                  }}
                  style={({ pressed }) => [
                    {
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      paddingVertical: 14,
                      borderRadius: 14,
                      backgroundColor: 'rgba(239, 68, 68, 0.12)',
                      borderWidth: 1,
                      borderColor: 'rgba(239, 68, 68, 0.3)',
                    },
                    pressed && { opacity: 0.8 },
                  ]}
                >
                  <Ionicons name="link-outline" size={20} color="#EF4444" />
                  <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 14, color: '#EF4444' }}>
                    {isAr ? 'إيقاف المشاركة للجميع' : 'Stop Sharing for Everyone'}
                  </Text>
                </Pressable>
              </View>
            ) : null
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
