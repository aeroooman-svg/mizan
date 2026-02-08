import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { useLanguage } from '@/lib/LanguageContext';

export default function SettingsScreen() {
  const { language, setLanguage, t } = useLanguage();

  const handleToggleLanguage = async (lang: 'ar' | 'en') => {
    Haptics.selectionAsync();
    await setLanguage(lang);
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.sheetTitle}>{t.settings}</Text>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="close" size={24} color={Colors.textSecondary} />
        </Pressable>
      </View>

      <View style={styles.content}>
        <View style={styles.section}>
          <Text style={styles.label}>{t.language}</Text>
          <View style={styles.langRow}>
            <Pressable
              onPress={() => handleToggleLanguage('ar')}
              style={[
                styles.langOption,
                language === 'ar' && styles.langOptionActive,
              ]}
            >
              <Text style={[styles.langText, language === 'ar' && styles.langTextActive]}>
                العربية
              </Text>
            </Pressable>
            <Pressable
              onPress={() => handleToggleLanguage('en')}
              style={[
                styles.langOption,
                language === 'en' && styles.langOptionActive,
              ]}
            >
              <Text style={[styles.langText, language === 'en' && styles.langTextActive]}>
                English
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.surface,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 8,
  },
  sheetTitle: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 20,
    color: Colors.text,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  section: {
    marginBottom: 24,
  },
  label: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 10,
  },
  langRow: {
    flexDirection: 'row',
    gap: 10,
  },
  langOption: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 14,
    backgroundColor: Colors.surfaceAlt,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  langOptionActive: {
    backgroundColor: Colors.primary + '12',
    borderColor: Colors.primary,
  },
  langText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 17,
    color: Colors.textSecondary,
  },
  langTextActive: {
    color: Colors.primary,
  },
});
