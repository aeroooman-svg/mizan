import React from 'react';
import { View, Text, TextInput, Pressable, Modal, Keyboard } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { formatCurrency } from '@/lib/categories';

interface KakeiboBudgetModalProps {
  visible: boolean;
  onClose: () => void;
  survivalInput: string;
  setSurvivalInput: (v: string) => void;
  wantsInput: string;
  setWantsInput: (v: string) => void;
  cultureInput: string;
  setCultureInput: (v: string) => void;
  extraInput: string;
  setExtraInput: (v: string) => void;
  onAutoDistribute: () => void;
  onSave: () => void;
  currency: string;
  colors: any;
  isAr: boolean;
  loc: (ar: string, en: string, ml?: string) => string;
}

export const KakeiboBudgetModal: React.FC<KakeiboBudgetModalProps> = ({
  visible,
  onClose,
  survivalInput,
  setSurvivalInput,
  wantsInput,
  setWantsInput,
  cultureInput,
  setCultureInput,
  extraInput,
  setExtraInput,
  onAutoDistribute,
  onSave,
  currency,
  colors,
  isAr,
  loc,
}) => {
  const totalVal =
    (parseFloat(survivalInput) || 0) +
    (parseFloat(wantsInput) || 0) +
    (parseFloat(cultureInput) || 0) +
    (parseFloat(extraInput) || 0);

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
          style={{ width: '100%', maxWidth: 400, backgroundColor: colors.surface, borderRadius: 24, padding: 20, borderWidth: 1, borderColor: colors.border, gap: 16 }}
          onPress={(e) => e.stopPropagation()}
        >
          <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 16, color: '#FFF', textAlign: 'center' }}>
            {loc('ضبط ميزانية الأعمدة الأربعة (Kakeibo)', 'Adjust Kakeibo Pillar Budgets', 'കാകെയ്ബോ സ്തംഭ ബജറ്റ് ക്രമീകരിക്കുക')}
          </Text>
          
          <Text style={{ fontFamily: 'Cairo_400Regular', fontSize: 11, color: colors.textSecondary, textAlign: 'center', lineHeight: 16 }}>
            {loc(
              'قسّم مصروفك الشهري المستهدف على التصنيفات الأربعة لتتبع التزامك بكفاءة.',
              'Divide your total target expenses among the 4 pillars to track your mindfulness.',
              'നിങ്ങളുടെ പ്രതിമാസ ചെലവ് 4 സ്തംഭങ്ങളിലായി വിഭജിക്കുക.'
            )}
          </Text>

          {/* Auto 50/25/15/10 Smart Allocation Button */}
          <Pressable
            onPress={onAutoDistribute}
            style={({ pressed }) => [{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              backgroundColor: colors.primary + '18',
              borderWidth: 1,
              borderColor: colors.primary + '40',
              paddingVertical: 10,
              borderRadius: 12,
              opacity: pressed ? 0.8 : 1,
            }]}
          >
            <Ionicons name="sparkles" size={16} color={colors.primary} />
            <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 12, color: colors.primary }}>
              {loc('توزيع ياباني تلقائي (50/25/15/10)', 'Auto Japanese Allocation (50/25/15/10)', 'ഓട്ടോ ജാപ്പനീസ് വിഭജനം (50/25/15/10)')}
            </Text>
          </Pressable>

          {/* Survival Input */}
          <View style={{ gap: 6 }}>
            <Text style={{ fontFamily: 'Cairo_600SemiBold', fontSize: 12, color: colors.textSecondary, textAlign: 'left' }}>
              {loc('الاحتياجات الأساسية (Survival)', 'Survival / Needs', 'അടിസ്ഥാന ആവശ്യങ്ങൾ (Survival)')}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surfaceAlt, borderRadius: 12, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12 }}>
              <TextInput
                style={{ flex: 1, height: 44, color: '#FFF', fontFamily: 'Cairo_700Bold', fontSize: 16, textAlign: isAr ? 'right' : 'left' }}
                keyboardType="decimal-pad"
                value={survivalInput}
                onChangeText={setSurvivalInput}
              />
              <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 12, color: colors.primary, marginLeft: 8 }}>{currency}</Text>
            </View>
          </View>

          {/* Wants Input */}
          <View style={{ gap: 6 }}>
            <Text style={{ fontFamily: 'Cairo_600SemiBold', fontSize: 12, color: colors.textSecondary, textAlign: 'left' }}>
              {loc('الرغبات الترفيهية (Wants)', 'Wants / Optional', 'വിനോദവും ആഗ്രഹങ്ങളും (Wants)')}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surfaceAlt, borderRadius: 12, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12 }}>
              <TextInput
                style={{ flex: 1, height: 44, color: '#FFF', fontFamily: 'Cairo_700Bold', fontSize: 16, textAlign: isAr ? 'right' : 'left' }}
                keyboardType="decimal-pad"
                value={wantsInput}
                onChangeText={setWantsInput}
              />
              <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 12, color: colors.primary, marginLeft: 8 }}>{currency}</Text>
            </View>
          </View>

          {/* Culture Input */}
          <View style={{ gap: 6 }}>
            <Text style={{ fontFamily: 'Cairo_600SemiBold', fontSize: 12, color: colors.textSecondary, textAlign: 'left' }}>
              {loc('الثقافة والتعليم (Culture)', 'Culture & Self-dev', 'സംസ്കാരവും വിദ്യാഭ്യാസവും (Culture)')}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surfaceAlt, borderRadius: 12, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12 }}>
              <TextInput
                style={{ flex: 1, height: 44, color: '#FFF', fontFamily: 'Cairo_700Bold', fontSize: 16, textAlign: isAr ? 'right' : 'left' }}
                keyboardType="decimal-pad"
                value={cultureInput}
                onChangeText={setCultureInput}
              />
              <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 12, color: colors.primary, marginLeft: 8 }}>{currency}</Text>
            </View>
          </View>

          {/* Extra Input */}
          <View style={{ gap: 6 }}>
            <Text style={{ fontFamily: 'Cairo_600SemiBold', fontSize: 12, color: colors.textSecondary, textAlign: 'left' }}>
              {loc('مصاريف إضافية وطارئة (Extra)', 'Extra / Unplanned', 'അപ്രതീക്ഷിത ചെലവുകൾ (Extra)')}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surfaceAlt, borderRadius: 12, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12 }}>
              <TextInput
                style={{ flex: 1, height: 44, color: '#FFF', fontFamily: 'Cairo_700Bold', fontSize: 16, textAlign: isAr ? 'right' : 'left' }}
                keyboardType="decimal-pad"
                value={extraInput}
                onChangeText={setExtraInput}
              />
              <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 12, color: colors.primary, marginLeft: 8 }}>{currency}</Text>
            </View>
          </View>

          {/* Total Check */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: colors.surfaceAlt, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.border }}>
            <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 12, color: colors.textSecondary }}>
              {loc('إجمالي الميزانية الجديدة', 'New Total Expenses', 'ആകെ പുതിയ ചെലവ്')}
            </Text>
            <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 14, color: colors.primary }}>
              {formatCurrency(totalVal)} {currency}
            </Text>
          </View>

          {/* Action Buttons */}
          <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
            <Pressable
              onPress={onSave}
              style={{ flex: 1, height: 44, borderRadius: 12, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center' }}
            >
              <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 13, color: '#FFF' }}>
                {loc('تحديث الميزانية', 'Save Budgets', 'ബജറ്റ് സേവ് ചെയ്യുക')}
              </Text>
            </Pressable>
            <Pressable
              onPress={onClose}
              style={{ flex: 1, height: 44, borderRadius: 12, backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border, justifyContent: 'center', alignItems: 'center' }}
            >
              <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 13, color: colors.textSecondary }}>
                {loc('إلغاء', 'Cancel', 'റദ്ദാക്കുക')}
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
};
