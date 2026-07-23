import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
  Platform,
  Modal,
} from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import Colors from '@/constants/colors';
import { Wallet, Transaction } from '@/lib/storage';
import { formatCurrency } from '@/lib/categories';

interface WalletCarouselProps {
  wallets: Wallet[];
  selectedWallet: Wallet | null;
  transactions: Transaction[];
  currentUser: { id: string; username: string } | null;
  language: 'ar' | 'en';
  colors: any;
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
  onSelectWallet,
  onDeleteWallet,
  onAddWallet,
  onEditWallet,
}: WalletCarouselProps) {
  const styles = getStyles(colors);
  const [actionWallet, setActionWallet] = useState<Wallet | null>(null);

  return (
    <View style={styles.walletsSection}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.walletsScroll}
        snapToInterval={290}
        decelerationRate="fast"
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
            .reduce((sum, t) => sum + t.amount, 0);
          const transferOut = transactions
            .filter((t) => t.type === 'transfer' && t.walletId === wallet.id)
            .reduce((sum, t) => sum + t.amount, 0);
          const walletBalance = income + transferIn - expense - transferOut;

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
                  shadowOpacity: isSelected ? 0.45 : 0.2,
                  shadowRadius: isSelected ? 12 : 6,
                  shadowOffset: { width: 0, height: isSelected ? 6 : 3 },
                },
                pressed && { transform: [{ scale: 0.97 }] },
              ]}
            >
              <View style={[cardDesignStyle, { paddingHorizontal: 0, paddingVertical: 0 }]}>
                {cardStyle === 'classic' && (
                  <LinearGradient
                    colors={[wallet.color, '#060B18']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={[StyleSheet.absoluteFillObject, { borderRadius: 18 }]}
                  />
                )}
                {cardStyle === 'glass' &&
                  (Platform.OS === 'ios' ? (
                    <BlurView
                      intensity={35}
                      tint="dark"
                      style={[StyleSheet.absoluteFillObject, { borderRadius: 18 }]}
                    />
                  ) : (
                    <View
                      style={[
                        StyleSheet.absoluteFillObject,
                        { backgroundColor: 'rgba(15, 23, 42, 0.9)', borderRadius: 18 },
                      ]}
                    />
                  ))}

                <View style={{ flex: 1, justifyContent: 'space-between', padding: 18 }}>
                  {/* Top Header Row */}
                  <View
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                    }}
                  >
                    <View style={{ flex: 1, marginRight: 8 }}>
                      <Text
                        style={{
                          fontFamily: 'Cairo_700Bold',
                          fontSize: 22,
                          color: textColor,
                          textAlign: 'left',
                          lineHeight: 28,
                        }}
                        numberOfLines={1}
                      >
                        {wallet.name.toUpperCase()}
                      </Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                        <View style={{ backgroundColor: 'rgba(255,255,255,0.18)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 }}>
                          <Text
                            style={{
                              fontFamily: 'Cairo_700Bold',
                              fontSize: 9,
                              color: textSecondaryColor,
                              letterSpacing: 0.8,
                            }}
                          >
                            MIZAN PLATINUM
                          </Text>
                        </View>
                      </View>
                      {wallet.sharedWith && (
                        <Pressable
                          onPress={() => {
                            Haptics.selectionAsync();
                            router.push(`/share-wallet?walletId=${wallet.id}` as any);
                          }}
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 4,
                            backgroundColor: 'rgba(16, 185, 129, 0.2)',
                            paddingHorizontal: 8,
                            paddingVertical: 3,
                            borderRadius: 6,
                            alignSelf: 'flex-start',
                            marginTop: 6,
                          }}
                        >
                          <Ionicons name="people" size={12} color="#10B981" />
                          <Text
                            style={{
                              fontFamily: 'Cairo_700Bold',
                              fontSize: 9,
                              color: '#10B981',
                            }}
                          >
                            {(() => {
                              try {
                                const members = JSON.parse(wallet.sharedWith);
                                if (Array.isArray(members)) {
                                  const names = members.map((m) => m.username).join(', ');
                                  return language === 'ar'
                                    ? `مشترك: ${names}`
                                    : `Shared: ${names}`;
                                }
                              } catch (e) {}
                              return language === 'ar'
                                ? `مشترك مع ${wallet.sharedWith}`
                                : `Shared: ${wallet.sharedWith}`;
                            })()}
                          </Text>
                        </Pressable>
                      )}
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <Pressable
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                          setActionWallet(wallet);
                        }}
                        hitSlop={10}
                        style={{
                          padding: 6,
                          backgroundColor: 'rgba(255,255,255,0.18)',
                          borderRadius: 10,
                        }}
                      >
                        <Ionicons name="ellipsis-vertical" size={16} color={textColor} />
                      </Pressable>
                      <MaterialIcons
                        name={(wallet.icon as any) || 'account-balance-wallet'}
                        size={26}
                        color={textColor}
                      />
                    </View>
                  </View>

                  {/* Middle Balance Row - Label & amount strictly aligned on the same side */}
                  <View style={{ marginVertical: 4, alignItems: 'flex-start' }}>
                    <Text
                      style={{
                        fontFamily: 'Cairo_600SemiBold',
                        fontSize: 10,
                        color: textSecondaryColor,
                        textTransform: 'uppercase',
                        letterSpacing: 0.5,
                        textAlign: 'left',
                        marginBottom: 2,
                      }}
                    >
                      {language === 'ar' ? 'الرصيد المتاح' : 'Available Balance'}
                    </Text>
                    <Text
                      style={{
                        fontFamily: 'Cairo_700Bold',
                        fontSize: 26,
                        color: textColor,
                        lineHeight: 34,
                        textAlign: 'left',
                      }}
                      numberOfLines={1}
                    >
                      {walletBalance >= 0 ? '' : '-'}
                      {formatCurrency(Math.abs(walletBalance), language)}{' '}
                      <Text style={{ fontSize: 14, fontFamily: 'Cairo_600SemiBold' }}>
                        {wallet.currency}
                      </Text>
                    </Text>
                  </View>

                  {/* Bottom Footer Row */}
                  <View
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <Text
                      style={{
                        fontFamily: 'Cairo_600SemiBold',
                        fontSize: 11,
                        color: textSecondaryColor,
                        letterSpacing: 1.5,
                      }}
                    >
                      ••••  ••••  ••••  {cardNumSuffix}
                    </Text>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text
                        style={{
                          fontFamily: 'Cairo_600SemiBold',
                          fontSize: 10,
                          color: expiryColor,
                        }}
                      >
                        07/31
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
            </Pressable>
          );
        })}
        <Pressable onPress={onAddWallet} style={styles.addWallet3DCard}>
          <View style={styles.addWalletIcon3DWrap}>
            <Ionicons name="add" size={32} color={Colors.primary} />
          </View>
          <Text style={styles.addWallet3DText}>
            {language === 'ar' ? 'محفظة جديدة' : 'New Wallet'}
          </Text>
        </Pressable>
      </ScrollView>

      {wallets.length > 1 && (
        <View style={styles.paginationDots}>
          {wallets.map((w) => {
            const isActive = selectedWallet?.id === w.id;
            return (
              <View
                key={w.id}
                style={[styles.dot, isActive ? styles.dotActive : styles.dotInactive]}
              />
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
                    {language === 'ar' ? 'تعديل المحفظة' : 'Edit Wallet'}
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
                      {language === 'ar' ? 'تعيين كمحفظة نشطة' : 'Set as Active Wallet'}
                    </Text>
                  </Pressable>
                )}

                {/* Option 3: Share Wallet */}
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
                    {language === 'ar' ? 'مشاركة المحفظة' : 'Share Wallet'}
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
                    {language === 'ar'
                      ? 'حذف المحفظة وكافة بياناتها'
                      : 'Delete Wallet & All Data'}
                  </Text>
                </Pressable>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const getStyles = (colors: any) =>
  StyleSheet.create({
    walletsSection: {
      marginTop: 12,
      paddingLeft: 20,
    },
    walletsScroll: {
      paddingRight: 20,
      gap: 12,
      paddingVertical: 6,
    },
    wallet3DCard: {
      width: 280,
      height: 175,
      borderRadius: 22,
      elevation: 6,
      backgroundColor: colors.surface,
    },
    wallet3DCardSelected: {
      borderWidth: 2,
      borderColor: colors.text,
      elevation: 10,
      shadowColor: colors.primary,
      shadowOpacity: 0.3,
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
      gap: 6,
    },
    dot: {
      height: 6,
      borderRadius: 3,
    },
    dotActive: {
      width: 16,
      backgroundColor: colors.primary,
    },
    dotInactive: {
      width: 6,
      backgroundColor: colors.border,
    },
  });
