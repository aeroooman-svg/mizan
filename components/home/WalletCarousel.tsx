import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
  Platform,
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
}: WalletCarouselProps) {
  const styles = getStyles(colors);

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
              onLongPress={() => onDeleteWallet(wallet.id, wallet.name)}
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
                      alignItems: 'center',
                    }}
                  >
                    <View style={{ flex: 1, marginRight: 8 }}>
                      <Text
                        style={{
                          fontFamily: 'Cairo_700Bold',
                          fontSize: 16,
                          color: textColor,
                          textAlign: 'left',
                        }}
                        numberOfLines={1}
                      >
                        {wallet.name.toUpperCase()}
                      </Text>
                      <Text
                        style={{
                          fontFamily: 'Cairo_600SemiBold',
                          fontSize: 9,
                          color: textSecondaryColor,
                          letterSpacing: 0.5,
                          textAlign: 'left',
                        }}
                      >
                        MIZAN PLATINUM
                      </Text>
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
                            backgroundColor: 'rgba(16, 185, 129, 0.15)',
                            paddingHorizontal: 6,
                            paddingVertical: 2,
                            borderRadius: 6,
                            alignSelf: 'flex-start',
                            marginTop: 4,
                          }}
                        >
                          <Ionicons name="people" size={10} color="#10B981" />
                          <Text
                            style={{
                              fontFamily: 'Cairo_600SemiBold',
                              fontSize: 8,
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
                      {currentUser && wallet.userId === currentUser.id && (
                        <Pressable
                          onPress={() => {
                            Haptics.selectionAsync();
                            router.push(`/share-wallet?walletId=${wallet.id}` as any);
                          }}
                          hitSlop={10}
                        >
                          <Ionicons name="share-social-outline" size={20} color={textColor} />
                        </Pressable>
                      )}
                      <MaterialIcons
                        name={(wallet.icon as any) || 'account-balance-wallet'}
                        size={24}
                        color={textColor}
                      />
                    </View>
                  </View>

                  {/* Middle Balance Row */}
                  <View style={{ marginVertical: 2 }}>
                    <Text
                      style={{
                        fontFamily: 'Cairo_400Regular',
                        fontSize: 8,
                        color: textSecondaryColor,
                        textTransform: 'uppercase',
                        letterSpacing: 1,
                      }}
                    >
                      {language === 'ar' ? 'الرصيد المتاح' : 'Available Balance'}
                    </Text>
                    <Text
                      style={{
                        fontFamily: 'Cairo_700Bold',
                        fontSize: 26,
                        color: textColor,
                        lineHeight: 32,
                      }}
                      numberOfLines={1}
                    >
                      {walletBalance >= 0 ? '' : '-'}
                      {formatCurrency(Math.abs(walletBalance), language)}{' '}
                      <Text style={{ fontSize: 13, fontFamily: 'Cairo_600SemiBold' }}>
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
    </View>
  );
}

const getStyles = (colors: any) =>
  StyleSheet.create({
    walletsSection: {
      marginTop: 16,
      paddingLeft: 20,
    },
    walletsScroll: {
      paddingRight: 20,
      gap: 10,
      paddingVertical: 4,
    },
    wallet3DCard: {
      width: 270,
      height: 160,
      borderRadius: 20,
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
      height: 160,
      borderRadius: 20,
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
