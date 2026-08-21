import React, { useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
  Platform,
  Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/lib/ThemeContext';
import { useLanguage } from '@/lib/LanguageContext';

export default function PrivacyPolicyScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const webTopInset = Platform.OS === 'web' ? 10 : 0;
  const { language } = useLanguage();
  const isAr = language === 'ar';

  const handleBack = () => {
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)/settings' as any);
    }
  };

  const handleEmailSupport = () => {
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
    Linking.openURL('mailto:aeroooman@gmail.com');
  };

  return (
    <View style={styles.container}>
      {/* Header Bar */}
      <View style={[styles.headerRow, { paddingTop: (insets.top || webTopInset) + 14 }]}>
        <Pressable onPress={handleBack} hitSlop={14} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.title}>
          {isAr ? 'سياسة الخصوصية وحماية البيانات' : 'Privacy Policy'}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 30 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Banner Card */}
        <View style={styles.bannerCard}>
          <View style={styles.shieldIconBox}>
            <MaterialIcons name="security" size={28} color={colors.primary} />
          </View>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={styles.bannerTitle}>
              {isAr ? 'تطبيق مالي آمن وخاص 100%' : '100% Secure & Private App'}
            </Text>

            <Text style={styles.bannerSub}>
              {isAr
                ? 'نلتزم بأعلى معايير الخصوصية لحماية بياناتك المالية والشخصية. بياناتك ملك لك وحدك.'
                : 'We prioritize your privacy above all else. Your financial data stays under your control.'}
            </Text>
            <Text style={styles.dateTag}>
              {isAr ? 'آخر تحديث: يوليو 2026' : 'Last Updated: July 2026'}
            </Text>
          </View>
        </View>

        {/* Section 1 */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Ionicons name="folder-open-outline" size={20} color={colors.primary} />
            <Text style={styles.sectionTitle}>
              {isAr ? '1. البيانات التي نجمعها ونعالجها' : '1. Data We Collect & Process'}
            </Text>
          </View>
          <View style={styles.bulletItem}>
            <Ionicons name="checkmark-circle" size={16} color={colors.primary} style={{ marginTop: 2 }} />
            <Text style={styles.bulletText}>
              <Text style={{ fontFamily: 'Cairo_700Bold', color: colors.text }}>
                {isAr ? 'المعاملات والمحافظ: ' : 'Transactions & Wallets: '}
              </Text>
              {isAr
                ? 'تُحفظ بيانات المعاملات والمحافظ وميزانيات الادخار محلياً على جهازك بشكل أساسي عبر التخزين المشفر.'
                : 'Transactions, wallets, and budgets are saved locally on your device via encrypted storage.'}
            </Text>
          </View>
          <View style={styles.bulletItem}>
            <Ionicons name="checkmark-circle" size={16} color={colors.primary} style={{ marginTop: 2 }} />
            <Text style={styles.bulletText}>
              <Text style={{ fontFamily: 'Cairo_700Bold', color: colors.text }}>
                {isAr ? 'البيانات الحيوية (البصمة/Face ID): ' : 'Biometrics (Face ID/Fingerprint): '}
              </Text>
              {isAr
                ? 'يُستخدم نظام المصادقة الخاص بجهازك لتأمين التطبيق، ولا نحفظ أو نطلع على بيانات بصمتك إطلاقاً.'
                : 'Your device authentication system handles app lock; biometric data never leaves your device.'}
            </Text>
          </View>
          <View style={styles.bulletItem}>
            <Ionicons name="checkmark-circle" size={16} color={colors.primary} style={{ marginTop: 2 }} />
            <Text style={styles.bulletText}>
              <Text style={{ fontFamily: 'Cairo_700Bold', color: colors.text }}>
                {isAr ? 'صور الفواتير: ' : 'Receipt Images: '}
              </Text>
              {isAr
                ? 'تُعالج صور الفواتير التي تقوم بمسحها ضوئياً لغرض استخراج البيانات فقط ولا يتم مشاركتها مع أطراف خارجية.'
                : 'Scanned receipts are processed solely to extract transaction details and are never shared.'}
            </Text>
          </View>
        </View>

        {/* Section 2 */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Ionicons name="lock-closed-outline" size={20} color={colors.primary} />
            <Text style={styles.sectionTitle}>
              {isAr ? '2. تخزين البيانات والأمان' : '2. Data Storage & Security'}
            </Text>
          </View>
          <Text style={styles.paragraphText}>
            {isAr
              ? 'يتم تصميم تطبيق ميزان على مبدأ "الخصوصية أولاً" (Offline-First Privacy). بياناتك المالية ملك خالص لك، وتخزينها يتم بشكل آمن محلياً على هاتفك. في حال استخدام خدمات النسخ الاحتياطي السحابي، يتم تشفير البيانات بنظام تشفير عالي الأمان.'
              : 'MIZAN is designed with offline-first privacy. Your financial data is completely yours and stored securely. Cloud sync features use end-to-end encryption.'}
          </Text>
        </View>

        {/* Section 3 */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Ionicons name="ribbon-outline" size={20} color={colors.primary} />
            <Text style={styles.sectionTitle}>
              {isAr ? '3. عدم مشاركة البيانات' : '3. Zero Data Sharing'}
            </Text>
          </View>
          <Text style={styles.paragraphText}>
            {isAr
              ? 'نحن لا نبيع ولا نؤجر ولا نشارك أي بيانات شخصية أو مالية مع أي شركات إعلانية أو أطراف خارجية تحت أي ظرف من الظروف.'
              : 'We do NOT sell, rent, or share any personal or financial data with advertising companies or third parties under any circumstances.'}
          </Text>
        </View>

        {/* Section 4 */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Ionicons name="trash-bin-outline" size={20} color={colors.expense} />
            <Text style={styles.sectionTitle}>
              {isAr ? '4. حقوقك وحذف البيانات' : '4. Data & Account Deletion'}
            </Text>
          </View>
          <Text style={styles.paragraphText}>
            {isAr
              ? 'يحق لك في أي وقت مسح كافة بياناتك المالية نهائياً وحذف الحساب من خلال الذهاب إلى (الإعدادات > مسح جميع البيانات) داخل التطبيق، أو بالتواصل معنا لمسح أي بيانات مرتبطة بالحساب السحابي فوراً.'
              : 'You have full control to wipe all your data at any time via (Settings > Clear All Data), or by contacting support.'}
          </Text>
        </View>

        {/* Section 5: Support */}
        <Pressable onPress={handleEmailSupport} style={styles.supportCard}>
          <Ionicons name="mail-outline" size={22} color={colors.primary} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={styles.supportTitle}>
              {isAr ? 'الدعم الفني واستفسارات الخصوصية' : 'Support & Privacy Queries'}
            </Text>
            <Text style={styles.supportEmail}>aeroooman@gmail.com</Text>
          </View>
          <Ionicons name={isAr ? "chevron-back" : "chevron-forward"} size={16} color={colors.textSecondary} />
        </Pressable>

        <Text style={styles.copyrightText}>
          &copy; 2026 MIZAN App. {isAr ? 'جميع الحقوق محفوظة.' : 'All rights reserved.'}
        </Text>
      </ScrollView>
    </View>
  );
}

const getStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 14,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    zIndex: 10,
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
  },
  title: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 16,
    color: colors.text,
  },
  scrollContent: {
    padding: 20,
    gap: 16,
  },
  bannerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.primary + '40',
  },
  shieldIconBox: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.primary + '18',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerTitle: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 15,
    color: colors.text,
  },
  bannerSub: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  dateTag: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 10,
    color: colors.primary,
    marginTop: 2,
  },
  sectionCard: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 2,
  },
  sectionTitle: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 14,
    color: colors.text,
  },
  bulletItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  bulletText: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 20,
    flex: 1,
  },
  paragraphText: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  supportCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: 4,
  },
  supportTitle: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 13,
    color: colors.text,
  },
  supportEmail: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 12,
    color: colors.primary,
  },
  copyrightText: {
    textAlign: 'center',
    fontFamily: 'Cairo_400Regular',
    fontSize: 12,
    color: colors.textTertiary,
    marginTop: 10,
  },
});
