import React from 'react';
import { StyleSheet, Text, View, Platform, Dimensions } from 'react-native';
import Svg, { Rect, Text as SvgText } from 'react-native-svg';
import { BlurView } from 'expo-blur';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const BAR_CHART_HEIGHT = 160;
const BAR_CHART_WIDTH = SCREEN_WIDTH - 64;

export interface DailyData {
  day: number;
  income: number;
  expense: number;
}

interface BarChartMonthlyProps {
  dailyData: DailyData[];
  maxDailyValue: number;
  colors: any;
  theme: string;
  t: any;
}

export const BarChartMonthly: React.FC<BarChartMonthlyProps> = ({
  dailyData,
  maxDailyValue,
  colors,
  theme,
  t,
}) => {
  if (!dailyData || dailyData.length === 0) return null;

  const groupWidth = dailyData.length > 0 ? (BAR_CHART_WIDTH - 20) / dailyData.length : 30;
  const barWidth = Math.max(3, (groupWidth - 6) / 2);

  return (
    <View style={styles.barChartSection}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>{t.dailySpending}</Text>
      <View style={styles.barChartLegend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: colors.income }]} />
          <Text style={[styles.legendText, { color: colors.textSecondary }]}>{t.incomeType}</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: colors.expense }]} />
          <Text style={[styles.legendText, { color: colors.textSecondary }]}>{t.expenses}</Text>
        </View>
      </View>
      <View style={[styles.barChartCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {Platform.OS === 'ios' && (
          <BlurView
            intensity={theme === 'dark' ? 15 : 40}
            tint={theme === 'dark' ? 'dark' : 'light'}
            style={StyleSheet.absoluteFill}
          />
        )}
        <Svg width={BAR_CHART_WIDTH} height={BAR_CHART_HEIGHT + 35}>
          {dailyData.map((d, i) => {
            const x = i * groupWidth + 12;
            const incomeH = maxDailyValue > 0 ? (d.income / maxDailyValue) * BAR_CHART_HEIGHT : 0;
            const expenseH = maxDailyValue > 0 ? (d.expense / maxDailyValue) * BAR_CHART_HEIGHT : 0;
            return (
              <React.Fragment key={d.day}>
                <Rect
                  x={x}
                  y={BAR_CHART_HEIGHT - incomeH}
                  width={barWidth}
                  height={Math.max(incomeH, 3)}
                  rx={barWidth / 2}
                  fill={colors.income}
                  opacity={0.85}
                />
                <Rect
                  x={x + barWidth + 3}
                  y={BAR_CHART_HEIGHT - expenseH}
                  width={barWidth}
                  height={Math.max(expenseH, 3)}
                  rx={barWidth / 2}
                  fill={colors.expense}
                  opacity={0.85}
                />
                <SvgText
                  x={x + barWidth + 1.5}
                  y={BAR_CHART_HEIGHT + 22}
                  fontSize={9}
                  fontFamily="Cairo_600SemiBold"
                  fill={colors.textSecondary}
                  textAnchor="middle"
                >
                  {d.day}
                </SvgText>
              </React.Fragment>
            );
          })}
        </Svg>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  barChartSection: {
    marginHorizontal: 20,
    marginTop: 8,
    marginBottom: 16,
    gap: 10,
  },
  sectionTitle: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 16,
  },
  barChartLegend: {
    flexDirection: 'row',
    gap: 16,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 12,
  },
  barChartCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 12,
    alignItems: 'center',
    overflow: 'hidden',
  },
});
