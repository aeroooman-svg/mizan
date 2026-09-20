import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Modal,
  Pressable,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import {
  SupportedBank,
  BankAccount,
  BankConnection,
  SyncResult,
  fetchBankAccounts,
  registerBankConnection,
  performFullSync,
  createWalletForBank,
} from '@/lib/openBankingService';
import { formatCurrency } from '@/lib/categories';

interface BankAuthModalProps {
  visible: boolean;
  bank: SupportedBank | null;
  onClose: () => void;
  onComplete: (connection: BankConnection, result: SyncResult) => void;
  wallets: any[];
  transactions: any[];
  language: string;
  colors: any;
  theme: string;
}

type AuthStep = 'credentials' | 'otp' | 'accounts' | 'authorizing' | 'success';

export default function BankAuthModal({
  visible,
  bank,
  onClose,
  onComplete,
  wallets,
  transactions,
  language,
  colors,
  theme,
}: BankAuthModalProps) {
  const isAr = language === 'ar';
  const loc = (ar: string, en: string, ml?: string) => {
    if (language === 'ml' || language === 'hi') return ml || en;
    if (language === 'ar') return ar;
    return en;
  };

  const [step, setStep] = useState<AuthStep>('credentials');
  const [civilId, setCivilId] = useState('');
  const [phone, setPhone] = useState('9***4821');
  const [otpCode, setOtpCode] = useState('');
  const [smsBanner, setSmsBanner] = useState<string | null>(null);
  const [timer, setTimer] = useState(60);
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [walletOption, setWalletOption] = useState<'new' | 'existing'>('new');
  const [selectedExistingWalletId, setSelectedExistingWalletId] = useState(wallets[0]?.id || '');
  const [syncStatusText, setSyncStatusText] = useState('');
  const [syncProgress, setSyncProgress] = useState(0);

  // Initialize data when bank changes
  useEffect(() => {
    if (visible && bank) {
      setStep('credentials');
      setOtpCode('');
      setSmsBanner(null);
      setTimer(60);
      setWalletOption('new');
      setSyncProgress(0);

      // Prefill realistic Civil ID / ID based on country
      if (bank.country === 'KW') {
        setCivilId('294011200452');
      } else if (bank.country === 'SA') {
        setCivilId('1089201942');
      } else if (bank.country === 'AE') {
        setCivilId('784-1994-1234567-1');
      } else if (bank.country === 'EG') {
        setCivilId('29408151201945');
      } else {
        setCivilId('940214829');
      }

      // Fetch accounts for this bank
      fetchBankAccounts('demo_entity', bank).then(accs => {
        setAccounts(accs);
        if (accs.length > 0) {
          setSelectedAccountId(accs[0].accountId);
        }
      });
    }
  }, [visible, bank]);

  // Timer countdown for OTP
  useEffect(() => {
    let interval: any;
    if (step === 'otp' && timer > 0) {
      interval = setInterval(() => setTimer(prev => prev - 1), 1000);
    }
    return () => clearInterval(interval);
  }, [step, timer]);

  if (!bank) return null;

  // Handle step 1 submission
  const handleProceedToOtp = () => {
    if (!civilId.trim()) {
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setStep('otp');
    setTimer(60);
    // Simulate SMS notification arriving
    setTimeout(() => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSmsBanner(
        loc(
          `💬 ${bank.nameAr}: رمز التحقق لربط ميزان هو: 4920 (صالح لـ 5 دقائق)`,
          `💬 ${bank.name}: Your Mizan verification OTP is: 4920 (Valid for 5 mins)`
        )
      );
    }, 800);
  };

  // Handle OTP verification
  const handleVerifyOtp = () => {
    if (otpCode !== '4920' && otpCode.length < 4) {
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setStep('accounts');
  };

  // Handle Final Authorization and wallet/transactions injection
  const handleFinalAuthorization = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setStep('authorizing');

    setSyncStatusText(loc('المصادقة وتفويض الاتصال بالبنك...', 'Authorizing bank connection...'));
    setSyncProgress(30);

    setTimeout(async () => {
      try {
        setSyncStatusText(loc('إنشاء المحفظة وتشفير الصلاحيات...', 'Configuring wallet & credentials...'));
        setSyncProgress(65);

        // Determine which wallet to use
        let targetWalletId = selectedExistingWalletId;
        const selectedAcc = accounts.find(a => a.accountId === selectedAccountId) || accounts[0];
        const initialBal = selectedAcc?.balance || 0;

        if (walletOption === 'new') {
          // Create new wallet dedicated to this bank
          const newW = await createWalletForBank(bank, initialBal);
          targetWalletId = newW.id;
        }

        // Register bank connection
        const entityId = `lean_auth_${bank.id}_${Date.now()}`;
        const connection = await registerBankConnection(entityId, bank, targetWalletId);
        connection.accountNumber = selectedAcc?.number || '****4921';
        connection.accountType = selectedAcc?.type || 'current';

        setSyncStatusText(loc('جلب وتصنيف المعاملات بالذكاء الاصطناعي...', 'Importing & auto-categorizing transactions...'));
        setSyncProgress(90);

        // Perform full transaction sync
        const syncRes = await performFullSync(connection, transactions);

        setTimeout(() => {
          setSyncProgress(100);
          setStep('success');
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          onComplete(connection, syncRes);
        }, 800);
      } catch (err) {
        console.error('Error completing bank auth:', err);
        onClose();
      }
    }, 1000);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.modalCard, { backgroundColor: colors.surface }]}>
          {/* Simulated SMS Banner Notification */}
          {smsBanner && step === 'otp' && (
            <Pressable
              onPress={() => {
                setOtpCode('4920');
                Haptics.selectionAsync();
              }}
              style={styles.smsToast}
            >
              <View style={styles.smsToastInner}>
                <Ionicons name="chatbubble-ellipses" size={18} color="#3B82F6" />
                <Text style={styles.smsToastText}>{smsBanner}</Text>
              </View>
              <Text style={styles.smsToastAction}>
                {loc('اضغط لتعبئة الرمز تلقائياً ⚡', 'Tap to autofill ⚡')}
              </Text>
            </Pressable>
          )}

          {/* Modal Header */}
          <View style={styles.modalHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={[styles.bankLogoCircle, { backgroundColor: colors.surfaceAlt }]}>
                <Text style={{ fontSize: 26 }}>{bank.logo}</Text>
              </View>
              <View>
                <Text style={[styles.bankModalTitle, { color: colors.text }]}>
                  {isAr ? bank.nameAr : bank.name}
                </Text>
                <View style={styles.countryPill}>
                  <Text style={{ fontSize: 13 }}>{bank.countryFlag}</Text>
                  <Text style={styles.countryPillText}>
                    {bank.currency} • {loc('مصرفية مفتوحة رسمية', 'Official Open Banking')}
                  </Text>
                </View>
              </View>
            </View>
            <Pressable onPress={onClose} style={styles.closeBtn} hitSlop={10}>
              <Ionicons name="close" size={22} color={colors.textSecondary} />
            </Pressable>
          </View>

          {/* Regulatory Security Shield Badge */}
          <View style={styles.securityBadge}>
            <Ionicons name="shield-checkmark" size={16} color="#10B981" />
            <Text style={styles.securityBadgeText}>
              {bank.country === 'KW'
                ? loc('معتمد ومتوافق مع معايير بنك الكويت المركزي', 'Central Bank of Kuwait Open Banking Standard')
                : bank.country === 'SA'
                ? loc('معتمد ومتوافق مع معايير البنك المركزي السعودي (ساما)', 'Saudi Central Bank (SAMA) Standard')
                : loc('بوابة اتصال بنكي مشفرة وآمنة 256-bit', '256-bit SSL Bank Grade Secure Gateway')}
            </Text>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.bodyScroll}>
            {/* STEP 1: Credentials / Identity */}
            {step === 'credentials' && (
              <View style={styles.stepContainer}>
                <Text style={[styles.stepHeading, { color: colors.text }]}>
                  {loc('المصادقة البنكية وتفويض القراءة', 'Bank Authentication & Consent')}
                </Text>
                <Text style={[styles.stepSubheading, { color: colors.textSecondary }]}>
                  {loc(
                    'يرجى إدخال بيانات الهوية المعتمدة لدى البنك لإرسال رمز التحقق الأمني:',
                    'Please enter your registered ID to request secure SMS verification:'
                  )}
                </Text>

                <View style={styles.formGroup}>
                  <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
                    {bank.country === 'KW'
                      ? loc('رقم البطاقة المدنية (Civil ID)', 'Civil ID Number')
                      : loc('رقم الهوية الوطنية / الإقامة', 'National ID / Residency')}
                  </Text>
                  <View style={[styles.inputWrapper, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
                    <Ionicons name="id-card-outline" size={18} color={colors.primary} />
                    <TextInput
                      style={[styles.textInput, { color: colors.text }]}
                      value={civilId}
                      onChangeText={setCivilId}
                      keyboardType="number-pad"
                      placeholder="e.g. 294011200452"
                      placeholderTextColor={colors.textTertiary}
                    />
                  </View>
                </View>

                <View style={styles.formGroup}>
                  <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
                    {loc('رقم الهاتف المسجل لدى البنك', 'Registered Mobile Number')}
                  </Text>
                  <View style={[styles.inputWrapper, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
                    <Ionicons name="phone-portrait-outline" size={18} color={colors.primary} />
                    <TextInput
                      style={[styles.textInput, { color: colors.text }]}
                      value={phone}
                      onChangeText={setPhone}
                      keyboardType="phone-pad"
                      placeholder="****4821"
                      placeholderTextColor={colors.textTertiary}
                    />
                  </View>
                </View>

                <View style={[styles.infoBox, { backgroundColor: colors.primary + '10', borderColor: colors.primary + '30' }]}>
                  <Ionicons name="information-circle-outline" size={20} color={colors.primary} />
                  <Text style={[styles.infoBoxText, { color: colors.primary }]}>
                    {loc(
                      'صلاحيات القراءة فقط: تطبيق ميزان يحصل فقط على رصيد الحساب والمعاملات لعرضها ومزامنتها. لا يمكن لأي طرف سحب أو تحويل أموال.',
                      'Read-only access: Mizan only syncs balances and transactions. No fund transfers or withdrawals can be performed.'
                    )}
                  </Text>
                </View>

                <Pressable
                  onPress={handleProceedToOtp}
                  style={[styles.primaryBtn, { backgroundColor: colors.primary }]}
                >
                  <Ionicons name="paper-plane-outline" size={18} color="#FFF" />
                  <Text style={styles.primaryBtnText}>
                    {loc('متابعة وإرسال رمز التحقق SMS', 'Continue & Request SMS OTP')}
                  </Text>
                </Pressable>
              </View>
            )}

            {/* STEP 2: OTP Verification */}
            {step === 'otp' && (
              <View style={styles.stepContainer}>
                <Text style={[styles.stepHeading, { color: colors.text }]}>
                  {loc('رمز التحقق الأمني (OTP)', 'Security OTP Verification')}
                </Text>
                <Text style={[styles.stepSubheading, { color: colors.textSecondary }]}>
                  {loc(
                    `تم إرسال رمز أمان لمرة واحدة إلى هاتفك المسجل لدى ${bank.nameAr} (${phone})`,
                    `A one-time security code was sent to your registered phone (${phone})`
                  )}
                </Text>

                <View style={styles.otpInputContainer}>
                  <TextInput
                    style={[styles.otpInput, { backgroundColor: colors.surfaceAlt, borderColor: colors.primary, color: colors.text }]}
                    value={otpCode}
                    onChangeText={setOtpCode}
                    keyboardType="number-pad"
                    maxLength={4}
                    placeholder="• • • •"
                    placeholderTextColor={colors.textTertiary}
                    textAlign="center"
                    autoFocus
                  />
                </View>

                <Pressable
                  onPress={() => {
                    setOtpCode('4920');
                    Haptics.selectionAsync();
                  }}
                  style={styles.autofillBtn}
                >
                  <Ionicons name="flash-outline" size={16} color={colors.primary} />
                  <Text style={[styles.autofillBtnText, { color: colors.primary }]}>
                    {loc('تعبئة الرمز التجريبي تلقائياً (4920)', 'Autofill OTP (4920)')}
                  </Text>
                </Pressable>

                <Text style={[styles.timerText, { color: colors.textTertiary }]}>
                  {timer > 0
                    ? loc(`إعادة إرسال الرمز خلال (${timer} ثانية)`, `Resend code in (${timer}s)`)
                    : loc('يمكنك طلب الرمز مرة أخرى الآن', 'You can request code again')}
                </Text>

                <Pressable
                  onPress={handleVerifyOtp}
                  style={[styles.primaryBtn, { backgroundColor: colors.primary, opacity: otpCode.length >= 4 ? 1 : 0.6 }]}
                  disabled={otpCode.length < 4}
                >
                  <Ionicons name="checkmark-done" size={18} color="#FFF" />
                  <Text style={styles.primaryBtnText}>
                    {loc('تأكيد الرمز والتفويض', 'Confirm & Authorize')}
                  </Text>
                </Pressable>
              </View>
            )}

            {/* STEP 3: Account & Wallet Selection */}
            {step === 'accounts' && (
              <View style={styles.stepContainer}>
                <Text style={[styles.stepHeading, { color: colors.text }]}>
                  {loc('اختيار الحساب والمحفظة المرتبطة', 'Select Account & Target Wallet')}
                </Text>
                <Text style={[styles.stepSubheading, { color: colors.textSecondary }]}>
                  {loc('تمت المصادقة بنجاح! اختر الحساب المطلوب مزامنته مع مِيزان:', 'Authenticated! Select the account to link with Mizan:')}
                </Text>

                {/* Available Accounts List */}
                <View style={{ gap: 10, marginVertical: 8 }}>
                  {accounts.map(acc => {
                    const isSelected = selectedAccountId === acc.accountId;
                    return (
                      <Pressable
                        key={acc.accountId}
                        onPress={() => {
                          setSelectedAccountId(acc.accountId);
                          Haptics.selectionAsync();
                        }}
                        style={[
                          styles.accountCard,
                          { backgroundColor: colors.surfaceAlt, borderColor: isSelected ? colors.primary : colors.border },
                          isSelected && { borderWidth: 2 },
                        ]}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                          <Ionicons
                            name={acc.type === 'savings' ? 'cash-outline' : 'card-outline'}
                            size={22}
                            color={isSelected ? colors.primary : colors.textSecondary}
                          />
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.accName, { color: colors.text }]}>{acc.name}</Text>
                            <Text style={[styles.accNumber, { color: colors.textTertiary }]}>{acc.number}</Text>
                          </View>
                          <View style={{ alignItems: 'flex-end' }}>
                            <Text style={[styles.accBalance, { color: colors.primary }]}>
                              {formatCurrency(acc.balance, language as any, bank.currency)}
                            </Text>
                            <Text style={[styles.accCurrency, { color: colors.textSecondary }]}>
                              {bank.currency}
                            </Text>
                          </View>
                        </View>
                      </Pressable>
                    );
                  })}
                </View>

                {/* Wallet Linking Destination */}
                <Text style={[styles.sectionSubtitle, { color: colors.text, marginTop: 12 }]}>
                  {loc('أين تريد إضافة هذا الحساب في ميزان؟', 'Where to link in Mizan?')}
                </Text>

                <Pressable
                  onPress={() => {
                    setWalletOption('new');
                    Haptics.selectionAsync();
                  }}
                  style={[
                    styles.walletOptionCard,
                    { backgroundColor: colors.surfaceAlt, borderColor: walletOption === 'new' ? colors.primary : colors.border },
                    walletOption === 'new' && { borderWidth: 2 },
                  ]}
                >
                  <Ionicons
                    name={walletOption === 'new' ? 'radio-button-on' : 'radio-button-off'}
                    size={20}
                    color={walletOption === 'new' ? colors.primary : colors.textSecondary}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.walletOptionTitle, { color: colors.text }]}>
                      ⭐ {loc(`إنشاء محفظة جديدة باسم "${bank.nameAr}"`, `Create new wallet for "${bank.name}"`)}
                    </Text>
                    <Text style={[styles.walletOptionDesc, { color: colors.textSecondary }]}>
                      {loc(
                        `تنشئ محفظة مستقلة بعملة ${bank.currency} ويتم ضبط رصيدها واستيراد المعاملات إليها تلقائياً.`,
                        `Creates a dedicated ${bank.currency} wallet synced automatically with bank transactions.`
                      )}
                    </Text>
                  </View>
                </Pressable>

                {wallets.length > 0 && (
                  <Pressable
                    onPress={() => {
                      setWalletOption('existing');
                      Haptics.selectionAsync();
                    }}
                    style={[
                      styles.walletOptionCard,
                      { backgroundColor: colors.surfaceAlt, borderColor: walletOption === 'existing' ? colors.primary : colors.border },
                      walletOption === 'existing' && { borderWidth: 2 },
                    ]}
                  >
                    <Ionicons
                      name={walletOption === 'existing' ? 'radio-button-on' : 'radio-button-off'}
                      size={20}
                      color={walletOption === 'existing' ? colors.primary : colors.textSecondary}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.walletOptionTitle, { color: colors.text }]}>
                        {loc('ربط بمحفظة موجودة حالياً', 'Link to an existing wallet')}
                      </Text>
                      {walletOption === 'existing' && (
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
                          <View style={{ flexDirection: 'row', gap: 6 }}>
                            {wallets.map((w: any) => (
                              <Pressable
                                key={w.id}
                                onPress={() => setSelectedExistingWalletId(w.id)}
                                style={[
                                  styles.miniWalletChip,
                                  {
                                    backgroundColor: selectedExistingWalletId === w.id ? colors.primary : colors.surface,
                                    borderColor: colors.border,
                                  },
                                ]}
                              >
                                <Text
                                  style={{
                                    fontFamily: 'Cairo_600SemiBold',
                                    fontSize: 11,
                                    color: selectedExistingWalletId === w.id ? '#FFF' : colors.text,
                                  }}
                                >
                                  {w.name} ({w.currency})
                                </Text>
                              </Pressable>
                            ))}
                          </View>
                        </ScrollView>
                      )}
                    </View>
                  </Pressable>
                )}

                <Pressable
                  onPress={handleFinalAuthorization}
                  style={[styles.primaryBtn, { backgroundColor: colors.primary, marginTop: 14 }]}
                >
                  <Ionicons name="cloud-download-outline" size={18} color="#FFF" />
                  <Text style={styles.primaryBtnText}>
                    {loc('تأكيد الربط واستيراد المعاملات الحية', 'Authorize & Import Live Transactions')}
                  </Text>
                </Pressable>
              </View>
            )}

            {/* STEP 4: Authorizing Progress */}
            {step === 'authorizing' && (
              <View style={[styles.stepContainer, { alignItems: 'center', paddingVertical: 24 }]}>
                <ActivityIndicator size="large" color={colors.primary} style={{ marginBottom: 16 }} />
                <Text style={[styles.stepHeading, { color: colors.text, textAlign: 'center' }]}>
                  {loc('جاري ربط حسابك البنكي...', 'Connecting your bank account...')}
                </Text>
                <Text style={[styles.stepSubheading, { color: colors.textSecondary, textAlign: 'center' }]}>
                  {syncStatusText}
                </Text>

                {/* Progress bar */}
                <View style={[styles.progressBarTrack, { backgroundColor: colors.surfaceAlt }]}>
                  <View style={[styles.progressBarFill, { backgroundColor: colors.primary, width: `${syncProgress}%` }]} />
                </View>
              </View>
            )}

            {/* STEP 5: Success Celebration */}
            {step === 'success' && (
              <View style={[styles.stepContainer, { alignItems: 'center', paddingVertical: 16 }]}>
                <View style={styles.successIconCircle}>
                  <Ionicons name="checkmark-circle" size={54} color="#10B981" />
                </View>
                <Text style={[styles.stepHeading, { color: colors.text, textAlign: 'center', marginTop: 10 }]}>
                  {loc('تم ربط الحساب البنكي بنجاح! 🎉', 'Bank Connected Successfully! 🎉')}
                </Text>
                <Text style={[styles.stepSubheading, { color: colors.textSecondary, textAlign: 'center', lineHeight: 22 }]}>
                  {loc(
                    `تم تفعيل المزامنة المباشرة مع ${bank.nameAr} واستيراد العمليات وتحديث الرصيد في مِيزان بنجاح.`,
                    `Direct sync with ${bank.name} is active. Balances and transactions are now live in Mizan.`
                  )}
                </Text>

                <Pressable
                  onPress={onClose}
                  style={[styles.primaryBtn, { backgroundColor: colors.primary, width: '100%', marginTop: 16 }]}
                >
                  <Text style={styles.primaryBtnText}>{loc('تم — عرض الحساب', 'Done — View Account')}</Text>
                </Pressable>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 16,
    paddingHorizontal: 20,
    paddingBottom: 32,
    maxHeight: '90%',
  },
  smsToast: {
    backgroundColor: '#1E293B',
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#38BDF8',
    elevation: 8,
  },
  smsToastInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  smsToastText: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 12,
    color: '#F8FAFC',
    flex: 1,
  },
  smsToastAction: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 11,
    color: '#38BDF8',
    marginTop: 4,
    textAlign: 'left',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  bankLogoCircle: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bankModalTitle: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 16,
  },
  countryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 2,
  },
  countryPillText: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 11,
    color: '#10B981',
  },
  closeBtn: {
    padding: 6,
  },
  securityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#10B98115',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 10,
    marginBottom: 14,
  },
  securityBadgeText: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 11,
    color: '#10B981',
    flex: 1,
  },
  bodyScroll: {
    paddingBottom: 10,
  },
  stepContainer: {
    gap: 12,
  },
  stepHeading: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 16,
  },
  stepSubheading: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 12,
    lineHeight: 18,
  },
  formGroup: {
    gap: 4,
  },
  inputLabel: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 12,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    height: 46,
    gap: 10,
  },
  textInput: {
    flex: 1,
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 14,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  infoBoxText: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 11,
    flex: 1,
    lineHeight: 16,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    borderRadius: 14,
    gap: 8,
    marginTop: 6,
  },
  primaryBtnText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 14,
    color: '#FFFFFF',
  },
  otpInputContainer: {
    marginVertical: 10,
    alignItems: 'center',
  },
  otpInput: {
    width: 200,
    height: 56,
    borderRadius: 14,
    borderWidth: 2,
    fontSize: 28,
    fontFamily: 'Cairo_700Bold',
    letterSpacing: 10,
  },
  autofillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 6,
  },
  autofillBtnText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 12,
  },
  timerText: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 11,
    textAlign: 'center',
    marginTop: 4,
  },
  accountCard: {
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
  },
  accName: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 13,
  },
  accNumber: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 11,
  },
  accBalance: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 14,
  },
  accCurrency: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 10,
  },
  sectionSubtitle: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 13,
  },
  walletOptionCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  walletOptionTitle: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 12,
  },
  walletOptionDesc: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 10,
    lineHeight: 14,
    marginTop: 2,
  },
  miniWalletChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  progressBarTrack: {
    width: '100%',
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    marginTop: 16,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  successIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#10B98115',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
