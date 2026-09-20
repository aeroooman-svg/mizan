import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  SafeAreaView,
  Pressable,
  ScrollView,
  TextInput,
  Alert,
} from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { WALLET_COLORS, EXPANDED_ICON_LIBRARY } from '@/lib/categories';
import getAddTransactionStyles from './addTransactionStyles';

interface CustomCategoryModalProps {
  visible: boolean;
  onClose: () => void;
  editingCategory: any;
  onSave: (nameAr: string, nameEn: string, icon: string, color: string) => void;
  onDelete?: () => void;
  language: string;
  colors: any;
  insetsBottom: number;
  t: any;
}

export default function CustomCategoryModal({
  visible,
  onClose,
  editingCategory,
  onSave,
  onDelete,
  language,
  colors,
  insetsBottom,
  t,
}: CustomCategoryModalProps) {
  const styles = getAddTransactionStyles(colors);
  const [customNameAr, setCustomNameAr] = useState('');
  const [customNameEn, setCustomNameEn] = useState('');
  const [customColor, setCustomColor] = useState(WALLET_COLORS[0]);
  const [customIcon, setCustomIcon] = useState(EXPANDED_ICON_LIBRARY[0] || 'star');

  useEffect(() => {
    if (editingCategory) {
      setCustomNameAr(editingCategory.nameAr || editingCategory.name || '');
      setCustomNameEn(editingCategory.nameEn || editingCategory.name || '');
      setCustomColor(editingCategory.color || WALLET_COLORS[0]);
      setCustomIcon(editingCategory.icon || EXPANDED_ICON_LIBRARY[0]);
    } else {
      setCustomNameAr('');
      setCustomNameEn('');
      setCustomColor(WALLET_COLORS[0]);
      setCustomIcon(EXPANDED_ICON_LIBRARY[0]);
    }
  }, [editingCategory, visible]);

  const handleSave = () => {
    const ar = customNameAr.trim();
    let en = customNameEn.trim();
    if (!ar && !en) {
      Alert.alert(
        language === 'ar' ? 'تنبيه' : 'Alert',
        language === 'ar' ? 'يرجى كتابة اسم الفئة' : 'Please enter category name'
      );
      return;
    }
    if (!en) en = ar;
    const finalAr = ar || en;
    onSave(finalAr, en, customIcon, customColor);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <SafeAreaView style={styles.customCatSheet}>
          <View style={styles.calcHeader}>
            <Pressable onPress={onClose} hitSlop={12} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color={Colors.text} />
            </Pressable>
            <Text style={styles.calcTitle}>
              {editingCategory ? (language === 'ar' ? 'تعديل الفئة' : 'Edit Category') : t.newCategory}
            </Text>
            <Pressable onPress={handleSave} hitSlop={12} style={styles.calcConfirmBtn}>
              <Ionicons name="checkmark" size={22} color={Colors.primary} />
            </Pressable>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.customCatBody}
            keyboardShouldPersistTaps="handled"
          >
            {/* Inputs */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>{t.categoryNameAr}</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="مثال: اشتراكات، قهوة، صيانة..."
                placeholderTextColor={Colors.textTertiary}
                value={customNameAr}
                onChangeText={setCustomNameAr}
                textAlign={language === 'ar' ? 'right' : 'left'}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>{t.categoryNameEn}</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="e.g. Subscriptions, Coffee, Care..."
                placeholderTextColor={Colors.textTertiary}
                value={customNameEn}
                onChangeText={setCustomNameEn}
                textAlign="left"
              />
            </View>

            {/* Color Grid Selector */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>{t.selectColor}</Text>
              <View style={styles.colorsGrid}>
                {WALLET_COLORS.map(c => {
                  const isSelected = customColor === c;
                  return (
                    <Pressable
                      key={c}
                      onPress={() => {
                        Haptics.selectionAsync();
                        setCustomColor(c);
                      }}
                      style={[
                        styles.colorCircle,
                        { backgroundColor: c },
                        isSelected && { borderColor: '#FFFFFF', borderWidth: 2.5, transform: [{ scale: 1.12 }] },
                      ]}
                    >
                      {isSelected && <Ionicons name="checkmark" size={18} color="#FFFFFF" />}
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* Expanded Icon Grid Selector */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>{t.selectIcon}</Text>
              <View style={styles.iconsGrid}>
                {EXPANDED_ICON_LIBRARY.map(ic => {
                  const isSelected = customIcon === ic;
                  return (
                    <Pressable
                      key={ic}
                      onPress={() => {
                        Haptics.selectionAsync();
                        setCustomIcon(ic);
                      }}
                      style={[
                        styles.iconBox,
                        isSelected && { borderColor: customColor, borderWidth: 2, backgroundColor: customColor + '20' },
                      ]}
                    >
                      <MaterialIcons
                        name={ic as any}
                        size={22}
                        color={isSelected ? customColor : Colors.textSecondary}
                      />
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </ScrollView>

          {/* Pinned Bottom Footer Save & Delete Buttons */}
          <View
            style={[
              styles.modalFooter,
              { flexDirection: 'row', gap: 10, paddingBottom: Math.max(insetsBottom, 16) + 8 },
            ]}
          >
            {editingCategory && onDelete && (
              <Pressable
                onPress={onDelete}
                style={({ pressed }) => [
                  styles.modalSaveBtn,
                  { flex: 1, backgroundColor: '#EF4444' },
                  pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
                ]}
              >
                <Ionicons name="trash-outline" size={18} color="#FFFFFF" style={{ marginRight: 4 }} />
                <Text style={styles.modalSaveText}>
                  {language === 'ar' ? 'حذف الفئة' : 'Delete'}
                </Text>
              </Pressable>
            )}

            <Pressable
              onPress={handleSave}
              style={({ pressed }) => [
                styles.modalSaveBtn,
                { flex: 2, backgroundColor: customColor || Colors.primary },
                pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
              ]}
            >
              <Ionicons name="checkmark-circle-outline" size={20} color="#FFFFFF" style={{ marginRight: 6 }} />
              <Text style={styles.modalSaveText}>
                {editingCategory
                  ? (language === 'ar' ? 'حفظ التعديلات' : 'Save Changes')
                  : (language === 'ar' ? 'حفظ وإنشاء الفئة' : 'Save & Create Category')}
              </Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}
