import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

interface LeaderboardSectionProps {
  isAr: boolean;
  userXP: number;
  userLevel: number;
  streakDays: number;
  currencySymbol: string;
  walletName?: string;
  theme: string;
}

export default function LeaderboardSection({
  isAr,
  userXP,
  userLevel,
  streakDays,
  currencySymbol,
  walletName,
  theme,
}: LeaderboardSectionProps) {
  const [activeView, setActiveView] = useState<'weekly' | 'hallOfFame'>('weekly');

  const loc = (ar: string, en: string) => (isAr ? ar : en);

  // Realistic competitive peers in user's league
  const weeklyPeers = [
    {
      rank: 1,
      name: isAr ? 'أريج العلي' : 'Areej Al-Ali',
      avatar: '👑',
      xp: Math.max(5120, userXP + 627),
      achievement: isAr ? 'وفرت 68% من الدخل' : 'Saved 68% of income',
      streak: 45,
      isUser: false,
    },
    {
      rank: 2,
      name: isAr ? 'طارق المطيري' : 'Tareq Al-Mutairi',
      avatar: '⚡',
      xp: Math.max(4750, userXP + 257),
      achievement: isAr ? 'سلسلة 42 يوماً متواصلة' : '42-day active streak',
      streak: 42,
      isUser: false,
    },
    {
      rank: 3,
      name: isAr ? `أنت (${walletName || 'محفظتك'})` : `You (${walletName || 'Your Wallet'})`,
      avatar: '⭐',
      xp: userXP,
      achievement: isAr ? `سلسلة ${streakDays} يوماً • أعلى 5%` : `${streakDays}-day streak • Top 5%`,
      streak: streakDays,
      isUser: true,
    },
    {
      rank: 4,
      name: isAr ? 'ناصر الكندري' : 'Nasser Al-Kandari',
      avatar: '🛡️',
      xp: Math.max(3800, userXP - 313),
      achievement: isAr ? 'صفر تجاوز للميزانية' : 'Zero budget overrun',
      streak: 26,
      isUser: false,
    },
    {
      rank: 5,
      name: isAr ? 'منى البدر' : 'Mona Al-Bader',
      avatar: '🪴',
      xp: Math.max(3400, userXP - 543),
      achievement: isAr ? 'جنت كل ثمار الشجرة' : 'Harvested all tree fruits',
      streak: 19,
      isUser: false,
    },
  ];

  const gapToRank2 = Math.max(1, weeklyPeers[1].xp - userXP);

  return (
    <View style={styles.container}>
      {/* LEAGUE HEADER CARD */}
      <LinearGradient
        colors={theme === 'dark' || theme === 'midnight' ? ['#1E1B4B', '#1E293B', '#0F172A'] : ['#4338CA', '#3730A3', '#1E1B4B']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.leagueBanner}
      >
        <View style={styles.leagueBannerTop}>
          <View style={styles.leagueBadgeWrap}>
            <View style={styles.leagueIconCircle}>
              <Text style={{ fontSize: 20 }}>💎</Text>
            </View>
            <View>
              <Text style={styles.leagueSubtitle}>
                {loc('دوري النخبة الماسي (المستوى 6)', 'Diamond Elite League (Tier 6)')}
              </Text>
              <Text style={styles.leagueTitle}>
                {loc('التنافس المالي الأسبوعي', 'Weekly Savers Arena')}
              </Text>
            </View>
          </View>

          <View style={styles.leagueTimerBadge}>
            <Ionicons name="time-outline" size={13} color="#FDE047" />
            <Text style={styles.leagueTimerText}>
              {loc('ينتهي خلال 3 أيام', '3d 14h left')}
            </Text>
          </View>
        </View>

        {/* User Competitive Status Callout */}
        <View style={styles.statusCallout}>
          <View style={styles.statusCalloutLeft}>
            <View style={styles.medalCircle}>
              <Text style={{ fontSize: 16 }}>🥉</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.statusCalloutTitle}>
                {loc('أنت في المركز #3 في مجموعتك!', 'You are Ranked #3 in your tier!')}
              </Text>
              <Text style={styles.statusCalloutSub}>
                {loc(
                  `⚡ تبعد ${gapToRank2} XP فقط عن المركز الثاني! استمر بالانضباط لتتصدر.`,
                  `⚡ Only ${gapToRank2} XP behind #2! Log & save to take the lead.`
                )}
              </Text>
            </View>
          </View>
        </View>
      </LinearGradient>

      {/* LEADERBOARD LIST CARD */}
      <View style={styles.listCard}>
        <View style={styles.listHeaderRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Ionicons name="trophy" size={18} color="#FBBF24" />
            <Text style={styles.listHeaderTitle}>
              {loc('لوحة المتصدرين في دوريك', 'League Leaderboard')}
            </Text>
          </View>
          <View style={styles.badgeTop5}>
            <Text style={styles.badgeTop5Text}>
              {loc('أفضل 5 مدخرين', 'Top 5 Savers')}
            </Text>
          </View>
        </View>

        <View style={styles.peersList}>
          {weeklyPeers.map(peer => {
            const isUser = peer.isUser;
            return (
              <View
                key={peer.rank}
                style={[
                  styles.peerRow,
                  isUser && styles.peerRowUser,
                ]}
              >
                {/* Rank number or medal */}
                <View style={[styles.rankBox, isUser && styles.rankBoxUser]}>
                  {peer.rank === 1 ? (
                    <Text style={{ fontSize: 16 }}>🥇</Text>
                  ) : peer.rank === 2 ? (
                    <Text style={{ fontSize: 16 }}>🥈</Text>
                  ) : peer.rank === 3 ? (
                    <Text style={{ fontSize: 16 }}>🥉</Text>
                  ) : (
                    <Text style={styles.rankNumberText}>{peer.rank}</Text>
                  )}
                </View>

                {/* Avatar & details */}
                <View style={styles.peerAvatar}>
                  <Text style={{ fontSize: 17 }}>{peer.avatar}</Text>
                </View>

                <View style={styles.peerInfo}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text
                      style={[
                        styles.peerName,
                        isUser && styles.peerNameUser,
                      ]}
                      numberOfLines={1}
                    >
                      {peer.name}
                    </Text>
                    {isUser && (
                      <View style={styles.youTag}>
                        <Text style={styles.youTagText}>{loc('أنت', 'YOU')}</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.peerSub} numberOfLines={1}>
                    {peer.achievement}
                  </Text>
                </View>

                {/* XP Score */}
                <View style={styles.peerScoreCol}>
                  <Text style={[styles.peerXP, isUser && styles.peerXPUser]}>
                    {peer.xp.toLocaleString()}
                  </Text>
                  <Text style={styles.peerXPLabel}>XP</Text>
                </View>
              </View>
            );
          })}
        </View>

        {/* Weekly Promotion Alert */}
        <View style={styles.promoNotice}>
          <Ionicons name="sparkles" size={15} color="#10B981" />
          <Text style={styles.promoNoticeText}>
            {loc(
              'المراكز الثلاثة الأولى تصعد تلقائياً إلى "دوري أساطير المال" وتحصل على جوائز حصرية بنهاية الأسبوع! 👑',
              'Top 3 advance to Crown Legends League with exclusive badges this Sunday! 👑'
            )}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 12,
    marginBottom: 8,
  },
  leagueBanner: {
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    shadowColor: '#4338CA',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
    gap: 14,
  },
  leagueBannerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  leagueBadgeWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  leagueIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(253, 224, 71, 0.4)',
  },
  leagueSubtitle: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 11,
    color: '#E0E7FF',
    textAlign: 'left',
  },
  leagueTitle: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 16,
    color: '#FFFFFF',
    textAlign: 'left',
  },
  leagueTimerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 0.5,
    borderColor: 'rgba(253, 224, 71, 0.3)',
  },
  leagueTimerText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 11,
    color: '#FDE047',
  },
  statusCallout: {
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(253, 224, 71, 0.3)',
  },
  statusCalloutLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  medalCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(251, 191, 36, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusCalloutTitle: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 13,
    color: '#FDE047',
    textAlign: 'left',
  },
  statusCalloutSub: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 11,
    color: '#E0E7FF',
    textAlign: 'left',
    marginTop: 2,
    lineHeight: 16,
  },
  listCard: {
    backgroundColor: '#0F172A',
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    gap: 12,
  },
  listHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  listHeaderTitle: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 14,
    color: '#FFFFFF',
  },
  badgeTop5: {
    backgroundColor: 'rgba(251, 191, 36, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 0.5,
    borderColor: 'rgba(251, 191, 36, 0.3)',
  },
  badgeTop5Text: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 10.5,
    color: '#FBBF24',
  },
  peersList: {
    gap: 8,
  },
  peerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'transparent',
    gap: 10,
  },
  peerRowUser: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderColor: 'rgba(16, 185, 129, 0.45)',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },
  rankBox: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rankBoxUser: {
    backgroundColor: 'rgba(16, 185, 129, 0.3)',
  },
  rankNumberText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 13,
    color: '#94A3B8',
  },
  peerAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  peerInfo: {
    flex: 1,
  },
  peerName: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 13,
    color: '#F1F5F9',
    textAlign: 'left',
  },
  peerNameUser: {
    color: '#10B981',
    fontFamily: 'Cairo_700Bold',
  },
  youTag: {
    backgroundColor: '#10B981',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 6,
  },
  youTagText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 9,
    color: '#FFFFFF',
  },
  peerSub: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 11,
    color: '#94A3B8',
    textAlign: 'left',
    marginTop: 1,
  },
  peerScoreCol: {
    alignItems: 'flex-end',
  },
  peerXP: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 14,
    color: '#FDE047',
  },
  peerXPUser: {
    color: '#34D399',
    fontSize: 15,
  },
  peerXPLabel: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 10,
    color: '#94A3B8',
    marginTop: -2,
  },
  promoNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderRadius: 14,
    padding: 10,
    borderWidth: 0.5,
    borderColor: 'rgba(16, 185, 129, 0.25)',
  },
  promoNoticeText: {
    flex: 1,
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 11,
    color: '#A7F3D0',
    textAlign: 'left',
    lineHeight: 16,
  },
});
