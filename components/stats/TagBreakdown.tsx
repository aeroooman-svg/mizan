import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { formatCurrency } from '@/lib/categories';

export interface TagStatItem {
  tagId: string;
  tagObj: any;
  amount: number;
  percentage: number;
}

interface TagBreakdownProps {
  tagStats: TagStatItem[];
  currencySymbol: string;
  language: string;
  colors: any;
}

export const TagBreakdown: React.FC<TagBreakdownProps> = ({
  tagStats,
  currencySymbol,
  language,
  colors,
}) => {
  if (!tagStats || tagStats.length === 0) return null;
  const isAr = language === 'ar';

  return (
    <View style={styles.section}>
      <View style={styles.headerRow}>
        <Ionicons name="pricetags" size={18} color={colors.accent} />
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          {isAr ? 'الإنفاق حسب الوسوم الذكية (Tags)' : 'Spending by Smart Tags'}
        </Text>
      </View>
      <View style={styles.list}>
        {tagStats.map(stat => {
          const tagColor = stat.tagObj?.color || colors.primary;
          const tagName = stat.tagObj
            ? (isAr ? stat.tagObj.nameAr : stat.tagObj.nameEn)
            : `#${stat.tagId}`;

          return (
            <View
              key={stat.tagId}
              style={[
                styles.card,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <View style={styles.rowTop}>
                <View style={[styles.iconWrap, { backgroundColor: tagColor + '18' }]}>
                  <Ionicons name="pricetag" size={16} color={tagColor} />
                </View>
                <View style={styles.nameWrap}>
                  <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
                    {tagName}
                  </Text>
                  <Text style={[styles.percent, { color: tagColor }]}>
                    {Math.round(stat.percentage)}%
                  </Text>
                </View>
                <Text style={[styles.amount, { color: colors.text }]}>
                  {formatCurrency(stat.amount)} {currencySymbol}
                </Text>
              </View>
              <View style={[styles.barBg, { backgroundColor: colors.borderLight }]}>
                <View
                  style={[
                    styles.barFill,
                    {
                      width: `${Math.min(100, Math.max(2, stat.percentage))}%`,
                      backgroundColor: tagColor,
                    },
                  ]}
                />
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  section: {
    marginTop: 16,
    gap: 10,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  sectionTitle: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 15,
  },
  list: {
    gap: 8,
  },
  card: {
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    gap: 8,
  },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nameWrap: {
    flex: 1,
    paddingHorizontal: 4,
  },
  name: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 13,
  },
  percent: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 11,
  },
  amount: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 13,
  },
  barBg: {
    height: 5,
    borderRadius: 3,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 3,
  },
});
