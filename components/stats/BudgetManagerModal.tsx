import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
  Modal,
  TextInput,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Category, formatCurrency } from '@/lib/categories';
import { getCategoryName } from '@/lib/i18n';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface BudgetManagerModalProps {
  visible: boolean;
  onClose: () => void;
  allExpenseCategories: Category[];
  budgets: Record<string, number>;
  currencySymbol: string;
  language: string;
  colors: any;
  t: any;
  onSaveBudget: (category: Category, limit: number) => Promise<void>;
}

export const BudgetManagerModal: React.FC<BudgetManagerModalProps> = ({
  visible,
  onClose,
  allExpenseCategories,
  budgets,
  currencySymbol,
  language,
  colors,
  t,
  onSaveBudget,
}) => {
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [activeCategory, setActiveCategory] = useState<Category | null>(null);
  const [limitInput, setLimitInput] = useState('');

  const handleOpenEdit = (cat: Category) => {
    Haptics.selectionAsync();
    const currentLimit = budgets[cat.id] || 0;
    setActiveCategory(cat);
    setLimitInput(currentLimit > 0 ? currentLimit.toString() : '');
    setEditModalVisible(true);
  };

  const handleSave = async () => {
    if (!activeCategory) return;
    const limit = parseFloat(limitInput) || 0;
    await onSaveBudget(activeCategory, limit);
    setEditModalVisible(false);
    setActiveCategory(null);
  };

  return (
    <>
      {/* Manage Budgets Modal */}
      <Modal visible={visible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <SafeAreaView style={[styles.modalSheet, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <Pressable onPress={onClose} hitSlop={12} style={styles.closeBtn}>
                <Ionicons name="close" size={24} color={colors.text} />
              </Pressable>
              <Text style={[styles.modalTitle, { color: colors.text }]}>{t.setBudget}</Text>
              <View style={{ width: 40 }} />
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.budgetsList}>
              {allExpenseCategories.map((cat) => {
                const limit = budgets[cat.id] || 0;
                return (
                  <Pressable
                    key={cat.id}
                    onPress={() => handleOpenEdit(cat)}
                    style={({ pressed }) => [
                      styles.budgetListItem,
                      { backgroundColor: colors.surfaceAlt, borderColor: colors.border },
                      pressed && { opacity: 0.8 },
                    ]}
                  >
                    <View style={[styles.catIcon, { backgroundColor: cat.color + '18' }]}>
                      <MaterialIcons name={cat.icon as any} size={20} color={cat.color} />
                    </View>
                    <Text style={[styles.budgetCatName, { color: colors.text }]}>
                      {getCategoryName(cat.id, language as any)}
                    </Text>
                    <View style={styles.budgetLimitValueContainer}>
                      <Text style={[styles.budgetLimitValue, { color: limit > 0 ? colors.text : colors.textTertiary }]}>
                        {limit > 0 ? `${formatCurrency(limit)} ${currencySymbol}` : t.noBudget}
                      </Text>
                      <MaterialIcons
                        name={language === 'ar' ? 'chevron-left' : 'chevron-right'}
                        size={20}
                        color={colors.textTertiary}
                      />
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
          </SafeAreaView>
        </View>
      </Modal>

      {/* Edit Single Budget Sub-Modal */}
      <Modal visible={editModalVisible} animationType="fade" transparent>
        <View style={styles.modalOverlayCenter}>
          <View style={[styles.editBudgetCard, { backgroundColor: colors.surface }]}>
            <Text style={[styles.editBudgetTitle, { color: colors.text }]}>
              {activeCategory ? getCategoryName(activeCategory.id, language as any) : ''}
            </Text>
            <Text style={[styles.editBudgetSubtitle, { color: colors.textSecondary }]}>
              {t.budgetLimit} ({currencySymbol})
            </Text>

            <TextInput
              style={[styles.budgetInput, { backgroundColor: colors.surfaceAlt, color: colors.text }]}
              keyboardType="decimal-pad"
              placeholder="0.00"
              placeholderTextColor={colors.textTertiary}
              value={limitInput}
              onChangeText={setLimitInput}
              autoFocus
              textAlign="center"
            />

            <View style={styles.modalActionRow}>
              <Pressable
                onPress={() => setEditModalVisible(false)}
                style={[styles.modalActionBtn, { backgroundColor: colors.surfaceAlt }]}
              >
                <Text style={[styles.modalActionCancelText, { color: colors.textSecondary }]}>
                  {t.cancel}
                </Text>
              </Pressable>
              <Pressable
                onPress={handleSave}
                style={[
                  styles.modalActionBtn,
                  { backgroundColor: activeCategory?.color || colors.primary },
                ]}
              >
                <Text style={styles.modalActionSaveText}>{t.save}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
    paddingBottom: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  closeBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 17,
  },
  budgetsList: {
    padding: 20,
    gap: 10,
  },
  budgetListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    gap: 12,
  },
  catIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  budgetCatName: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 14,
    flex: 1,
  },
  budgetLimitValueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  budgetLimitValue: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 13,
  },
  modalOverlayCenter: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  editBudgetCard: {
    borderRadius: 20,
    padding: 24,
    width: SCREEN_WIDTH * 0.85,
    maxWidth: 320,
    alignItems: 'center',
    gap: 12,
  },
  editBudgetTitle: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 18,
  },
  editBudgetSubtitle: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 13,
  },
  budgetInput: {
    width: '100%',
    borderRadius: 12,
    paddingVertical: 14,
    fontSize: 24,
    fontFamily: 'Cairo_700Bold',
    textAlign: 'center',
  },
  modalActionRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  modalActionBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  modalActionCancelText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 14,
  },
  modalActionSaveText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 14,
    color: '#FFF',
  },
});
