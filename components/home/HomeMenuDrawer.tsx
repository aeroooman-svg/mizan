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
  onOpenMonthlyReport?: () => void;
  onOpenConverterModal: () => void;
}

export default function HomeMenuDrawer({
  visible,
  onClose,
  language,
  colors,
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
            contentContainerStyle={{ gap: 8, paddingBottom: 16 }}
            showsVerticalScrollIndicator={false}
          >
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
          </ScrollView>

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
