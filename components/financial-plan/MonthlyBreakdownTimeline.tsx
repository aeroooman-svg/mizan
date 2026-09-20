import React from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { FinancialPlan } from '@/lib/planStorage';
import { formatCurrency } from '@/lib/categories';

interface MonthlyBreakdownTimelineProps {
  plan: FinancialPlan;
  created: Date;
  monthsElapsed: number;
  totalMonths: number;
  walletTransactions: any[];
  selectedWallet: any;
  currencySymbol: string;
  colors: any;
  styles: any;
  t: any;
  loc: (ar: string, en: string, ml?: string) => string;
  onOpenSingleMonthModal: (monthKey: string, monthNameStr: string, currentPlannedInc: number, currentPlannedExp: number) => void;
}

export const MonthlyBreakdownTimeline: React.FC<MonthlyBreakdownTimelineProps> = ({
  plan,
  created,
  monthsElapsed,
  totalMonths,
  walletTransactions,
  selectedWallet,
  currencySymbol,
  colors,
  styles,
  t,
  loc,
  onOpenSingleMonthModal,
}) => {
  const currentMonthNumber = Math.min(totalMonths, monthsElapsed + 1);
  const planProgressPct = Math.min(100, Math.max(0, Math.round((currentMonthNumber / totalMonths) * 100)));
  const maxDisplayMonths = Math.min(36, totalMonths);
  const sym = currencySymbol || selectedWallet?.currency || 'EGP';

  return (
    <View style={[styles.timelineSection, { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, padding: 16, borderRadius: 22, gap: 14 }]}>
      {/* Section Header with Title & Gamified Progress Badge */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: colors.primary + '18', alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="calendar-outline" size={18} color={colors.primary} />
          </View>
          <Text style={[styles.timelineTitle, { color: colors.text, marginBottom: 0, fontSize: 15 }]}>
            {t.monthlyBreakdown}
          </Text>
        </View>
        <View style={{ backgroundColor: '#10B98120', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, borderWidth: 1, borderColor: '#10B98140' }}>
          <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 11, color: '#10B981' }}>
            🔥 {planProgressPct}% {loc('مكتمل', 'Completed', 'പൂർത്തിയായി')}
          </Text>
        </View>
      </View>

      {/* Gamified Glowing Progress Bar & Motivational Counter */}
      <View style={{ gap: 6 }}>
        <View style={{ height: 8, backgroundColor: colors.surfaceAlt, borderRadius: 4, overflow: 'hidden', borderWidth: 1, borderColor: colors.border }}>
          <LinearGradient
            colors={['#10B981', '#06B6D4']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{ width: `${Math.max(4, planProgressPct)}%`, height: '100%', borderRadius: 4 }}
          />
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ fontFamily: 'Cairo_600SemiBold', fontSize: 11, color: colors.textSecondary }}>
            {loc(
              `الشهر ${currentMonthNumber} من أصل ${totalMonths} شهر 🎯`,
              `Month ${currentMonthNumber} of ${totalMonths} mos 🎯`,
              `${totalMonths} മാസങ്ങളിൽ മാസം ${currentMonthNumber} 🎯`
            )}
          </Text>
          <Text style={{ fontFamily: 'Cairo_400Regular', fontSize: 10, color: colors.textSecondary }}>
            {loc('اسحب أفقياً لاستعراض الأشهر ➔', 'Swipe horizontally ➔', 'തിരശ്ചീനമായി സ്വൈപ്പ് ചെയ്യുക ➔')}
          </Text>
        </View>
      </View>

      {/* Horizontal Scroll Cards Carousel */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 12, paddingVertical: 4 }}
      >
        {Array.from({ length: maxDisplayMonths }, (_, i) => {
          const monthDate = new Date(created);
          monthDate.setMonth(created.getMonth() + i);
          const m = monthDate.getMonth();
          const y = monthDate.getFullYear();
          const monthName = t.months[m];
          const monthKey = `${y}-${(m + 1).toString().padStart(2, '0')}`;
          const isPast = i < monthsElapsed;
          const isCurrent = i === monthsElapsed;

          // Check if custom override exists for this month
          const customOverride = plan.customMonthlyOverrides?.[monthKey];
          const plannedInc = customOverride?.income ?? plan.monthlyIncome;
          const plannedExp = customOverride?.expense ?? plan.monthlyExpense;
          const plannedSaving = plannedInc - plannedExp;

          const monthTx = walletTransactions.filter(tx => {
            const d = new Date(tx.date);
            return d.getMonth() === m && d.getFullYear() === y;
          });
          const actualMonthIncome = monthTx
            .filter(tx => (tx.type === 'income' && tx.category !== 'debt_loan') || (tx.type === 'transfer' && selectedWallet && tx.toWalletId === selectedWallet.id))
            .reduce((s, tx) => s + tx.amount, 0);
          const actualMonthExpense = monthTx
            .filter(tx => (tx.type === 'expense' && tx.category !== 'jameya_savings' && tx.category !== 'debt_loan') || (tx.type === 'transfer' && selectedWallet && tx.walletId === selectedWallet.id))
            .reduce((s, tx) => s + tx.amount, 0);
          const actualMonthSaving = actualMonthIncome - actualMonthExpense;
          const hasActualData = monthTx.length > 0;

          // Cumulative savings
          const initialWalletBalance = selectedWallet?.initialBalance || 0;
          let cumulativeSavings = initialWalletBalance;

          for (let k = 0; k <= i; k++) {
            const monthDateK = new Date(created);
            monthDateK.setMonth(created.getMonth() + k);
            const mK = monthDateK.getMonth();
            const yK = monthDateK.getFullYear();
            const monthKeyK = `${yK}-${(mK + 1).toString().padStart(2, '0')}`;

            const customOverrideK = plan.customMonthlyOverrides?.[monthKeyK];
            const plannedIncK = customOverrideK?.income ?? plan.monthlyIncome;
            const plannedExpK = customOverrideK?.expense ?? plan.monthlyExpense;
            const plannedSavingK = plannedIncK - plannedExpK;

            const monthTxK = walletTransactions.filter(tx => {
              const d = new Date(tx.date);
              return d.getMonth() === mK && d.getFullYear() === yK;
            });
            const hasActualK = monthTxK.length > 0;

            if (k <= monthsElapsed) {
              if (hasActualK) {
                const actualIncK = monthTxK
                  .filter(tx => (tx.type === 'income' && tx.category !== 'debt_loan') || (tx.type === 'transfer' && selectedWallet && tx.toWalletId === selectedWallet.id))
                  .reduce((s, tx) => s + tx.amount, 0);
                const actualExpK = monthTxK
                  .filter(tx => (tx.type === 'expense' && tx.category !== 'jameya_savings' && tx.category !== 'debt_loan') || (tx.type === 'transfer' && selectedWallet && tx.walletId === selectedWallet.id))
                  .reduce((s, tx) => s + tx.amount, 0);
                cumulativeSavings += (actualIncK - actualExpK);
              } else {
                cumulativeSavings += plannedSavingK;
              }
            } else {
              cumulativeSavings += plannedSavingK;
            }
          }

          return (
            <Pressable
              key={i}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onOpenSingleMonthModal(monthKey, `${monthName} ${y}`, plannedInc, plannedExp);
              }}
              style={({ pressed }) => [
                {
                  width: 220,
                  backgroundColor: isCurrent ? colors.primary + '18' : isPast ? colors.surfaceAlt + '90' : colors.surfaceAlt + '40',
                  borderColor: isCurrent ? colors.primary : customOverride ? colors.accent : colors.border,
                  borderWidth: isCurrent || customOverride ? 1.5 : 1,
                  borderRadius: 18,
                  padding: 14,
                  gap: 10,
                  justifyContent: 'space-between',
                  opacity: pressed ? 0.9 : 1,
                },
              ]}
            >
              {/* Top: Month Header & Badge */}
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <View
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: 11,
                      backgroundColor: isPast ? '#10B981' : isCurrent ? colors.primary : colors.surfaceAlt,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {isPast ? (
                      <Ionicons name="checkmark" size={13} color="#FFF" />
                    ) : isCurrent ? (
                      <Ionicons name="sparkles" size={11} color="#FFF" />
                    ) : (
                      <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 9, color: colors.textSecondary }}>{i + 1}</Text>
                    )}
                  </View>
                  <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 13, color: isCurrent ? colors.primary : colors.text }}>
                    {monthName} {y}
                  </Text>
                </View>

                <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="create-outline" size={14} color={colors.primary} />
                </View>
              </View>

              {/* Status / Override Tag */}
              <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                {isCurrent ? (
                  <View style={{ backgroundColor: colors.primary, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 }}>
                    <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 10, color: '#FFF' }}>
                      {loc('الشهر الحالي 🟢', 'Current 🟢', 'ഈ മാസം 🟢')}
                    </Text>
                  </View>
                ) : isPast ? (
                  <View style={{ backgroundColor: '#10B98120', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 }}>
                    <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 10, color: '#10B981' }}>
                      {loc('مكتمل ✅', 'Completed ✅', 'പൂർത്തിയായി ✅')}
                    </Text>
                  </View>
                ) : (
                  <View style={{ backgroundColor: colors.surfaceAlt, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, borderWidth: 1, borderColor: colors.border }}>
                    <Text style={{ fontFamily: 'Cairo_600SemiBold', fontSize: 10, color: colors.textSecondary }}>
                      {loc(`شهر ${i + 1}`, `Month ${i + 1}`, `മാസം ${i + 1}`)}
                    </Text>
                  </View>
                )}
                {customOverride && (
                  <View style={{ backgroundColor: colors.accent + '20', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 }}>
                    <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 9, color: colors.accent }}>
                      {loc('تعديل مخصص ✏️', 'Custom ✏️', 'മാറ്റം വരുത്തിയത് ✏️')}
                    </Text>
                  </View>
                )}
              </View>

              {/* Planned & Actual Savings */}
              <View style={{ gap: 4, backgroundColor: colors.surface, padding: 8, borderRadius: 12, borderWidth: 1, borderColor: colors.borderLight }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ fontFamily: 'Cairo_600SemiBold', fontSize: 10, color: colors.textSecondary }}>
                    {loc('المخطط:', 'Planned:', 'പ്ലാൻ:')}
                  </Text>
                  <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 11, color: plannedSaving >= 0 ? '#10B981' : '#EF4444' }}>
                    {plannedSaving >= 0 ? '+' : ''}{formatCurrency(plannedSaving)} {sym}
                  </Text>
                </View>
                {(isPast || isCurrent) && hasActualData && (
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: colors.borderLight, paddingTop: 3 }}>
                    <Text style={{ fontFamily: 'Cairo_600SemiBold', fontSize: 10, color: colors.textSecondary }}>
                      {loc('الفعلي:', 'Actual:', 'യഥാർത്ഥം:')}
                    </Text>
                    <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 11, color: actualMonthSaving >= 0 ? '#10B981' : '#EF4444' }}>
                      {actualMonthSaving >= 0 ? '+' : ''}{formatCurrency(actualMonthSaving)} {sym}
                    </Text>
                  </View>
                )}
              </View>

              {/* Bottom Cumulative Total Box */}
              <View style={{ backgroundColor: isCurrent ? colors.primary + '20' : colors.surfaceAlt, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, borderWidth: 1, borderColor: isCurrent ? colors.primary + '40' : colors.border }}>
                <Text style={{ fontFamily: 'Cairo_600SemiBold', fontSize: 9, color: colors.textSecondary }}>
                  {loc('الرصيد التراكمي', 'Cumulative Total', 'ആകെ സഞ്ചിത തുക')}
                </Text>
                <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 13, color: isCurrent ? colors.primary : colors.text }}>
                  {formatCurrency(cumulativeSavings)} {sym}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
};
