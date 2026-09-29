import React, { useState, useEffect, useMemo, useRef } from 'react';
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
  waterLevel?: number; // 0 - 100
  harvested: boolean;
  harvestedFruitIds?: number[];
  onWaterTree: () => void;
  onHarvestSingleFruit: (fruitId: number, amount: number) => void;
  onHarvestAllFruits: (amount: number) => void;
  savingsRate: number; // percentage (0 - 100)
  surplusAmount?: number;
  currencySymbol?: string;
  totalHarvestedSavings?: number;
}

const isWeb = Platform.OS === 'web';

export default function MoneyTreeGarden({
  userLevel,
  healthScore,
  isAr,
  watered,
  waterLevel = 45,
  harvested,
  harvestedFruitIds = [],
  onWaterTree,
  onHarvestSingleFruit,
  onHarvestAllFruits,
  savingsRate,
  surplusAmount = 0,
  currencySymbol = '',
  totalHarvestedSavings = 0,
}: MoneyTreeGardenProps) {
  const fruitAmount = Math.max(1, Math.round((surplusAmount || 0) / 3));
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

  // Fruit positions on the tree (Relative to 240x200 canvas)
  const fruitsData = [
    { id: 0, x: 75, y: 75, nameAr: 'ثمرة الالتزام', nameEn: 'Commitment' },
    { id: 1, x: 120, y: 48, nameAr: 'ثمرة التوفير', nameEn: 'Savings' },
    { id: 2, x: 165, y: 75, nameAr: 'ثمرة الذكاء المالي', nameEn: 'Discipline' },
  ];

  const unharvestedCount = fruitsData.filter(f => !harvestedFruitIds.includes(f.id)).length;

  // Speech bubble state
  const [speech, setSpeech] = useState('');
  const [floatingToast, setFloatingToast] = useState<{ text: string; color: string } | null>(null);

  // Animations
  const treeScale = useRef(new Animated.Value(1)).current;
  const fruitPulse = useRef(new Animated.Value(1)).current;
  const wateringStreamAnim = useRef(new Animated.Value(0)).current;
  const [isWateringActive, setIsWateringActive] = useState(false);

  useEffect(() => {
    // Breathing idle animation
    const breath = Animated.loop(
      Animated.sequence([
        Animated.timing(treeScale, {
          toValue: 1.02,
          duration: 2200,
          useNativeDriver: !isWeb,
        }),
        Animated.timing(treeScale, {
          toValue: 1,
          duration: 2200,
          useNativeDriver: !isWeb,
        }),
      ])
    );
    breath.start();

    // Fruit pulsing animation
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(fruitPulse, {
          toValue: 1.15,
          duration: 1000,
          useNativeDriver: !isWeb,
        }),
        Animated.timing(fruitPulse, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: !isWeb,
        }),
      ])
    );
    pulse.start();

    return () => {
      breath.stop();
      pulse.stop();
    };
  }, []);

  // Update speech based on state
  useEffect(() => {
    if (unharvestedCount === 0) {
      setSpeech(
        isAr
          ? '🎉 رائع! جنيت كل ثمار اليوم بنجاح، استمر في التوفير لتنضج ثمار جديدة غداً!'
          : '🎉 All fruits harvested today! Keep saving to grow new ones tomorrow!'
      );
    } else if (watered) {
      setSpeech(
        isAr
          ? '💦 أشعر بالانتعاش والقوة! رعاية شجرتك يومياً تعكس انضباطك المالي الحقيقي.'
          : '💦 Refreshed & hydrated! Your daily consistency fuels our wealth journey.'
      );
    } else if (healthScore < 50) {
      setSpeech(
        isAr
          ? '🥺 أغصاني عطشى بسبب زيادة المصاريف! اضغط على السقي وضبط الميزانية لترويني.'
          : '🥺 I feel thirsty from recent spending! Tap to water and stay disciplined.'
      );
    } else {
      setSpeech(
        isAr
          ? `🌳 مرحباً بك! لديك ${unharvestedCount} ثمار ناضجة جاهزة للقطف، اضغط عليها مباشرة!`
          : `🌳 Welcome! You have ${unharvestedCount} golden fruits ready to harvest!`
      );
    }
  }, [unharvestedCount, watered, healthScore, isAr]);

  // Show floating reward toast
  const showToast = (text: string, color: string = '#FDE047') => {
    setFloatingToast({ text, color });
    setTimeout(() => {
      setFloatingToast(null);
    }, 2000);
  };

  // Realistic Water Action
  const handleWater = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setIsWateringActive(true);
    wateringStreamAnim.setValue(0);

    // Tree bounce when drinking water
    Animated.sequence([
      Animated.timing(wateringStreamAnim, {
        toValue: 1,
        duration: 1400,
        useNativeDriver: !isWeb,
      }),
      Animated.spring(treeScale, {
        toValue: 1.08,
        friction: 4,
        useNativeDriver: !isWeb,
      }),
      Animated.spring(treeScale, {
        toValue: 1,
        friction: 6,
        useNativeDriver: !isWeb,
      }),
    ]).start(() => {
      setIsWateringActive(false);
    });

    showToast(isAr ? '💦 تم ري الشجرة! +15 XP' : '💦 Tree Watered! +15 XP', '#38BDF8');
    setSpeech(
      isAr
        ? 'يا سلام! جذوري شربت الماء وانتعشت أوراقي، استمر في الحفاظ على ميزانيتك! 🌿✨'
        : 'Delicious! Roots absorbed the water and leaves are glistening! 🌿✨'
    );

    onWaterTree();
  };

  // Harvest single fruit
  const handleTapFruit = (fruitId: number) => {
    if (harvestedFruitIds.includes(fruitId)) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    showToast(
      isAr
        ? `🪙 قطفت ثمرة توفير (+${fruitAmount} ${currencySymbol})! +15 XP`
        : `🪙 Harvested fruit (+${fruitAmount} ${currencySymbol})! +15 XP`,
      '#FDE047'
    );
    onHarvestSingleFruit(fruitId, fruitAmount);
  };

  // Harvest all remaining
  const handleHarvestAll = () => {
    if (unharvestedCount === 0) return;

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const totalHarvest = unharvestedCount * fruitAmount;
    showToast(
      isAr
        ? `🎉 جنيت جميع الثمار (+${totalHarvest} ${currencySymbol})! +${unharvestedCount * 15} XP`
        : `🎉 Harvested all (+${totalHarvest} ${currencySymbol})! +${unharvestedCount * 15} XP`,
      '#FBBF24'
    );
    onHarvestAllFruits(totalHarvest);
  };

  const currentWaterLevel = watered ? 100 : waterLevel;

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
            <Text style={[styles.vitalityText, { color: vitality.tagColor }]} numberOfLines={1}>
              {isAr ? vitality.labelAr : vitality.labelEn}
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

        {/* FLOATING ACTION TOAST */}
        {floatingToast && (
          <View style={styles.floatingToastBox}>
            <Text style={[styles.floatingToastText, { color: floatingToast.color }]}>
              {floatingToast.text}
            </Text>
          </View>
        )}

        {/* TREE CANVAS & INTERACTIVE ZONE */}
        <View style={styles.treeArea}>
          {/* WATERING ANIMATION OVERLAY */}
          {isWateringActive && (
            <Animated.View
              style={[
                styles.wateringOverlay,
                {
                  opacity: wateringStreamAnim.interpolate({
                    inputRange: [0, 0.2, 0.8, 1],
                    outputRange: [0, 1, 1, 0],
                  }),
                },
              ]}
              pointerEvents="none"
            >
              <View style={styles.wateringCanBox}>
                <Text style={{ fontSize: 36 }}>🫗</Text>
              </View>
              <Animated.View
                style={[
                  styles.waterStream,
                  {
                    transform: [
                      {
                        translateY: wateringStreamAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [-20, 80],
                        }),
                      },
                    ],
                  },
                ]}
              >
                <Text style={{ fontSize: 24 }}>💧 💦 💧 💦</Text>
              </Animated.View>
            </Animated.View>
          )}

          {/* SVG TREE RENDERING */}
          <Animated.View style={{ transform: [{ scale: treeScale }], alignItems: 'center' }}>
            <Svg width={240} height={200} viewBox="0 0 240 200">
              <Defs>
                <SvgRadialGradient id="auraGlow" cx="50%" cy="50%" rx="50%" ry="50%">
                  <Stop offset="0%" stopColor={vitality.leafColor1} stopOpacity={watered ? 0.45 : 0.25} />
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

              {/* Pot Base & Soil */}
              <Ellipse cx="120" cy="180" rx="65" ry="14" fill="#090D16" opacity="0.6" />
              <Path
                d="M 75 160 L 85 182 Q 120 190 155 182 L 165 160 Q 120 166 75 160 Z"
                fill="url(#potGrad)"
              />
              <Ellipse cx="120" cy="160" rx="45" ry="8" fill="#5A3A1A" />
              <Ellipse
                cx="120"
                cy="159"
                rx="40"
                ry="6"
                fill={watered ? '#2E1D0C' : '#3D2611'}
              />

              {/* RIPPLE EFFECT ON SOIL WHEN WATERED */}
              {watered && (
                <Ellipse cx="120" cy="159" rx="36" ry="5" stroke="#38BDF8" strokeWidth="1" fill="none" opacity="0.6" />
              )}

              {/* GROWTH STAGES */}
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
                  <Path
                    d="M 120 158 Q 118 135 120 115"
                    stroke="url(#trunkGrad)"
                    strokeWidth="6"
                    strokeLinecap="round"
                  />
                  <Path
                    d="M 120 135 C 95 130 92 110 120 118"
                    fill="url(#foliageGrad1)"
                    stroke="#065F46"
                    strokeWidth="1"
                  />
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
                  <Path
                    d="M 115 160 Q 114 130 110 115 Q 120 105 132 90 M 112 120 Q 98 108 92 98"
                    stroke="url(#trunkGrad)"
                    strokeWidth="8"
                    strokeLinecap="round"
                  />
                  <Circle cx="90" cy="95" r="24" fill="url(#foliageGrad1)" />
                  <Circle cx="132" cy="85" r="28" fill="url(#foliageGrad1)" />
                  <Circle cx="112" cy="72" r="30" fill="url(#foliageGrad1)" />
                </G>
              )}

              {(growthStage === 'blooming' || growthStage === 'legendary') && (
                <G>
                  <Path
                    d="M 112 160 Q 115 130 105 110 Q 95 95 85 85 M 115 125 Q 130 110 145 95 M 110 110 Q 118 90 120 70"
                    stroke="url(#trunkGrad)"
                    strokeWidth="13"
                    strokeLinecap="round"
                  />
                  <Path
                    d="M 115 158 Q 118 132 110 114"
                    stroke="#FEF08A"
                    strokeWidth="1.5"
                    opacity="0.4"
                  />

                  {/* Dense Foliage */}
                  <Circle cx="75" cy="85" r="32" fill="url(#foliageGrad1)" />
                  <Circle cx="165" cy="85" r="32" fill="url(#foliageGrad1)" />
                  <Circle cx="95" cy="55" r="36" fill="url(#foliageGrad1)" />
                  <Circle cx="145" cy="55" r="36" fill="url(#foliageGrad1)" />
                  <Circle cx="120" cy="45" r="40" fill="url(#foliageGrad1)" />

                  <Circle cx="120" cy="40" r="28" fill={vitality.leafColor3} opacity="0.35" />

                  {growthStage === 'blooming' && (
                    <G>
                      <Circle cx="85" cy="75" r="5" fill="#F472B6" />
                      <Circle cx="155" cy="70" r="5" fill="#F472B6" />
                      <Circle cx="120" cy="35" r="6" fill="#F472B6" />
                    </G>
                  )}

                  {growthStage === 'legendary' && (
                    <G>
                      <Path
                        d="M 108 12 L 114 20 L 120 10 L 126 20 L 132 12 L 130 24 L 110 24 Z"
                        fill="url(#goldCoinGrad)"
                      />
                      <Circle cx="120" cy="18" r="2" fill="#FFFFFF" />
                      <Circle cx="60" cy="70" r="3" fill="#FDE047" opacity="0.9" />
                      <Circle cx="180" cy="70" r="3" fill="#FDE047" opacity="0.9" />
                    </G>
                  )}
                </G>
              )}
            </Svg>

            {/* DIRECT TAPPABLE FRUITS OVERLAY ON THE CANOPY */}
            <View style={styles.interactiveFruitsLayer} pointerEvents="box-none">
              {fruitsData.map((f) => {
                const isHarvested = harvestedFruitIds.includes(f.id);

                return (
                  <View
                    key={f.id}
                    style={[
                      styles.fruitTouchTarget,
                      {
                        left: f.x - 24,
                        top: f.y - 24,
                      },
                    ]}
                  >
                    {!isHarvested ? (
                      <Pressable
                        onPress={() => handleTapFruit(f.id)}
                        hitSlop={14}
                        style={({ pressed }) => [
                          styles.fruitPressable,
                          pressed && { transform: [{ scale: 0.85 }] },
                        ]}
                      >
                        <Animated.View style={{ transform: [{ scale: fruitPulse }] }}>
                          <LinearGradient
                            colors={['#FEF08A', '#FACC15', '#CA8A04']}
                            style={styles.fruitCoinCircle}
                          >
                            <Text style={styles.fruitCoinText}>$</Text>
                          </LinearGradient>
                        </Animated.View>
                        {surplusAmount > 0 && (
                          <View style={styles.fruitPriceBadge}>
                            <Text style={styles.fruitPriceText}>
                              +{fruitAmount}
                            </Text>
                          </View>
                        )}
                      </Pressable>
                    ) : (
                      <View style={styles.harvestedFlowerBud}>
                        <Text style={{ fontSize: 13 }}>🌸</Text>
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          </Animated.View>
        </View>

        {/* HYDRATION & HARVEST PROGRESS BARS */}
        <View style={styles.metricsRow}>
          {/* Hydration Bar */}
          <View style={styles.metricItem}>
            <View style={styles.metricHeaderRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Ionicons name="water" size={14} color="#38BDF8" />
                <Text style={styles.metricLabel}>
                  {isAr ? 'مستوى الارتواء' : 'Hydration'}
                </Text>
              </View>
              <Text style={[styles.metricValue, { color: '#38BDF8' }]}>
                {currentWaterLevel}%
              </Text>
            </View>
            <View style={styles.barBg}>
              <View style={[styles.barFill, { width: `${currentWaterLevel}%`, backgroundColor: '#38BDF8' }]} />
            </View>
          </View>

          {/* Fruit Harvest Bar */}
          <View style={styles.metricItem}>
            <View style={styles.metricHeaderRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Ionicons name="gift" size={14} color="#FBBF24" />
                <Text style={styles.metricLabel}>
                  {isAr ? 'ثمار التوفير' : 'Fruits'}
                </Text>
              </View>
              <Text style={[styles.metricValue, { color: '#FBBF24' }]}>
                {3 - unharvestedCount} / 3
              </Text>
            </View>
            <View style={styles.barBg}>
              <View
                style={[
                  styles.barFill,
                  {
                    width: `${((3 - unharvestedCount) / 3) * 100}%`,
                    backgroundColor: '#FBBF24',
                  },
                ]}
              />
            </View>
          </View>
        </View>

        {/* INTERACTIVE ACTIONS ROW */}
        <View style={styles.actionsRow}>
          {/* WATER ACTION */}
          <Pressable
            onPress={handleWater}
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
                ? (isAr ? 'شبعانة رياً اليوم 💧' : 'Watered Today 💧')
                : (isAr ? 'اروَ الشجرة 💧 (+15 XP)' : 'Water Tree 💧 (+15 XP)')}
            </Text>
          </Pressable>

          {/* HARVEST ALL ACTION */}
          <Pressable
            onPress={handleHarvestAll}
            disabled={unharvestedCount === 0}
            style={({ pressed }) => [
              styles.actionBtn,
              unharvestedCount === 0 ? styles.actionBtnDone : styles.actionBtnHarvest,
              pressed && unharvestedCount > 0 && { opacity: 0.8 },
            ]}
          >
            <Ionicons
              name={unharvestedCount === 0 ? 'checkmark-done' : 'gift'}
              size={18}
              color={unharvestedCount === 0 ? '#10B981' : '#FBBF24'}
            />
            <Text
              style={[
                styles.actionBtnText,
                unharvestedCount === 0 ? styles.actionBtnTextDone : { color: '#FEF9C3' },
              ]}
            >
              {unharvestedCount === 0
                ? (isAr ? 'تم جني ثمار اليوم ✓' : 'All Harvested ✓')
                : (isAr
                    ? (surplusAmount > 0
                        ? `اجنِ الثمار (+${unharvestedCount * fruitAmount} ${currencySymbol}) 🪙`
                        : `اقطف الباقي (${unharvestedCount}) 🪙`)
                    : (surplusAmount > 0
                        ? `Harvest (+${unharvestedCount * fruitAmount} ${currencySymbol}) 🪙`
                        : `Harvest All (${unharvestedCount}) 🪙`))}
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
    maxWidth: '94%',
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
  floatingToastBox: {
    position: 'absolute',
    top: 50,
    alignSelf: 'center',
    zIndex: 999,
    backgroundColor: '#0F172A',
    borderWidth: 1.5,
    borderColor: '#FBBF24',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  floatingToastText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 13,
  },
  treeArea: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 200,
    marginVertical: 4,
    position: 'relative',
  },
  wateringOverlay: {
    position: 'absolute',
    top: 0,
    alignItems: 'center',
    zIndex: 25,
  },
  wateringCanBox: {
    marginBottom: 2,
  },
  waterStream: {
    alignItems: 'center',
  },
  interactiveFruitsLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 240,
    height: 200,
  },
  fruitTouchTarget: {
    position: 'absolute',
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 20,
  },
  fruitPressable: {
    width: 38,
    height: 38,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fruitCoinCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#FEF08A',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.6,
    shadowRadius: 6,
    elevation: 6,
  },
  fruitCoinText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 16,
    color: '#713F12',
    lineHeight: 20,
  },
  fruitPriceBadge: {
    position: 'absolute',
    bottom: -11,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 6,
    borderWidth: 0.8,
    borderColor: '#FDE047',
  },
  fruitPriceText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 9,
    color: '#FEF08A',
  },
  harvestedFlowerBud: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 6,
    marginBottom: 10,
  },
  metricItem: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    padding: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  metricHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  metricLabel: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 11,
    color: '#94A3B8',
  },
  metricValue: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 12,
  },
  barBg: {
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  barFill: {
    height: 6,
    borderRadius: 3,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 2,
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
    backgroundColor: 'rgba(14, 165, 233, 0.25)',
    borderColor: 'rgba(56, 189, 248, 0.5)',
  },
  actionBtnHarvest: {
    backgroundColor: 'rgba(245, 158, 11, 0.25)',
    borderColor: 'rgba(251, 191, 36, 0.5)',
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
