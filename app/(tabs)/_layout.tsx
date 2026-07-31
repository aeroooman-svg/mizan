import { Tabs, useRouter } from "expo-router";
import { BlurView } from "expo-blur";
import { Platform, StyleSheet, View, Text, Pressable, Modal } from "react-native";
import { Ionicons, MaterialIcons, MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import Colors from "@/constants/colors";
import { useLanguage } from "@/lib/LanguageContext";
import { useTheme } from "@/lib/ThemeContext";
import { useMemo } from "react";

interface CustomTabBarProps {
  state: any;
  descriptors: any;
  navigation: any;
  onAddPress: () => void;
}

function CustomTabBar({ state, descriptors, navigation, onAddPress }: CustomTabBarProps) {
  const { colors, theme } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const { language } = useLanguage();
  
  const renderTab = (routeIndex: number) => {
    const route = state.routes[routeIndex];
    const isFocused = state.index === routeIndex;

    const onPress = () => {
      const event = navigation.emit({
        type: 'tabPress',
        target: route.key,
        canPreventDefault: true,
      });

      if (!isFocused && !event.defaultPrevented) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        navigation.navigate(route.name);
      }
    };

    let iconName = "";
    let isMaterial = false;
    let label = "";

    if (route.name === "index") {
      iconName = isFocused ? "home" : "home-outline";
      label = language === 'ar' ? "الرئيسية" : "Home";
    } else if (route.name === "transactions") {
      iconName = isFocused ? "list" : "list-outline";
      label = language === 'ar' ? "المعاملات" : "Trans";
    } else if (route.name === "stats") {
      iconName = isFocused ? "pie-chart" : "pie-chart-outline";
      label = language === 'ar' ? "إحصائيات" : "Stats";
    } else if (route.name === "financial-plan") {
      iconName = "flag";
      isMaterial = true;
      label = language === 'ar' ? "الخطة" : "Plan";
    }

    return (
      <Pressable
        key={route.key}
        onPress={onPress}
        style={styles.tabButton}
        accessibilityRole="tab"
        accessibilityLabel={label}
        accessibilityState={{ selected: isFocused }}
      >
        {isMaterial ? (
          <MaterialIcons 
            name={iconName as any} 
            size={22} 
            color={isFocused ? colors.primary : colors.textSecondary} 
          />
        ) : (
          <Ionicons 
            name={iconName as any} 
            size={22} 
            color={isFocused ? colors.primary : colors.textSecondary} 
          />
        )}
        <Text style={[
          styles.tabLabel, 
          { color: isFocused ? colors.primary : colors.textSecondary }
        ]}>
          {label}
        </Text>
      </Pressable>
    );
  };

  return (
    <View style={styles.floatingBarContainer}>
      {Platform.OS === 'ios' ? (
        <BlurView intensity={80} tint={theme === 'light' ? 'light' : 'dark'} style={[StyleSheet.absoluteFill, { borderRadius: 33, overflow: 'hidden' }]} />
      ) : (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.surface + 'EE', borderRadius: 33, overflow: 'hidden' }]} />
      )}
      
      <View style={styles.tabBarInner}>
        {renderTab(0)}
        {renderTab(1)}
        
        {/* Center Glowing Action Button with Balance Scale Emblem */}
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            onAddPress();
          }}
          style={({ pressed }) => [
            styles.centerFab,
            pressed && { transform: [{ scale: 0.92 }] }
          ]}
          accessibilityRole="button"
          accessibilityLabel={language === 'ar' ? 'إضافة معاملة جديدة' : 'Add new transaction'}
        >
          <LinearGradient
            colors={[colors.primary, colors.primaryDark]}
            style={styles.centerFabGradient}
          >
            <MaterialCommunityIcons name="scale-balance" size={26} color="#fff" />
          </LinearGradient>
        </Pressable>

        {renderTab(2)}
        {renderTab(3)}
      </View>
    </View>
  );
}

