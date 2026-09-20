import React from 'react';
import { View, Text, TextInput, Pressable, Modal, Keyboard } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Colors from '@/constants/colors';
import { formatCurrency } from '@/lib/categories';

interface SingleMonthTargetModalProps {
  visible: boolean;
  onClose: () => void;
  monthName: string;
  monthKey: string;
  incomeInput: string;
  setIncomeInput: (v: string) => void;
  expenseInput: string;
  setExpenseInput: (v: string) => void;
  onSave: () => void;
  onReset: () => void;
  hasOverride: boolean;
  currencySymbol: string;
  isAr: boolean;
  loc: (ar: string, en: string, ml?: string) => string;
}

export const SingleMonthTargetModal: React.FC<SingleMonthTargetModalProps> = ({
  visible,
  onClose,
  monthName,
  incomeInput,
  setIncomeInput,
  expenseInput,
  setExpenseInput,
  onSave,
  onReset,
  hasOverride,
  currencySymbol,
  isAr,
  loc,
}) => {
  const inc = parseFloat(incomeInput) || 0;
  const exp = parseFloat(expenseInput) || 0;
  const net = inc - exp;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable 
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 }}
        onPress={Keyboard.dismiss}
      >
        <Pressable 
          style={{ width: '100%', maxWidth: 420, backgroundColor: Colors.surface, borderRadius: 24, padding: 20, borderWidth: 1, borderColor: Colors.border, gap: 16 }}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderColor: Colors.border, paddingBottom: 10 }}>
            <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 16, color: '#FFF' }}>
              {loc(`تخصيص استهداف شهر (${monthName})`, `Custom Target for (${monthName})`, `${monthName} മാസത്തെ പ്രത്യേക ലക്ഷ്യം`)}
            </Text>
            <Pressable onPress={onClose} hitSlop={10}>
              <Ionicons name="close" size={22} color={Colors.textSecondary} />
            </Pressable>
          </View>

          <Text style={{ fontFamily: 'Cairo_400Regular', fontSize: 12, color: Colors.textSecondary, lineHeight: 18, textAlign: 'left' }}>
            {loc(
              'يمكنك تعديل الدخل والمصاريف المتوقعة لهذا الشهر المحدد فقط (مثل مصاريف المدارس أو المكافآت) دون تغيير باقي أشهر الخطة.',
              'Customize expected income and expenses for this specific month only.',
              'മറ്റ് മാസങ്ങളെ ബാധിക്കാതെ ഈ മാസത്തെ വരുമാനവും ചെലവും മാറ്റുക.'
            )}
          </Text>

          {/* Monthly Income Input */}
          <View style={{ gap: 6 }}>
            <Text style={{ fontFamily: 'Cairo_600SemiBold', fontSize: 12, color: Colors.textSecondary, textAlign: 'left' }}>
              {loc(`الدخل المستهدف لشهر (${monthName}):`, 'Target Income:', 'ലക്ഷ്യ വരുമാനം:')}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surfaceAlt, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 12 }}>
              <TextInput
                style={{ flex: 1, height: 44, color: '#FFF', fontFamily: 'Cairo_700Bold', fontSize: 16, textAlign: isAr ? 'right' : 'left' }}
                keyboardType="decimal-pad"
                value={incomeInput}
                onChangeText={setIncomeInput}
              />
              <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 12, color: Colors.primary, marginLeft: 8 }}>{currencySymbol}</Text>
            </View>
          </View>

          {/* Monthly Expense Input */}
          <View style={{ gap: 6 }}>
            <Text style={{ fontFamily: 'Cairo_600SemiBold', fontSize: 12, color: Colors.textSecondary, textAlign: 'left' }}>
              {loc(`المصاريف المستهدفة لشهر (${monthName}):`, 'Target Expenses:', 'ലക്ഷ്യ ചെലവ്:')}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surfaceAlt, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 12 }}>
              <TextInput
                style={{ flex: 1, height: 44, color: '#FFF', fontFamily: 'Cairo_700Bold', fontSize: 16, textAlign: isAr ? 'right' : 'left' }}
                keyboardType="decimal-pad"
                value={expenseInput}
                onChangeText={setExpenseInput}
              />
              <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 12, color: Colors.primary, marginLeft: 8 }}>{currencySymbol}</Text>
            </View>
          </View>

          {/* Net Result Preview */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: Colors.surfaceAlt, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: Colors.border }}>
            <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 12, color: Colors.textSecondary }}>
              {loc('الادخار الصافي المتوقع لهذا الشهر:', 'Projected Savings:', 'പ്രതീക്ഷിക്കുന്ന അറ്റ സമ്പാദ്യം:')}
            </Text>
            <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 14, color: net >= 0 ? Colors.primary : Colors.expense }}>
              {formatCurrency(net)} {currencySymbol}
            </Text>
          </View>

          {/* Action Buttons */}
          <View style={{ gap: 8, marginTop: 4 }}>
            <Pressable
              onPress={onSave}
              style={({ pressed }) => [
                { height: 46, borderRadius: 14, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center', flexDirection: 'row', gap: 6 },
                pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] }
              ]}
            >
              <Ionicons name="checkmark-circle" size={18} color="#FFF" />
              <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 14, color: '#FFF' }}>
                {loc(`حفظ استهداف ${monthName} 🎯`, 'Save Month Target 🎯', 'മാസ ലക്ഷ്യം സേവ് ചെയ്യുക 🎯')}
              </Text>
            </Pressable>

            {hasOverride && (
              <Pressable
                onPress={onReset}
                style={({ pressed }) => [
                  { height: 40, borderRadius: 12, backgroundColor: Colors.surfaceAlt, borderWidth: 1, borderColor: Colors.border, justifyContent: 'center', alignItems: 'center' },
                  pressed && { opacity: 0.8 }
                ]}
              >
                <Text style={{ fontFamily: 'Cairo_600SemiBold', fontSize: 12, color: Colors.expense }}>
                  {loc('إعادة للاستهداف العام 🔄', 'Reset to Global Target 🔄', 'സാധാരണ ലക്ഷ്യത്തിലേക്ക് പുനഃക്രമീകരിക്കുക 🔄')}
                </Text>
              </Pressable>
            )}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
};
