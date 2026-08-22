import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Modal,
  Pressable,
  Platform,
  ActivityIndicator,
  Animated,
  Easing,
  TextInput,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import * as Crypto from 'expo-crypto';
import { useTheme } from '@/lib/ThemeContext';
import { useLanguage } from '@/lib/LanguageContext';
import { useTransactions } from '@/lib/TransactionContext';
import { getCategoryById, expenseCategories, incomeCategories } from '@/lib/categories';
import { parseTransactionText, ParsedTransaction } from '@/lib/nlpParser';
import { playIncomeSound, playExpenseSound } from '@/lib/sounds';

interface VoiceTransactionModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: (txn: any) => void;
}

export default function VoiceTransactionModal({
  visible,
  onClose,
  onSuccess,
}: VoiceTransactionModalProps) {
  const { colors, theme } = useTheme();
  const styles = useMemo(() => getStyles(colors, theme), [colors, theme]);
  const { language } = useLanguage();
  const isAr = language === 'ar';

  const {
    wallets,
    selectedWallet,
    currencySymbol,
    addTransaction,
    customCategories = [],
  } = useTransactions();

  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [parsedData, setParsedData] = useState<ParsedTransaction | null>(null);
  
  // Interactive editable overrides
  const [selectedType, setSelectedType] = useState<'expense' | 'income' | 'transfer'>('expense');
  const [amountStr, setAmountStr] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('food');
  const [selectedWalletId, setSelectedWalletId] = useState('');
  const [descriptionStr, setDescriptionStr] = useState('');
  
  const [isSaving, setIsSaving] = useState(false);

  // Animation pulses
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const ringAnim = useRef(new Animated.Value(0)).current;
  const recognitionRef = useRef<any>(null);

  // Set default wallet on open
  useEffect(() => {
    if (selectedWallet?.id) {
      setSelectedWalletId(selectedWallet.id);
    } else if (wallets.length > 0) {
      setSelectedWalletId(wallets[0].id);
    }
  }, [selectedWallet, wallets, visible]);

  // Start breathing/pulse animation
  useEffect(() => {
    if (isListening) {
      Animated.loop(
        Animated.parallel([
          Animated.sequence([
            Animated.timing(pulseAnim, {
              toValue: 1.15,
              duration: 800,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }),
            Animated.timing(pulseAnim, {
              toValue: 1,
              duration: 800,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }),
          ]),
          Animated.sequence([
            Animated.timing(ringAnim, {
              toValue: 1,
              duration: 1600,
              easing: Easing.out(Easing.ease),
              useNativeDriver: true,
            }),
            Animated.timing(ringAnim, {
              toValue: 0,
              duration: 0,
              useNativeDriver: true,
            }),
          ]),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
      ringAnim.setValue(0);
    }
  }, [isListening]);

  // Setup Web Speech Recognition with Arabic (Egypt) priority
  const startSpeechRecognition = () => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

      if (SpeechRecognition) {
        try {
          const recognition = new SpeechRecognition();
          // Set to Egyptian Arabic (ar-EG) for best vernacular recognition, or app language
          recognition.lang = isAr ? 'ar-EG' : 'en-US';
          recognition.continuous = false;
          recognition.interimResults = true;

          recognition.onstart = () => {
            setIsListening(true);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          };

          recognition.onresult = (event: any) => {
            const current = event.resultIndex;
            const text = event.results[current][0].transcript;
            setTranscript(text);
            handleTextParse(text);
          };

          recognition.onerror = (event: any) => {
            console.warn('Speech recognition error:', event.error);
            setIsListening(false);
          };

          recognition.onend = () => {
            setIsListening(false);
          };

          recognition.start();
          recognitionRef.current = recognition;
          return;
        } catch (e) {
          console.warn('Could not start web speech:', e);
        }
      }
    }

    // Fallback simulation / native
    setIsListening(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const stopSpeechRecognition = () => {
    setIsListening(false);
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {}
    }
  };

  const handleTextParse = (text: string) => {
    if (!text.trim()) {
      setParsedData(null);
      return;
    }
    const result = parseTransactionText(text, wallets, customCategories);
    setParsedData(result);

    if (result.type) setSelectedType(result.type);
    if (result.amount !== null) setAmountStr(result.amount.toString());
    if (result.category) setSelectedCategory(result.category);
    if (result.description) setDescriptionStr(result.description);
    if (result.walletId) setSelectedWalletId(result.walletId);
  };

  const handleExamplePress = (exampleText: string) => {
    Haptics.selectionAsync();
    setTranscript(exampleText);
    handleTextParse(exampleText);
  };

  const handleSave = async () => {
    const finalAmount = parseFloat(amountStr);
    if (isNaN(finalAmount) || finalAmount <= 0) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }

    setIsSaving(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    try {
      const finalWalletId = selectedWalletId || selectedWallet?.id || wallets[0]?.id;
      const newTxn = {
        id: Crypto.randomUUID(),
        type: selectedType,
        amount: finalAmount,
        category: selectedCategory || (selectedType === 'income' ? 'salary' : 'food'),
        description: descriptionStr || transcript || (isAr ? 'تسجيل صوتي ذكي' : 'Smart Voice Entry'),
        date: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        walletId: finalWalletId,
        toWalletId: parsedData?.toWalletId || undefined,
      };

      await addTransaction(newTxn);

      if (newTxn.type === 'income') {
        playIncomeSound();
      } else {
        playExpenseSound();
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onSuccess?.(newTxn);
      handleClose();
    } catch (e) {
      console.error('Error saving voice transaction:', e);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    stopSpeechRecognition();
    setTranscript('');
    setParsedData(null);
    setAmountStr('');
    setDescriptionStr('');
    onClose();
  };

  const currentCategoryObj = getCategoryById(selectedCategory);
  const categoryName = currentCategoryObj
    ? isAr
      ? currentCategoryObj.nameAr
      : currentCategoryObj.name
    : selectedCategory;

  const currentCategoryIcon = currentCategoryObj?.icon || 'pricetag';
  const currentCategoryColor = currentCategoryObj?.color || '#00E676';

  const displayedCategories = useMemo(() => {
    return selectedType === 'income' ? incomeCategories : expenseCategories;
  }, [selectedType]);

  const ringScale = ringAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 2.2],
  });

  const ringOpacity = ringAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.6, 0],
  });

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <View style={styles.modalOverlay}>
        <BlurView intensity={Platform.OS === 'ios' ? 70 : 100} tint="dark" style={StyleSheet.absoluteFill} />

        <View style={styles.modalSheet}>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
            {/* Header */}
            <View style={styles.sheetHeader}>
              <View style={styles.headerTitleRow}>
                <View style={styles.aiBadge}>
                  <Ionicons name="sparkles" size={14} color="#00E676" />
                  <Text style={styles.aiBadgeText}>AI VOICE</Text>
                </View>
                <Text style={styles.sheetTitle}>
                  {isAr ? 'التسجيل الصوتي الذكي' : 'Smart Voice Entry'}
                </Text>
              </View>
              <Pressable onPress={handleClose} style={styles.closeBtn} hitSlop={15}>
                <Ionicons name="close" size={22} color="#FFF" />
              </Pressable>
            </View>

            <Text style={styles.sheetSubtitle}>
              {isAr
                ? 'تحدث بالعامية المصرية أو بأي لهجة (مثال: "صرفت 50 جنيه غدا كشري") وسيتم التعرف على كل التفاصيل فوراً!'
                : 'Speak naturally in Egyptian dialect or any language and all details will be extracted!'}
            </Text>

            {/* Microphone Central Button & Concentric Animation */}
            <View style={styles.micSection}>
              <View style={styles.micButtonContainer}>
                {isListening && (
                  <Animated.View
                    style={[
                      styles.pulseRing,
                      {
                        transform: [{ scale: ringScale }],
                        opacity: ringOpacity,
                      },
                    ]}
                  />
                )}

                <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                  <Pressable
                    onPress={() => {
                      if (isListening) {
                        stopSpeechRecognition();
                      } else {
                        startSpeechRecognition();
                      }
                    }}
                    style={({ pressed }) => [
                      styles.micButton,
                      isListening && styles.micButtonActive,
                      pressed && { opacity: 0.85 },
                    ]}
                  >
                    <LinearGradient
                      colors={isListening ? ['#EF4444', '#DC2626'] : ['#00E676', '#00B0FF']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.micGradient}
                    >
                      <Ionicons
                        name={isListening ? 'stop' : 'mic'}
                        size={38}
                        color="#FFF"
                      />
                    </LinearGradient>
                  </Pressable>
                </Animated.View>
              </View>

              <Text style={styles.micStatusText}>
                {isListening
                  ? isAr
                    ? '🎙️ جاري الاستماع... تحدث الآن'
                    : '🎙️ Listening... Speak now'
                  : isAr
                  ? 'اضغط على الميكروفون وتحدث بصوتك'
                  : 'Tap microphone to speak'}
              </Text>
            </View>

            {/* Transcript / Input text area */}
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.transcriptInput}
                value={transcript}
                onChangeText={text => {
                  setTranscript(text);
                  handleTextParse(text);
                }}
                placeholder={
                  isAr
                    ? 'مثال: "صرفت 75 جنيه غداء كشري" أو اكتب هنا...'
                    : 'e.g. "Spent 50 on lunch" or type here...'
                }
                placeholderTextColor="rgba(255,255,255,0.4)"
                multiline
                textAlign={isAr ? 'right' : 'left'}
              />
              {transcript.length > 0 && (
                <Pressable
                  onPress={() => {
                    setTranscript('');
                    setParsedData(null);
                    setAmountStr('');
                    setDescriptionStr('');
                  }}
                  style={styles.clearInputBtn}
                >
                  <Ionicons name="close-circle" size={20} color="rgba(255,255,255,0.5)" />
                </Pressable>
              )}
            </View>

            {/* Extracted Interactive Transaction Card */}
            {(parsedData || amountStr) ? (
              <View style={styles.parsedCard}>
                {/* 1. Transaction Type Selector Tabs */}
                <View style={styles.typeSelectorRow}>
                  <Pressable
                    onPress={() => {
                      Haptics.selectionAsync();
                      setSelectedType('expense');
                      if (selectedCategory === 'salary' || selectedCategory === 'freelance') {
                        setSelectedCategory('food');
                      }
                    }}
                    style={[
                      styles.typeTab,
                      selectedType === 'expense' && styles.typeTabActiveExpense,
                    ]}
                  >
                    <Text
                      style={[
                        styles.typeTabText,
                        selectedType === 'expense' && { color: '#EF4444', fontFamily: 'Cairo_700Bold' },
                      ]}
                    >
                      🔴 {isAr ? 'مصروف' : 'Expense'}
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={() => {
                      Haptics.selectionAsync();
                      setSelectedType('income');
                      if (selectedCategory === 'food' || selectedCategory === 'transport') {
                        setSelectedCategory('salary');
                      }
                    }}
                    style={[
                      styles.typeTab,
                      selectedType === 'income' && styles.typeTabActiveIncome,
                    ]}
                  >
                    <Text
                      style={[
                        styles.typeTabText,
                        selectedType === 'income' && { color: '#10B981', fontFamily: 'Cairo_700Bold' },
                      ]}
                    >
                      🟢 {isAr ? 'دخل / قبض' : 'Income'}
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={() => {
                      Haptics.selectionAsync();
                      setSelectedType('transfer');
                    }}
                    style={[
                      styles.typeTab,
                      selectedType === 'transfer' && styles.typeTabActiveTransfer,
                    ]}
                  >
                    <Text
                      style={[
                        styles.typeTabText,
                        selectedType === 'transfer' && { color: '#3B82F6', fontFamily: 'Cairo_700Bold' },
                      ]}
                    >
                      🔄 {isAr ? 'تحويل' : 'Transfer'}
                    </Text>
                  </Pressable>
                </View>

                {/* 2. Amount & Description Row */}
                <View style={styles.formRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.fieldLabel}>{isAr ? 'المبلغ المطلوب' : 'Amount'}</Text>
                    <View style={styles.amountInputWrapper}>
                      <TextInput
                        style={styles.amountInput}
                        value={amountStr}
                        onChangeText={setAmountStr}
                        keyboardType="numeric"
                        placeholder="0"
                        placeholderTextColor="rgba(255,255,255,0.3)"
                      />
                      <Text style={styles.currencySuffix}>{currencySymbol}</Text>
                    </View>
                  </View>

                  <View style={{ flex: 1.4 }}>
                    <Text style={styles.fieldLabel}>{isAr ? 'البيان / الوصف' : 'Description'}</Text>
                    <TextInput
                      style={styles.descInput}
                      value={descriptionStr}
                      onChangeText={setDescriptionStr}
                      placeholder={isAr ? 'وصف المعاملة...' : 'Description...'}
                      placeholderTextColor="rgba(255,255,255,0.3)"
                    />
                  </View>
                </View>

                {/* 3. Category with Real Icon & Color */}
                <View style={{ marginTop: 4 }}>
                  <Text style={styles.fieldLabel}>
                    {isAr ? 'فئة الصرف والأيقونة:' : 'Category & Icon:'}
                  </Text>
                  <View style={styles.currentCategoryBadge}>
                    <View
                      style={[
                        styles.catIconCircle,
                        { backgroundColor: currentCategoryColor + '25', borderColor: currentCategoryColor },
                      ]}
                    >
                      <Ionicons name={currentCategoryIcon as any} size={18} color={currentCategoryColor} />
                    </View>
                    <Text style={[styles.catNameText, { color: currentCategoryColor }]}>
                      {categoryName}
                    </Text>
                  </View>

                  {/* Horizontal Scroll for Fast Category Picking */}
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ gap: 8, marginTop: 8 }}
                  >
                    {displayedCategories.map(cat => {
                      const isSelected = selectedCategory === cat.id;
                      return (
                        <Pressable
                          key={cat.id}
                          onPress={() => {
                            Haptics.selectionAsync();
                            setSelectedCategory(cat.id);
                          }}
                          style={[
                            styles.catMiniChip,
                            isSelected && {
                              borderColor: cat.color || '#00E676',
                              backgroundColor: (cat.color || '#00E676') + '25',
                            },
                          ]}
                        >
                          <Ionicons
                            name={(cat.icon || 'pricetag') as any}
                            size={14}
                            color={isSelected ? cat.color || '#00E676' : 'rgba(255,255,255,0.6)'}
                          />
                          <Text
                            style={[
                              styles.catMiniChipText,
                              isSelected && { color: '#FFF', fontFamily: 'Cairo_700Bold' },
                            ]}
                          >
                            {isAr ? cat.nameAr : cat.name}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                </View>

                {/* 4. Target Wallet Selector */}
                {wallets.length > 1 && (
                  <View style={{ marginTop: 4 }}>
                    <Text style={styles.fieldLabel}>{isAr ? 'المحفظة المسحوب منها / المودع فيها:' : 'Wallet:'}</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                      {wallets.map(w => {
                        const isSelected = selectedWalletId === w.id;
                        return (
                          <Pressable
                            key={w.id}
                            onPress={() => {
                              Haptics.selectionAsync();
                              setSelectedWalletId(w.id);
                            }}
                            style={[
                              styles.walletMiniChip,
                              isSelected && { borderColor: '#00E676', backgroundColor: '#00E67620' },
                            ]}
                          >
                            <Ionicons
                              name="wallet-outline"
                              size={13}
                              color={isSelected ? '#00E676' : 'rgba(255,255,255,0.6)'}
                            />
                            <Text
                              style={[
                                styles.walletMiniChipText,
                                isSelected && { color: '#00E676', fontFamily: 'Cairo_700Bold' },
                              ]}
                            >
                              {w.name}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </ScrollView>
                  </View>
                )}

                {/* 5. Confirm and Save Button */}
                <Pressable
                  onPress={handleSave}
                  disabled={isSaving || !amountStr || parseFloat(amountStr) <= 0}
                  style={({ pressed }) => [
                    styles.saveBtn,
                    (!amountStr || parseFloat(amountStr) <= 0) && { opacity: 0.5 },
                    pressed && { opacity: 0.85 },
                  ]}
                >
                  {isSaving ? (
                    <ActivityIndicator color="#FFF" size="small" />
                  ) : (
                    <>
                      <Ionicons name="checkmark-circle" size={20} color="#FFF" />
                      <Text style={styles.saveBtnText}>
                        {isAr ? '💾 حفظ وتسجيل المعاملة في المحفظة' : '💾 Save & Record Transaction'}
                      </Text>
                    </>
                  )}
                </Pressable>
              </View>
            ) : (
              /* Egyptian Inspiration Chips */
              <View style={styles.examplesSection}>
                <Text style={styles.examplesTitle}>
                  {isAr ? '💡 أمثلة عامية يمكنك تجربتها بلمسة واحدة:' : '💡 Example voice commands:'}
                </Text>
                <View style={styles.examplesChips}>
                  {[
                    isAr ? 'صرفت 75 جنيه غدا كشري' : 'Spent $50 on lunch',
                    isAr ? 'دفعت 40 جنيه اوبر مشوار' : 'Paid $40 for uber ride',
                    isAr ? 'سددت فاتورة النت 250' : 'Paid $250 internet bill',
                    isAr ? 'قبضت المرتب 8000 جنيه' : 'Received $8000 salary',
                    isAr ? 'شحنت كارت رصيد بـ 50' : 'Recharged $50 credit',
                  ].map((ex, i) => (
                    <Pressable
                      key={i}
                      onPress={() => handleExamplePress(ex)}
                      style={({ pressed }) => [
                        styles.exampleChip,
                        pressed && { opacity: 0.7 },
                      ]}
                    >
                      <Ionicons name="mic-outline" size={13} color="#00E676" />
                      <Text style={styles.exampleChipText}>{ex}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function getStyles(colors: any, theme: string) {
  return StyleSheet.create({
    modalOverlay: {
      flex: 1,
      justifyContent: 'flex-end',
      backgroundColor: 'rgba(0, 0, 0, 0.75)',
    },
    modalSheet: {
      backgroundColor: '#111827',
      borderTopLeftRadius: 32,
      borderTopRightRadius: 32,
      paddingHorizontal: 20,
      paddingTop: 20,
      paddingBottom: Platform.OS === 'ios' ? 36 : 20,
      maxHeight: '90%',
      borderTopWidth: 1,
      borderTopColor: 'rgba(255, 255, 255, 0.15)',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: -10 },
      shadowOpacity: 0.5,
      shadowRadius: 24,
      elevation: 24,
    },
    sheetHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 6,
    },
    headerTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    aiBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: 'rgba(0, 230, 118, 0.15)',
      paddingVertical: 3,
      paddingHorizontal: 8,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: 'rgba(0, 230, 118, 0.4)',
    },
    aiBadgeText: {
      fontFamily: 'Cairo_700Bold',
      fontSize: 10,
      color: '#00E676',
      letterSpacing: 0.5,
    },
    sheetTitle: {
      fontFamily: 'Cairo_700Bold',
      fontSize: 18,
      color: '#FFF',
    },
    closeBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: 'rgba(255, 255, 255, 0.1)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    sheetSubtitle: {
      fontFamily: 'Cairo_500Medium',
      fontSize: 12,
      color: 'rgba(255, 255, 255, 0.7)',
      lineHeight: 18,
      marginBottom: 16,
    },
    micSection: {
      alignItems: 'center',
      justifyContent: 'center',
      marginVertical: 6,
    },
    micButtonContainer: {
      width: 90,
      height: 90,
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
    },
    pulseRing: {
      position: 'absolute',
      width: 90,
      height: 90,
      borderRadius: 45,
      backgroundColor: '#00E676',
    },
    micButton: {
      width: 80,
      height: 80,
      borderRadius: 40,
      overflow: 'hidden',
      shadowColor: '#00E676',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.4,
      shadowRadius: 12,
      elevation: 8,
    },
    micButtonActive: {
      shadowColor: '#EF4444',
    },
    micGradient: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    micStatusText: {
      fontFamily: 'Cairo_600SemiBold',
      fontSize: 13,
      color: 'rgba(255, 255, 255, 0.95)',
      marginTop: 10,
    },
    inputContainer: {
      position: 'relative',
      marginVertical: 12,
    },
    transcriptInput: {
      backgroundColor: 'rgba(255, 255, 255, 0.08)',
      borderRadius: 16,
      padding: 12,
      paddingRight: 40,
      color: '#FFF',
      fontFamily: 'Cairo_600SemiBold',
      fontSize: 14,
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.15)',
      minHeight: 48,
    },
    clearInputBtn: {
      position: 'absolute',
      right: 12,
      top: 14,
    },
    parsedCard: {
      backgroundColor: 'rgba(17, 24, 39, 0.9)',
      borderRadius: 20,
      padding: 16,
      borderWidth: 1.5,
      borderColor: 'rgba(0, 230, 118, 0.4)',
      gap: 12,
    },
    typeSelectorRow: {
      flexDirection: 'row',
      gap: 8,
      backgroundColor: 'rgba(255, 255, 255, 0.05)',
      padding: 4,
      borderRadius: 12,
    },
    typeTab: {
      flex: 1,
      paddingVertical: 7,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 10,
    },
    typeTabActiveExpense: {
      backgroundColor: 'rgba(239, 68, 68, 0.2)',
      borderWidth: 1,
      borderColor: '#EF4444',
    },
    typeTabActiveIncome: {
      backgroundColor: 'rgba(16, 185, 129, 0.2)',
      borderWidth: 1,
      borderColor: '#10B981',
    },
    typeTabActiveTransfer: {
      backgroundColor: 'rgba(59, 130, 246, 0.2)',
      borderWidth: 1,
      borderColor: '#3B82F6',
    },
    typeTabText: {
      fontFamily: 'Cairo_600SemiBold',
      fontSize: 12,
      color: 'rgba(255, 255, 255, 0.7)',
    },
    formRow: {
      flexDirection: 'row',
      gap: 10,
    },
    fieldLabel: {
      fontFamily: 'Cairo_600SemiBold',
      fontSize: 11,
      color: 'rgba(255, 255, 255, 0.65)',
      marginBottom: 4,
    },
    amountInputWrapper: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: 'rgba(255, 255, 255, 0.08)',
      borderRadius: 12,
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.15)',
      paddingHorizontal: 10,
      height: 42,
    },
    amountInput: {
      flex: 1,
      color: '#00E676',
      fontFamily: 'Cairo_700Bold',
      fontSize: 16,
      textAlign: 'center',
    },
    currencySuffix: {
      fontFamily: 'Cairo_600SemiBold',
      fontSize: 12,
      color: 'rgba(255, 255, 255, 0.6)',
    },
    descInput: {
      backgroundColor: 'rgba(255, 255, 255, 0.08)',
      borderRadius: 12,
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.15)',
      paddingHorizontal: 12,
      height: 42,
      color: '#FFF',
      fontFamily: 'Cairo_600SemiBold',
      fontSize: 13,
    },
    currentCategoryBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: 'rgba(255, 255, 255, 0.05)',
      paddingVertical: 6,
      paddingHorizontal: 10,
      borderRadius: 12,
      alignSelf: 'flex-start',
    },
    catIconCircle: {
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
    },
    catNameText: {
      fontFamily: 'Cairo_700Bold',
      fontSize: 13,
    },
    catMiniChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      backgroundColor: 'rgba(255, 255, 255, 0.07)',
      paddingVertical: 5,
      paddingHorizontal: 9,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    catMiniChipText: {
      fontFamily: 'Cairo_500Medium',
      fontSize: 11,
      color: 'rgba(255, 255, 255, 0.75)',
    },
    walletMiniChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      backgroundColor: 'rgba(255, 255, 255, 0.07)',
      paddingVertical: 5,
      paddingHorizontal: 9,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    walletMiniChipText: {
      fontFamily: 'Cairo_500Medium',
      fontSize: 11,
      color: 'rgba(255, 255, 255, 0.75)',
    },
    saveBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: '#10B981',
      paddingVertical: 13,
      borderRadius: 14,
      marginTop: 6,
      shadowColor: '#10B981',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.35,
      shadowRadius: 8,
      elevation: 4,
    },
    saveBtnText: {
      fontFamily: 'Cairo_700Bold',
      fontSize: 14,
      color: '#FFF',
    },
    examplesSection: {
      marginTop: 4,
    },
    examplesTitle: {
      fontFamily: 'Cairo_600SemiBold',
      fontSize: 12,
      color: 'rgba(255, 255, 255, 0.65)',
      marginBottom: 8,
    },
    examplesChips: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    exampleChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      backgroundColor: 'rgba(255, 255, 255, 0.07)',
      paddingVertical: 6,
      paddingHorizontal: 10,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    exampleChipText: {
      fontFamily: 'Cairo_500Medium',
      fontSize: 11,
      color: 'rgba(255, 255, 255, 0.85)',
    },
  });
}
