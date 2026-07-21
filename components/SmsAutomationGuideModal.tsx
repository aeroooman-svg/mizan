import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Modal,
  Pressable,
  ScrollView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/lib/ThemeContext';
import { useLanguage } from '@/lib/LanguageContext';
import * as Haptics from 'expo-haptics';

interface SmsAutomationGuideModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function SmsAutomationGuideModal({
  visible,
  onClose,
}: SmsAutomationGuideModalProps) {
  const { colors } = useTheme();
  const { language } = useLanguage();
  const isAr = language === 'ar';

  const [activeTab, setActiveTab] = useState<'ios' | 'android'>(
    Platform.OS === 'ios' ? 'ios' : 'android'
  );

  const handleTabPress = (tab: 'ios' | 'android') => {
    try {
      Haptics.selectionAsync().catch(() => {});
    } catch (e) {}
    setActiveTab(tab);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            {isAr ? '⚡ دليل أتمتة الرسائل البنكية' : '⚡ Bank SMS Automation Guide'}
          </Text>
          <Pressable
            onPress={onClose}
            style={({ pressed }) => [styles.closeButton, pressed && { opacity: 0.6 }]}
          >
            <Ionicons name="close" size={24} color={colors.text} />
          </Pressable>
        </View>

        {/* System Tab Selector */}
        <View style={styles.tabsContainer}>
          <Pressable
            onPress={() => handleTabPress('android')}
            style={[
              styles.tab,
              { backgroundColor: colors.card, borderColor: colors.border },
              activeTab === 'android' && { backgroundColor: colors.primary, borderColor: colors.primary },
            ]}
          >
            <Ionicons
              name="logo-android"
              size={18}
              color={activeTab === 'android' ? '#FFF' : colors.text}
            />
            <Text
              style={[
                styles.tabText,
                { color: colors.text },
                activeTab === 'android' && { color: '#FFF', fontWeight: '700' },
              ]}
            >
              Android
            </Text>
          </Pressable>

          <Pressable
            onPress={() => handleTabPress('ios')}
            style={[
              styles.tab,
              { backgroundColor: colors.card, borderColor: colors.border },
              activeTab === 'ios' && { backgroundColor: colors.primary, borderColor: colors.primary },
            ]}
          >
            <Ionicons
              name="logo-apple"
              size={18}
              color={activeTab === 'ios' ? '#FFF' : colors.text}
            />
            <Text
              style={[
                styles.tabText,
                { color: colors.text },
                activeTab === 'ios' && { color: '#FFF', fontWeight: '700' },
              ]}
            >
              iPhone (iOS)
            </Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          {activeTab === 'android' ? (
            <View style={styles.section}>
              <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.stepHeader}>
                  <View style={[styles.stepBadge, { backgroundColor: colors.primary }]}>
                    <Text style={styles.stepNumber}>1</Text>
                  </View>
                  <Text style={[styles.stepTitle, { color: colors.text }]}>
                    {isAr ? 'تفعيل ميزة الالتقاط التلقائي' : 'Enable Auto-Detection'}
                  </Text>
                </View>
                <Text style={[styles.stepDescription, { color: colors.subtext }]}>
                  {isAr
                    ? 'من شاشة إعدادات التطبيق، قم بتشغيل "أتمتة الرسائل البنكية" و"التسجيل التلقائي".'
                    : 'From App Settings, enable "Bank SMS Automation" and "Auto-Save Mode".'}
                </Text>
              </View>

              <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.stepHeader}>
                  <View style={[styles.stepBadge, { backgroundColor: colors.primary }]}>
                    <Text style={styles.stepNumber}>2</Text>
                  </View>
                  <Text style={[styles.stepTitle, { color: colors.text }]}>
                    {isAr ? 'نسخ الرسالة أو فتح الإشعار' : 'Copy SMS or Open Notification'}
                  </Text>
                </View>
                <Text style={[styles.stepDescription, { color: colors.subtext }]}>
                  {isAr
                    ? 'عند وصول أي رسالة من البنك (CIB, الأهلي, الراجحي, فودافون كاش, إلخ) بمجرد فتح التطبيق سيتم التقاطها وتسجيلها في محفظتك تلقائياً!'
                    : 'When receiving any bank SMS, as soon as you open the app, it will read and record the transaction automatically!'}
                </Text>
              </View>
            </View>
          ) : (
            <View style={styles.section}>
              <View style={[styles.infoBanner, { backgroundColor: colors.primary + '15', borderColor: colors.primary }]}>
                <Ionicons name="sparkles" size={20} color={colors.primary} />
                <Text style={[styles.infoBannerText, { color: colors.text }]}>
                  {isAr
                    ? 'على آيفون، يتيح لك تطبيق الاختصارات (iOS Shortcuts) ربط الرسائل البنكية لتعمل بلمسة واحدة بدون تدخُّل!'
                    : 'On iPhone, iOS Shortcuts app lets you automate bank SMS with 1 tap!'}
                </Text>
              </View>

              <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.stepHeader}>
                  <View style={[styles.stepBadge, { backgroundColor: colors.primary }]}>
                    <Text style={styles.stepNumber}>1</Text>
                  </View>
                  <Text style={[styles.stepTitle, { color: colors.text }]}>
                    {isAr ? 'افتح تطبيق الاختصارات (Shortcuts)' : 'Open Shortcuts App'}
                  </Text>
                </View>
                <Text style={[styles.stepDescription, { color: colors.subtext }]}>
                  {isAr
                    ? 'اختر تبويب "التلقائيات" (Automations) من الأسفل، ثم انقر على (+) إنشاء تحكم آلي شخصي.'
                    : 'Select "Automations" tab at the bottom, then click (+) Create Personal Automation.'}
                </Text>
              </View>

              <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.stepHeader}>
                  <View style={[styles.stepBadge, { backgroundColor: colors.primary }]}>
                    <Text style={styles.stepNumber}>2</Text>
                  </View>
                  <Text style={[styles.stepTitle, { color: colors.text }]}>
                    {isAr ? 'اختر مشغل "الرسائل" (Message)' : 'Choose "Message" Trigger'}
                  </Text>
                </View>
                <Text style={[styles.stepDescription, { color: colors.subtext }]}>
                  {isAr
                    ? 'في خانة "تحتوي على" (Contains)، اكتب اسم البنك أو كلمات مثل: EGP أو SAR أو CIB أو شراء.'
                    : 'In "Message Contains", type bank name or keywords like: EGP, SAR, CIB, Purchase.'}
                </Text>
              </View>

              <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.stepHeader}>
                  <View style={[styles.stepBadge, { backgroundColor: colors.primary }]}>
                    <Text style={styles.stepNumber}>3</Text>
                  </View>
                  <Text style={[styles.stepTitle, { color: colors.text }]}>
                    {isAr ? 'أضف إجراء "نسخ إلى الحافظة"' : 'Add Action "Copy to Clipboard"'}
                  </Text>
                </View>
                <Text style={[styles.stepDescription, { color: colors.subtext }]}>
                  {isAr
                    ? 'اجعل الإجراء ينسخ محتوى الرسالة، ثم اختر إيقاف "السؤال قبل التشغيل".'
                    : 'Set the action to copy message content to clipboard, and turn off "Ask Before Running".'}
                </Text>
              </View>
            </View>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 54 : 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  closeButton: {
    padding: 4,
  },
  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 12,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    gap: 8,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  section: {
    gap: 14,
    paddingTop: 8,
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    gap: 12,
  },
  infoBannerText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  card: {
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
  },
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 10,
  },
  stepBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepNumber: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '800',
  },
  stepTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  stepDescription: {
    fontSize: 13,
    lineHeight: 20,
  },
});
