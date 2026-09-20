import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
  Modal,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/lib/ThemeContext';
import { useLanguage } from '@/lib/LanguageContext';
import { useTransactions } from '@/lib/TransactionContext';
import { formatCurrency } from '@/lib/categories';
import {
  BankConnection,
  SupportedBank,
  SyncResult,
  getBankConnections,
  removeBankConnection,
  registerBankConnection,
  performFullSync,
  revokeBankConsent,
  isConsentValid,
  getPopularBanks,
  getSupportedCountries,
  getBanksByCountry,
  fetchBankAccounts,
  isOpenBankingAvailable,
} from '@/lib/openBankingService';

export default function BankConnectScreen() {
  const { colors, theme } = useTheme();
  const styles = useMemo(() => getStyles(colors, theme), [colors, theme]);
  const insets = useSafeAreaInsets();
  const { language } = useLanguage();
  const isAr = language === 'ar';
  const { wallets, selectedWallet, transactions, refresh } = useTransactions();

  const loc = (ar: string, en: string, ml?: string) => {
    if (language === 'ml' || language === 'hi') return ml || en;
    if (language === 'ar') return ar;
    return en;
  };

  // State
  const [connections, setConnections] = useState<BankConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<string | null>(null); // connectionId being synced
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);

  const countries = getSupportedCountries();

  // Load connections
  const loadConnections = useCallback(async () => {
    setLoading(true);
    const conns = await getBankConnections();
    setConnections(conns);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadConnections();
  }, [loadConnections]);

  // Handle bank selection for connection
  const handleSelectBank = async (bank: SupportedBank) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    if (!isOpenBankingAvailable()) {
      // Demo mode — simulate connection
      Alert.alert(
        loc('وضع التجربة 🧪', 'Demo Mode 🧪'),
        loc(
          'الربط البنكي يحتاج إعداد Lean Technologies API Token. سيتم إضافة اتصال تجريبي بمعاملات عرض توضيحية.',
          'Bank linking requires Lean Technologies API Token setup. A demo connection with sample transactions will be created.'
        ),
        [
          { text: loc('إلغاء', 'Cancel'), style: 'cancel' },
          {
            text: loc('تجربة تجريبية', 'Try Demo'),
            onPress: () => createDemoConnection(bank),
          },
        ]
      );
      return;
    }

    // Production flow: Open Lean Connect
    Alert.alert(
      loc('ربط حسابك البنكي', 'Connect Your Bank'),
      loc(
        `سيتم فتح صفحة آمنة لربط حسابك في ${bank.nameAr}. بياناتك محمية بتشفير بنكي.`,
        `A secure page will open to connect your ${bank.name} account. Your data is protected with bank-grade encryption.`
      ),
      [
        { text: loc('إلغاء', 'Cancel'), style: 'cancel' },
        {
          text: loc('متابعة', 'Continue'),
          onPress: () => {
            // In production: LeanConnect.connect({ bankId: bank.id })
            // For now: create demo
            createDemoConnection(bank);
          },
        },
      ]
    );
  };

  const createDemoConnection = async (bank: SupportedBank) => {
    try {
      const walletId = selectedWallet?.id || wallets[0]?.id;
      if (!walletId) {
        Alert.alert(loc('خطأ', 'Error'), loc('أنشئ محفظة أولاً', 'Create a wallet first'));
        return;
      }

      const demoEntityId = `demo_entity_${bank.id}_${Date.now()}`;
      const connection = await registerBankConnection(demoEntityId, bank, walletId);

      // Auto-sync demo transactions
      const result = await performFullSync(connection, transactions);
      setSyncResult(result);
      
      await loadConnections();
      setShowAddModal(false);
      
      if (result.success) {
        refresh(); // Refresh transactions context
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert(
          loc('تم الربط بنجاح! 🎉', 'Connected Successfully! 🎉'),
          loc(
            `تم ربط ${bank.nameAr} وإضافة ${result.newTransactions} معاملة جديدة.`,
            `${bank.name} connected and ${result.newTransactions} new transactions added.`
          )
        );
      }
    } catch (error) {
      console.error('Bank connection error:', error);
      Alert.alert(loc('خطأ', 'Error'), loc('فشل ربط البنك', 'Failed to connect bank'));
    }
  };

  // Sync a specific connection
  const handleSync = async (connection: BankConnection) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSyncing(connection.id);

    try {
      const result = await performFullSync(connection, transactions);
      setSyncResult(result);
      
      if (result.success) {
        refresh();
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        
        if (result.newTransactions > 0) {
          Alert.alert(
            loc('تم المزامنة! ✅', 'Synced! ✅'),
            loc(
              `تم إضافة ${result.newTransactions} معاملة جديدة (تخطي ${result.duplicatesSkipped} مكرر).`,
              `Added ${result.newTransactions} new transactions (skipped ${result.duplicatesSkipped} duplicates).`
            )
          );
        } else {
          Alert.alert(
            loc('محدّث ✅', 'Up to date ✅'),
            loc('لا توجد معاملات جديدة من البنك.', 'No new transactions from the bank.')
          );
        }
      }
    } catch (error) {
      Alert.alert(loc('خطأ في المزامنة', 'Sync Error'));
    } finally {
      setSyncing(null);
    }
  };

  // Disconnect a bank
  const handleDisconnect = (connection: BankConnection) => {
    Alert.alert(
      loc('فصل البنك', 'Disconnect Bank'),
      loc(
        `هل تريد فصل ${connection.bankNameAr}؟ لن يتم حذف المعاملات المستوردة.`,
        `Disconnect ${connection.bankName}? Imported transactions will not be deleted.`
      ),
      [
        { text: loc('إلغاء', 'Cancel'), style: 'cancel' },
        {
          text: loc('فصل', 'Disconnect'),
          style: 'destructive',
          onPress: async () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            await revokeBankConsent(connection.id);
            await removeBankConnection(connection.id);
            await loadConnections();
          },
        },
      ]
    );
  };

  // Time ago formatter
  const timeAgo = (dateStr: string | null): string => {
    if (!dateStr) return loc('لم تتم المزامنة', 'Never synced');
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return loc('الآن', 'Just now');
    if (mins < 60) return loc(`منذ ${mins} دقيقة`, `${mins}m ago`);
    const hours = Math.floor(mins / 60);
    if (hours < 24) return loc(`منذ ${hours} ساعة`, `${hours}h ago`);
    const days = Math.floor(hours / 24);
    return loc(`منذ ${days} يوم`, `${days}d ago`);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>
          {loc('الربط البنكي', 'Bank Connect', 'ബാങ്ക് കണക്ഷൻ')}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 100, paddingHorizontal: 16 }}
      >
        {/* Hero Banner */}
        <LinearGradient
          colors={[colors.primary + '20', colors.primary + '05']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroBanner}
        >
          <View style={styles.heroIconContainer}>
            <Ionicons name="link" size={28} color={colors.primary} />
          </View>
          <Text style={styles.heroTitle}>
            {loc('اربط حسابك البنكي', 'Connect Your Bank Account')}
          </Text>
          <Text style={styles.heroSubtitle}>
            {loc(
              'استورد معاملاتك تلقائياً من البنك. بياناتك آمنة ومشفرة بالكامل.',
              'Import transactions automatically from your bank. Your data is fully encrypted and secure.'
            )}
          </Text>

          <View style={styles.heroFeatures}>
            {[
              { icon: 'shield-checkmark' as const, text: loc('تشفير بنكي', 'Bank-grade encryption') },
              { icon: 'sync' as const, text: loc('مزامنة تلقائية', 'Auto sync') },
              { icon: 'sparkles' as const, text: loc('تصنيف ذكي', 'Smart categorization') },
            ].map((f, i) => (
              <View key={i} style={styles.heroFeatureItem}>
                <Ionicons name={f.icon} size={14} color={colors.primary} />
                <Text style={styles.heroFeatureText}>{f.text}</Text>
              </View>
            ))}
          </View>
        </LinearGradient>

        {/* Connected Banks */}
        {connections.length > 0 && (
          <View style={{ marginTop: 20 }}>
            <Text style={styles.sectionTitle}>
              {loc('البنوك المربوطة', 'Connected Banks')}
            </Text>

            {connections.map((conn) => (
              <View key={conn.id} style={styles.connectionCard}>
                <View style={styles.connectionHeader}>
                  <View style={styles.connectionBankInfo}>
                    <Text style={styles.connectionLogo}>{conn.bankLogo}</Text>
                    <View>
                      <Text style={styles.connectionName}>
                        {isAr ? conn.bankNameAr : conn.bankName}
                      </Text>
                      <Text style={styles.connectionDetails}>
                        {conn.countryFlag} {conn.accountNumber || ''} • {conn.currency}
                      </Text>
                    </View>
                  </View>

                  <View style={[
                    styles.statusBadge,
                    { backgroundColor: conn.status === 'active' ? colors.income + '20' : colors.expense + '20' }
                  ]}>
                    <View style={[
                      styles.statusDot,
                      { backgroundColor: conn.status === 'active' ? colors.income : colors.expense }
                    ]} />
                    <Text style={[
                      styles.statusText,
                      { color: conn.status === 'active' ? colors.income : colors.expense }
                    ]}>
                      {conn.status === 'active' 
                        ? loc('نشط', 'Active') 
                        : loc('منتهي', 'Expired')
                      }
                    </Text>
                  </View>
                </View>

                <View style={styles.connectionMeta}>
                  <Text style={styles.connectionMetaText}>
                    🕐 {timeAgo(conn.lastSyncAt)}
                  </Text>
                </View>

                <View style={styles.connectionActions}>
                  <Pressable
                    onPress={() => handleSync(conn)}
                    disabled={syncing === conn.id}
                    style={({ pressed }) => [
                      styles.syncButton,
                      { opacity: pressed || syncing === conn.id ? 0.6 : 1 }
                    ]}
                  >
                    {syncing === conn.id ? (
                      <ActivityIndicator size="small" color="#FFF" />
                    ) : (
                      <>
                        <Ionicons name="sync" size={16} color="#FFF" />
                        <Text style={styles.syncButtonText}>
                          {loc('مزامنة', 'Sync')}
                        </Text>
                      </>
                    )}
                  </Pressable>

                  <Pressable
                    onPress={() => handleDisconnect(conn)}
                    style={({ pressed }) => [
                      styles.disconnectButton,
                      { opacity: pressed ? 0.6 : 1 }
                    ]}
                  >
                    <Ionicons name="unlink" size={16} color={colors.expense} />
                    <Text style={[styles.disconnectButtonText, { color: colors.expense }]}>
                      {loc('فصل', 'Disconnect')}
                    </Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Add Bank Button */}
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            setShowAddModal(true);
            setSelectedCountry(null);
          }}
          style={({ pressed }) => [
            styles.addBankButton,
            { opacity: pressed ? 0.85 : 1 }
          ]}
        >
          <LinearGradient
            colors={[colors.primary, colors.primaryDark]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.addBankGradient}
          >
            <Ionicons name="add-circle" size={22} color="#FFF" />
            <Text style={styles.addBankText}>
              {loc('ربط بنك جديد', 'Connect New Bank')}
            </Text>
          </LinearGradient>
        </Pressable>

        {/* Supported Countries */}
        <View style={{ marginTop: 24 }}>
          <Text style={styles.sectionTitle}>
            {loc('الدول المدعومة', 'Supported Countries')}
          </Text>
          <View style={styles.countriesGrid}>
            {countries.map((country) => (
              <View key={country.code} style={styles.countryChip}>
                <Text style={{ fontSize: 18 }}>{country.flag}</Text>
                <Text style={styles.countryText}>
                  {isAr ? country.nameAr : country.nameEn}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* Privacy Notice */}
        <View style={styles.privacyCard}>
          <Ionicons name="shield-checkmark" size={20} color={colors.primary} />
          <Text style={styles.privacyText}>
            {loc(
              'بياناتك البنكية مشفرة ولا نخزنها على خوادمنا. يتم المعالجة محلياً على جهازك فقط. يمكنك فصل البنك في أي وقت.',
              'Your banking data is encrypted and never stored on our servers. Processing happens locally on your device. You can disconnect at any time.'
            )}
          </Text>
        </View>
      </ScrollView>

      {/* Add Bank Modal */}
      <Modal
        visible={showAddModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowAddModal(false)}
      >
        <View style={[styles.modalContainer, { paddingTop: Platform.OS === 'ios' ? 20 : 10 }]}>
          {/* Modal Header */}
          <View style={styles.modalHeader}>
            <Pressable onPress={() => {
              if (selectedCountry) {
                setSelectedCountry(null);
              } else {
                setShowAddModal(false);
              }
            }}>
              <Ionicons 
                name={selectedCountry ? "arrow-back" : "close"} 
                size={24} 
                color={colors.text} 
              />
            </Pressable>
            <Text style={styles.modalTitle}>
              {selectedCountry
                ? loc('اختر البنك', 'Select Bank')
                : loc('اختر الدولة', 'Select Country')
              }
            </Text>
            <View style={{ width: 24 }} />
          </View>

          <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}>
            {!selectedCountry ? (
              /* Country Selection */
              <>
                <Text style={styles.modalSubtitle}>
                  {loc('اختر دولة البنك الذي تريد ربطه', 'Choose the country of your bank')}
                </Text>
                {countries.map((country) => {
                  const bankCount = getBanksByCountry(country.code).length;
                  return (
                    <Pressable
                      key={country.code}
                      onPress={() => {
                        Haptics.selectionAsync();
                        setSelectedCountry(country.code);
                      }}
                      style={({ pressed }) => [
                        styles.countryOption,
                        { opacity: pressed ? 0.7 : 1 }
                      ]}
                    >
                      <Text style={{ fontSize: 32 }}>{country.flag}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.countryOptionName}>
                          {isAr ? country.nameAr : country.nameEn}
                        </Text>
                        <Text style={styles.countryOptionBankCount}>
                          {loc(`${bankCount} بنك متاح`, `${bankCount} banks available`)}
                        </Text>
                      </View>
                      <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
                    </Pressable>
                  );
                })}
              </>
            ) : (
              /* Bank Selection */
              <>
                <Text style={styles.modalSubtitle}>
                  {loc('اختر البنك الذي تريد ربطه', 'Choose your bank')}
                </Text>
                {getBanksByCountry(selectedCountry).map((bank) => (
                  <Pressable
                    key={bank.id}
                    onPress={() => handleSelectBank(bank)}
                    style={({ pressed }) => [
                      styles.bankOption,
                      { opacity: pressed ? 0.7 : 1 }
                    ]}
                  >
                    <Text style={{ fontSize: 28 }}>{bank.logo}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.bankOptionName}>
                        {isAr ? bank.nameAr : bank.name}
                      </Text>
                      <Text style={styles.bankOptionCurrency}>
                        {bank.countryFlag} {bank.currency}
                      </Text>
                    </View>
                    {bank.isPopular && (
                      <View style={styles.popularBadge}>
                        <Text style={styles.popularBadgeText}>
                          {loc('شائع', 'Popular')}
                        </Text>
                      </View>
                    )}
                    <Ionicons name="add-circle-outline" size={22} color={colors.primary} />
                  </Pressable>
                ))}
              </>
            )}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────

function getStyles(colors: any, theme: string) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    backBtn: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerTitle: {
      fontFamily: 'Cairo_700Bold',
      fontSize: 18,
      color: colors.text,
    },

    // Hero
    heroBanner: {
      borderRadius: 20,
      padding: 20,
      marginTop: 8,
      borderWidth: 1,
      borderColor: colors.primary + '20',
      alignItems: 'center',
    },
    heroIconContainer: {
      width: 56,
      height: 56,
      borderRadius: 18,
      backgroundColor: colors.primary + '15',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 12,
    },
    heroTitle: {
      fontFamily: 'Cairo_700Bold',
      fontSize: 18,
      color: colors.text,
      textAlign: 'center',
    },
    heroSubtitle: {
      fontFamily: 'Cairo_400Regular',
      fontSize: 13,
      color: colors.textSecondary,
      textAlign: 'center',
      marginTop: 6,
      lineHeight: 20,
    },
    heroFeatures: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 16,
      marginTop: 14,
    },
    heroFeatureItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    heroFeatureText: {
      fontFamily: 'Cairo_600SemiBold',
      fontSize: 11,
      color: colors.textSecondary,
    },

    // Section
    sectionTitle: {
      fontFamily: 'Cairo_700Bold',
      fontSize: 16,
      color: colors.text,
      marginBottom: 12,
    },

    // Connection Card
    connectionCard: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    connectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    connectionBankInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    connectionLogo: {
      fontSize: 28,
    },
    connectionName: {
      fontFamily: 'Cairo_700Bold',
      fontSize: 14,
      color: colors.text,
    },
    connectionDetails: {
      fontFamily: 'Cairo_400Regular',
      fontSize: 11,
      color: colors.textSecondary,
    },
    statusBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 8,
    },
    statusDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
    },
    statusText: {
      fontFamily: 'Cairo_600SemiBold',
      fontSize: 11,
    },
    connectionMeta: {
      marginTop: 10,
      paddingTop: 10,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    connectionMetaText: {
      fontFamily: 'Cairo_400Regular',
      fontSize: 12,
      color: colors.textSecondary,
    },
    connectionActions: {
      flexDirection: 'row',
      gap: 10,
      marginTop: 12,
    },
    syncButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      backgroundColor: colors.primary,
      paddingVertical: 10,
      borderRadius: 12,
    },
    syncButtonText: {
      fontFamily: 'Cairo_700Bold',
      fontSize: 13,
      color: '#FFF',
    },
    disconnectButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      backgroundColor: colors.expense + '12',
      paddingVertical: 10,
      paddingHorizontal: 16,
      borderRadius: 12,
    },
    disconnectButtonText: {
      fontFamily: 'Cairo_600SemiBold',
      fontSize: 13,
    },

    // Add Bank
    addBankButton: {
      marginTop: 20,
      borderRadius: 16,
      overflow: 'hidden',
    },
    addBankGradient: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 14,
      borderRadius: 16,
    },
    addBankText: {
      fontFamily: 'Cairo_700Bold',
      fontSize: 15,
      color: '#FFF',
    },

    // Countries
    countriesGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
    },
    countryChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: colors.surface,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    countryText: {
      fontFamily: 'Cairo_600SemiBold',
      fontSize: 12,
      color: colors.text,
    },

    // Privacy
    privacyCard: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
      backgroundColor: colors.surface,
      borderRadius: 14,
      padding: 14,
      marginTop: 20,
      borderWidth: 1,
      borderColor: colors.primary + '20',
    },
    privacyText: {
      flex: 1,
      fontFamily: 'Cairo_400Regular',
      fontSize: 11,
      color: colors.textSecondary,
      lineHeight: 18,
    },

    // Modal
    modalContainer: {
      flex: 1,
      backgroundColor: colors.background,
    },
    modalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    modalTitle: {
      fontFamily: 'Cairo_700Bold',
      fontSize: 17,
      color: colors.text,
    },
    modalSubtitle: {
      fontFamily: 'Cairo_400Regular',
      fontSize: 13,
      color: colors.textSecondary,
      marginTop: 16,
      marginBottom: 16,
    },

    // Country Option
    countryOption: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      backgroundColor: colors.surface,
      padding: 16,
      borderRadius: 16,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: colors.border,
    },
    countryOptionName: {
      fontFamily: 'Cairo_700Bold',
      fontSize: 15,
      color: colors.text,
    },
    countryOptionBankCount: {
      fontFamily: 'Cairo_400Regular',
      fontSize: 12,
      color: colors.textSecondary,
    },

    // Bank Option
    bankOption: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: colors.surface,
      padding: 14,
      borderRadius: 16,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: colors.border,
    },
    bankOptionName: {
      fontFamily: 'Cairo_700Bold',
      fontSize: 14,
      color: colors.text,
    },
    bankOptionCurrency: {
      fontFamily: 'Cairo_400Regular',
      fontSize: 11,
      color: colors.textSecondary,
    },
    popularBadge: {
      backgroundColor: '#F59E0B20',
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 6,
    },
    popularBadgeText: {
      fontFamily: 'Cairo_600SemiBold',
      fontSize: 10,
      color: '#F59E0B',
    },
  });
}
