import React from 'react';
import { View, Text, TextInput, Pressable, Modal, Keyboard, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
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
  const sVal = parseFloat(survivalInput) || 0;
  const wVal = parseFloat(wantsInput) || 0;
  const cVal = parseFloat(cultureInput) || 0;
  const eVal = parseFloat(extraInput) || 0;
  const totalVal = sVal + wVal + cVal + eVal;

  const envelopes = [
    {
      id: 'survival',
      kanji: '生活',
      title: loc('نبض الحياة (الأساسيات 50%)', 'Survival / Needs (50%)', 'അടിസ്ഥാനം (50%)'),
      desc: loc('الطعام، الفواتير، الإيجار، الصحة', 'Food, utilities, rent, healthcare', 'ഭക്ഷണം, വീട്ടുചെലവ്'),
      val: survivalInput,
      setVal: setSurvivalInput,
      color: '#10B981',
      pct: totalVal > 0 ? Math.round((sVal / totalVal) * 100) : 50,
    },
    {
      id: 'wants',
      kanji: '希望',
      title: loc('بهجة النفس (الرغبات 25%)', 'Wants / Joys (25%)', 'ആഗ്രഹങ്ങൾ (25%)'),
      desc: loc('المقاهي، الترفيه، التسوق المبهج', 'Dining out, hobbies, shopping', 'വിനോദം, ഷോപ്പിംഗ്'),
      val: wantsInput,
      setVal: setWantsInput,
      color: '#F43F5E',
      pct: totalVal > 0 ? Math.round((wVal / totalVal) * 100) : 25,
    },
    {
      id: 'culture',
      kanji: '教養',
      title: loc('غذاء العقل (الثقافة 15%)', 'Culture & Mind (15%)', 'സംസ്കാരം (15%)'),
      desc: loc('الكتب، الدورات وتطوير الذات', 'Books, learning, workshops', 'വിദ്യാഭ്യാസം, പുസ്തകങ്ങൾ'),
      val: cultureInput,
      setVal: setCultureInput,
      color: '#6366F1',
      pct: totalVal > 0 ? Math.round((cVal / totalVal) * 100) : 15,
    },
    {
      id: 'extra',
      kanji: '特別',
      title: loc('أمان الطوارئ (المفاجآت 10%)', 'Extra & Buffer (10%)', 'അപ്രതീക്ഷിതം (10%)'),
      desc: loc('المناسبات، الهدايا والإصلاحات', 'Repairs, unexpected gifts, cushion', 'അടിയന്തര ഫണ്ട്'),
      val: extraInput,
      setVal: setExtraInput,
      color: '#F59E0B',
      pct: totalVal > 0 ? Math.round((eVal / totalVal) * 100) : 10,
    },
  ];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.7)',
          justifyContent: 'center',
          alignItems: 'center',
          padding: 20,
        }}
        onPress={Keyboard.dismiss}
      >
        <Pressable
          style={{
            width: '100%',
            maxWidth: 420,
            maxHeight: '90%',
            backgroundColor: colors.surface,
            borderRadius: 26,
            padding: 20,
            borderWidth: 1,
            borderColor: colors.border,
            gap: 14,
          }}
          onPress={(e) => e.stopPropagation()}
        >
          {/* Header with Zen Motif */}
          <View style={{ alignItems: 'center', gap: 4 }}>
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 14,
                backgroundColor: '#8B5CF620',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 2,
              }}
            >
              <Text style={{ fontSize: 22 }}>🎎</Text>
            </View>
            <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 16, color: colors.text, textAlign: 'center' }}>
              {loc('توزيع أظرف الكاكيبو الأربعة (家計簿)', 'Kakeibo Envelope Allocation', 'കാകെയ്ബോ കവർ ബജറ്റ്')}
            </Text>
            <Text
              style={{
                fontFamily: 'Cairo_400Regular',
                fontSize: 11,
                color: colors.textSecondary,
                textAlign: 'center',
                lineHeight: 16,
              }}
            >
              {loc(
                'قسّم مصاريفك الشهرية وفق التناغم الياباني الحكيم (50% حياة / 25% بهجة / 15% فكر / 10% طوارئ)',
                'Distribute your monthly expenses based on the mindful Japanese harmony ratio.',
                'നിങ്ങളുടെ പ്രതിമാസ ചെലവ് 4 സ്തംഭങ്ങളിലായി വിഭജിക്കുക.'
              )}
            </Text>
          </View>

          {/* Auto Smart Distribution Button */}
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              onAutoDistribute();
            }}
            style={({ pressed }) => [
              {
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                backgroundColor: '#8B5CF618',
                borderWidth: 1.5,
                borderColor: '#8B5CF640',
                paddingVertical: 10,
                borderRadius: 14,
              },
              pressed && { opacity: 0.8 },
            ]}
          >
            <Ionicons name="sparkles" size={16} color="#A78BFA" />
            <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 12, color: '#A78BFA' }}>
              {loc('توزيع التناغم الذهبي التلقائي (50/25/15/10) ✨', 'Apply Golden Harmony Ratio ✨', 'ഓട്ടോ ജാപ്പനീസ് വിഭജനം ✨')}
            </Text>
          </Pressable>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
            {envelopes.map((env) => (
              <View
                key={env.id}
                style={{
                  backgroundColor: colors.surfaceAlt,
                  borderRadius: 16,
                  padding: 12,
                  borderWidth: 1,
                  borderColor: colors.borderLight,
                  gap: 8,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <View
                      style={{
                        backgroundColor: env.color + '22',
                        paddingHorizontal: 6,
                        paddingVertical: 2,
                        borderRadius: 6,
                      }}
                    >
                      <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 10, color: env.color }}>
                        {env.kanji}
                      </Text>
                    </View>
                    <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 12, color: colors.text }}>
                      {env.title}
                    </Text>
                  </View>
                  <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 11, color: env.color }}>
                    {env.pct}%
                  </Text>
                </View>

                <Text style={{ fontFamily: 'Cairo_400Regular', fontSize: 9, color: colors.textSecondary, textAlign: isAr ? 'right' : 'left' }}>
                  {env.desc}
                </Text>

                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: colors.surface,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: colors.border,
                    paddingHorizontal: 12,
                    height: 42,
                  }}
                >
                  <TextInput
                    style={{
                      flex: 1,
                      color: colors.text,
                      fontFamily: 'Cairo_700Bold',
                      fontSize: 15,
                      textAlign: isAr ? 'right' : 'left',
                    }}
                    keyboardType="decimal-pad"
                    value={env.val}
                    onChangeText={env.setVal}
                    placeholder="0"
                    placeholderTextColor={colors.textSecondary}
                  />
                  <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 11, color: colors.textSecondary, marginLeft: 8 }}>
                    {currency}
                  </Text>
                </View>
              </View>
            ))}
          </ScrollView>

          {/* Total Sum Footprint */}
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              backgroundColor: colors.surfaceAlt,
              padding: 12,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="pie-chart-outline" size={16} color={colors.primary} />
              <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 12, color: colors.textSecondary }}>
                {loc('إجمالي أظرف الميزانية:', 'Total Envelopes Sum:', 'ആകെ പുതിയ ചെലവ്:')}
              </Text>
            </View>
            <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 14, color: colors.primary }}>
              {formatCurrency(totalVal)} {currency}
            </Text>
          </View>

          {/* Modal Actions */}
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Pressable
              onPress={() => {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                onSave();
              }}
              style={({ pressed }) => [
                {
                  flex: 1,
                  height: 44,
                  borderRadius: 14,
                  backgroundColor: '#8B5CF6',
                  justifyContent: 'center',
                  alignItems: 'center',
                  flexDirection: 'row',
                  gap: 6,
                },
                pressed && { opacity: 0.9 },
              ]}
            >
              <Ionicons name="checkmark-done" size={16} color="#FFF" />
              <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 13, color: '#FFF' }}>
                {loc('اعتماد ميزانية الأظرف', 'Seal Envelopes', 'ബജറ്റ് സേവ് ചെയ്യുക')}
              </Text>
            </Pressable>

            <Pressable
              onPress={onClose}
              style={({ pressed }) => [
                {
                  width: 80,
                  height: 44,
                  borderRadius: 14,
                  backgroundColor: colors.surfaceAlt,
                  borderWidth: 1,
                  borderColor: colors.border,
                  justifyContent: 'center',
                  alignItems: 'center',
                },
                pressed && { opacity: 0.8 },
              ]}
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
