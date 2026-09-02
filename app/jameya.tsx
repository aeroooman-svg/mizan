import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/lib/ThemeContext';
import { useLanguage } from '@/lib/LanguageContext';
import { useTransactions } from '@/lib/TransactionContext';
import { formatCurrency } from '@/lib/categories';
import {
  Jameya,
  getJameyas,
  saveJameya,
  deleteJameya,
  payJameyaMonth,
  receiveJameyaPayout,
} from '@/lib/jameyaStorage';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function JameyaScreen() {
  const { colors, theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { language } = useLanguage();
  const isAr = language === 'ar';
  const { selectedWallet, wallets, addTransaction, currencySymbol } = useTransactions();

  // Data
  const [jameyas, setJameyas] = useState<Jameya[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [modalVisible, setModalVisible] = useState(false);
  const [editingJameya, setEditingJameya] = useState<Jameya | null>(null);
  const [payingJameyaItem, setPayingJameyaItem] = useState<Jameya | null>(null);
  const [payoutTarget, setPayoutTarget] = useState<{ item: Jameya; month?: number } | null>(null);
  const [deductCurrentInstallment, setDeductCurrentInstallment] = useState(false);
  const [deletingJameyaItem, setDeletingJameyaItem] = useState<Jameya | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Form fields
  const [jameyaName, setJameyaName] = useState('');
  const [singleShareAmount, setSingleShareAmount] = useState('');
  const [sharesCount, setSharesCount] = useState('1');
  const [totalMonths, setTotalMonths] = useState('10');
  const [startMonth, setStartMonth] = useState(new Date().toISOString().substring(0, 7));
  const [walletId, setWalletId] = useState(selectedWallet?.id || wallets[0]?.id || '');
  const [payoutMonthsInputs, setPayoutMonthsInputs] = useState<string[]>(['1']);

  // Load data
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getJameyas();
      setJameyas(data);
    } catch (e) {
      console.error('Error loading Jameyas in dedicated screen:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  useEffect(() => {
    if (selectedWallet && !walletId) {
      setWalletId(selectedWallet.id);
    }
  }, [selectedWallet]);

  // Adjust payout months inputs when shares count changes
  useEffect(() => {
    const count = Math.max(1, Math.floor(parseFloat(sharesCount) || 1));
    setPayoutMonthsInputs(prev => {
      const next = [...prev];
      while (next.length < count) {
        next.push((next.length + 1).toString());
      }
      return next.slice(0, count);
    });
  }, [sharesCount]);

  // Filter for active wallet or show all
  const filteredJameyas = useMemo(() => {
    if (!selectedWallet) return jameyas;
    return jameyas.filter(j => j.walletId === selectedWallet.id);
  }, [jameyas, selectedWallet]);

interface JameyaMetrics {
  totalPaidSavings: number;
  totalRemainingToPay: number;
  totalExpectedPayout: number;
  activeCount: number;
  completedCount: number;
  upcomingPayoutNotice: { name: string; amount: number; month: number } | null;
}

  // Executive summary metrics
  const metrics = useMemo<JameyaMetrics>(() => {
    let totalPaidSavings = 0;
    let totalRemainingToPay = 0;
    let totalExpectedPayout = 0;
    let upcomingPayoutNotice: { name: string; amount: number; month: number } | null = null;

    filteredJameyas.forEach(j => {
      const paid = Math.min(j.paidMonthsCount || 0, j.totalMonths);
      const remaining = Math.max(0, j.totalMonths - paid);
      const monthly = j.monthlyAmount || 0;
      const shares = j.sharesCount || 1;
      const singleShare = j.singleShareAmount || (monthly / shares);
      const potPerShare = singleShare * j.totalMonths;

      totalPaidSavings += paid * monthly;
      totalRemainingToPay += remaining * monthly;

      // Payout tracking
      const payoutMonths = j.payoutMonths || [j.payoutMonth || 1];
      const received = j.receivedPayoutMonths || [];
      const pendingMonths = payoutMonths.filter(m => !received.includes(m));

      if (pendingMonths.length > 0) {
        totalExpectedPayout += pendingMonths.length * potPerShare;
        if (!upcomingPayoutNotice) {
          upcomingPayoutNotice = {
            name: j.name,
            amount: potPerShare,
            month: pendingMonths[0],
          };
        }
      }
    });

    return {
      totalPaidSavings,
      totalRemainingToPay,
      totalExpectedPayout,
      activeCount: filteredJameyas.filter(j => j.paidMonthsCount < j.totalMonths).length,
      completedCount: filteredJameyas.filter(j => j.paidMonthsCount >= j.totalMonths).length,
      upcomingPayoutNotice,
    };
  }, [filteredJameyas]);

  // Open Create / Edit Modal
  const handleOpenModal = (item?: Jameya) => {
    setFormError(null);
    if (item) {
      setEditingJameya(item);
      setJameyaName(item.name);
      setSharesCount(String(item.sharesCount || 1));
      setSingleShareAmount(String(item.singleShareAmount || (item.monthlyAmount / (item.sharesCount || 1))));
      setTotalMonths(String(item.totalMonths));
      setStartMonth(item.startMonth);
      setWalletId(item.walletId);
      const months = item.payoutMonths && item.payoutMonths.length > 0
        ? item.payoutMonths.map(String)
        : [String(item.payoutMonth || 1)];
      setPayoutMonthsInputs(months);
    } else {
      setEditingJameya(null);
      setJameyaName('');
      setSharesCount('1');
      setSingleShareAmount('');
      setTotalMonths('10');
      setStartMonth(new Date().toISOString().substring(0, 7));
      setWalletId(selectedWallet?.id || wallets[0]?.id || '');
      setPayoutMonthsInputs(['1']);
    }
    setModalVisible(true);
  };

  // Submit Jameya Form
  const handleSaveJameya = async () => {
    const single = parseFloat(singleShareAmount);
    const shares = parseFloat(sharesCount);
    const months = parseInt(totalMonths, 10);

    if (!jameyaName.trim()) {
      setFormError(isAr ? 'يرجى إدخال اسم الجمعية' : 'Please enter circle name');
      return;
    }
    if (isNaN(single) || single <= 0) {
      setFormError(isAr ? 'يرجى إدخال قيمة السهم بشكل صحيح' : 'Please enter a valid share amount');
      return;
    }
    if (isNaN(shares) || shares <= 0) {
      setFormError(isAr ? 'يرجى إدخال عدد الأسهم' : 'Please enter valid shares count');
      return;
    }
    if (isNaN(months) || months <= 1) {
      setFormError(isAr ? 'مدة الجمعية يجب أن تكون شهرين على الأقل' : 'Circle duration must be at least 2 months');
      return;
    }

    const parsedPayoutMonths = payoutMonthsInputs.map(m => parseInt(m, 10)).filter(m => !isNaN(m) && m >= 1 && m <= months);
    if (parsedPayoutMonths.length === 0) {
      setFormError(isAr ? 'يرجى تحديد شهر القبض ضمن مدة الجمعية' : 'Please select valid payout month within circle duration');
      return;
    }

    try {
      setIsSubmitting(true);
      await saveJameya({
        id: editingJameya?.id,
        name: jameyaName.trim(),
        singleShareAmount: single,
        sharesCount: shares,
        monthlyAmount: single * shares,
        totalMonths: months,
        payoutMonth: parsedPayoutMonths[0],
        payoutMonths: parsedPayoutMonths,
        receivedPayoutMonths: editingJameya?.receivedPayoutMonths || [],
        startMonth: startMonth || new Date().toISOString().substring(0, 7),
        paidMonthsCount: editingJameya ? editingJameya.paidMonthsCount : 0,
        isPayoutReceived: editingJameya ? editingJameya.isPayoutReceived : false,
        walletId: walletId || wallets[0]?.id || '',
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setModalVisible(false);
      await loadData();
    } catch (e) {
      Alert.alert(isAr ? 'خطأ' : 'Error', isAr ? 'فشل حفظ الجمعية' : 'Failed to save circle');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Pay Month confirmation
  const handleConfirmPayMonth = async () => {
    if (!payingJameyaItem) return;
    try {
      setIsSubmitting(true);
      const res = await payJameyaMonth(payingJameyaItem.id, addTransaction);
      if (res.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        setPayingJameyaItem(null);
        await loadData();
      } else {
        Alert.alert(isAr ? 'تنبيه' : 'Notice', isAr ? 'تم سداد جميع أشهر هذه الجمعية بالفعل' : 'All months are already paid');
      }
    } catch (e) {
      Alert.alert(isAr ? 'خطأ' : 'Error', isAr ? 'فشل تسجيل الدفع' : 'Payment failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Receive Payout confirmation
  const handleConfirmReceivePayout = async () => {
    if (!payoutTarget) return;
    try {
      setIsSubmitting(true);
      const success = await receiveJameyaPayout(
        payoutTarget.item.id,
        addTransaction,
        payoutTarget.month,
        deductCurrentInstallment
      );
      if (success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        setPayoutTarget(null);
        await loadData();
      } else {
        Alert.alert(isAr ? 'تنبيه' : 'Notice', isAr ? 'تم استلام هذا المبلغ بالفعل سابقاً' : 'Payout was already received');
      }
    } catch (e) {
      Alert.alert(isAr ? 'خطأ' : 'Error', isAr ? 'فشل تسجيل القبض' : 'Payout registration failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete Jameya
  const handleConfirmDelete = async () => {
    if (!deletingJameyaItem) return;
    try {
      setIsSubmitting(true);
      await deleteJameya(deletingJameyaItem.id);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setDeletingJameyaItem(null);
      await loadData();
    } catch (e) {
      Alert.alert(isAr ? 'خطأ' : 'Error', isAr ? 'فشل حذف الجمعية' : 'Delete failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Top Header */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) + 8 }]}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          style={[styles.headerBackBtn, { backgroundColor: colors.surfaceAlt }]}
        >
          <Ionicons name={isAr ? 'arrow-forward' : 'arrow-back'} size={20} color={colors.text} />
        </Pressable>

        <View style={styles.headerTitleContainer}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            {isAr ? 'الجمعيات الشهرية' : 'Money Circles (ROSCA)'}
          </Text>
          <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
            {isAr ? 'ادخار تعاوني منظم بدون فوائد' : 'Collaborative zero-interest savings'}
          </Text>
        </View>

        <Pressable
          onPress={() => handleOpenModal()}
          hitSlop={12}
          style={[styles.headerAddBtn, { backgroundColor: '#10B981' }]}
        >
          <Ionicons name="add" size={22} color="#FFF" />
        </Pressable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: Math.max(insets.bottom, 20) + 90 }]}
      >
        {/* Executive Summary Hero Banner */}
        <LinearGradient
          colors={theme === 'dark' ? ['#064E3B', '#042F2E', '#0B132B'] : ['#ECFDF5', '#D1FAE5', '#E0F2FE']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroBanner}
        >
          <View style={styles.heroTopRow}>
            <View>
              <Text style={[styles.heroSubtitle, { color: theme === 'dark' ? '#A7F3D0' : '#047857' }]}>
                {isAr ? 'إجمالي المدخر في الجمعيات' : 'Total Saved in Circles'}
              </Text>
              <Text style={[styles.heroMainAmount, { color: theme === 'dark' ? '#FFF' : '#065F46' }]}>
                {formatCurrency(metrics.totalPaidSavings)} <Text style={{ fontSize: 16 }}>{currencySymbol}</Text>
              </Text>
            </View>
            <View style={styles.heroIconBadge}>
              <MaterialCommunityIcons name="handshake" size={28} color="#10B981" />
            </View>
          </View>

          {/* Sub Metrics Grid */}
          <View style={styles.heroSubGrid}>
            <View style={[styles.heroSubCard, { backgroundColor: theme === 'dark' ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.7)' }]}>
              <Text style={styles.heroSubLabel}>{isAr ? 'المتبقي للدفع' : 'Remaining'}</Text>
              <Text style={[styles.heroSubVal, { color: '#EF4444' }]}>
                {formatCurrency(metrics.totalRemainingToPay)} {currencySymbol}
              </Text>
            </View>

            <View style={[styles.heroSubCard, { backgroundColor: theme === 'dark' ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.7)' }]}>
              <Text style={styles.heroSubLabel}>{isAr ? 'في انتظار القبض' : 'Expected Payout'}</Text>
              <Text style={[styles.heroSubVal, { color: '#F59E0B' }]}>
                {formatCurrency(metrics.totalExpectedPayout)} {currencySymbol}
              </Text>
            </View>

            <View style={[styles.heroSubCard, { backgroundColor: theme === 'dark' ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.7)' }]}>
              <Text style={styles.heroSubLabel}>{isAr ? 'جمعيات نشطة' : 'Active Circles'}</Text>
              <Text style={[styles.heroSubVal, { color: '#10B981' }]}>
                {metrics.activeCount}
              </Text>
            </View>
          </View>

          {/* Upcoming Payout Notice Tag */}
          {metrics.upcomingPayoutNotice && (
            <View style={styles.heroNoticeTag}>
              <Ionicons name="sparkles" size={15} color="#F59E0B" />
              <Text style={styles.heroNoticeText}>
                {isAr
                  ? `دور قبض قادم: شهر ${metrics.upcomingPayoutNotice.month} لـ "${metrics.upcomingPayoutNotice.name}" بمبلغ ${formatCurrency(metrics.upcomingPayoutNotice.amount)} ${currencySymbol}`
                  : `Next payout: Month ${metrics.upcomingPayoutNotice.month} for "${metrics.upcomingPayoutNotice.name}" (${formatCurrency(metrics.upcomingPayoutNotice.amount)} ${currencySymbol})`}
              </Text>
            </View>
          )}
        </LinearGradient>

        {/* Action Button: Create New Circle */}
        <Pressable
          onPress={() => handleOpenModal()}
          style={({ pressed }) => [
            styles.createCircleBar,
            { backgroundColor: colors.surfaceAlt, borderColor: colors.border },
            pressed && { opacity: 0.8 },
          ]}
        >
          <View style={styles.createCircleBarLeft}>
            <View style={[styles.createCircleIcon, { backgroundColor: '#10B98118' }]}>
              <Ionicons name="add-circle" size={24} color="#10B981" />
            </View>
            <View>
              <Text style={[styles.createCircleTitle, { color: colors.text }]}>
                {isAr ? 'إضافة جمعية جديدة' : 'Join / Create New Circle'}
              </Text>
              <Text style={[styles.createCircleSubtitle, { color: colors.textSecondary }]}>
                {isAr ? 'حدد القسط، عدد الأسهم، وشهر القبض' : 'Set monthly amount, shares & payout month'}
              </Text>
            </View>
          </View>
          <Ionicons name={isAr ? 'chevron-back' : 'chevron-forward'} size={18} color={colors.textTertiary} />
        </Pressable>

        {/* Circles List Section */}
        <View style={styles.circlesSection}>
          <Text style={[styles.sectionHeading, { color: colors.text }]}>
            {isAr ? 'قائمة الجمعيات' : 'My Circles'} ({filteredJameyas.length})
          </Text>

          {filteredJameyas.length === 0 ? (
            <View style={[styles.emptyContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <MaterialCommunityIcons name="account-group-outline" size={56} color={colors.textTertiary} />
              <Text style={[styles.emptyTitle, { color: colors.text }]}>
                {isAr ? 'لا توجد جمعيات مسجلة' : 'No Circles Yet'}
              </Text>
              <Text style={[styles.emptyDesc, { color: colors.textSecondary }]}>
                {isAr
                  ? 'الجمعية الشهرية هي طريقة ممتازة للادخار التعاوني وقبض مبالغ كبيرة بدون فوائد. أضف جمعيتك الأولى الآن!'
                  : 'ROSCA is a great way to save cooperatively and receive a lump sum interest-free. Start your first circle!'}
              </Text>
              <Pressable
                onPress={() => handleOpenModal()}
                style={[styles.emptyBtn, { backgroundColor: '#10B981' }]}
              >
                <Ionicons name="add" size={18} color="#FFF" />
                <Text style={styles.emptyBtnText}>
                  {isAr ? 'إضافة جمعية' : 'Add Circle'}
                </Text>
              </Pressable>
            </View>
          ) : (
            filteredJameyas.map((item) => {
              const paid = item.paidMonthsCount || 0;
              const total = item.totalMonths;
              const percent = Math.min(100, Math.round((paid / total) * 100));
              const isFinished = paid >= total;
              const payoutMonths = item.payoutMonths || [item.payoutMonth || 1];
              const receivedMonths = item.receivedPayoutMonths || [];
              const shares = item.sharesCount || 1;
              const singleShare = item.singleShareAmount || (item.monthlyAmount / shares);
              const potPerShare = singleShare * total;
              const currentPaidAmount = paid * item.monthlyAmount;
              const remainingAmount = (total - paid) * item.monthlyAmount;

              return (
                <View
                  key={item.id}
                  style={[
                    styles.jameyaCard,
                    { backgroundColor: colors.card, borderColor: colors.border },
                    isFinished && { borderColor: '#10B98140' },
                  ]}
                >
                  {/* Card Header */}
                  <View style={styles.cardHeader}>
                    <View style={styles.cardHeaderLeft}>
                      <View style={[styles.circleIconBadge, { backgroundColor: isFinished ? '#10B98120' : '#3B82F620' }]}>
                        <MaterialCommunityIcons
                          name={isFinished ? 'check-decagram' : 'handshake'}
                          size={22}
                          color={isFinished ? '#10B981' : '#3B82F6'}
                        />
                      </View>
                      <View>
                        <Text style={[styles.cardTitle, { color: colors.text }]}>{item.name}</Text>
                        <Text style={[styles.cardShares, { color: colors.textSecondary }]}>
                          {isAr
                            ? `${shares} ${shares > 1 ? 'أسهم' : 'سهم'} • ${formatCurrency(singleShare)} ${currencySymbol}/سهم`
                            : `${shares} share(s) • ${formatCurrency(singleShare)} ${currencySymbol}/ea`}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.cardHeaderRight}>
                      {isFinished ? (
                        <View style={[styles.statusBadge, { backgroundColor: '#10B98118' }]}>
                          <Text style={[styles.statusText, { color: '#10B981' }]}>
                            {isAr ? 'مكتملة ✅' : 'Completed ✅'}
                          </Text>
                        </View>
                      ) : (
                        <View style={[styles.statusBadge, { backgroundColor: '#3B82F618' }]}>
                          <Text style={[styles.statusText, { color: '#3B82F6' }]}>
                            {paid}/{total} {isAr ? 'شهر' : 'mo'}
                          </Text>
                        </View>
                      )}

                      <Pressable
                        onPress={() => handleOpenModal(item)}
                        hitSlop={8}
                        style={styles.cardIconBtn}
                      >
                        <Ionicons name="create-outline" size={18} color={colors.textSecondary} />
                      </Pressable>
                      <Pressable
                        onPress={() => setDeletingJameyaItem(item)}
                        hitSlop={8}
                        style={styles.cardIconBtn}
                      >
                        <Ionicons name="trash-outline" size={18} color="#EF4444" />
                      </Pressable>
                    </View>
                  </View>

                  {/* Financial Metrics Summary inside Card */}
                  <View style={[styles.cardMetricsGrid, { backgroundColor: colors.surfaceAlt }]}>
                    <View style={styles.cardMetricItem}>
                      <Text style={[styles.cardMetricLabel, { color: colors.textSecondary }]}>
                        {isAr ? 'القسط الشهري' : 'Monthly Due'}
                      </Text>
                      <Text style={[styles.cardMetricValue, { color: colors.text }]}>
                        {formatCurrency(item.monthlyAmount)} {currencySymbol}
                      </Text>
                    </View>

                    <View style={styles.cardMetricItem}>
                      <Text style={[styles.cardMetricLabel, { color: colors.textSecondary }]}>
                        {isAr ? 'إجمالي القبض' : 'Total Pot'}
                      </Text>
                      <Text style={[styles.cardMetricValue, { color: '#10B981' }]}>
                        {formatCurrency(potPerShare * shares)} {currencySymbol}
                      </Text>
                    </View>

                    <View style={styles.cardMetricItem}>
                      <Text style={[styles.cardMetricLabel, { color: colors.textSecondary }]}>
                        {isAr ? 'المدفوع حتى الآن' : 'Total Paid'}
                      </Text>
                      <Text style={[styles.cardMetricValue, { color: colors.primary }]}>
                        {formatCurrency(currentPaidAmount)} {currencySymbol}
                      </Text>
                    </View>
                  </View>

                  {/* Visual Progress Bar */}
                  <View style={styles.progressSection}>
                    <View style={styles.progressHeader}>
                      <Text style={[styles.progressLabel, { color: colors.textSecondary }]}>
                        {isAr ? 'نسبة التقدم والسداد' : 'Payment Progress'}
                      </Text>
                      <Text style={[styles.progressPercent, { color: colors.primary }]}>
                        {percent}%
                      </Text>
                    </View>
                    <View style={[styles.progressTrack, { backgroundColor: colors.borderLight }]}>
                      <View
                        style={[
                          styles.progressFill,
                          {
                            width: `${percent}%`,
                            backgroundColor: isFinished ? '#10B981' : colors.primary,
                          },
                        ]}
                      />
                    </View>
                  </View>

                  {/* Visual Months Timeline Grid */}
                  <View style={styles.timelineSection}>
                    <Text style={[styles.timelineTitle, { color: colors.textSecondary }]}>
                      {isAr ? '📅 خريطة أشهر الجمعية:' : '📅 Monthly Timeline:'}
                    </Text>

                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.timelineScroll}>
                      {Array.from({ length: total }).map((_, idx) => {
                        const monthNum = idx + 1;
                        const isPaid = monthNum <= paid;
                        const isCurrentUpcoming = monthNum === paid + 1;
                        const isPayoutMonth = payoutMonths.includes(monthNum);
                        const isPayoutReceived = receivedMonths.includes(monthNum);

                        let bgColor = colors.surfaceAlt;
                        let borderColor = colors.border;
                        let iconName = 'ellipse-outline';
                        let iconColor = colors.textTertiary;

                        if (isPaid) {
                          bgColor = '#10B98118';
                          borderColor = '#10B98160';
                          iconName = 'checkmark-circle';
                          iconColor = '#10B981';
                        } else if (isCurrentUpcoming) {
                          bgColor = colors.primary + '20';
                          borderColor = colors.primary;
                          iconName = 'time-outline';
                          iconColor = colors.primary;
                        }

                        if (isPayoutMonth) {
                          if (isPayoutReceived) {
                            borderColor = '#10B981';
                          } else {
                            borderColor = '#F59E0B';
                            bgColor = '#F59E0B18';
                          }
                        }

                        return (
                          <View
                            key={monthNum}
                            style={[
                              styles.timelineNode,
                              { backgroundColor: bgColor, borderColor },
                            ]}
                          >
                            <Text style={[styles.timelineNodeMonth, { color: colors.text }]}>
                              #{monthNum}
                            </Text>

                            {isPayoutMonth ? (
                              <View style={styles.payoutMiniBadge}>
                                <Text style={{ fontSize: 10 }}>💰</Text>
                              </View>
                            ) : (
                              <Ionicons name={iconName as any} size={13} color={iconColor} />
                            )}

                            <Text style={[styles.timelineNodeStatus, { color: isPaid ? '#10B981' : colors.textTertiary }]}>
                              {isPaid ? (isAr ? 'مدفوع' : 'Paid') : (isPayoutMonth ? (isAr ? 'قبض' : 'Pot') : (isAr ? 'متبقي' : 'Due'))}
                            </Text>
                          </View>
                        );
                      })}
                    </ScrollView>
                  </View>

                  {/* Direct Action Buttons */}
                  <View style={styles.cardActionsRow}>
                    {/* Pay This Month Button */}
                    {!isFinished && (
                      <Pressable
                        onPress={() => {
                          Haptics.selectionAsync().catch(() => {});
                          setPayingJameyaItem(item);
                        }}
                        style={({ pressed }) => [
                          styles.actionBtn,
                          { backgroundColor: colors.primary },
                          pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
                        ]}
                      >
                        <Ionicons name="card-outline" size={16} color="#FFF" />
                        <Text style={styles.actionBtnText}>
                          {isAr ? `دفع قسط شهر ${paid + 1}` : `Pay Month ${paid + 1}`}
                        </Text>
                      </Pressable>
                    )}

                    {/* Receive Payout Button (For unreceived payout months) */}
                    {payoutMonths.map(pm => {
                      const alreadyReceived = receivedMonths.includes(pm);
                      if (alreadyReceived) return null;

                      return (
                        <Pressable
                          key={pm}
                          onPress={() => {
                            Haptics.selectionAsync().catch(() => {});
                            setDeductCurrentInstallment(false);
                            setPayoutTarget({ item, month: pm });
                          }}
                          style={({ pressed }) => [
                            styles.actionBtn,
                            { backgroundColor: '#F59E0B' },
                            pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
                          ]}
                        >
                          <Ionicons name="gift-outline" size={16} color="#FFF" />
                          <Text style={styles.actionBtnText}>
                            {isAr ? `قبض دور شهر ${pm} 💰` : `Receive Month ${pm} Pot 💰`}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>

      {/* CREATE / EDIT Jameya Modal */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalBackdrop}
        >
          <View style={[styles.modalSheet, { backgroundColor: colors.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                {editingJameya
                  ? (isAr ? 'تعديل الجمعية' : 'Edit Circle')
                  : (isAr ? 'إضافة جمعية جديدة' : 'Add New Money Circle')}
              </Text>
              <Pressable onPress={() => setModalVisible(false)} hitSlop={10}>
                <Ionicons name="close-circle" size={26} color={colors.textTertiary} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalFormContent}>
              {formError && (
                <View style={styles.formErrorBadge}>
                  <Ionicons name="alert-circle" size={16} color="#EF4444" />
                  <Text style={styles.formErrorText}>{formError}</Text>
                </View>
              )}

              {/* Circle Name */}
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
                  {isAr ? 'اسم الجمعية' : 'Circle Name'} *
                </Text>
                <TextInput
                  value={jameyaName}
                  onChangeText={setJameyaName}
                  placeholder={isAr ? 'مثال: جمعية الأقارب، جمعية العمل' : 'e.g. Family Savings, Work Circle'}
                  placeholderTextColor={colors.textTertiary}
                  style={[styles.textInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surfaceAlt }]}
                />
              </View>

              {/* Single Share Amount & Shares Count Grid */}
              <View style={styles.inputRow}>
                <View style={[styles.inputGroup, { flex: 1.2 }]}>
                  <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
                    {isAr ? 'قيمة السهم الواحد' : 'Share Amount'} *
                  </Text>
                  <TextInput
                    value={singleShareAmount}
                    onChangeText={setSingleShareAmount}
                    placeholder="1000"
                    placeholderTextColor={colors.textTertiary}
                    keyboardType="numeric"
                    style={[styles.textInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surfaceAlt }]}
                  />
                </View>

                <View style={[styles.inputGroup, { flex: 0.8 }]}>
                  <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
                    {isAr ? 'عدد الأسهم' : 'Shares'} *
                  </Text>
                  <TextInput
                    value={sharesCount}
                    onChangeText={setSharesCount}
                    placeholder="1"
                    placeholderTextColor={colors.textTertiary}
                    keyboardType="numeric"
                    style={[styles.textInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surfaceAlt }]}
                  />
                </View>
              </View>

              {/* Total Months Duration */}
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
                  {isAr ? 'مدة الجمعية (إجمالي عدد الأشهر)' : 'Circle Duration (Total Months)'} *
                </Text>
                <TextInput
                  value={totalMonths}
                  onChangeText={setTotalMonths}
                  placeholder="10"
                  placeholderTextColor={colors.textTertiary}
                  keyboardType="numeric"
                  style={[styles.textInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surfaceAlt }]}
                />
              </View>

              {/* Target Payout Month(s) */}
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
                  {isAr ? 'شهر القبض الخاص بك (الدور)' : 'Your Payout Month (Round)'} *
                </Text>
                <View style={{ gap: 8 }}>
                  {payoutMonthsInputs.map((val, i) => (
                    <TextInput
                      key={i}
                      value={val}
                      onChangeText={(txt) => {
                        const next = [...payoutMonthsInputs];
                        next[i] = txt;
                        setPayoutMonthsInputs(next);
                      }}
                      placeholder={isAr ? `شهر القبض للسهم رقم ${i + 1}` : `Payout month for share #${i + 1}`}
                      placeholderTextColor={colors.textTertiary}
                      keyboardType="numeric"
                      style={[styles.textInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surfaceAlt }]}
                    />
                  ))}
                </View>
              </View>

              {/* Wallet Picker */}
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
                  {isAr ? 'المحفظة المرتبطة' : 'Linked Wallet'}
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                  {wallets.map(w => {
                    const isSelected = walletId === w.id;
                    return (
                      <Pressable
                        key={w.id}
                        onPress={() => setWalletId(w.id)}
                        style={[
                          styles.walletChip,
                          { borderColor: colors.border, backgroundColor: colors.surfaceAlt },
                          isSelected && { borderColor: colors.primary, backgroundColor: colors.primary + '18' },
                        ]}
                      >
                        <Text style={[styles.walletChipText, { color: isSelected ? colors.primary : colors.text }]}>
                          {w.name} ({w.currency})
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <Pressable
                onPress={() => setModalVisible(false)}
                style={[styles.modalBtn, { backgroundColor: colors.surfaceAlt }]}
              >
                <Text style={[styles.modalBtnText, { color: colors.textSecondary }]}>
                  {isAr ? 'إلغاء' : 'Cancel'}
                </Text>
              </Pressable>

              <Pressable
                onPress={handleSaveJameya}
                disabled={isSubmitting}
                style={[styles.modalBtn, { backgroundColor: '#10B981', flex: 1.5 }]}
              >
                <Text style={[styles.modalBtnText, { color: '#FFF' }]}>
                  {isSubmitting ? (isAr ? 'جارِ الحفظ...' : 'Saving...') : (isAr ? 'حفظ الجمعية' : 'Save Circle')}
                </Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* CONFIRMATION: Pay Month Modal */}
      <Modal visible={!!payingJameyaItem} transparent animationType="fade">
        <View style={styles.modalBackdropCenter}>
          <View style={[styles.confirmDialog, { backgroundColor: colors.card }]}>
            <View style={[styles.confirmIconWrap, { backgroundColor: colors.primary + '20' }]}>
              <Ionicons name="card" size={28} color={colors.primary} />
            </View>

            <Text style={[styles.confirmTitle, { color: colors.text }]}>
              {isAr ? 'تأكيد سداد القسط الشهري' : 'Confirm Monthly Installment'}
            </Text>

            <Text style={[styles.confirmBody, { color: colors.textSecondary }]}>
              {isAr
                ? `سيتم تسجيل قسط شهر ${(payingJameyaItem?.paidMonthsCount || 0) + 1} بمبلغ ${formatCurrency(payingJameyaItem?.monthlyAmount || 0)} ${currencySymbol} كمعاملة ادخار في المحفظة.`
                : `This will log Month ${(payingJameyaItem?.paidMonthsCount || 0) + 1} installment (${formatCurrency(payingJameyaItem?.monthlyAmount || 0)} ${currencySymbol}) as savings transaction.`}
            </Text>

            <View style={styles.confirmActionsRow}>
              <Pressable
                onPress={() => setPayingJameyaItem(null)}
                style={[styles.confirmBtn, { backgroundColor: colors.surfaceAlt }]}
              >
                <Text style={[styles.confirmBtnText, { color: colors.textSecondary }]}>
                  {isAr ? 'إلغاء' : 'Cancel'}
                </Text>
              </Pressable>

              <Pressable
                onPress={handleConfirmPayMonth}
                disabled={isSubmitting}
                style={[styles.confirmBtn, { backgroundColor: colors.primary, flex: 1.5 }]}
              >
                <Text style={[styles.confirmBtnText, { color: '#FFF' }]}>
                  {isSubmitting ? (isAr ? 'جارِ السداد...' : 'Processing...') : (isAr ? 'تأكيد الدفع 💳' : 'Confirm Pay 💳')}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* CONFIRMATION: Receive Payout Modal */}
      <Modal visible={!!payoutTarget} transparent animationType="fade">
        <View style={styles.modalBackdropCenter}>
          <View style={[styles.confirmDialog, { backgroundColor: colors.card }]}>
            <View style={[styles.confirmIconWrap, { backgroundColor: '#F59E0B20' }]}>
              <Ionicons name="gift" size={28} color="#F59E0B" />
            </View>

            <Text style={[styles.confirmTitle, { color: colors.text }]}>
              {isAr ? '🎉 استلام وقبض الجمعية' : '🎉 Receive Circle Payout'}
            </Text>

            <Text style={[styles.confirmBody, { color: colors.textSecondary }]}>
              {isAr
                ? `مبارك! سيتم تسجيل قبض الجمعية كدخل وارد في محفظتك بمبلغ ${formatCurrency((payoutTarget?.item.singleShareAmount || 0) * (payoutTarget?.item.totalMonths || 1))} ${currencySymbol}.`
                : `Congratulations! Payout will be recorded as income in your wallet (${formatCurrency((payoutTarget?.item.singleShareAmount || 0) * (payoutTarget?.item.totalMonths || 1))} ${currencySymbol}).`}
            </Text>

            {/* Checkbox: Deduct this month's installment share */}
            <Pressable
              onPress={() => setDeductCurrentInstallment(!deductCurrentInstallment)}
              style={styles.checkboxRow}
            >
              <Ionicons
                name={deductCurrentInstallment ? 'checkbox' : 'square-outline'}
                size={20}
                color={colors.primary}
              />
              <Text style={[styles.checkboxLabel, { color: colors.text }]}>
                {isAr ? 'خصم قسط هذا الشهر تلقائياً من إجمالي القبض' : 'Deduct this month\'s installment share from pot'}
              </Text>
            </Pressable>

            <View style={styles.confirmActionsRow}>
              <Pressable
                onPress={() => setPayoutTarget(null)}
                style={[styles.confirmBtn, { backgroundColor: colors.surfaceAlt }]}
              >
                <Text style={[styles.confirmBtnText, { color: colors.textSecondary }]}>
                  {isAr ? 'إلغاء' : 'Cancel'}
                </Text>
              </Pressable>

              <Pressable
                onPress={handleConfirmReceivePayout}
                disabled={isSubmitting}
                style={[styles.confirmBtn, { backgroundColor: '#F59E0B', flex: 1.5 }]}
              >
                <Text style={[styles.confirmBtnText, { color: '#FFF' }]}>
                  {isSubmitting ? (isAr ? 'جارِ التسجيل...' : 'Recording...') : (isAr ? 'تأكيد القبض 💰' : 'Confirm Payout 💰')}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* CONFIRMATION: Delete Circle Modal */}
      <Modal visible={!!deletingJameyaItem} transparent animationType="fade">
        <View style={styles.modalBackdropCenter}>
          <View style={[styles.confirmDialog, { backgroundColor: colors.card }]}>
            <View style={[styles.confirmIconWrap, { backgroundColor: '#EF444420' }]}>
              <Ionicons name="trash" size={28} color="#EF4444" />
            </View>

            <Text style={[styles.confirmTitle, { color: colors.text }]}>
              {isAr ? 'حذف الجمعية' : 'Delete Circle'}
            </Text>

            <Text style={[styles.confirmBody, { color: colors.textSecondary }]}>
              {isAr
                ? `هل أنت متأكد من حذف جمعية "${deletingJameyaItem?.name}"؟ لن يتم حذف المعاملات السابقة المسجلة.`
                : `Are you sure you want to delete "${deletingJameyaItem?.name}"? Past recorded transactions will not be deleted.`}
            </Text>

            <View style={styles.confirmActionsRow}>
              <Pressable
                onPress={() => setDeletingJameyaItem(null)}
                style={[styles.confirmBtn, { backgroundColor: colors.surfaceAlt }]}
              >
                <Text style={[styles.confirmBtnText, { color: colors.textSecondary }]}>
                  {isAr ? 'إلغاء' : 'Cancel'}
                </Text>
              </Pressable>

              <Pressable
                onPress={handleConfirmDelete}
                disabled={isSubmitting}
                style={[styles.confirmBtn, { backgroundColor: '#EF4444', flex: 1.5 }]}
              >
                <Text style={[styles.confirmBtnText, { color: '#FFF' }]}>
                  {isSubmitting ? (isAr ? 'جارِ الحذف...' : 'Deleting...') : (isAr ? 'تأكيد الحذف' : 'Confirm Delete')}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 12,
    gap: 12,
  },
  headerBackBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleContainer: {
    flex: 1,
  },
  headerTitle: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 18,
  },
  headerSubtitle: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 11,
  },
  headerAddBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingHorizontal: 20,
    gap: 16,
  },
  // Hero Banner
  heroBanner: {
    borderRadius: 20,
    padding: 18,
    gap: 14,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  heroSubtitle: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 12,
  },
  heroMainAmount: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 26,
    marginTop: 2,
  },
  heroIconBadge: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroSubGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  heroSubCard: {
    flex: 1,
    padding: 10,
    borderRadius: 12,
  },
  heroSubLabel: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 10,
    color: '#9CA3AF',
  },
  heroSubVal: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 12.5,
    marginTop: 2,
  },
  heroNoticeTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  heroNoticeText: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 11,
    color: '#F59E0B',
    flex: 1,
  },
  // Create Circle Bar
  createCircleBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  createCircleBarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  createCircleIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createCircleTitle: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 14,
  },
  createCircleSubtitle: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 11,
  },
  // Circles List Section
  circlesSection: {
    gap: 12,
  },
  sectionHeading: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 15,
  },
  emptyContainer: {
    padding: 32,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    gap: 12,
  },
  emptyTitle: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 16,
  },
  emptyDesc: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
  },
  emptyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
    marginTop: 8,
  },
  emptyBtnText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 13,
    color: '#FFF',
  },
  // Jameya Card
  jameyaCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    gap: 14,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  circleIconBadge: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 15,
  },
  cardShares: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 11,
  },
  cardHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  statusText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 11,
  },
  cardIconBtn: {
    padding: 4,
  },
  cardMetricsGrid: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 10,
  },
  cardMetricItem: {
    flex: 1,
    alignItems: 'center',
  },
  cardMetricLabel: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 10,
  },
  cardMetricValue: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 12.5,
    marginTop: 2,
  },
  // Progress
  progressSection: {
    gap: 6,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressLabel: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 11,
  },
  progressPercent: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 12,
  },
  progressTrack: {
    height: 7,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  // Timeline
  timelineSection: {
    gap: 8,
  },
  timelineTitle: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 11,
  },
  timelineScroll: {
    gap: 8,
    paddingVertical: 2,
  },
  timelineNode: {
    width: 54,
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    gap: 4,
  },
  timelineNodeMonth: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 11,
  },
  timelineNodeStatus: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 9,
  },
  payoutMiniBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#F59E0B25',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Actions
  cardActionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingTop: 4,
  },
  actionBtn: {
    flex: 1,
    minWidth: '45%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
  },
  actionBtnText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 12.5,
    color: '#FFF',
  },
  // Modals
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 17,
  },
  modalFormContent: {
    gap: 14,
    paddingBottom: 16,
  },
  formErrorBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#EF444415',
    padding: 10,
    borderRadius: 10,
  },
  formErrorText: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 12,
    color: '#EF4444',
  },
  inputGroup: {
    gap: 6,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 10,
  },
  inputLabel: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 12,
  },
  textInput: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 14,
  },
  walletChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
  walletChipText: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 12,
  },
  modalFooter: {
    flexDirection: 'row',
    gap: 10,
    paddingTop: 8,
  },
  modalBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBtnText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 14,
  },
  // Confirm Dialog
  modalBackdropCenter: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  confirmDialog: {
    width: '100%',
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    gap: 12,
  },
  confirmIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmTitle: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 17,
    textAlign: 'center',
  },
  confirmBody: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginVertical: 4,
    paddingHorizontal: 8,
  },
  checkboxLabel: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 12,
    flex: 1,
  },
  confirmActionsRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
    marginTop: 8,
  },
  confirmBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmBtnText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 14,
  },
});
