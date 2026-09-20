import React from 'react';
import { View, Text, TextInput, Pressable, Modal, Keyboard } from 'react-native';
import Colors from '@/constants/colors';
import { formatCurrency } from '@/lib/categories';

interface AdjustPlanModalProps {
  visible: boolean;
  onClose: () => void;
  adjustIncome: string;
  setAdjustIncome: (v: string) => void;
  adjustExpense: string;
  setAdjustExpense: (v: string) => void;
  onSave: () => void;
  currency: string;
  isAr: boolean;
  loc: (ar: string, en: string, ml?: string) => string;
}

export const AdjustPlanModal: React.FC<AdjustPlanModalProps> = ({
  visible,
  onClose,
  adjustIncome,
  setAdjustIncome,
  adjustExpense,
  setAdjustExpense,
  onSave,
  currency,
  isAr,
  loc,
}) => {
  const inc = parseFloat(adjustIncome) || 0;
  const exp = parseFloat(adjustExpense) || 0;
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
          style={{ width: '100%', maxWidth: 400, backgroundColor: Colors.surface, borderRadius: 24, padding: 20, borderWidth: 1, borderColor: Colors.border, gap: 16 }}
          onPress={(e) => e.stopPropagation()}
        >
          <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 16, color: '#FFF', textAlign: 'center' }}>
            {loc('تعديل الميزانية لتلائم الواقع', 'Adjust Plan to Fit Reality', 'പ്ലാൻ യാഥാർത്ഥ്യവുമായി ക്രമീകരിക്കുക')}
          </Text>
          
          <Text style={{ fontFamily: 'Cairo_400Regular', fontSize: 11, color: Colors.textSecondary, textAlign: 'center', lineHeight: 16 }}>
            {loc(
              'تم حساب المتوسطات التاريخية لمصاريفك ودخلك. يمكنك تعديل القيم الآن لتشمل الرواتب الإضافية أو استبعاد المصاريف الاستثنائية.',
              'Historical averages calculated. You can modify the values below to include bonuses or exclude one-off expenses.',
              'ചരിത്രപരമായ ശരാശരികൾ കണക്കാക്കി. വരും മാസങ്ങളിലേക്കായി തുകകൾ മാറ്റാവുന്നതാണ്.'
            )}
          </Text>

          {/* Monthly Income Input */}
          <View style={{ gap: 6 }}>
            <Text style={{ fontFamily: 'Cairo_600SemiBold', fontSize: 12, color: Colors.textSecondary, textAlign: 'left' }}>
              {loc('الدخل الشهري المتوقع', 'Expected Monthly Income', 'പ്രതീക്ഷിത പ്രതിമാസ വരുമാനം')}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surfaceAlt, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 12 }}>
              <TextInput
                style={{ flex: 1, height: 44, color: '#FFF', fontFamily: 'Cairo_700Bold', fontSize: 16, textAlign: isAr ? 'right' : 'left' }}
                keyboardType="decimal-pad"
                value={adjustIncome}
                onChangeText={setAdjustIncome}
              />
              <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 12, color: Colors.primary, marginLeft: 8 }}>{currency}</Text>
            </View>
          </View>

          {/* Monthly Expense Input */}
          <View style={{ gap: 6 }}>
            <Text style={{ fontFamily: 'Cairo_600SemiBold', fontSize: 12, color: Colors.textSecondary, textAlign: 'left' }}>
              {loc('المصاريف الشهرية المتوقعة', 'Expected Monthly Expenses', 'പ്രതീക്ഷിത പ്രതിമാസ ചെലവുകൾ')}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surfaceAlt, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 12 }}>
              <TextInput
                style={{ flex: 1, height: 44, color: '#FFF', fontFamily: 'Cairo_700Bold', fontSize: 16, textAlign: isAr ? 'right' : 'left' }}
                keyboardType="decimal-pad"
                value={adjustExpense}
                onChangeText={setAdjustExpense}
              />
              <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 12, color: Colors.primary, marginLeft: 8 }}>{currency}</Text>
            </View>
          </View>

          {/* Projected Monthly Savings Output */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: Colors.surfaceAlt, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: Colors.border }}>
            <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 12, color: Colors.textSecondary }}>
              {loc('الصافي الادخاري الجديد', 'New Projected Savings', 'പുതിയ പ്രതീക്ഷിക്കുന്ന സമ്പാദ്യം')}
            </Text>
            <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 14, color: net >= 0 ? Colors.primary : Colors.expense }}>
              {formatCurrency(net)} {currency}
            </Text>
          </View>

          {/* Action Buttons */}
          <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
            <Pressable
              onPress={onSave}
              style={{ flex: 1, height: 44, borderRadius: 12, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center' }}
            >
              <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 13, color: '#FFF' }}>
                {loc('تحديث الخطة', 'Update Plan', 'പ്ലാൻ അപ്ഡേറ്റ് ചെയ്യുക')}
              </Text>
            </Pressable>
            <Pressable
              onPress={onClose}
              style={{ flex: 1, height: 44, borderRadius: 12, backgroundColor: Colors.surfaceAlt, borderWidth: 1, borderColor: Colors.border, justifyContent: 'center', alignItems: 'center' }}
            >
              <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 13, color: Colors.textSecondary }}>
                {loc('إلغاء', 'Cancel', 'റദ്ദാക്കുക')}
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
};