export default function TabLayout() {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const { language } = useLanguage();
  const router = useRouter();
  const [isActionMenuOpen, setIsActionMenuOpen] = useState(false);

  return (
    <View style={{ flex: 1 }}>
      <Tabs
        tabBar={(props) => (
          <CustomTabBar 
            {...props} 
            onAddPress={() => setIsActionMenuOpen(true)} 
          />
        )}
        screenOptions={{
          headerShown: false,
        }}
      >
        <Tabs.Screen name="index" />
        <Tabs.Screen name="transactions" />
        <Tabs.Screen name="stats" />
        <Tabs.Screen name="financial-plan" />
      </Tabs>

      {/* Premium Glassmorphic Bottom Action Menu Modal */}
      <Modal
        visible={isActionMenuOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setIsActionMenuOpen(false)}
      >
        <Pressable 
          style={styles.modalOverlay} 
          onPress={() => setIsActionMenuOpen(false)}
        >
          <View style={styles.actionMenuSheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.actionMenuTitle}>
              {language === 'ar' ? 'إجراءات سريعة' : 'Quick Actions'}
            </Text>
            
            <View style={styles.actionMenuOptions}>
              <Pressable
                style={({ pressed }) => [styles.actionOptionBtn, pressed && { opacity: 0.8 }]}
                onPress={() => {
                  setIsActionMenuOpen(false);
                  router.push('/add-transaction');
                }}
                accessibilityRole="button"
                accessibilityLabel={language === 'ar' ? 'إضافة معاملة جديدة' : 'Add New Transaction'}
              >
                <View style={[styles.actionIconWrap, { backgroundColor: colors.incomeLight }]}>
                  <Ionicons name="cash-outline" size={24} color={colors.primary} />
                </View>
                <View style={styles.actionOptionInfo}>
                  <Text style={styles.actionOptionName}>
                    {language === 'ar' ? 'إضافة معاملة جديدة' : 'Add New Transaction'}
                  </Text>
                  <Text style={styles.actionOptionDesc}>
                    {language === 'ar' ? 'سجل مصروفاتك أو مداخيلك اليومية فوراً' : 'Log your daily income or expenses instantly'}
                  </Text>
                </View>
                <Ionicons name={language === 'ar' ? "chevron-back" : "chevron-forward"} size={18} color={colors.textTertiary} />
              </Pressable>

              <Pressable
                style={({ pressed }) => [styles.actionOptionBtn, pressed && { opacity: 0.8 }]}
                onPress={() => {
                  setIsActionMenuOpen(false);
                  router.push('/scan-receipt');
                }}
                accessibilityRole="button"
                accessibilityLabel={language === 'ar' ? 'مسح فاتورة بالكاميرا' : 'Scan Receipt'}
              >
                <View style={[styles.actionIconWrap, { backgroundColor: '#8B5CF620' }]}>
                  <Ionicons name="camera-outline" size={24} color="#8B5CF6" />
                </View>
                <View style={styles.actionOptionInfo}>
                  <Text style={styles.actionOptionName}>
                    {language === 'ar' ? 'مسح فاتورة بالكاميرا' : 'Scan Receipt'}
                  </Text>
                  <Text style={styles.actionOptionDesc}>
                    {language === 'ar' ? 'التقط صورة للفاتورة واستخرج البيانات تلقائياً' : 'Scan a paper receipt to log expenses automatically'}
                  </Text>
                </View>
                <Ionicons name={language === 'ar' ? "chevron-back" : "chevron-forward"} size={18} color={colors.textTertiary} />
              </Pressable>

              <Pressable
                style={({ pressed }) => [styles.actionOptionBtn, pressed && { opacity: 0.8 }]}
                onPress={() => {
                  setIsActionMenuOpen(false);
                  router.push('/add-wallet');
                }}
                accessibilityRole="button"
                accessibilityLabel={language === 'ar' ? 'إنشاء محفظة جديدة' : 'Create New Wallet'}
              >
                <View style={[styles.actionIconWrap, { backgroundColor: 'rgba(59, 130, 246, 0.15)' }]}>
                  <Ionicons name="wallet-outline" size={24} color="#3B82F6" />
                </View>
                <View style={styles.actionOptionInfo}>
                  <Text style={styles.actionOptionName}>
                    {language === 'ar' ? 'إنشاء محفظة جديدة' : 'Create New Wallet'}
                  </Text>
                  <Text style={styles.actionOptionDesc}>
                    {language === 'ar' ? 'أضف بطاقة أو محفظة كاش جديدة لتتبعها' : 'Add a new bank card or cash wallet'}
                  </Text>
                </View>
                <Ionicons name={language === 'ar' ? "chevron-back" : "chevron-forward"} size={18} color={colors.textTertiary} />
              </Pressable>
            </View>

            <Pressable
              style={({ pressed }) => [styles.actionMenuCloseBtn, pressed && { opacity: 0.8 }]}
              onPress={() => setIsActionMenuOpen(false)}
            >
              <Text style={styles.actionMenuCloseText}>
                {language === 'ar' ? 'إغلاق' : 'Close'}
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const getStyles = (colors: any) => StyleSheet.create({
  floatingBarContainer: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 28 : 18,
    left: 16,
    right: 16,
    height: 66,
    borderRadius: 33,
    borderWidth: 1.5,
    borderColor: colors.cardBorder || 'rgba(255, 255, 255, 0.08)',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
  },
  tabBarInner: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    paddingVertical: 8,
  },
  tabLabel: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 11,
    marginTop: 2,
  },
  centerFab: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginTop: -30,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.6,
    shadowRadius: 16,
    elevation: 12,
  },
  centerFabGradient: {
    flex: 1,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.45)',
  },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  actionMenuSheet: {
    width: '100%',
    backgroundColor: colors.surface,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    padding: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    elevation: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.3,
    shadowRadius: 15,
  },
  sheetHandle: {
    width: 40,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: colors.borderLight,
    alignSelf: 'center',
    marginBottom: 20,
  },
  actionMenuTitle: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 18,
    color: colors.text,
    textAlign: 'center',
    marginBottom: 20,
  },
  actionMenuOptions: {
    gap: 12,
    marginBottom: 20,
  },
  actionOptionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    borderRadius: 16,
    padding: 14,
    gap: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  actionIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionOptionInfo: {
    flex: 1,
    gap: 2,
  },
  actionOptionName: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 14,
    color: colors.text,
    textAlign: 'left',
  },
  actionOptionDesc: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 10,
    color: colors.textSecondary,
    textAlign: 'left',
    lineHeight: 14,
  },
  actionMenuCloseBtn: {
    backgroundColor: '#EF444415',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionMenuCloseText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 14,
    color: '#EF4444',
  },
});
