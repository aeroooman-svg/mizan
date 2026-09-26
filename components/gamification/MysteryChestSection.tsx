import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  Modal,
  Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

interface MysteryChestSectionProps {
  isAr: boolean;
  openedToday: boolean;
  canUnlock: boolean;
  onOpenChest: (rewardXP: number) => void;
}

const FINANCIAL_WISDOMS_AR = [
  'القاعدة الذهبية: "لا توفر ما يتبقى بعد الإنفاق، بل أنفق ما يتبقى بعد التوفير".',
  'كل دينار تدخره اليوم هو جندي مخلص يعمل لصالحك ولصالح مستقبلك.',
  'الراحة النفسية الناجمة عن وجود صندوق طوارئ أثمن من أي سلعة كمالية تشتريها.',
  'مراقبة المصاريف الصغيرة تمنع غرق السفينة الكبيرة.',
  'الاستثمار في وعيك المالي يعطي دائماً أعلى نسبة أرباح.',
];

const FINANCIAL_WISDOMS_EN = [
  'Rule #1: "Do not save what is left after spending, but spend what is left after saving."',
  'Every penny saved today is a reliable worker building your future freedom.',
  'The peace of mind from an emergency fund beats any luxury item you could buy.',
  'Beware of little expenses; a small leak will sink a great ship.',
  'An investment in financial knowledge pays the best interest.',
];

export default function MysteryChestSection({
  isAr,
  openedToday,
  canUnlock,
  onOpenChest,
}: MysteryChestSectionProps) {
  const [modalVisible, setModalVisible] = useState(false);
  const [rewardXP, setRewardXP] = useState(75);
  const [wisdom, setWisdom] = useState('');

  // Chest pulse animation
  const pulseAnim = React.useRef(new Animated.Value(1)).current;

  React.useEffect(() => {
    if (!openedToday && canUnlock) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.05,
            duration: 900,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 900,
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    }
  }, [openedToday, canUnlock]);

  const handlePressChest = () => {
    if (openedToday) return;

    if (!canUnlock) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const xp = Math.floor(Math.random() * 40) + 60; // 60-100 XP
    const wisdoms = isAr ? FINANCIAL_WISDOMS_AR : FINANCIAL_WISDOMS_EN;
    const pickedWisdom = wisdoms[Math.floor(Math.random() * wisdoms.length)];

    setRewardXP(xp);
    setWisdom(pickedWisdom);
    setModalVisible(true);
    onOpenChest(xp);
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={
          openedToday
            ? ['#1E293B', '#0F172A']
            : canUnlock
            ? ['#78350F', '#451A03', '#1E293B']
            : ['#1E293B', '#1E1B4B']
        }
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.card}
      >
        <View style={styles.contentRow}>
          {/* Animated Chest Icon */}
          <Pressable onPress={handlePressChest} hitSlop={8}>
            <Animated.View
              style={[
                styles.iconBox,
                openedToday && styles.iconBoxOpened,
                canUnlock && !openedToday && styles.iconBoxAvailable,
                { transform: [{ scale: pulseAnim }] },
              ]}
            >
              <Text style={{ fontSize: 34 }}>
                {openedToday ? '📦' : canUnlock ? '🎁' : '🔒'}
              </Text>
            </Animated.View>
          </Pressable>

          {/* Info */}
          <View style={styles.infoCol}>
            <View style={styles.titleRow}>
              <Text style={styles.title}>
                {isAr ? 'صندوق المفاجآت اليومي' : 'Daily Mystery Chest'}
              </Text>
              {canUnlock && !openedToday && (
                <View style={styles.readyBadge}>
                  <Text style={styles.readyBadgeText}>
                    {isAr ? 'جاهز للفتح!' : 'Ready!'}
                  </Text>
                </View>
              )}
            </View>

            <Text style={styles.description}>
              {openedToday
                ? (isAr ? 'فتحت كنز اليوم بنجاح! عد غداً لمكافأة جديدة ✨' : 'Chest opened today! Come back tomorrow ✨')
                : canUnlock
                ? (isAr ? 'اضغط لفتح صندوقك وكسب نقاط XP وحكمة مالية حصرية!' : 'Tap to open your chest and unlock XP & wisdom!')
                : (isAr ? 'سجل معاملة أو أنجز مهمة واحدة على الأقل لفتح القفل 🔑' : 'Log a transaction or complete 1 quest to unlock 🔑')}
            </Text>
          </View>

          {/* Action button */}
          <Pressable
            onPress={handlePressChest}
            disabled={openedToday || !canUnlock}
            style={({ pressed }) => [
              styles.openBtn,
              openedToday
                ? styles.openBtnDone
                : canUnlock
                ? styles.openBtnActive
                : styles.openBtnLocked,
              pressed && { opacity: 0.8 },
            ]}
          >
            <Ionicons
              name={openedToday ? 'checkmark' : canUnlock ? 'sparkles' : 'lock-closed'}
              size={18}
              color={openedToday ? '#10B981' : '#FFFFFF'}
            />
          </Pressable>
        </View>
      </LinearGradient>

      {/* REWARD MODAL */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.rewardCard}>
            <Text style={{ fontSize: 60, marginBottom: 8 }}>🎉</Text>
            <Text style={styles.rewardTitle}>
              {isAr ? 'مبروك! كنز اليوم' : 'Congratulations!'}
            </Text>

            <View style={styles.xpBadge}>
              <Ionicons name="flash" size={22} color="#FBBF24" />
              <Text style={styles.xpBadgeText}>+{rewardXP} XP</Text>
            </View>

            <View style={styles.wisdomBox}>
              <Ionicons name="bulb-outline" size={20} color="#F59E0B" />
              <Text style={styles.wisdomText}>{wisdom}</Text>
            </View>

            <Pressable
              onPress={() => setModalVisible(false)}
              style={styles.rewardCloseBtn}
            >
              <Text style={styles.rewardCloseBtnText}>
                {isAr ? 'رائع، استمرار!' : 'Awesome, Continue!'}
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
    borderRadius: 20,
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  card: {
    borderRadius: 20,
    padding: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(251, 191, 36, 0.25)',
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  iconBox: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBoxOpened: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
  },
  iconBoxAvailable: {
    backgroundColor: 'rgba(245, 158, 11, 0.25)',
    borderWidth: 1.5,
    borderColor: '#FDE047',
  },
  infoCol: {
    flex: 1,
    gap: 4,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 15,
    color: '#FFFFFF',
  },
  readyBadge: {
    backgroundColor: '#10B981',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  readyBadgeText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 10,
    color: '#FFFFFF',
  },
  description: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 12,
    color: '#CBD5E1',
    lineHeight: 18,
  },
  openBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  openBtnActive: {
    backgroundColor: '#F59E0B',
  },
  openBtnDone: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    borderWidth: 1,
    borderColor: '#10B981',
  },
  openBtnLocked: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  rewardCard: {
    width: '100%',
    backgroundColor: '#0F172A',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#F59E0B',
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 10,
  },
  rewardTitle: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 20,
    color: '#FFFFFF',
    marginBottom: 12,
  },
  xpBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#FBBF24',
    marginBottom: 16,
  },
  xpBadgeText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 22,
    color: '#FDE047',
  },
  wisdomBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    padding: 14,
    borderRadius: 16,
    marginBottom: 20,
  },
  wisdomText: {
    flex: 1,
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 13,
    color: '#E2E8F0',
    lineHeight: 20,
  },
  rewardCloseBtn: {
    backgroundColor: '#10B981',
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 16,
  },
  rewardCloseBtnText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 15,
    color: '#FFFFFF',
  },
});
