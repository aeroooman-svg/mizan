import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  SafeAreaView,
  ScrollView,
  Pressable,
  TextInput,
} from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { formatCurrency, getCategoryById } from '@/lib/categories';
import { getCategoryName, Language } from '@/lib/i18n';

interface MonthlyBreakdownModalProps {
  visible: boolean;
  onClose: () => void;
  breakdownType: 'expense' | 'income' | 'rosca' | 'transfer';
  setBreakdownType: (type: 'expense' | 'income' | 'rosca' | 'transfer') => void;
  viewMonth: number;
  monthlyTransactions: any[];
  selectedWallet: any;
  wallets: any[];
  currencySymbol: string;
  colors: any;
  theme: string;
  styles: any;
  t: any;
  language: Language;
  loc: (ar: string, en: string, ml?: string) => string;
  periodLabel?: string;
}

export const MonthlyBreakdownModal: React.FC<MonthlyBreakdownModalProps> = ({
  visible,
  onClose,
  breakdownType,
  setBreakdownType,
  viewMonth,
  monthlyTransactions,
  selectedWallet,
  wallets,
  currencySymbol,
  colors,
  theme,
  styles,
  t,
  language,
  loc,
  periodLabel,
}) => {
  const [breakdownSearchQuery, setBreakdownSearchQuery] = useState('');

  const isExp = breakdownType === 'expense';
  const isInc = breakdownType === 'income';
  const isTrans = breakdownType === 'transfer';

  const activePeriod = periodLabel || t.months[viewMonth];

  // Sub totals calculation
  const pureExp = monthlyTransactions
    .filter(tr => tr.type === 'expense' && tr.category !== 'jameya_savings' && tr.category !== 'debt_loan')
    .reduce((s, tr) => s + tr.amount, 0);
  const transfersOut = monthlyTransactions
    .filter(tr => tr.type === 'transfer' && (!selectedWallet || tr.walletId === selectedWallet.id))
    .reduce((s, tr) => s + tr.amount, 0);

  const pureInc = monthlyTransactions
    .filter(tr => tr.type === 'income' && tr.category !== 'debt_loan')
    .reduce((s, tr) => s + tr.amount, 0);
  const transfersIn = monthlyTransactions
    .filter(tr => tr.type === 'transfer' && selectedWallet && tr.toWalletId === selectedWallet.id)
    .reduce((s, tr) => s + tr.amount, 0);

  // Filter transactions based on breakdownType and search
  const currentFilteredTxns = monthlyTransactions
    .filter(tr => {
      if (isExp) {
        return tr.type === 'expense' && tr.category !== 'jameya_savings' && tr.category !== 'debt_loan';
      } else if (isInc) {
        return (tr.type === 'income' && tr.category !== 'debt_loan') || (tr.type === 'transfer' && selectedWallet && tr.toWalletId === selectedWallet.id);
      } else if (isTrans) {
        return tr.type === 'transfer' && (!selectedWallet || tr.walletId === selectedWallet.id);
      } else {
        return tr.category === 'jameya_savings' || tr.category === 'savings_goal' || tr.category === 'goal_deposit';
      }
    })
    .filter(tr => {
      if (!breakdownSearchQuery) return true;
      const q = breakdownSearchQuery.toLowerCase();
      const catName = getCategoryName(tr.category, language).toLowerCase();
      const note = (tr.note || '').toLowerCase();
      return catName.includes(q) || note.includes(q);
    });

  const totalVal = isExp
    ? pureExp + transfersOut
    : isInc
    ? pureInc + transfersIn
    : isTrans
    ? transfersOut
    : monthlyTransactions
        .filter(tr => tr.category === 'jameya_savings' || tr.category === 'savings_goal' || tr.category === 'goal_deposit')
        .reduce((s, tr) => s + tr.amount, 0);

  const totalColor = isExp
    ? colors.expense
    : isInc
    ? colors.income
    : isTrans
    ? '#6366F1'
    : '#0D7C66';

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <SafeAreaView style={[styles.modalSheet, { flex: 1, maxHeight: '90%' }]}>
          {/* Modal Header */}
          <View style={styles.modalHeader}>
            <Pressable onPress={onClose} hitSlop={12} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color={colors.text} />
            </Pressable>
            <Text style={styles.modalTitle}>
              {breakdownType === 'income'
                ? loc(`تفاصيل الدخل (${activePeriod})`, `Income Breakdown (${activePeriod})`, `വരുമാന വിവരണം (${activePeriod})`)
                : breakdownType === 'expense'
                ? loc(`تفاصيل المصاريف (${activePeriod})`, `Expenses Breakdown (${activePeriod})`, `ചെലവ് വിവരണം (${activePeriod})`)
                : breakdownType === 'transfer'
                ? loc(`تفاصيل التحويلات (${activePeriod})`, `Transfers Breakdown (${activePeriod})`, `കൈമാറ്റ വിവരണം (${activePeriod})`)
                : loc(`تفاصيل الادخار والجمعيات (${activePeriod})`, `Savings & ROSCA Breakdown (${activePeriod})`, `സമ്പാദ്യ & ചിട്ടി വിവരണം (${activePeriod})`)}
            </Text>
            <View style={{ width: 32 }} />
          </View>

          {/* Sub-Switch inside Modal: Expense, Income, Savings, Transfers */}
          <View style={{ flexDirection: 'row', backgroundColor: theme === 'dark' ? '#0F172A' : '#E2E8F0', borderRadius: 14, padding: 4, marginHorizontal: 16, marginTop: 10, gap: 4 }}>
            <Pressable
              onPress={() => {
                Haptics.selectionAsync();
                setBreakdownType('expense');
              }}
              style={{
                flex: 1,
                paddingVertical: 8,
                borderRadius: 10,
                alignItems: 'center',
                backgroundColor: breakdownType === 'expense' ? (theme === 'dark' ? '#1E293B' : '#FFFFFF') : 'transparent',
              }}
            >
              <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 11, color: breakdownType === 'expense' ? colors.expense : colors.textSecondary }}>
                🔴 {t.expenses}
              </Text>
            </Pressable>

            <Pressable
              onPress={() => {
                Haptics.selectionAsync();
                setBreakdownType('income');
              }}
              style={{
                flex: 1,
                paddingVertical: 8,
                borderRadius: 10,
                alignItems: 'center',
                backgroundColor: breakdownType === 'income' ? (theme === 'dark' ? '#1E293B' : '#FFFFFF') : 'transparent',
              }}
            >
              <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 11, color: breakdownType === 'income' ? colors.income : colors.textSecondary }}>
                🟢 {t.income}
              </Text>
            </Pressable>

            <Pressable
              onPress={() => {
                Haptics.selectionAsync();
                setBreakdownType('rosca');
              }}
              style={{
                flex: 1,
                paddingVertical: 8,
                borderRadius: 10,
                alignItems: 'center',
                backgroundColor: breakdownType === 'rosca' ? (theme === 'dark' ? '#1E293B' : '#FFFFFF') : 'transparent',
              }}
            >
              <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 11, color: breakdownType === 'rosca' ? '#0D7C66' : colors.textSecondary }}>
                🎁 {loc('الادخار', 'Savings', 'സമ്പാദ്യം')}
              </Text>
            </Pressable>

            <Pressable
              onPress={() => {
                Haptics.selectionAsync();
                setBreakdownType('transfer');
              }}
              style={{
                flex: 1,
                paddingVertical: 8,
                borderRadius: 10,
                alignItems: 'center',
                backgroundColor: breakdownType === 'transfer' ? (theme === 'dark' ? '#1E293B' : '#FFFFFF') : 'transparent',
              }}
            >
              <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 11, color: breakdownType === 'transfer' ? '#6366F1' : colors.textSecondary }}>
                🔄 {loc('التحويلات', 'Transfers', 'കൈമാറ്റങ്ങൾ')}
              </Text>
            </Pressable>
          </View>

          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, gap: 14 }}>
            <View style={{ gap: 14 }}>
              {/* Total Hero Card */}
              <View style={{ backgroundColor: theme === 'dark' ? '#0F172A' : '#F8FAFC', borderRadius: 18, padding: 16, borderWidth: 1, borderColor: colors.border, gap: 6, alignItems: 'center' }}>
                <Text style={{ fontFamily: 'Cairo_600SemiBold', fontSize: 12, color: colors.textSecondary }}>
                  {isExp
                    ? loc('إجمالي المصاريف', 'Total Monthly Expenses', 'ആകെ പ്രതിമാസ ചെലവ്')
                    : isInc
                    ? loc('إجمالي المقبوضات والدخل', 'Total Monthly Inflow', 'ആകെ പ്രതിമാസ വരുമാനം')
                    : isTrans
                    ? loc('إجمالي التحويلات الصادرة', 'Total Outgoing Transfers', 'ആകെ കൈമാറ്റങ്ങൾ')
                    : loc('إجمالي الادخار والجمعيات', 'Total Savings & ROSCA', 'ആകെ സമ്പാദ്യവും ചിട്ടിയും')}
                </Text>
                <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 26, color: totalColor }}>
                  {isExp || isTrans ? '-' : '+'}{formatCurrency(totalVal)} {currencySymbol}
                </Text>
                <Text style={{ fontFamily: 'Cairo_400Regular', fontSize: 11, color: colors.textSecondary }}>
                  {loc(`${currentFilteredTxns.length} معاملة مسجلة في محفظة "${selectedWallet?.name || ''}"`, `${currentFilteredTxns.length} transactions recorded`, `"${selectedWallet?.name || ''}" വാലറ്റിൽ ${currentFilteredTxns.length} ഇടപാടുകൾ രേഖപ്പെടുത്തിയിട്ടുണ്ട്`)}
                </Text>
              </View>

              {/* Sub-Components Breakdown Pills */}
              {isExp && (
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <View style={{ flex: 1, backgroundColor: theme === 'dark' ? '#1E293B' : '#FFFFFF', padding: 12, borderRadius: 14, borderWidth: 1, borderColor: colors.border, gap: 4 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Ionicons name="cart-outline" size={15} color={colors.expense} />
                      <Text style={{ fontFamily: 'Cairo_600SemiBold', fontSize: 11, color: colors.textSecondary }}>
                        {loc('مصاريف استهلاكية', 'Pure Spending', 'ഉപഭോഗ ചെലവുകൾ')}
                      </Text>
                    </View>
                    <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 14, color: colors.expense }}>
                      -{formatCurrency(pureExp)} {currencySymbol}
                    </Text>
                  </View>

                  {transfersOut > 0 && (
                    <View style={{ flex: 1, backgroundColor: theme === 'dark' ? '#1E293B' : '#FFFFFF', padding: 12, borderRadius: 14, borderWidth: 1, borderColor: colors.border, gap: 4 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Ionicons name="swap-horizontal" size={15} color="#8B5CF6" />
                        <Text style={{ fontFamily: 'Cairo_600SemiBold', fontSize: 11, color: colors.textSecondary }}>
                          {loc('تحويل لمحافظ أخرى', 'Transfers Out', 'മറ്റ് വാലറ്റുകളിലേക്ക് കൈമാറ്റം')}
                        </Text>
                      </View>
                      <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 14, color: '#8B5CF6' }}>
                        -{formatCurrency(transfersOut)} {currencySymbol}
                      </Text>
                    </View>
                  )}
                </View>
              )}

              {isInc && (
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <View style={{ flex: 1, backgroundColor: theme === 'dark' ? '#1E293B' : '#FFFFFF', padding: 12, borderRadius: 14, borderWidth: 1, borderColor: colors.border, gap: 4 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Ionicons name="cash-outline" size={15} color={colors.income} />
                      <Text style={{ fontFamily: 'Cairo_600SemiBold', fontSize: 11, color: colors.textSecondary }}>
                        {loc('دخل وإيرادات مباشرة', 'Direct Income', 'നേരിട്ടുള്ള വരുമാനം')}
                      </Text>
                    </View>
                    <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 14, color: colors.income }}>
                      +{formatCurrency(pureInc)} {currencySymbol}
                    </Text>
                  </View>

                  {transfersIn > 0 && (
                    <View style={{ flex: 1, backgroundColor: theme === 'dark' ? '#1E293B' : '#FFFFFF', padding: 12, borderRadius: 14, borderWidth: 1, borderColor: colors.border, gap: 4 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Ionicons name="swap-horizontal" size={15} color="#10B981" />
                        <Text style={{ fontFamily: 'Cairo_600SemiBold', fontSize: 11, color: colors.textSecondary }}>
                          {loc('تحويلات واردة', 'Transfers In', 'ലഭിച്ച കൈമാറ്റങ്ങൾ')}
                        </Text>
                      </View>
                      <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 14, color: '#10B981' }}>
                        +{formatCurrency(transfersIn)} {currencySymbol}
                      </Text>
                    </View>
                  )}
                </View>
              )}

              {/* Search / Filter Input */}
              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surfaceAlt, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, gap: 8, borderWidth: 1, borderColor: colors.border }}>
                <Ionicons name="search" size={16} color={colors.textTertiary} />
                <TextInput
                  placeholder={loc('بحث في المعاملات...', 'Search transactions...', 'ഇടപാടുകളിൽ തിരയുക...')}
                  placeholderTextColor={colors.textTertiary}
                  value={breakdownSearchQuery}
                  onChangeText={setBreakdownSearchQuery}
                  style={{ flex: 1, fontFamily: 'Cairo_400Regular', fontSize: 12, color: colors.text, padding: 0 }}
                />
                {breakdownSearchQuery ? (
                  <Pressable onPress={() => setBreakdownSearchQuery('')} hitSlop={8}>
                    <Ionicons name="close-circle" size={16} color={colors.textTertiary} />
                  </Pressable>
                ) : null}
              </View>

              {/* Transaction List */}
              <View style={{ gap: 8 }}>
                <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 13, color: colors.text, textAlign: 'left' }}>
                  {loc('قائمة المعاملات بالتفصيل', 'Transaction Details', 'വിശദമായ ഇടപാട് വിവരങ്ങൾ')}
                </Text>

                {currentFilteredTxns.length === 0 ? (
                  <View style={{ padding: 24, alignItems: 'center' }}>
                    <Text style={{ fontFamily: 'Cairo_400Regular', fontSize: 12, color: colors.textSecondary }}>
                      {loc('لا توجد معاملات مسجلة تطابق البحث', 'No transactions found', 'ഇടപാടുകളൊന്നും കണ്ടെത്തിയില്ല')}
                    </Text>
                  </View>
                ) : (
                  currentFilteredTxns.map(tx => {
                    const isTransfer = tx.type === 'transfer';
                    const toW = isTransfer && tx.toWalletId ? wallets.find(w => w.id === tx.toWalletId) : null;
                    const fromW = isTransfer && tx.walletId ? wallets.find(w => w.id === tx.walletId) : null;

                    let title = getCategoryName(tx.category, language);
                    if (isTransfer) {
                      if (tx.walletId === selectedWallet?.id) {
                        title = loc(`تحويل إلى "${toW?.name || 'محفظة أخرى'}"`, `Transfer to "${toW?.name || 'Wallet'}"`, `"${toW?.name || 'മറ്റൊരു വാലറ്റ്'}"-ലേക്ക് കൈമാറ്റം`);
                      } else {
                        title = loc(`تحويل من "${fromW?.name || 'محفظة أخرى'}"`, `Transfer from "${fromW?.name || 'Wallet'}"`, `"${fromW?.name || 'മറ്റൊരു വാലറ്റ്'}"-ൽ നിന്നുള്ള കൈമാറ്റം`);
                      }
                    }

                    const d = new Date(tx.date);
                    const dateStr = `${d.getDate()} ${t.months[d.getMonth()]}`;
                    const catObj = getCategoryById(tx.category);

                    return (
                      <View
                        key={tx.id}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          backgroundColor: theme === 'dark' ? '#0F172A' : '#FFFFFF',
                          padding: 12,
                          borderRadius: 14,
                          borderWidth: 1,
                          borderColor: colors.borderLight,
                        }}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, paddingRight: 10 }}>
                          <View style={{
                            width: 36,
                            height: 36,
                            borderRadius: 10,
                            backgroundColor: isTransfer ? '#8B5CF620' : (catObj?.color ? catObj.color + '20' : (isExp ? '#EF444415' : '#10B98115')),
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}>
                            <MaterialIcons
                              name={isTransfer ? 'swap-horiz' : (catObj?.icon as any || 'receipt')}
                              size={20}
                              color={isTransfer ? '#8B5CF6' : (catObj?.color || (isExp ? colors.expense : colors.income))}
                            />
                          </View>
                          <View style={{ flex: 1, alignItems: 'flex-start' }}>
                            <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 12, color: colors.text }} numberOfLines={1}>
                              {title}
                            </Text>
                            <Text style={{ fontFamily: 'Cairo_400Regular', fontSize: 10, color: colors.textSecondary }} numberOfLines={1}>
                              {dateStr} {tx.note ? `• ${tx.note}` : ''}
                            </Text>
                          </View>
                        </View>

                        <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 13, color: isTransfer ? '#8B5CF6' : isExp ? colors.expense : colors.income }}>
                          {isExp ? '-' : '+'}{formatCurrency(tx.amount)} {currencySymbol}
                        </Text>
                      </View>
                    );
                  })
                )}
              </View>
            </View>
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  );
};
