import React from 'react';
import { StyleSheet, Text, View, Platform } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { BlurView } from 'expo-blur';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { Category, formatCurrency } from '@/lib/categories';
import { getCategoryName } from '@/lib/i18n';

const CHART_SIZE = 180;
const STROKE_WIDTH = 26;
const RADIUS = (CHART_SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export interface CategoryStatWithColor {
  category: Category;
  total: number;
  percentage: number;
  displayColor: string;
}

interface DonutChartProps {
  categoryStatsWithColors: CategoryStatWithColor[];
  totalAmount: number;
  currencySymbol: string;
  language: string;
  colors: any;
  theme: string;
  t: any;
  budgets: Record<string, number>;
}

export const DonutChart: React.FC<DonutChartProps> = ({
  categoryStatsWithColors,
  totalAmount,
  currencySymbol,
  language,
  colors,
  theme,
  t,
  budgets,
}) => {
  if (categoryStatsWithColors.length === 0) {
    return (
      <View style={styles.emptyState}>
        <Ionicons name="analytics-outline" size={48} color={colors.textTertiary} />
        <Text style={[styles.emptyTitle, { color: colors.text }]}>{t.noData}</Text>
        <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
          {t.addTransactionsForStats}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.donutSection}>
      {/* Donut Card */}
      <View style={[styles.donutCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {Platform.OS === 'ios' && (
          <BlurView
            intensity={theme === 'dark' ? 15 : 40}
            tint={theme === 'dark' ? 'dark' : 'light'}
            style={StyleSheet.absoluteFill}
          />
        )}
        <View style={styles.chartContainer}>
          <Svg width={CHART_SIZE} height={CHART_SIZE}>
            <Circle
              cx={CHART_SIZE / 2}
              cy={CHART_SIZE / 2}
              r={RADIUS}
              fill="none"
              stroke={theme === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}
              strokeWidth={STROKE_WIDTH}
            />
            {(() => {
              let accumulatedOffset = 0;
              return categoryStatsWithColors.map((stat) => {
                const segmentLength = (stat.percentage / 100) * CIRCUMFERENCE;
                const offset = accumulatedOffset;
                accumulatedOffset += segmentLength;
                return (
                  <Circle
                    key={stat.category.id}
                    cx={CHART_SIZE / 2}
                    cy={CHART_SIZE / 2}
                    r={RADIUS}
                    fill="none"
                    stroke={stat.displayColor}
                    strokeWidth={STROKE_WIDTH}
                    strokeDasharray={`${Math.max(1, segmentLength - 2)} ${CIRCUMFERENCE - Math.max(1, segmentLength - 2)}`}
                    strokeDashoffset={-offset}
                    strokeLinecap="round"
                    transform={`rotate(-90 ${CHART_SIZE / 2} ${CHART_SIZE / 2})`}
                  />
                );
              });
            })()}
          </Svg>
          <View style={styles.chartCenter}>
            <Text style={[styles.chartTotal, { color: colors.text }]}>
              {formatCurrency(totalAmount)}
            </Text>
            <Text style={[styles.chartLabel, { color: colors.textSecondary }]}>
              {currencySymbol}
            </Text>
          </View>
        </View>

        {/* Distinct Category Color Legend Badges Grid */}
        <View style={[styles.legendGrid, { borderTopColor: colors.borderLight }]}>
          {categoryStatsWithColors.map((stat) => (
            <View
              key={stat.category.id}
              style={[
                styles.legendBadge,
                {
                  backgroundColor: stat.displayColor + '15',
                  borderColor: stat.displayColor + '30',
                },
              ]}
            >
              <View style={[styles.legendDot, { backgroundColor: stat.displayColor }]} />
              <Text style={[styles.legendText, { color: colors.text }]}>
                {getCategoryName(stat.category.id, language as any)} ({Math.round(stat.percentage)}%)
              </Text>
            </View>
          ))}
        </View>
      </View>

      {/* Categories Breakdown details list */}
      <View style={styles.categoriesSection}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>{t.details}</Text>
        <View style={styles.categoriesList}>
          {categoryStatsWithColors.map((stat) => {
            const budgetLimit = budgets[stat.category.id] || 0;
            const hasBudget = budgetLimit > 0;
            const isOverBudget = hasBudget && stat.total > budgetLimit;

            return (
              <View
                key={stat.category.id}
                style={[styles.premiumCategoryCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
              >
                <View style={styles.categoryRowTop}>
                  <View style={[styles.catIconWrap, { backgroundColor: stat.displayColor + '18' }]}>
                    <MaterialIcons name={stat.category.icon as any} size={18} color={stat.displayColor} />
                  </View>
                  <View style={styles.categoryTextWrap}>
                    <Text style={[styles.categoryName, { color: colors.text }]} numberOfLines={1}>
                      {getCategoryName(stat.category.id, language as any)}
                    </Text>
                    <Text style={[styles.categoryPercent, { color: stat.displayColor }]}>
                      {Math.round(stat.percentage)}%
                    </Text>
                  </View>
                  <Text style={[styles.categoryAmount, { color: colors.text }]}>
                    {formatCurrency(stat.total)} {currencySymbol}
                  </Text>
                </View>

                <View style={[styles.categoryBarBg, { backgroundColor: colors.borderLight }]}>
                  <View
                    style={[
                      styles.categoryBarFill,
                      {
                        width: `${stat.percentage}%`,
                        backgroundColor: stat.displayColor,
                      },
                    ]}
                  />
                </View>

                {hasBudget && (
                  <View style={styles.budgetStatusRow}>
                    <View style={{ flex: 1 }}>
                      <View style={[styles.budgetProgressBgSmall, { backgroundColor: colors.borderLight }]}>
                        <View
                          style={[
                            styles.budgetProgressFillSmall,
                            {
                              width: `${Math.min(100, (stat.total / budgetLimit) * 100)}%`,
                              backgroundColor: isOverBudget ? colors.expense : colors.primary,
                            },
                          ]}
                        />
                      </View>
                    </View>
                    <Text
                      style={[
                        styles.budgetStatusText,
                        { color: colors.textSecondary },
                        isOverBudget && { color: colors.expense, fontFamily: 'Cairo_700Bold' },
                      ]}
                    >
                      {isOverBudget
                        ? (language === 'ar' ? '⚠️ تجاوزت الحد!' : '⚠️ Over limit!')
                        : (language === 'ar'
                            ? `ميزانية: ${formatCurrency(budgetLimit)}`
                            : `Budget: ${formatCurrency(budgetLimit)}`)}
                    </Text>
                  </View>
                )}
              </View>
            );
          })}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  emptyState: {
    padding: 36,
    alignItems: 'center',
    gap: 8,
  },
  emptyTitle: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 16,
  },
  emptySubtitle: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 12,
  },
  donutSection: {
    marginHorizontal: 20,
    gap: 16,
  },
  donutCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    alignItems: 'center',
    overflow: 'hidden',
  },
  chartContainer: {
    width: CHART_SIZE,
    height: CHART_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chartCenter: {
    position: 'absolute',
    alignItems: 'center',
  },
  chartTotal: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 18,
  },
  chartLabel: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 11,
  },
  legendGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  legendBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 11,
  },
  categoriesSection: {
    gap: 10,
  },
  sectionTitle: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 15,
  },
  categoriesList: {
    gap: 8,
  },
  premiumCategoryCard: {
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    gap: 8,
  },
  categoryRowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  catIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryTextWrap: {
    flex: 1,
    paddingHorizontal: 4,
  },
  categoryName: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 13,
  },
  categoryPercent: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 11,
  },
  categoryAmount: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 13,
  },
  categoryBarBg: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  categoryBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  budgetStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
  },
  budgetProgressBgSmall: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  budgetProgressFillSmall: {
    height: '100%',
    borderRadius: 2,
  },
  budgetStatusText: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 10,
  },
});
