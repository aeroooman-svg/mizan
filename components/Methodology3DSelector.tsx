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

  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={{
        fontFamily: 'Cairo_700Bold',
        fontSize: 13,
        color: colors.text,
        marginBottom: 8,
        textAlign: 'left',
      }}>
        {isAr ? 'منهجية التخطيط والادخار' : 'Planning Methodology'}
      </Text>

      <View style={{
        flexDirection: 'row',
        backgroundColor: colors.surfaceAlt,
        borderRadius: 16,
        padding: 4,
        borderWidth: 1,
        borderColor: colors.border,
        gap: 6,
      }}>
        {/* Option 1: Standard 50/30/20 */}
        <Pressable
          onPress={() => {
            Haptics.selectionAsync().catch(() => {});
            onSelectMode(false);
          }}
          style={({ pressed }) => [{
            flex: 1,
            paddingVertical: 12,
            paddingHorizontal: 8,
            borderRadius: 12,
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'row',
            gap: 6,
            backgroundColor: !isKakeiboMode ? '#10B981' : 'transparent',
            opacity: pressed ? 0.85 : 1,
          }]}
        >
          <Ionicons name="pie-chart" size={16} color={!isKakeiboMode ? '#FFF' : colors.textSecondary} />
          <Text style={{
            fontFamily: 'Cairo_700Bold',
            fontSize: 12,
            color: !isKakeiboMode ? '#FFF' : colors.textSecondary,
          }}>
            {isAr ? 'الخطة الرقمية 50/30/20' : 'Standard 50/30/20'}
          </Text>
        </Pressable>

        {/* Option 2: Japanese Kakeibo */}
        <Pressable
          onPress={() => {
            Haptics.selectionAsync().catch(() => {});
            onSelectMode(true);
          }}
          style={({ pressed }) => [{
            flex: 1,
            paddingVertical: 12,
            paddingHorizontal: 8,
            borderRadius: 12,
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'row',
            gap: 6,
            backgroundColor: isKakeiboMode ? '#8B5CF6' : 'transparent',
            opacity: pressed ? 0.85 : 1,
          }]}
        >
          <Ionicons name="sparkles" size={16} color={isKakeiboMode ? '#FFF' : colors.textSecondary} />
          <Text style={{
            fontFamily: 'Cairo_700Bold',
            fontSize: 12,
            color: isKakeiboMode ? '#FFF' : colors.textSecondary,
          }}>
            {isAr ? 'المنهج الياباني Kakeibo' : 'Japanese Kakeibo'}
          </Text>
        </Pressable>
      </View>

      <Text style={{
        fontFamily: 'Cairo_400Regular',
        fontSize: 11,
        color: colors.textSecondary,
        marginTop: 6,
        textAlign: 'left',
        paddingHorizontal: 4,
      }}>
        {isKakeiboMode
          ? (isAr ? '🧘‍♂️ تقسيم سلوكي للمصاريف إلى 4 أركان (احتياجات، رغبات، تعليم، طوارئ) لتنمية الوعي المالي.' : '🧘‍♂️ Mindful 4-pillars behavioral budgeting for higher financial discipline.')
          : (isAr ? '📊 توزيع رقمي تلقائي: 50% للأساسيات، 30% للرغبات، و20% للادخار المباشر.' : '📊 Automated percentage allocation: 50% Needs, 30% Wants, 20% Savings.')}
      </Text>
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
