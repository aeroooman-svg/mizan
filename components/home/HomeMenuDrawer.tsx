import React from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  ScrollView,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Colors from '@/constants/colors';
import getHomeStyles from './homeStyles';

interface HomeMenuDrawerProps {
  visible: boolean;
  onClose: () => void;
  language: string;
  colors: any;
  onOpenMonthlyReport: () => void;
  onOpenConverterModal: () => void;
}

export default function HomeMenuDrawer({
  visible,
  onClose,
  language,
  colors,
  onOpenMonthlyReport,
  onOpenConverterModal,
}: HomeMenuDrawerProps) {
  const router = useRouter();
  const styles = getHomeStyles(colors);

  const isAr = language === 'ar';
  const isMl = language === 'ml' || language === 'hi';
  const loc = (ar: string, en: string, ml?: string) => {
    if (isMl) return ml || en;
    if (isAr) return ar;
    return en;
  };

  const navigateTo = (path: string) => {
    onClose();
    router.push(path as any);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={[styles.drawerOverlay, { flexDirection: language === 'ar' ? 'row' : 'row-reverse' }]}>
        <Pressable
          style={styles.drawerBackdrop}
          onPress={onClose}
        />
        <View style={[styles.drawerSheet, { borderLeftWidth: language === 'ar' ? 1 : 0, borderRightWidth: language === 'ar' ? 0 : 1 }]}>
          <View style={styles.drawerHeader}>
            <View
              style={{
                width: 84,
                height: 84,
                borderRadius: 22,
                overflow: 'hidden',
                marginBottom: 10,
                backgroundColor: '#0A1D30',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 6,
                borderWidth: 1.5,
                borderColor: 'rgba(16, 185, 129, 0.3)',
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3,
                shadowRadius: 8,
                elevation: 6,
              }}
            >
              <Image
                source={require('../../assets/images/splash-icon.png')}
                style={{ width: '100%', height: '100%' }}
                resizeMode="contain"
              />
            </View>
            <Text style={styles.drawerAppName}>MIZAN</Text>
            <Text style={[styles.drawerVersion, { color: '#14B8A6', fontFamily: 'Cairo_600SemiBold' }]}>مِيزان</Text>
            <Text style={styles.drawerVersion}>v1.0.0</Text>
          </View>

          <View style={styles.drawerDivider} />

          <ScrollView
            style={{ flex: 1, marginVertical: 8 }}
            contentContainerStyle={{ gap: 8, paddingBottom: 24 }}
            showsVerticalScrollIndicator={true}
          >
            {/* Open Banking Integration */}
            <Pressable
              style={({ pressed }) => [styles.drawerLinkBtn, pressed && { backgroundColor: Colors.border }]}
              onPress={() => navigateTo('/bank-connect')}
            >
              <Ionicons name="business-outline" size={22} color="#10B981" />
              <Text style={[styles.drawerLinkText, { color: '#10B981', fontFamily: 'Cairo_700Bold' }]}>
                {loc('🏦 الربط البنكي المباشر (Open Banking)', '🏦 Bank Connect (Open Banking)', '🏦 ബാങ്ക് കണക്ട് (ഓപ്പൺ ബാങ്കിംഗ്)')}
              </Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [styles.drawerLinkBtn, pressed && { backgroundColor: Colors.border }]}
              onPress={() => navigateTo('/challenges')}
            >
              <Ionicons name="trophy-outline" size={22} color={Colors.primary} />
              <Text style={styles.drawerLinkText}>
                {loc('تحديات الادخار والأوسمة', 'Challenges & Badges', 'സമ്പാദ്യ വെല്ലുവിളികളും ബാഡ്ജുകളും')}
              </Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [styles.drawerLinkBtn, pressed && { backgroundColor: Colors.border }]}
              onPress={() => navigateTo('/recurring-list')}
            >
              <Ionicons name="calendar-outline" size={22} color={Colors.primary} />
              <Text style={styles.drawerLinkText}>
                {loc('المصاريف والفواتير المتكررة', 'Recurring Subscriptions', 'തുടർ ചെലവുകളും സബ്‌സ്‌ക്രിപ്ഷനുകളും')}
              </Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [styles.drawerLinkBtn, pressed && { backgroundColor: Colors.border }]}
              onPress={() => navigateTo('/(tabs)/financial-plan')}
            >
              <Ionicons name="flag-outline" size={22} color={Colors.primary} />
              <Text style={styles.drawerLinkText}>
                {loc('الخطة المالية الذكية', 'Smart Financial Plan', 'സ്മാർട്ട് സാമ്പത്തിക പ്ലാൻ')}
              </Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [styles.drawerLinkBtn, pressed && { backgroundColor: Colors.border }]}
              onPress={() => navigateTo('/debts')}
            >
              <Ionicons name="people-outline" size={22} color={Colors.primary} />
              <Text style={styles.drawerLinkText}>
                {loc('الديون والسلف الشخصية', 'Personal Debts & Loans', 'വ്യക്തിഗത കടങ്ങളും വായ്പകളും')}
              </Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [styles.drawerLinkBtn, pressed && { backgroundColor: Colors.border }]}
              onPress={() => navigateTo('/jameya')}
            >
              <Ionicons name="people-circle-outline" size={22} color={Colors.primary} />
              <Text style={styles.drawerLinkText}>
                {loc('الجمعيات والالتزامات', 'Savings Associations (ROSCA)', 'ചിട്ടി സമ്പാദ്യങ്ങളും ബാധ്യതകളും')}
              </Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [styles.drawerLinkBtn, pressed && { backgroundColor: Colors.border }]}
              onPress={() => navigateTo('/savings-goals')}
            >
              <Ionicons name="heart-outline" size={22} color={Colors.primary} />
              <Text style={styles.drawerLinkText}>
                {loc('أهداف الادخار وحصالة الفكة', 'Savings & Piggy Goals', 'സമ്പാദ്യ ലക്ഷ്യങ്ങളും കുടുക്കയും')}
              </Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [styles.drawerLinkBtn, pressed && { backgroundColor: Colors.border }]}
              onPress={() => navigateTo('/ai-advisor')}
            >
              <Ionicons name="sparkles-outline" size={22} color={Colors.primary} />
              <Text style={styles.drawerLinkText}>
                {loc('مستشار الذكاء الاصطناعي', 'AI Financial Advisor', 'AI സാമ്പത്തിക ഉപദേശകൻ')}
              </Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [styles.drawerLinkBtn, pressed && { backgroundColor: Colors.border }]}
              onPress={() => navigateTo('/zakat-calculator')}
            >
              <Ionicons name="calculator-outline" size={22} color={Colors.primary} />
              <Text style={styles.drawerLinkText}>
                {loc('حساب الزكاة والصدقات', 'Zakat & Charity Calculator', 'സക്കാത്ത് & ദാനധർമ്മ കാൽക്കുലേറ്റർ')}
              </Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [styles.drawerLinkBtn, pressed && { backgroundColor: Colors.border }]}
              onPress={() => navigateTo('/join-wallet')}
            >
              <Ionicons name="link-outline" size={22} color={Colors.primary} />
              <Text style={styles.drawerLinkText}>
                {loc('الانضمام لمحفظة مشتركة كود', 'Join Shared Wallet with Code', 'കോഡ് വഴി ഷെയേർഡ് വാലറ്റിൽ ചേരുക')}
              </Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [styles.drawerLinkBtn, pressed && { backgroundColor: Colors.border }]}
              onPress={() => {
                onClose();
                onOpenConverterModal();
              }}
            >
              <Ionicons name="repeat-outline" size={22} color={Colors.primary} />
              <Text style={styles.drawerLinkText}>
                {loc('محول العملات الحي', 'Live Currency Converter', 'തത്സമയ കറൻസി കൺവെർട്ടർ')}
              </Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [styles.drawerLinkBtn, pressed && { backgroundColor: Colors.border }]}
              onPress={() => navigateTo('/widgets-setup')}
            >
              <Ionicons name="hardware-chip-outline" size={22} color={Colors.primary} />
              <Text style={styles.drawerLinkText}>
                {loc('📱 ودجت الشاشة الرئيسية والقفل', '📱 Live Home & Lock Screen Widgets', '📱 ഹോം & ലോക്ക് സ്ക്രീൻ വിജറ്റുകൾ')}
              </Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [styles.drawerLinkBtn, pressed && { backgroundColor: Colors.border }]}
              onPress={() => {
                onClose();
                onOpenMonthlyReport();
              }}
            >
              <Ionicons name="sparkles-outline" size={22} color="#F59E0B" />
              <Text style={[styles.drawerLinkText, { color: colors.text, fontFamily: 'Cairo_700Bold' }]}>
                {loc('📊 التقرير المالي الشهري المقارن', '📊 Monthly Financial Digest', '📊 പ്രതിമാസ സാമ്പത്തിക ഡൈജസ്റ്റ്')}
              </Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [styles.drawerLinkBtn, pressed && { backgroundColor: Colors.border }]}
              onPress={() => navigateTo('/(tabs)/stats')}
            >
              <Ionicons name="analytics-outline" size={22} color={Colors.primary} />
              <Text style={styles.drawerLinkText}>
                {loc('تحليل الميزانية والرسوم', 'Budget Analytics', 'ബജറ്റും ചെലവ് അവലോകനവും')}
              </Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [styles.drawerLinkBtn, pressed && { backgroundColor: Colors.border }]}
              onPress={() => navigateTo('/settings')}
            >
              <Ionicons name="settings-outline" size={22} color={Colors.primary} />
              <Text style={styles.drawerLinkText}>
                {loc('إعدادات التطبيق والأمان', 'Settings & Security', 'ആപ്പ് ക്രമീകരണങ്ങളും സുരക്ഷയും')}
              </Text>
            </Pressable>
          </ScrollView>

          {/* Scroll Indicator Cue Banner */}
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            paddingVertical: 7,
            paddingHorizontal: 14,
            backgroundColor: 'rgba(20, 184, 166, 0.12)',
            borderRadius: 20,
            borderWidth: 1,
            borderColor: 'rgba(20, 184, 166, 0.3)',
            marginBottom: 8,
            alignSelf: 'center',
          }}>
            <Ionicons name="arrow-down-circle-outline" size={16} color="#14B8A6" />
            <Text style={{
              fontFamily: 'Cairo_700Bold',
              fontSize: 11,
              color: '#14B8A6',
            }}>
              {loc('اسحب للأسفل لعرض باقي الأدوات ↓', 'Scroll down for more features ↓', 'കൂടുതൽ ഫീച്ചറുകൾക്കായി താഴേക്ക് സ്ക്രോൾ ചെയ്യുക ↓')}
            </Text>
          </View>

          <Pressable
            style={({ pressed }) => [styles.drawerCloseBtn, pressed && { opacity: 0.8 }]}
            onPress={onClose}
          >
            <Ionicons name="close-circle-outline" size={22} color="#EF4444" />
            <Text style={styles.drawerCloseText}>
              {loc('إغلاق القائمة', 'Close Menu', 'മെനു അടയ്ക്കുക')}
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
