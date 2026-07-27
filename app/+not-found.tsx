import React, { useMemo } from "react";
import { Link, Stack } from "expo-router";
import { StyleSheet, Text, View, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/lib/ThemeContext";
import { useLanguage } from "@/lib/LanguageContext";

export default function NotFoundScreen() {
  const { colors } = useTheme();
  const { language } = useLanguage();
  const styles = useMemo(() => getStyles(colors), [colors]);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.container}>
        <View style={styles.iconCircle}>
          <Ionicons name="compass-outline" size={56} color={colors.primary} />
        </View>
        <Text style={styles.title}>
          {language === 'ar' ? 'الصفحة غير موجودة' : 'Screen Not Found'}
        </Text>
        <Text style={styles.subtitle}>
          {language === 'ar' 
            ? 'يبدو أن الصفحة التي تبحث عنها غير موجودة أو تم نقلها' 
            : 'The page you are looking for does not exist or was moved'}
        </Text>

        <Link href="/" asChild>
          <Pressable style={({ pressed }) => [styles.button, pressed && { opacity: 0.85 }]}>
            <Ionicons name="home-outline" size={20} color="#FFF" />
            <Text style={styles.buttonText}>
              {language === 'ar' ? 'العودة للشاشة الرئيسية' : 'Return to Home'}
            </Text>
          </Pressable>
        </Link>
      </View>
    </>
  );
}

const getStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: colors.background,
  },
  iconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.primary + '18',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: colors.primary + '30',
  },
  title: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 22,
    color: colors.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 28,
    maxWidth: 280,
    lineHeight: 22,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 14,
  },
  buttonText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 15,
    color: '#FFFFFF',
  },
});
