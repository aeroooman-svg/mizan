import React, { useState, useEffect, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  Animated,
  Platform,
} from 'react-native';
import Svg, {
  Path,
  Circle,
  Ellipse,
  Rect,
  Defs,
  LinearGradient as SvgLinearGradient,
  RadialGradient as SvgRadialGradient,
  Stop,
  G,
} from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';

export type TreeGrowthStage = 'seed' | 'sprout' | 'sapling' | 'blooming' | 'legendary';

interface MoneyTreeGardenProps {
  userLevel: number;
  healthScore: number;
  isAr: boolean;
  watered: boolean;
  harvested: boolean;
  onWaterTree: () => void;
  onHarvestFruits: () => void;
  savingsRate: number; // percentage (0 - 100)
}

export default function MoneyTreeGarden({
  userLevel,
  healthScore,
  isAr,
  watered,
  harvested,
  onWaterTree,
  onHarvestFruits,
  savingsRate,
}: MoneyTreeGardenProps) {
  // Determine growth stage
  const growthStage: TreeGrowthStage = useMemo(() => {
    if (userLevel <= 1) return 'seed';
    if (userLevel <= 3) return 'sprout';
    if (userLevel <= 5) return 'sapling';
    if (userLevel <= 7) return 'blooming';
    return 'legendary';
  }, [userLevel]);

  // Determine tree mood and vitality
  const vitality = useMemo(() => {
    if (healthScore >= 80) {
      return {
        level: 'flourishing',
        labelAr: 'يانعة ومزدهرة ✨',
        labelEn: 'Flourishing & Radiant ✨',
        leafColor1: '#10B981',
        leafColor2: '#059669',
        leafColor3: '#34D399',
        fruitGlow: '#FDE047',
        tagColor: '#10B981',
        statusBg: '#10B98122',
      };
    }
    if (healthScore >= 60) {
      return {
        level: 'healthy',
        labelAr: 'نضرة ومستقرة 🌿',
        labelEn: 'Healthy & Stable 🌿',
        leafColor1: '#22C55E',
        leafColor2: '#16A34A',
        leafColor3: '#4ADE80',
        fruitGlow: '#FBBF24',
        tagColor: '#22C55E',
        statusBg: '#22C55E22',
      };
    }
    if (healthScore >= 45) {
      return {
        level: 'thirsty',
        labelAr: 'عطشى وتحتاج رعاية 🍂',
        labelEn: 'Thirsty, Needs Care 🍂',
        leafColor1: '#EAB308',
        leafColor2: '#CA8A04',
        leafColor3: '#FDE047',
        fruitGlow: '#F59E0B',
        tagColor: '#EAB308',
        statusBg: '#EAB30822',
      };
    }
    return {
      level: 'wilted',
      labelAr: 'مجهدة وجافة 🥀',
      labelEn: 'Wilted & Stressed 🥀',
      leafColor1: '#F97316',
      leafColor2: '#EA580C',
      leafColor3: '#FB923C',
      fruitGlow: '#9CA3AF',
      tagColor: '#EF4444',
      statusBg: '#EF444422',
    };
  }, [healthScore]);

  // Stage name
  const stageName = useMemo(() => {
    switch (growthStage) {
      case 'seed':
        return isAr ? 'بذرة الوفرة 🌱' : 'Seed of Abundance 🌱';
      case 'sprout':
        return isAr ? 'برعم الادخار 🌿' : 'Savings Sprout 🌿';
      case 'sapling':
        return isAr ? 'شجيرة الثقة 🪴' : 'Confidence Sapling 🪴';
      case 'blooming':
        return isAr ? 'شجرة التوفير المزهرة 🌸' : 'Blossoming Tree 🌸';
      case 'legendary':
        return isAr ? 'شجرة الثروة الأسطورية 👑' : 'Legendary Wealth Tree 👑';
    }
  }, [growthStage, isAr]);

  // Speech bubble text
  const [speech, setSpeech] = useState('');

  useEffect(() => {
    if (!watered && healthScore < 50) {
      setSpeech(
        isAr
          ? 'أغصاني عطشى بسبب زيادة المصاريف! اروِني بتسجيل معاملة وضبط النفقات 💧'
          : 'I feel thirsty from high spending! Water me by controlling expenses 💧'
      );
    } else if (vitality.level === 'flourishing') {
      setSpeech(
        isAr
          ? 'أشعر بالحيوية والوفرة! خطتك المالية ممتازة وأوراقي تلمع ذهباً ✨'
          : 'I feel radiant! Your financial management is shining bright ✨'
      );
    } else if (savingsRate >= 40) {
      setSpeech(
        isAr
          ? `نسبة ادخارك ${Math.round(savingsRate)}%! هذا السماد المثالي لنمو ثماري 🪙`
          : `You saved ${Math.round(savingsRate)}%! The perfect fertilizer for my fruits 🪙`
      );
    } else {
      setSpeech(
        isAr
          ? 'كل معاملة تسجلها وكل قرش تدخره يساعدني على النمو والازدهار!'
          : 'Every expense logged and saved helps me grow stronger every day!'
      );
    }
  }, [vitality.level, watered, healthScore, savingsRate, isAr]);

  // Animations
  const treeScale = React.useRef(new Animated.Value(1)).current;
  const fruitBounce = React.useRef(new Animated.Value(0)).current;
  const waterDropsAnim = React.useRef(new Animated.Value(0)).current;
  const [showWaterEffect, setShowWaterEffect] = useState(false);

  useEffect(() => {
    // Subtle breathing animation
    const breath = Animated.loop(
      Animated.sequence([
        Animated.timing(treeScale, {
          toValue: 1.03,
          duration: 2500,
          useNativeDriver: true,
        }),
        Animated.timing(treeScale, {
          toValue: 1,
          duration: 2500,
          useNativeDriver: true,
        }),
      ])
    );
    breath.start();

    // Fruit floating
    const bounce = Animated.loop(
      Animated.sequence([
        Animated.timing(fruitBounce, {
          toValue: -6,
          duration: 1600,
          useNativeDriver: true,
        }),
        Animated.timing(fruitBounce, {
          toValue: 0,
          duration: 1600,
          useNativeDriver: true,
        }),
      ])
    );
    bounce.start();

    return () => {
      breath.stop();
      bounce.stop();
    };
  }, []);

  const handleWater = () => {
    if (watered) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setShowWaterEffect(true);
    waterDropsAnim.setValue(0);

    Animated.timing(waterDropsAnim, {
      toValue: 1,
      duration: 1200,
      useNativeDriver: true,
    }).start(() => {
      setShowWaterEffect(false);
    });

    setSpeech(
      isAr
        ? 'يا سلام! انتعشت جذوري برعايتك واكتسبت +15 XP 💦'
        : 'Splash! Roots refreshed and you earned +15 XP 💦'
    );
    onWaterTree();
  };

  const handleHarvest = () => {
    if (harvested) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setSpeech(
      isAr
        ? 'أحسنت! قطفت ثمار صبرك وادخارك وكسبت +25 XP 🪙'
        : 'Harvested! You collected your savings reward +25 XP 🪙'
    );
    onHarvestFruits();
  };

  return (
    <View style={styles.cardContainer}>
      <LinearGradient
        colors={['#0F172A', '#1E293B', '#111827']}
        style={styles.gardenCard}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        {/* TOP STATUS BAR */}
        <View style={styles.topBar}>
          <View style={styles.stageTag}>
            <Ionicons name="sparkles" size={14} color="#FBBF24" />
            <Text style={styles.stageTagText}>{stageName}</Text>
          </View>

          <View style={[styles.vitalityTag, { backgroundColor: vitality.statusBg }]}>
            <Text style={[styles.vitalityText, { color: vitality.tagColor }]}>
              {vitality.labelAr}
            </Text>
          </View>
        </View>

        {/* SPEECH BUBBLE */}
        <View style={styles.speechBubbleWrapper}>
          <View style={styles.speechBubble}>
            <Text style={styles.speechBubbleText}>{speech}</Text>
          </View>
          <View style={styles.speechTail} />
        </View>

        {/* TREE CANVAS */}
        <View style={styles.treeArea}>
          {/* Animated Water Effect */}
          {showWaterEffect && (
            <Animated.View
              style={[
                styles.waterDropsContainer,
                {
                  opacity: waterDropsAnim.interpolate({
                    inputRange: [0, 0.2, 0.8, 1],
                    outputRange: [0, 1, 1, 0],
                  }),
                  transform: [
                    {
                      translateY: waterDropsAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [-30, 70],
                      }),
                    },
                  ],
                },
              ]}
              pointerEvents="none"
            >
              <Text style={{ fontSize: 26 }}>💧 💧 💧</Text>
            </Animated.View>
          )}

          {/* SVG RENDERING */}
          <Animated.View style={{ transform: [{ scale: treeScale }], alignItems: 'center' }}>
            <Svg width={240} height={200} viewBox="0 0 240 200">
              <Defs>
                <SvgRadialGradient id="auraGlow" cx="50%" cy="50%" rx="50%" ry="50%">
                  <Stop offset="0%" stopColor={vitality.leafColor1} stopOpacity="0.35" />
                  <Stop offset="100%" stopColor="#000000" stopOpacity="0" />
                </SvgRadialGradient>

                <SvgLinearGradient id="trunkGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <Stop offset="0%" stopColor="#854D0E" />
                  <Stop offset="50%" stopColor="#713F12" />
                  <Stop offset="100%" stopColor="#451A03" />
                </SvgLinearGradient>

                <SvgLinearGradient id="foliageGrad1" x1="0%" y1="0%" x2="100%" y2="100%">
                  <Stop offset="0%" stopColor={vitality.leafColor3} />
                  <Stop offset="50%" stopColor={vitality.leafColor1} />
                  <Stop offset="100%" stopColor={vitality.leafColor2} />
                </SvgLinearGradient>

                <SvgLinearGradient id="potGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <Stop offset="0%" stopColor="#334155" />
                  <Stop offset="50%" stopColor="#475569" />
                  <Stop offset="100%" stopColor="#1E293B" />
                </SvgLinearGradient>

                <SvgLinearGradient id="goldCoinGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <Stop offset="0%" stopColor="#FEF08A" />
                  <Stop offset="50%" stopColor="#FACC15" />
                  <Stop offset="100%" stopColor="#CA8A04" />
                </SvgLinearGradient>
              </Defs>

              {/* Background Aura */}
              <Circle cx="120" cy="100" r="90" fill="url(#auraGlow)" />

              {/* Island / Pot Base */}
              <Ellipse cx="120" cy="180" rx="65" ry="14" fill="#090D16" opacity="0.6" />
              <Path
                d="M 75 160 L 85 182 Q 120 190 155 182 L 165 160 Q 120 166 75 160 Z"
                fill="url(#potGrad)"
              />
              <Ellipse cx="120" cy="160" rx="45" ry="8" fill="#5A3A1A" />
              <Ellipse cx="120" cy="159" rx="40" ry="6" fill="#3D2611" />

              {/* STAGES RENDERING */}
              {growthStage === 'seed' && (
                <G>
                  <Circle cx="120" cy="154" r="14" fill="url(#goldCoinGrad)" />
                  <Path
                    d="M 120 140 Q 126 130 134 132 Q 130 144 120 140"
                    fill={vitality.leafColor1}
                  />
                  <Circle cx="120" cy="154" r="7" fill="#FEF08A" opacity="0.8" />
                </G>
              )}

              {growthStage === 'sprout' && (
                <G>
                  {/* Stem */}
                  <Path
                    d="M 120 158 Q 118 135 120 115"
                    stroke="url(#trunkGrad)"
                    strokeWidth="6"
                    strokeLinecap="round"
                  />
                  {/* Left leaf */}
                  <Path
                    d="M 120 135 C 95 130 92 110 120 118"
                    fill="url(#foliageGrad1)"
                    stroke="#065F46"
                    strokeWidth="1"
                  />
                  {/* Right leaf */}
                  <Path
                    d="M 120 125 C 145 120 148 100 120 108"
                    fill="url(#foliageGrad1)"
                    stroke="#065F46"
                    strokeWidth="1"
                  />
                  <Circle cx="120" cy="106" r="6" fill="#FDE047" />
                </G>
              )}

              {growthStage === 'sapling' && (
                <G>
                  {/* Trunk */}
                  <Path
                    d="M 115 160 Q 114 130 110 115 Q 120 105 132 90 M 112 120 Q 98 108 92 98"
                    stroke="url(#trunkGrad)"
                    strokeWidth="8"
                    strokeLinecap="round"
                  />
                  {/* Foliage Clusters */}
                  <Circle cx="90" cy="95" r="24" fill="url(#foliageGrad1)" />
                  <Circle cx="132" cy="85" r="28" fill="url(#foliageGrad1)" />
                  <Circle cx="112" cy="72" r="30" fill="url(#foliageGrad1)" />
                </G>
              )}

              {(growthStage === 'blooming' || growthStage === 'legendary') && (
                <G>
                  {/* Rich Curved Trunk */}
                  <Path
                    d="M 112 160 Q 115 130 105 110 Q 95 95 85 85 M 115 125 Q 130 110 145 95 M 110 110 Q 118 90 120 70"
                    stroke="url(#trunkGrad)"
                    strokeWidth="13"
                    strokeLinecap="round"
                  />
                  {/* Shading branch details */}
                  <Path
                    d="M 115 158 Q 118 132 110 114"
                    stroke="#FEF08A"
                    strokeWidth="1.5"
                    opacity="0.4"
                  />

                  {/* Dense Foliage Canopy */}
                  <Circle cx="75" cy="85" r="32" fill="url(#foliageGrad1)" />
                  <Circle cx="165" cy="85" r="32" fill="url(#foliageGrad1)" />
                  <Circle cx="95" cy="55" r="36" fill="url(#foliageGrad1)" />
                  <Circle cx="145" cy="55" r="36" fill="url(#foliageGrad1)" />
                  <Circle cx="120" cy="45" r="40" fill="url(#foliageGrad1)" />

                  {/* Highlights on top */}
                  <Circle cx="120" cy="40" r="28" fill={vitality.leafColor3} opacity="0.3" />

                  {/* Blooming Flowers or Sparkles if Blooming */}
                  {growthStage === 'blooming' && (
                    <G>
                      <Circle cx="85" cy="75" r="5" fill="#F472B6" />
                      <Circle cx="155" cy="70" r="5" fill="#F472B6" />
                      <Circle cx="120" cy="35" r="6" fill="#F472B6" />
                      <Circle cx="100" cy="50" r="4" fill="#FDE047" />
                      <Circle cx="140" cy="50" r="4" fill="#FDE047" />
                    </G>
                  )}

                  {/* Legendary Crown & Golden Accents */}
                  {growthStage === 'legendary' && (
                    <G>
                      {/* Floating Crown above canopy */}
                      <Path
                        d="M 108 12 L 114 20 L 120 10 L 126 20 L 132 12 L 130 24 L 110 24 Z"
                        fill="url(#goldCoinGrad)"
                      />
                      <Circle cx="120" cy="18" r="2" fill="#FFFFFF" />
                      {/* Golden Sparkles */}
                      <Circle cx="60" cy="70" r="3" fill="#FDE047" opacity="0.8" />
                      <Circle cx="180" cy="70" r="3" fill="#FDE047" opacity="0.8" />
                      <Circle cx="120" cy="65" r="3" fill="#FDE047" opacity="0.8" />
                    </G>
                  )}
                </G>
              )}

              {/* COIN FRUITS (Interactive) */}
              {!harvested && (
                <G>
                  {/* Left Fruit */}
                  <Circle cx="90" cy="85" r="10" fill="url(#goldCoinGrad)" />
                  <Circle cx="90" cy="85" r="8" fill="#FBBF24" />
                  <Circle cx="90" cy="85" r="4" fill="#FEF08A" opacity="0.7" />

                  {/* Right Fruit */}
                  <Circle cx="150" cy="85" r="10" fill="url(#goldCoinGrad)" />
                  <Circle cx="150" cy="85" r="8" fill="#FBBF24" />
                  <Circle cx="150" cy="85" r="4" fill="#FEF08A" opacity="0.7" />

                  {/* Center Top Fruit */}
                  <Circle cx="120" cy="60" r="11" fill="url(#goldCoinGrad)" />
                  <Circle cx="120" cy="60" r="9" fill="#FBBF24" />
                  <Circle cx="120" cy="60" r="5" fill="#FEF08A" opacity="0.7" />
                </G>
              )}
            </Svg>
          </Animated.View>
        </View>

        {/* INTERACTIVE ACTIONS ROW */}
        <View style={styles.actionsRow}>
          {/* WATER ACTION */}
          <Pressable
            onPress={handleWater}
            disabled={watered}
            style={({ pressed }) => [
              styles.actionBtn,
              watered ? styles.actionBtnDone : styles.actionBtnWater,
              pressed && { opacity: 0.8 },
            ]}
          >
            <Ionicons
              name={watered ? 'checkmark-circle' : 'water'}
              size={18}
              color={watered ? '#10B981' : '#38BDF8'}
            />
            <Text
              style={[
                styles.actionBtnText,
                watered ? styles.actionBtnTextDone : { color: '#E0F2FE' },
              ]}
            >
              {watered
                ? (isAr ? 'تم السقي اليوم ✓' : 'Watered Today ✓')
                : (isAr ? 'اروَ الشجرة 💧 (+15 XP)' : 'Water Tree 💧 (+15 XP)')}
            </Text>
          </Pressable>

          {/* HARVEST ACTION */}
          <Pressable
            onPress={handleHarvest}
            disabled={harvested}
            style={({ pressed }) => [
              styles.actionBtn,
              harvested ? styles.actionBtnDone : styles.actionBtnHarvest,
              pressed && { opacity: 0.8 },
            ]}
          >
            <Ionicons
              name={harvested ? 'checkmark-done' : 'gift'}
              size={18}
              color={harvested ? '#10B981' : '#FBBF24'}
            />
            <Text
              style={[
                styles.actionBtnText,
                harvested ? styles.actionBtnTextDone : { color: '#FEF9C3' },
              ]}
            >
              {harvested
                ? (isAr ? 'تم جني الثمار ✓' : 'Harvested ✓')
                : (isAr ? 'اقطف الثمار 🪙 (+25 XP)' : 'Harvest 🪙 (+25 XP)')}
            </Text>
          </Pressable>
        </View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  cardContainer: {
    marginBottom: 16,
    borderRadius: 24,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 14,
    elevation: 8,
  },
  gardenCard: {
    borderRadius: 24,
    padding: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    overflow: 'hidden',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  stageTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.3)',
  },
  stageTagText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 12,
    color: '#FDE047',
  },
  vitalityTag: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 16,
  },
  vitalityText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 12,
  },
  speechBubbleWrapper: {
    alignItems: 'center',
    marginBottom: 4,
  },
  speechBubble: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    maxWidth: '92%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  speechBubbleText: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 12,
    color: '#0F172A',
    textAlign: 'center',
    lineHeight: 18,
  },
  speechTail: {
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 6,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: 'rgba(255, 255, 255, 0.95)',
    alignSelf: 'center',
  },
  treeArea: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 190,
    marginVertical: 4,
  },
  waterDropsContainer: {
    position: 'absolute',
    top: 10,
    zIndex: 20,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 16,
    borderWidth: 1,
  },
  actionBtnWater: {
    backgroundColor: 'rgba(14, 165, 233, 0.2)',
    borderColor: 'rgba(56, 189, 248, 0.4)',
  },
  actionBtnHarvest: {
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    borderColor: 'rgba(251, 191, 36, 0.4)',
  },
  actionBtnDone: {
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  actionBtnText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 12,
  },
  actionBtnTextDone: {
    color: 'rgba(255, 255, 255, 0.5)',
  },
});
