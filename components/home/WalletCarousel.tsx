import React, { useState, useRef, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
  Platform,
  Modal,
  Alert,
  useWindowDimensions,
  TextInput,
} from 'react-native';
import { useTransactions } from '@/lib/TransactionContext';
import { normalizeAmountInput } from '@/lib/arabicNumbers';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import Colors from '@/constants/colors';
import { Wallet, Transaction } from '@/lib/storage';
import { formatCurrency } from '@/lib/categories';
import { getExchangeRates, convertAmount } from '@/lib/currencyApi';
import WalletCardRender from './WalletCardRender';

interface WalletCarouselProps {
  wallets: Wallet[];
  selectedWallet: Wallet | null;
  transactions: Transaction[];
  currentUser: { id: string; username: string } | null;
  language: 'ar' | 'en' | 'hi';
  colors: any;
  healthScore?: number;
  onSelectWallet: (id: string) => void;
  onDeleteWallet: (id: string, name: string) => void;
  onAddWallet: () => void;
  onEditWallet?: (wallet: Wallet) => void;
}

export default function WalletCarousel({
  wallets,
  selectedWallet,
  transactions,
  currentUser,
  language,
  colors,
  healthScore = 100,
  onSelectWallet,
  onDeleteWallet,
  onAddWallet,
  onEditWallet,
}: WalletCarouselProps) {
  const loc = (ar: string, en: string, hi: string) => {
    if (language === 'hi') return hi;
    if (language === 'ar') return ar;
    return en;
  };

  const { width: windowWidth } = useWindowDimensions();
  const cardWidth = Math.min(440, Math.max(280, windowWidth - 32));
  const cardGap = 24;
  const styles = getStyles(colors, cardWidth, cardGap);
  const [actionWallet, setActionWallet] = useState<Wallet | null>(null);
  const [adjustWallet, setAdjustWallet] = useState<Wallet | null>(null);
  const [confirmStopShareWallet, setConfirmStopShareWallet] = useState<Wallet | null>(null);
  const [targetBalanceInput, setTargetBalanceInput] = useState('');
  const { updateWallet, refresh } = useTransactions();
  const scrollRef = useRef<ScrollView>(null);

  const [rates, setRates] = useState<Record<string, number>>({});

  useEffect(() => {
    async function loadRates() {
      try {
        const r = await getExchangeRates();
        setRates(r);
      } catch (e) {}
    }
    loadRates();
  }, []);

  const handleOpenAdjustModal = (w: Wallet, currentBal: number) => {
    Haptics.selectionAsync();
    setAdjustWallet(w);
    setTargetBalanceInput(Number(currentBal.toFixed(8)).toString());
  };

  const handleSaveAdjustedBalance = async () => {
    if (!adjustWallet) return;
    const targetAmount = parseFloat(normalizeAmountInput(targetBalanceInput)) || 0;
    
    // Calculate net transactions for this wallet
    const income = transactions.filter((t) => t.type === 'income' && t.walletId === adjustWallet.id).reduce((sum, t) => sum + t.amount, 0);
    const expense = transactions.filter((t) => t.type === 'expense' && t.walletId === adjustWallet.id).reduce((sum, t) => sum + t.amount, 0);
    const transferIn = transactions.filter((t) => t.type === 'transfer' && t.toWalletId === adjustWallet.id).reduce((sum, t) => {
      const fromW = wallets.find((w) => w.id === t.walletId);
      const fromCurrency = fromW ? fromW.currency : adjustWallet.currency;
      return sum + convertAmount(t.amount, fromCurrency, adjustWallet.currency, rates);
    }, 0);
    const transferOut = transactions.filter((t) => t.type === 'transfer' && t.walletId === adjustWallet.id).reduce((sum, t) => sum + t.amount, 0);

    const netTxns = income + transferIn - expense - transferOut;
    const newInitialBalance = targetAmount - netTxns;

    const updated = { ...adjustWallet, initialBalance: newInitialBalance };
    await updateWallet(updated);
    try { await refresh(); } catch {}

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setAdjustWallet(null);
  };

  useEffect(() => {
    if (selectedWallet && scrollRef.current) {
      const index = wallets.findIndex((w) => w.id === selectedWallet.id);
      if (index !== -1) {
        scrollRef.current.scrollTo({ x: index * (cardWidth + cardGap), animated: true });
      }
    }
  }, [selectedWallet?.id, cardWidth, cardGap, wallets]);

  return (
    <View style={styles.walletsSection}>
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.walletsScroll}
        snapToInterval={cardWidth + cardGap}
        snapToAlignment="center"
        decelerationRate="fast"
        onMomentumScrollEnd={(event) => {
          const offsetX = event.nativeEvent.contentOffset.x;
          const index = Math.round(offsetX / (cardWidth + cardGap));
          if (wallets[index] && wallets[index].id !== selectedWallet?.id) {
            Haptics.selectionAsync();
            onSelectWallet(wallets[index].id);
          }
        }}
      >
        {wallets.map((wallet) => {
          const isSelected = selectedWallet?.id === wallet.id;
          const cardNumSuffix = wallet.id.slice(-4).toUpperCase();

          const income = transactions
            .filter((t) => t.type === 'income' && t.walletId === wallet.id)
            .reduce((sum, t) => sum + t.amount, 0);
          const expense = transactions
            .filter((t) => t.type === 'expense' && t.walletId === wallet.id)
            .reduce((sum, t) => sum + t.amount, 0);
          const transferIn = transactions
            .filter((t) => t.type === 'transfer' && t.toWalletId === wallet.id)
            .reduce((sum, t) => {
              const fromW = wallets.find((w) => w.id === t.walletId);
              const fromCurrency = fromW ? fromW.currency : wallet.currency;
              return sum + convertAmount(t.amount, fromCurrency, wallet.currency, rates);
            }, 0);
          const transferOut = transactions
            .filter((t) => t.type === 'transfer' && t.walletId === wallet.id)
            .reduce((sum, t) => sum + t.amount, 0);
          const walletBalance = (wallet.initialBalance || 0) + income + transferIn - expense - transferOut;

          const cardStyle = wallet.cardStyle || 'classic';

          const cardDesignStyle = [
            styles.cardGradient,
            cardStyle === 'glass' && {
              backgroundColor: 'rgba(255, 255, 255, 0.03)',
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.1)',
            },
            cardStyle === 'futuristic' && {
              backgroundColor: '#090D1A',
              borderWidth: 2,
              borderColor: wallet.color,
            },
            cardStyle === 'minimal' && {
              backgroundColor: 'transparent',
              borderWidth: 1.5,
              borderColor: wallet.color,
            },
          ];

          const textColor = cardStyle === 'minimal' ? wallet.color : '#fff';
          const textSecondaryColor =
            cardStyle === 'minimal'
              ? wallet.color + 'aa'
              : 'rgba(255,255,255,0.7)';
          const expiryColor = cardStyle === 'minimal' ? wallet.color : '#fff';

          const sharedText = wallet.sharedWith ? (() => {
            try {
              const parsed = JSON.parse(wallet.sharedWith);
              let membersList: any[] = [];
              if (Array.isArray(parsed)) {
                membersList = parsed;
              } else if (parsed && typeof parsed === 'object' && Array.isArray(parsed.members)) {
                membersList = parsed.members;
              }

              if (membersList.length > 0) {
                // Filter out owner to get the other actively joined members
                const otherMembers = membersList
                  .filter((m: any) => m.role !== 'owner' && m.username && m.username !== 'مالك المحفظة' && m.username !== 'صاحب المحفظة')
                  .map((m: any) => m.username)
                  .filter(Boolean);

                // If no other members are joined (only owner), hide the badge
                if (membersList.length <= 1 || otherMembers.length === 0) {
                  return undefined;
                }

                if (otherMembers.length === 1) {
                  return otherMembers[0];
                }
                if (otherMembers.length === 2) {
                  return otherMembers.join('، ');
                }
                return loc(`${otherMembers.length} أعضاء`, `${otherMembers.length} members`, `${otherMembers.length} सदस्य`);
              }
            } catch (e) {}
            return undefined;
          })() : undefined;

          return (
            <Pressable
              key={wallet.id}
              onPress={() => {
                Haptics.selectionAsync();
                onSelectWallet(wallet.id);
              }}
              onLongPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                setActionWallet(wallet);
              }}
              style={({ pressed }) => [
                styles.wallet3DCard,
                isSelected && styles.wallet3DCardSelected,
                {
                  shadowColor: wallet.color,
                  shadowOpacity: isSelected ? 0.5 : 0.25,
                  shadowRadius: isSelected ? 14 : 6,
                  shadowOffset: { width: 0, height: isSelected ? 6 : 3 },
                },
                pressed && { transform: [{ scale: 0.97 }] },
              ]}
            >
              <WalletCardRender
                name={wallet.name}
                balanceFormatted={`${walletBalance >= 0 ? '' : '-'}${formatCurrency(Math.abs(walletBalance), language, wallet.currency)}`}
                currencySymbol={wallet.currency}
                cardStyle={cardStyle}
                color={wallet.color}
                icon={wallet.icon || 'account-balance-wallet'}
                isShared={Boolean(sharedText)}
                sharedLabel={sharedText ? loc(`مشترك: ${sharedText}`, `Shared: ${sharedText}`, `साझा: ${sharedText}`) : undefined}
                height={190}
              />
            </Pressable>
          );
        })}
        <Pressable onPress={onAddWallet} style={styles.addWallet3DCard}>
          <View style={styles.addWalletIcon3DWrap}>
            <Ionicons name="add" size={32} color={Colors.primary} />
          </View>
          <Text style={styles.addWallet3DText}>
            {loc('محفظة جديدة', 'New Wallet', 'नया वॉलेट')}
          </Text>
        </Pressable>
      </ScrollView>

      {wallets.length > 1 && (
        <View style={styles.paginationDots}>
          {wallets.map((w) => {
            const isActive = selectedWallet?.id === w.id;
            return (
              <Pressable
                key={w.id}
                onPress={() => {
                  Haptics.selectionAsync();
                  onSelectWallet(w.id);
                }}
                hitSlop={12}
                style={({ pressed }) => [
                  styles.dotPressable,
                  pressed && { opacity: 0.6, transform: [{ scale: 1.1 }] },
                ]}
              >
                <View
                  style={[styles.dot, isActive ? styles.dotActive : styles.dotInactive]}
                />
              </Pressable>
            );
          })}
        </View>
      )}

      {/* Wallet Actions Modal */}
      <Modal
        visible={Boolean(actionWallet)}
        transparent
        animationType="fade"
        onRequestClose={() => setActionWallet(null)}
      >
        <Pressable
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.65)',
            justifyContent: 'flex-end',
          }}
          onPress={() => setActionWallet(null)}
        >
          <Pressable
            style={{
              backgroundColor: colors.surface,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              padding: 20,
              paddingBottom: Platform.OS === 'ios' ? 40 : 24,
              borderTopWidth: 1,
              borderTopColor: colors.border,
            }}
            onPress={(e) => e.stopPropagation()}
          >
            {actionWallet && (
              <>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 16,
                    paddingBottom: 12,
                    borderBottomWidth: 1,
                    borderBottomColor: colors.border,
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <View
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 12,
                        backgroundColor: actionWallet.color + '20',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <MaterialIcons
                        name={(actionWallet.icon as any) || 'account-balance-wallet'}
                        size={22}
                        color={actionWallet.color}
                      />
                    </View>
                    <View>
                      <Text
                        style={{
                          fontFamily: 'Cairo_700Bold',
                          fontSize: 16,
                          color: colors.text,
                        }}
                      >
                        {actionWallet.name}
                      </Text>
                      <Text
                        style={{
                          fontFamily: 'Cairo_400Regular',
                          fontSize: 12,
                          color: colors.textSecondary,
                        }}
                      >
                        {actionWallet.currency}
                      </Text>
                    </View>
                  </View>
                  <Pressable onPress={() => setActionWallet(null)}>
                    <Ionicons name="close" size={22} color={colors.textSecondary} />
                  </Pressable>
                </View>

                {/* Quick Option: Direct Balance Adjustment */}
                <Pressable
                  onPress={() => {
                    const w = actionWallet;
                    setActionWallet(null);
                    // Calculate current balance for actionWallet
                    const income = transactions.filter((t) => t.type === 'income' && t.walletId === w.id).reduce((sum, t) => sum + t.amount, 0);
                    const expense = transactions.filter((t) => t.type === 'expense' && t.walletId === w.id).reduce((sum, t) => sum + t.amount, 0);
                    const transferIn = transactions.filter((t) => t.type === 'transfer' && t.toWalletId === w.id).reduce((sum, t) => {
                      const fromW = wallets.find((wObj) => wObj.id === t.walletId);
                      const fromCurrency = fromW ? fromW.currency : w.currency;
                      return sum + convertAmount(t.amount, fromCurrency, w.currency, rates);
                    }, 0);
                    const transferOut = transactions.filter((t) => t.type === 'transfer' && t.walletId === w.id).reduce((sum, t) => sum + t.amount, 0);
                    const curBal = (w.initialBalance || 0) + income + transferIn - expense - transferOut;

                    handleOpenAdjustModal(w, curBal);
                  }}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 12,
                    paddingVertical: 14,
                    paddingHorizontal: 12,
                    borderRadius: 12,
                    backgroundColor: colors.primary + '18',
                    borderColor: colors.primary + '40',
                    borderWidth: 1,
                    marginBottom: 8,
                  }}
                >
                  <Ionicons name="cash-outline" size={20} color={colors.primary} />
                  <Text
                    style={{
                      fontFamily: 'Cairo_700Bold',
                      fontSize: 14,
                      color: colors.primary,
                    }}
                  >
                    {loc('تعديل الرصيد المتاح يدوياً ✏️', 'Quick Adjust Balance ✏️', 'शेष राशि त्वरित समायोजित करें ✏️')}
                  </Text>
                </Pressable>

                {/* Option 1: Edit Wallet */}
                <Pressable
                  onPress={() => {
                    const w = actionWallet;
                    setActionWallet(null);
                    if (onEditWallet) {
                      onEditWallet(w);
                    } else {
                      router.push({
                        pathname: '/add-wallet',
                        params: { walletId: w.id },
                      } as any);
                    }
                  }}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 12,
                    paddingVertical: 14,
                    paddingHorizontal: 12,
                    borderRadius: 12,
                    backgroundColor: colors.surfaceAlt + '60',
                    marginBottom: 8,
                  }}
                >
                  <Ionicons name="create-outline" size={20} color={colors.primary} />
                  <Text
                    style={{
                      fontFamily: 'Cairo_700Bold',
                      fontSize: 14,
                      color: colors.text,
                    }}
                  >
                    {loc('تعديل المحفظة', 'Edit Wallet', 'वॉलेट संपादित करें')}
                  </Text>
                </Pressable>

                {/* Option 2: Set Active Wallet */}
                {selectedWallet?.id !== actionWallet.id && (
                  <Pressable
                    onPress={() => {
                      onSelectWallet(actionWallet.id);
                      setActionWallet(null);
                    }}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 12,
                      paddingVertical: 14,
                      paddingHorizontal: 12,
                      borderRadius: 12,
                      backgroundColor: colors.surfaceAlt + '60',
                      marginBottom: 8,
                    }}
                  >
                    <Ionicons name="checkmark-circle-outline" size={20} color="#10B981" />
                    <Text
                      style={{
                        fontFamily: 'Cairo_700Bold',
                        fontSize: 14,
                        color: colors.text,
                      }}
                    >
                      {loc('تعيين كمحفظة نشطة', 'Set as Active Wallet', 'सक्रिय वॉलेट के रूप में सेट करें')}
                    </Text>
                  </Pressable>
                )}

                {/* Option 3: Share / Manage Wallet */}
                <Pressable
                  onPress={() => {
                    const wId = actionWallet.id;
                    setActionWallet(null);
                    router.push(`/share-wallet?walletId=${wId}` as any);
                  }}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 12,
                    paddingVertical: 14,
                    paddingHorizontal: 12,
                    borderRadius: 12,
                    backgroundColor: colors.surfaceAlt + '60',
                    marginBottom: 8,
                  }}
                >
                  <Ionicons name="share-social-outline" size={20} color="#3B82F6" />
                  <Text
                    style={{
                      fontFamily: 'Cairo_700Bold',
                      fontSize: 14,
                      color: colors.text,
                    }}
                  >
                    {actionWallet.isJoined
                      ? loc('عرض تفاصيل وأعضاء المحفظة', 'View Shared Wallet Members', 'साझा वॉलेट सदस्य देखें')
                      : (actionWallet.shareCode || actionWallet.sharedWith)
                      ? loc('إدارة المشاركة والأعضاء', 'Manage Sharing & Members', 'साझाकरण और सदस्य प्रबंधित करें')
                      : loc('مشاركة المحفظة', 'Share Wallet', 'वॉलेट साझा करें')}
                  </Text>
                </Pressable>

                {/* Option 3.2: Stop Sharing (for owner) or Leave Wallet (for joined member) */}
                {(actionWallet.shareCode || actionWallet.sharedWith || actionWallet.isJoined) && (
                  <Pressable
                    onPress={() => {
                      const w = actionWallet;
                      setActionWallet(null);
                      try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy); } catch {}
                      setConfirmStopShareWallet(w);
                    }}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 12,
                      paddingVertical: 14,
                      paddingHorizontal: 12,
                      borderRadius: 12,
                      backgroundColor: 'rgba(239, 68, 68, 0.1)',
                      marginBottom: 8,
                    }}
                  >
                    <Ionicons name={actionWallet.isJoined ? "log-out-outline" : "link-outline"} size={20} color="#EF4444" />
                    <Text
                      style={{
                        fontFamily: 'Cairo_700Bold',
                        fontSize: 14,
                        color: '#EF4444',
                      }}
                    >
                      {actionWallet.isJoined
                        ? loc('مغادرة المحفظة المشتركة', 'Leave Shared Wallet', 'साझा वॉलेट छोड़ें')
                        : loc('إلغاء مشاركة المحفظة', 'Stop Sharing Wallet', 'वॉलेट साझा करना बंद करें')}
                    </Text>
                  </Pressable>
                )}

                {/* Option 3.5: Toggle Exclude from Total */}
                <Pressable
                  onPress={async () => {
                    const w = actionWallet;
                    setActionWallet(null);
                    const updated = { ...w, excludeFromTotal: !w.excludeFromTotal };
                    try {
                      await updateWallet(updated);
                      await refresh();
                    } catch (e) {}
                  }}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 12,
                    paddingVertical: 14,
                    paddingHorizontal: 12,
                    borderRadius: 12,
                    backgroundColor: colors.surfaceAlt + '60',
                    marginBottom: 8,
                  }}
                >
                  <Ionicons
                    name={actionWallet.excludeFromTotal ? "eye-off-outline" : "eye-outline"}
                    size={20}
                    color={actionWallet.excludeFromTotal ? "#F59E0B" : colors.primary}
                  />
                  <Text
                    style={{
                      fontFamily: 'Cairo_700Bold',
                      fontSize: 14,
                      color: colors.text,
                    }}
                  >
                    {actionWallet.excludeFromTotal
                      ? loc('تضمين في الإجمالي الشامل', 'Include in Consolidated Total', 'समेकित कुल में शामिल करें')
                      : loc('استبعاد من الإجمالي الشامل', 'Exclude from Consolidated Total', 'समेकित कुल से बाहर रखें')}
                  </Text>
                </Pressable>

                {/* Option 4: Delete Wallet */}
                <Pressable
                  onPress={() => {
                    const w = actionWallet;
                    setActionWallet(null);
                    onDeleteWallet(w.id, w.name);
                  }}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 12,
                    paddingVertical: 14,
                    paddingHorizontal: 12,
                    borderRadius: 12,
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    marginTop: 4,
                  }}
                >
                  <Ionicons name="trash-outline" size={20} color="#EF4444" />
                  <Text
                    style={{
                      fontFamily: 'Cairo_700Bold',
                      fontSize: 14,
                      color: '#EF4444',
                    }}
                  >
                    {loc('حذف المحفظة وكافة بياناتها', 'Delete Wallet & All Data', 'वॉलेट और सारा डेटा हटाएं')}
                  </Text>
                </Pressable>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      {/* Direct Balance Adjustment Modal */}
      <Modal
        visible={!!adjustWallet}
        animationType="fade"
        transparent
        onRequestClose={() => setAdjustWallet(null)}
      >
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: 20 }}
          onPress={() => setAdjustWallet(null)}
        >
          <Pressable
            style={{ width: '100%', maxWidth: 420, backgroundColor: colors.surface, borderRadius: 22, padding: 22, borderWidth: 1, borderColor: colors.border, gap: 16 }}
            onPress={(e) => e.stopPropagation()}
          >
            {adjustWallet && (
              <>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: colors.primary + '20', alignItems: 'center', justifyContent: 'center' }}>
                      <Ionicons name="create-outline" size={20} color={colors.primary} />
                    </View>
                    <View>
                      <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 16, color: colors.text }}>
                        {loc('تعديل الرصيد المتاح يدوياً', 'Edit Available Balance', 'उपलब्ध शेष राशि संपादित करें')}
                      </Text>
                      <Text style={{ fontFamily: 'Cairo_600SemiBold', fontSize: 11, color: colors.primary }}>
                        {adjustWallet.name} ({adjustWallet.currency})
                      </Text>
                    </View>
                  </View>
                  <Pressable onPress={() => setAdjustWallet(null)} hitSlop={12}>
                    <Ionicons name="close" size={22} color={colors.textSecondary} />
                  </Pressable>
                </View>

                <Text style={{ fontFamily: 'Cairo_400Regular', fontSize: 12, color: colors.textSecondary, lineHeight: 20 }}>
                  {loc(
                    `أدخل المبلغ الإجمالي الفعلي الموجود بحوزتك الآن في محفظة "${adjustWallet.name}". سيتم تعديل رصيد المحفظة المتاح فوراً دون المساس بمعاملاتك التاريخية.`,
                    `Enter the actual total balance you currently hold in "${adjustWallet.name}".`,
                    `"${adjustWallet.name}" में आपके पास वर्तमान में मौजूद वास्तविक कुल शेष राशि दर्ज करें।`
                  )}
                </Text>

                <View style={{ gap: 6 }}>
                  <Text style={{ fontFamily: 'Cairo_600SemiBold', fontSize: 13, color: colors.text }}>
                    {loc(`الرصيد الفعلي الآن (${adjustWallet.currency}):`, `Actual Balance Now (${adjustWallet.currency}):`, `वर्तमान वास्तविक शेष (${adjustWallet.currency}):`)}
                  </Text>
                  <TextInput
                    style={{
                      backgroundColor: colors.surfaceAlt,
                      color: colors.text,
                      borderRadius: 14,
                      padding: 14,
                      fontSize: 22,
                      fontFamily: 'Cairo_700Bold',
                      borderWidth: 1.5,
                      borderColor: colors.primary,
                      textAlign: 'right',
                    }}
                    value={targetBalanceInput}
                    onChangeText={setTargetBalanceInput}
                    keyboardType="decimal-pad"
                    placeholder="0.00"
                    placeholderTextColor={colors.textTertiary}
                    autoFocus
                  />
                </View>

                <View style={{ flexDirection: 'row', gap: 10, marginTop: 6 }}>
                  <Pressable
                    onPress={() => setAdjustWallet(null)}
                    style={{ flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: colors.surfaceAlt, alignItems: 'center' }}
                  >
                    <Text style={{ fontFamily: 'Cairo_600SemiBold', color: colors.textSecondary }}>
                      {loc('إلغاء', 'Cancel', 'रद्द करें')}
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={handleSaveAdjustedBalance}
                    style={{ flex: 2, paddingVertical: 14, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center' }}
                  >
                    <Text style={{ fontFamily: 'Cairo_700Bold', color: '#FFF' }}>
                      {loc('حفظ الرصيد الجديد 💾', 'Save New Balance 💾', 'नया शेष सहेजें 💾')}
                    </Text>
                  </Pressable>
                </View>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      {/* Confirm Stop Sharing Modal */}
      <Modal
        visible={!!confirmStopShareWallet}
        animationType="fade"
        transparent
        onRequestClose={() => setConfirmStopShareWallet(null)}
      >
        <Pressable
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.7)',
            justifyContent: 'center',
            alignItems: 'center',
            padding: 20,
          }}
          onPress={() => setConfirmStopShareWallet(null)}
        >
          <Pressable
            style={{
              width: '100%',
              maxWidth: 400,
              backgroundColor: colors.surface,
              borderRadius: 22,
              padding: 22,
              borderWidth: 1,
              borderColor: colors.border,
              gap: 16,
            }}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={{ alignItems: 'center', gap: 12 }}>
              <View
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 28,
                  backgroundColor: 'rgba(239, 68, 68, 0.15)',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name={confirmStopShareWallet?.isJoined ? "log-out-outline" : "link-outline"} size={28} color="#EF4444" />
              </View>
              <Text
                style={{
                  fontFamily: 'Cairo_700Bold',
                  fontSize: 17,
                  color: colors.text,
                  textAlign: 'center',
                }}
              >
                {confirmStopShareWallet?.isJoined
                  ? loc('مغادرة المحفظة المشتركة', 'Leave Shared Wallet', 'साझा वॉलेट छोड़ें')
                  : loc('إلغاء مشاركة المحفظة', 'Stop Sharing Wallet', 'वॉलेट साझा करना बंद करें')}
              </Text>
              <Text
                style={{
                  fontFamily: 'Cairo_400Regular',
                  fontSize: 13,
                  color: colors.textSecondary,
                  textAlign: 'center',
                  lineHeight: 20,
                }}
              >
                {confirmStopShareWallet?.isJoined
                  ? loc(
                      `هل أنت متأكد من مغادرة محفظة "${confirmStopShareWallet?.name}"؟ سيتم حذف المحفظة ومعاملاتها من جهازك.`,
                      `Are you sure you want to leave "${confirmStopShareWallet?.name}"? The wallet and its transactions will be removed from your device.`,
                      `क्या आप "${confirmStopShareWallet?.name}" छोड़ने के लिए सुनिश्चित हैं? वॉलेट और उसके लेन-देन आपके डिवाइस से हटा दिए जाएंगे।`
                    )
                  : loc(
                      `هل أنت متأكد من إيقاف مشاركة محفظة "${confirmStopShareWallet?.name}"؟ سيتم تعطيل كود المشاركة وإزالة كافة الأعضاء وتصبح المحفظة خاصة بك فقط.`,
                      `Are you sure you want to stop sharing "${confirmStopShareWallet?.name}"? The share code will be revoked and members removed.`,
                      `क्या आप "${confirmStopShareWallet?.name}" को साझा करना बंद करने के लिए सुनिश्चित हैं? साझाकरण कोड अमान्य कर दिया जाएगा और सदस्य हटा दिए जाएंगे।`
                    )}
              </Text>
            </View>

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
              <Pressable
                onPress={() => setConfirmStopShareWallet(null)}
                style={{
                  flex: 1,
                  paddingVertical: 12,
                  borderRadius: 12,
                  backgroundColor: colors.surfaceAlt,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text
                  style={{
                    fontFamily: 'Cairo_700Bold',
                    fontSize: 14,
                    color: colors.textSecondary,
                  }}
                >
                  {loc('إلغاء', 'Cancel', 'रद्द करें')}
                </Text>
              </Pressable>

              <Pressable
                onPress={async () => {
                  const target = confirmStopShareWallet;
                  setConfirmStopShareWallet(null);
                  if (!target) return;
                  try {
                    if (target.isJoined) {
                      const { leaveSharedWallet } = await import('@/lib/sharingService');
                      await leaveSharedWallet(target.id);
                      await refresh();
                      try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch {}
                      Alert.alert(
                        loc('تم بنجاح', 'Success', 'सफल'),
                        loc('تمت مغادرة المحفظة بنجاح', 'You have left the wallet', 'आप सफलतापूर्वक वॉलेट से बाहर हो गए हैं')
                      );
                    } else {
                      const { stopSharingWallet } = await import('@/lib/sharingService');
                      await stopSharingWallet(target.id);
                      const updated = { ...target };
                      delete updated.shareCode;
                      delete updated.sharedWith;
                      await updateWallet(updated);
                      await refresh();
                      try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch {}
                      Alert.alert(
                        loc('تم بنجاح', 'Success', 'सफल'),
                        loc('تم إيقاف مشاركة المحفظة وأصبحت خاصة بك فقط', 'Wallet sharing has been stopped', 'वॉलेट साझाकरण रोक दिया गया है और अब यह केवल आपका है')
                      );
                    }
                  } catch (e) {
                    console.error('Failed to stop sharing or leave:', e);
                  }
                }}
                style={{
                  flex: 1,
                  paddingVertical: 12,
                  borderRadius: 12,
                  backgroundColor: '#EF4444',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text
                  style={{
                    fontFamily: 'Cairo_700Bold',
                    fontSize: 14,
                    color: '#FFF',
                  }}
                >
                  {confirmStopShareWallet?.isJoined
                    ? loc('مغادرة', 'Leave', 'छोड़ें')
                    : loc('إيقاف المشاركة', 'Stop Sharing', 'साझाकरण रोकें')}
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const getStyles = (colors: any, cardWidth: number, cardGap: number) =>
  StyleSheet.create({
    walletsSection: {
      marginTop: 12,
      paddingHorizontal: 0,
    },
    walletsScroll: {
      paddingHorizontal: 16,
      gap: cardGap,
      paddingVertical: 6,
    },
    wallet3DCard: {
      width: cardWidth,
      height: 175,
      borderRadius: 22,
      overflow: 'hidden',
      elevation: 6,
      backgroundColor: 'transparent',
    },
    wallet3DCardSelected: {
      borderWidth: 2.5,
      borderColor: colors.text,
      elevation: 12,
      shadowColor: colors.primary,
      shadowOpacity: 0.4,
    },
    cardGradient: {
      flex: 1,
      paddingHorizontal: 16,
      paddingVertical: 12,
      justifyContent: 'space-between',
    },
    addWallet3DCard: {
      width: 140,
      height: 175,
      borderRadius: 22,
      borderWidth: 2,
      borderStyle: 'dashed',
      borderColor: colors.border,
      backgroundColor: colors.surfaceAlt + '40',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      padding: 16,
    },
    addWalletIcon3DWrap: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: colors.primary + '12',
      alignItems: 'center',
      justifyContent: 'center',
    },
    addWallet3DText: {
      fontFamily: 'Cairo_700Bold',
      fontSize: 13,
      color: colors.primary,
      textAlign: 'center',
    },
    paginationDots: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: 12,
      marginBottom: 16,
      gap: 8,
    },
    dotPressable: {
      padding: 4,
    },
    dot: {
      height: 7,
      borderRadius: 4,
    },
    dotActive: {
      width: 22,
      backgroundColor: colors.primary,
    },
    dotInactive: {
      width: 7,
      backgroundColor: colors.border,
    },
  });
