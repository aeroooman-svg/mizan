import React, { useState, useEffect, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
  TextInput,
  Switch,
  Modal,
  Alert,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useTheme } from '@/lib/ThemeContext';
import { useLanguage } from '@/lib/LanguageContext';
import { useTransactions } from '@/lib/TransactionContext';
import { expenseCategories, incomeCategories, formatCurrency } from '@/lib/categories';
import { getCategoryName } from '@/lib/i18n';
import {
  AutoRule,
  getAutoRules,
  saveAutoRule,
  deleteAutoRule,
  toggleAutoRule,
  matchTransactionAgainstRules,
} from '@/lib/autoRulesStorage';
import { getAllTags, Tag } from '@/lib/tagStorage';
import ConfirmModal from '@/components/ConfirmModal';

export default function AutoRulesScreen() {
  const { colors } = useTheme();
  const { language } = useLanguage();
  const insets = useSafeAreaInsets();
  const isAr = language === 'ar';
  const { customCategories, currencySymbol } = useTransactions();

  const [rules, setRules] = useState<AutoRule[]>([]);
  const [allAvailableTags, setAllAvailableTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);

  // Edit / Create Modal State
  const [modalVisible, setModalVisible] = useState(false);
  const [editingRule, setEditingRule] = useState<AutoRule | null>(null);
  const [ruleName, setRuleName] = useState('');
  const [ruleKeywords, setRuleKeywords] = useState('');
  const [ruleType, setRuleType] = useState<'expense' | 'income' | 'all'>('expense');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [minAmount, setMinAmount] = useState('');
  const [ruleNote, setRuleNote] = useState('');

  // Delete modal state
  const [ruleToDelete, setRuleToDelete] = useState<AutoRule | null>(null);

  // Simulator / Test State
  const [testText, setTestText] = useState('');
  const [testResult, setTestResult] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const [r, t] = await Promise.all([getAutoRules(), getAllTags()]);
      setRules(r);
      setAllAvailableTags(t);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const allCategories = useMemo(() => {
    const staticCats = ruleType === 'income' ? incomeCategories : expenseCategories;
    const userCats = customCategories.filter(c => ruleType === 'all' || c.type === ruleType);
    const combined = ruleType === 'all' ? [...expenseCategories, ...incomeCategories] : staticCats;
    return [...combined, ...userCats];
  }, [ruleType, customCategories]);

  const handleToggle = async (rule: AutoRule) => {
    Haptics.selectionAsync();
    const nextState = !rule.isActive;
    await toggleAutoRule(rule.id, nextState);
    setRules(prev => prev.map(r => (r.id === rule.id ? { ...r, isActive: nextState } : r)));
  };

  const openNewRule = () => {
    Haptics.selectionAsync();
    setEditingRule(null);
    setRuleName('');
    setRuleKeywords('');
    setRuleType('expense');
    setSelectedCategory('');
    setSelectedTagIds([]);
    setMinAmount('');
    setRuleNote('');
    setModalVisible(true);
  };

  const openEditRule = (rule: AutoRule) => {
    Haptics.selectionAsync();
    setEditingRule(rule);
    setRuleName(rule.name);
    setRuleKeywords(rule.keyword);
    setRuleType(rule.type || 'expense');
    setSelectedCategory(rule.assignCategory || '');
    setSelectedTagIds(rule.assignTags || []);
    setMinAmount(rule.minAmount ? rule.minAmount.toString() : '');
    setRuleNote(rule.appendNote || '');
    setModalVisible(true);
  };

  const handleSaveRule = async () => {
    if (!ruleName.trim() || !ruleKeywords.trim()) {
      Alert.alert(
        isAr ? 'تنبيه' : 'Alert',
        isAr ? 'يرجى كتابة اسم القاعدة والكلمات المفتاحية' : 'Please enter rule name and keywords'
      );
      return;
    }

    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await saveAutoRule({
        id: editingRule?.id,
        name: ruleName.trim(),
        keyword: ruleKeywords.trim(),
        type: ruleType,
        assignCategory: selectedCategory || undefined,
        assignTags: selectedTagIds.length > 0 ? selectedTagIds : undefined,
        minAmount: minAmount ? parseFloat(minAmount) : undefined,
        appendNote: ruleNote.trim() || undefined,
        isActive: editingRule ? editingRule.isActive : true,
      });

      setModalVisible(false);
      await loadData();
    } catch (e) {
      console.error('Error saving rule:', e);
    }
  };

  const handleDeleteRule = async () => {
    if (!ruleToDelete) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    await deleteAutoRule(ruleToDelete.id);
    setRuleToDelete(null);
    await loadData();
  };

  const handleRunTest = () => {
    if (!testText.trim()) {
      setTestResult(null);
      return;
    }
    const match = matchTransactionAgainstRules(testText, 100, 'expense', rules);
    if (match) {
      const catName = match.category ? getCategoryName(match.category, language) : isAr ? 'بدون' : 'None';
      const tagsStr = (match.tags || []).join(', ') || (isAr ? 'بدون' : 'None');
      setTestResult(
        isAr
          ? `✅ تطابقت مع [${match.matchedRule.name}]\nالفئة: ${catName}\nالوسوم: ${tagsStr}`
          : `✅ Matched [${match.matchedRule.name}]\nCategory: ${catName}\nTags: ${tagsStr}`
      );
    } else {
      setTestResult(isAr ? '❌ لا توجد قاعدة مطابقة لهذا النص' : '❌ No matching rule found');
    }
  };

  const styles = useMemo(() => getStyles(colors), [colors]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.backBtn}>
          <Ionicons name={isAr ? 'chevron-forward' : 'chevron-back'} size={24} color={colors.text} />
        </Pressable>
        <View style={{ flex: 1, alignItems: isAr ? 'flex-end' : 'flex-start' }}>
          <Text style={styles.title}>{isAr ? 'القواعد التلقائية الذكية' : 'Smart Auto Rules'}</Text>
          <Text style={styles.subTitle}>
            {isAr
              ? 'تصنيف تلقائي للمعاملات وتطبيق الوسوم حسب الكلمات المفتاحية'
              : 'Auto-categorize transactions & apply tags based on keywords'}
          </Text>
        </View>
        <Pressable onPress={openNewRule} style={styles.addHeaderBtn}>
          <Ionicons name="add" size={22} color="#000" />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Simulator Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="flash" size={18} color="#F59E0B" />
            <Text style={styles.cardTitle}>{isAr ? 'مختبر تجربة القواعد' : 'Rule Simulator'}</Text>
          </View>
          <View style={styles.testInputRow}>
            <TextInput
              style={styles.testInput}
              placeholder={isAr ? 'اكتب نصاً لتجربته (مثال: قهوة من ستاربكس أو بنزين ساسكو)' : 'Type text to test...'}
              placeholderTextColor={colors.textTertiary}
              value={testText}
              onChangeText={setTestText}
            />
            <Pressable onPress={handleRunTest} style={styles.testBtn}>
              <Text style={styles.testBtnText}>{isAr ? 'فحص' : 'Test'}</Text>
            </Pressable>
          </View>
          {testResult && (
            <View style={styles.testResultBox}>
              <Text style={styles.testResultText}>{testResult}</Text>
            </View>
          )}
        </View>

        {/* Rules List */}
        <View style={styles.listHeader}>
          <Text style={styles.sectionTitle}>
            {isAr ? `القواعد المفعلة (${rules.length})` : `Active Rules (${rules.length})`}
          </Text>
        </View>

        {rules.map((rule) => {
          const categoryObj = allCategories.find(c => c.id === rule.assignCategory);
          return (
            <View
              key={rule.id}
              style={[
                styles.ruleCard,
                !rule.isActive && { opacity: 0.6, borderColor: colors.border },
              ]}
            >
              <View style={styles.ruleTopRow}>
                <View style={styles.ruleTitleBlock}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={styles.ruleName}>{rule.name}</Text>
                    {rule.isSystem && (
                      <View style={styles.systemBadge}>
                        <Text style={styles.systemBadgeText}>{isAr ? 'نظامي' : 'Preset'}</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.keywordText}>
                    {isAr ? 'الكلمات:' : 'Keywords:'} {rule.keyword}
                  </Text>
                </View>
                <Switch
                  value={rule.isActive}
                  onValueChange={() => handleToggle(rule)}
                  trackColor={{ false: colors.border, true: colors.primary }}
                  thumbColor="#FFF"
                />
              </View>

              <View style={styles.ruleActionsRow}>
                {categoryObj && (
                  <View style={styles.tagBadge}>
                    <Ionicons name="folder-outline" size={13} color={categoryObj.color || colors.primary} />
                    <Text style={[styles.tagBadgeText, { color: categoryObj.color || colors.primary }]}>
                      {getCategoryName(categoryObj.id, language)}
                    </Text>
                  </View>
                )}

                {rule.assignTags && rule.assignTags.map(tagId => {
                  const tagObj = allAvailableTags.find(t => t.id === tagId);
                  return (
                    <View key={tagId} style={styles.tagBadge}>
                      <Ionicons name="pricetag-outline" size={13} color={tagObj?.color || colors.accent} />
                      <Text style={[styles.tagBadgeText, { color: tagObj?.color || colors.accent }]}>
                        {tagObj ? (isAr ? tagObj.nameAr : tagObj.nameEn) : tagId}
                      </Text>
                    </View>
                  );
                })}

                <View style={{ flex: 1 }} />

                <Pressable onPress={() => openEditRule(rule)} hitSlop={6} style={styles.iconBtn}>
                  <Ionicons name="pencil" size={16} color={colors.textSecondary} />
                </Pressable>
                <Pressable onPress={() => setRuleToDelete(rule)} hitSlop={6} style={styles.iconBtn}>
                  <Ionicons name="trash-outline" size={16} color="#EF4444" />
                </Pressable>
              </View>
            </View>
          );
        })}
      </ScrollView>

      {/* Edit / Create Rule Modal */}
      <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={() => setModalVisible(false)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingRule
                  ? (isAr ? 'تعديل القاعدة التلقائية' : 'Edit Auto Rule')
                  : (isAr ? 'إضافة قاعدة ذكية جديدة' : 'New Smart Rule')}
              </Text>
              <Pressable onPress={() => setModalVisible(false)} hitSlop={10}>
                <Ionicons name="close-circle" size={24} color={colors.textSecondary} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 14 }}>
              {/* Rule Name */}
              <View>
                <Text style={styles.inputLabel}>{isAr ? 'اسم القاعدة' : 'Rule Name'}</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder={isAr ? 'مثال: مشتريات البقالة' : 'e.g. Grocery Purchases'}
                  placeholderTextColor={colors.textTertiary}
                  value={ruleName}
                  onChangeText={setRuleName}
                />
              </View>

              {/* Keywords */}
              <View>
                <Text style={styles.inputLabel}>
                  {isAr ? 'الكلمات المفتاحية (مفصولة بفاصلة)' : 'Keywords (comma-separated)'}
                </Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder={isAr ? 'بنده, لولو, عثيم, كارفور, بقالة' : 'walmart, target, grocery, market'}
                  placeholderTextColor={colors.textTertiary}
                  value={ruleKeywords}
                  onChangeText={setRuleKeywords}
                />
              </View>

              {/* Transaction Type */}
              <View>
                <Text style={styles.inputLabel}>{isAr ? 'نوع المعاملة' : 'Transaction Type'}</Text>
                <View style={styles.typeSelector}>
                  {(['expense', 'income', 'all'] as const).map(t => (
                    <Pressable
                      key={t}
                      onPress={() => {
                        Haptics.selectionAsync();
                        setRuleType(t);
                      }}
                      style={[
                        styles.typeBtn,
                        ruleType === t && { backgroundColor: colors.primary },
                      ]}
                    >
                      <Text
                        style={[
                          styles.typeBtnText,
                          ruleType === t && { color: '#000', fontFamily: 'Cairo_700Bold' },
                        ]}
                      >
                        {t === 'expense' ? (isAr ? 'مصروف' : 'Expense') : t === 'income' ? (isAr ? 'دخل' : 'Income') : (isAr ? 'الكل' : 'All')}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              {/* Auto Category Assign */}
              <View>
                <Text style={styles.inputLabel}>{isAr ? 'تعيين الفئة تلقائياً' : 'Auto Assign Category'}</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                  {allCategories.map(cat => {
                    const isSelected = selectedCategory === cat.id;
                    return (
                      <Pressable
                        key={cat.id}
                        onPress={() => {
                          Haptics.selectionAsync();
                          setSelectedCategory(isSelected ? '' : cat.id);
                        }}
                        style={[
                          styles.catPill,
                          isSelected && { borderColor: cat.color || colors.primary, backgroundColor: (cat.color || colors.primary) + '20' },
                        ]}
                      >
                        <MaterialIcons name={cat.icon as any} size={16} color={cat.color || colors.text} />
                        <Text style={[styles.catPillText, isSelected && { color: cat.color || colors.primary, fontFamily: 'Cairo_700Bold' }]}>
                          {getCategoryName(cat.id, language)}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>

              {/* Auto Tags Assign */}
              <View>
                <Text style={styles.inputLabel}>{isAr ? 'إضافة وسوم تلقائياً' : 'Auto Apply Tags'}</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                  {allAvailableTags.map(tag => {
                    const isSelected = selectedTagIds.includes(tag.id);
                    return (
                      <Pressable
                        key={tag.id}
                        onPress={() => {
                          Haptics.selectionAsync();
                          setSelectedTagIds(prev =>
                            isSelected ? prev.filter(id => id !== tag.id) : [...prev, tag.id]
                          );
                        }}
                        style={[
                          styles.tagPill,
                          isSelected && { backgroundColor: tag.color + '25', borderColor: tag.color },
                        ]}
                      >
                        <Text style={[styles.tagPillText, isSelected && { color: tag.color, fontFamily: 'Cairo_700Bold' }]}>
                          {isAr ? tag.nameAr : tag.nameEn}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              {/* Action Buttons */}
              <Pressable onPress={handleSaveRule} style={styles.saveBtn}>
                <Text style={styles.saveBtnText}>{isAr ? 'حفظ القاعدة' : 'Save Rule'}</Text>
              </Pressable>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Delete Confirm */}
      <ConfirmModal
        visible={!!ruleToDelete}
        title={isAr ? 'حذف القاعدة' : 'Delete Rule'}
        message={isAr ? `هل أنت متأكد من حذف القاعدة "${ruleToDelete?.name}"؟` : `Delete rule "${ruleToDelete?.name}"?`}
        confirmText={isAr ? 'حذف' : 'Delete'}
        cancelText={isAr ? 'إلغاء' : 'Cancel'}
        onConfirm={handleDeleteRule}
        onCancel={() => setRuleToDelete(null)}
      />
    </View>
  );
}

const getStyles = (colors: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
      gap: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    backBtn: {
      padding: 4,
    },
    title: {
      fontFamily: 'Cairo_700Bold',
      fontSize: 18,
      color: colors.text,
    },
    subTitle: {
      fontFamily: 'Cairo_400Regular',
      fontSize: 12,
      color: colors.textSecondary,
    },
    addHeaderBtn: {
      backgroundColor: colors.primary,
      borderRadius: 12,
      padding: 8,
      alignItems: 'center',
      justifyContent: 'center',
    },
    scrollContent: {
      padding: 16,
      gap: 16,
    },
    card: {
      backgroundColor: colors.surfaceAlt,
      borderRadius: 16,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 10,
    },
    cardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    cardTitle: {
      fontFamily: 'Cairo_700Bold',
      fontSize: 14,
      color: colors.text,
    },
    testInputRow: {
      flexDirection: 'row',
      gap: 8,
    },
    testInput: {
      flex: 1,
      backgroundColor: colors.background,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 8,
      color: colors.text,
      fontFamily: 'Cairo_600SemiBold',
      fontSize: 13,
      borderWidth: 1,
      borderColor: colors.border,
    },
    testBtn: {
      backgroundColor: colors.primary,
      borderRadius: 10,
      paddingHorizontal: 14,
      justifyContent: 'center',
      alignItems: 'center',
    },
    testBtnText: {
      fontFamily: 'Cairo_700Bold',
      fontSize: 13,
      color: '#000',
    },
    testResultBox: {
      backgroundColor: colors.background,
      padding: 10,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
    },
    testResultText: {
      fontFamily: 'Cairo_600SemiBold',
      fontSize: 12,
      color: colors.text,
      lineHeight: 18,
    },
    listHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: 4,
    },
    sectionTitle: {
      fontFamily: 'Cairo_700Bold',
      fontSize: 15,
      color: colors.text,
    },
    ruleCard: {
      backgroundColor: colors.surfaceAlt,
      borderRadius: 16,
      padding: 14,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 10,
    },
    ruleTopRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
    },
    ruleTitleBlock: {
      flex: 1,
      gap: 4,
    },
    ruleName: {
      fontFamily: 'Cairo_700Bold',
      fontSize: 15,
      color: colors.text,
    },
    systemBadge: {
      backgroundColor: colors.primary + '20',
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 6,
    },
    systemBadgeText: {
      fontFamily: 'Cairo_600SemiBold',
      fontSize: 10,
      color: colors.primary,
    },
    keywordText: {
      fontFamily: 'Cairo_400Regular',
      fontSize: 12,
      color: colors.textSecondary,
    },
    ruleActionsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      flexWrap: 'wrap',
      paddingTop: 6,
      borderTopWidth: 1,
      borderTopColor: colors.border + '40',
    },
    tagBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: colors.background,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
    },
    tagBadgeText: {
      fontFamily: 'Cairo_600SemiBold',
      fontSize: 11,
    },
    iconBtn: {
      padding: 6,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.65)',
      justifyContent: 'flex-end',
    },
    modalContent: {
      backgroundColor: colors.surfaceAlt,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      padding: 20,
      maxHeight: '90%',
      gap: 14,
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    modalTitle: {
      fontFamily: 'Cairo_700Bold',
      fontSize: 16,
      color: colors.text,
    },
    inputLabel: {
      fontFamily: 'Cairo_600SemiBold',
      fontSize: 13,
      color: colors.textSecondary,
      marginBottom: 6,
    },
    modalInput: {
      backgroundColor: colors.background,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 10,
      color: colors.text,
      fontFamily: 'Cairo_600SemiBold',
      fontSize: 14,
      borderWidth: 1,
      borderColor: colors.border,
    },
    typeSelector: {
      flexDirection: 'row',
      backgroundColor: colors.background,
      borderRadius: 12,
      padding: 4,
      gap: 4,
    },
    typeBtn: {
      flex: 1,
      paddingVertical: 8,
      alignItems: 'center',
      borderRadius: 8,
    },
    typeBtnText: {
      fontFamily: 'Cairo_600SemiBold',
      fontSize: 12,
      color: colors.textSecondary,
    },
    catPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: colors.background,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    catPillText: {
      fontFamily: 'Cairo_600SemiBold',
      fontSize: 12,
      color: colors.text,
    },
    tagPill: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 10,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
    },
    tagPillText: {
      fontFamily: 'Cairo_600SemiBold',
      fontSize: 11,
      color: colors.textSecondary,
    },
    saveBtn: {
      backgroundColor: colors.primary,
      paddingVertical: 14,
      borderRadius: 14,
      alignItems: 'center',
      marginTop: 10,
      marginBottom: 20,
    },
    saveBtnText: {
      fontFamily: 'Cairo_700Bold',
      fontSize: 15,
      color: '#000',
    },
  });
