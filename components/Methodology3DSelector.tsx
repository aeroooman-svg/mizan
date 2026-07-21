import React from 'react';
import { StyleSheet, Text, View, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/lib/ThemeContext';
import { useLanguage } from '@/lib/LanguageContext';

interface Methodology3DSelectorProps {
  isKakeiboMode: boolean;
  onSelectMode: (isKakeibo: boolean) => void;
}

export default function Methodology3DSelector({
  isKakeiboMode,
  onSelectMode,
}: Methodology3DSelectorProps) {
  const { colors, theme } = useTheme();
  const { language } = useLanguage();
  const isAr = language === 'ar';

  const isDark = theme === 'dark' || theme === 'midnight' || theme === 'emerald' || theme === 'rose';

  return (
    <View style={styles.outerContainer}>
      <View style={[styles.cardGrid, { backgroundColor: isDark ? '#0F172A' : '#F1F5F9', borderColor: colors.border }]}>
        
        {/* Option 1: Digital 50/30/20 Rule */}
        <Pressable
          onPress={() => {
            Haptics.selectionAsync().catch(() => {});
            onSelectMode(false);
          }}
          style={({ pressed }) => [
            styles.cardPressable,
            pressed && { transform: [{ scale: 0.98 }] },
          ]}
        >
          {!isKakeiboMode ? (
            <LinearGradient
              colors={['#10B981', '#059669']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.activeCard, styles.shadow3dGreen]}
            >
              <View style={styles.cardHeaderRow}>
                <View style={styles.icon3dCircle}>
                  <Ionicons name="pie-chart" size={20} color="#10B981" />
                </View>
                <View style={styles.badge3d}>
                  <Text style={styles.badge3dText}>50/30/20</Text>
                </View>
              </View>

              <Text style={styles.activeTitle}>
                {isAr ? '📊 الخطة الرقمية' : '📊 Standard 50/30/20'}
              </Text>
              <Text style={styles.activeSub}>
                {isAr ? 'حساب تلقائي للنسب والميزانيات' : 'Automated income breakdown'}
              </Text>

              <View style={styles.activeIndicator}>
                <Ionicons name="checkmark-circle" size={16} color="#FFF" />
                <Text style={styles.activeIndicatorText}>{isAr ? 'مُفعّل' : 'Active'}</Text>
              </View>
            </LinearGradient>
          ) : (
            <View style={[styles.inactiveCard, { backgroundColor: isDark ? '#1E293B' : '#FFFFFF', borderColor: colors.border }]}>
              <View style={styles.cardHeaderRow}>
                <View style={[styles.icon3dCircle, { backgroundColor: 'rgba(16, 185, 129, 0.12)' }]}>
                  <Ionicons name="pie-chart-outline" size={20} color="#10B981" />
                </View>
              </View>
              <Text style={[styles.inactiveTitle, { color: colors.text }]}>
                {isAr ? 'الخطة الرقمية' : 'Standard 50/30/20'}
              </Text>
              <Text style={[styles.inactiveSub, { color: colors.textSecondary }]}>
                {isAr ? 'نسب مئوية جاهزة' : 'Fixed percentages'}
              </Text>
            </View>
          )}
        </Pressable>

        {/* Option 2: Japanese Kakeibo Method */}
        <Pressable
          onPress={() => {
            Haptics.selectionAsync().catch(() => {});
            onSelectMode(true);
          }}
          style={({ pressed }) => [
            styles.cardPressable,
            pressed && { transform: [{ scale: 0.98 }] },
          ]}
        >
          {isKakeiboMode ? (
            <LinearGradient
              colors={['#8B5CF6', '#6366F1']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.activeCard, styles.shadow3dPurple]}
            >
              <View style={styles.cardHeaderRow}>
                <View style={styles.icon3dCirclePurple}>
                  <Ionicons name="sparkles" size={20} color="#8B5CF6" />
                </View>
                <View style={styles.badge3dPurple}>
                  <Text style={styles.badge3dText}>KAKEIBO</Text>
                </View>
              </View>

              <Text style={styles.activeTitle}>
                {isAr ? '🧘‍♂️ المنهج الياباني' : '🧘‍♂️ Japanese Kakeibo'}
              </Text>
              <Text style={styles.activeSub}>
                {isAr ? 'الوعي السلوكي والركائز الـ 4' : '4 Pillars & Mindful Ring'}
              </Text>

              <View style={styles.activeIndicator}>
                <Ionicons name="checkmark-circle" size={16} color="#FFF" />
                <Text style={styles.activeIndicatorText}>{isAr ? 'مُفعّل' : 'Active'}</Text>
              </View>
            </LinearGradient>
          ) : (
            <View style={[styles.inactiveCard, { backgroundColor: isDark ? '#1E293B' : '#FFFFFF', borderColor: colors.border }]}>
              <View style={styles.cardHeaderRow}>
                <View style={[styles.icon3dCirclePurple, { backgroundColor: 'rgba(139, 92, 246, 0.12)' }]}>
                  <Ionicons name="sparkles-outline" size={20} color="#8B5CF6" />
                </View>
              </View>
              <Text style={[styles.inactiveTitle, { color: colors.text }]}>
                {isAr ? 'المنهج الياباني' : 'Japanese Kakeibo'}
              </Text>
              <Text style={[styles.inactiveSub, { color: colors.textSecondary }]}>
                {isAr ? 'تأمل سلوكي ودائرة وعي' : 'Mindfulness & 4 Pillars'}
              </Text>
            </View>
          )}
        </Pressable>

      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    marginVertical: 12,
  },
  cardGrid: {
    flexDirection: 'row',
    gap: 12,
    padding: 8,
    borderRadius: 22,
    borderWidth: 1,
  },
  cardPressable: {
    flex: 1,
  },
  activeCard: {
    padding: 16,
    borderRadius: 18,
    minHeight: 135,
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
  shadow3dGreen: {
    boxShadow: '0px 8px 18px rgba(16, 185, 129, 0.4)',
    elevation: 8,
  },
  shadow3dPurple: {
    boxShadow: '0px 8px 18px rgba(139, 92, 246, 0.4)',
    elevation: 8,
  },
  inactiveCard: {
    padding: 16,
    borderRadius: 18,
    minHeight: 135,
    justifyContent: 'space-between',
    borderWidth: 1,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  icon3dCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0px 4px 8px rgba(0,0,0,0.15)',
  },
  icon3dCirclePurple: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0px 4px 8px rgba(0,0,0,0.15)',
  },
  badge3d: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  badge3dPurple: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  badge3dText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 9,
    color: '#FFF',
    letterSpacing: 0.5,
  },
  activeTitle: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 14,
    color: '#FFF',
    lineHeight: 20,
  },
  activeSub: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 10,
    color: 'rgba(255, 255, 255, 0.85)',
    marginTop: 2,
    lineHeight: 14,
  },
  inactiveTitle: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 14,
    lineHeight: 20,
  },
  inactiveSub: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 10,
    marginTop: 2,
    lineHeight: 14,
  },
  activeIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 8,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  activeIndicatorText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 10,
    color: '#FFF',
  },
});
