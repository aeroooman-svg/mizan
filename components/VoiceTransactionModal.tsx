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
  Dimensions,
} from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import * as Crypto from 'expo-crypto';
import { useTheme } from '@/lib/ThemeContext';
import { useLanguage } from '@/lib/LanguageContext';
import { useTransactions } from '@/lib/TransactionContext';
import { formatCurrency, getCategoryById } from '@/lib/categories';
import { parseTransactionText, ParsedTransaction } from '@/lib/nlpParser';
import { playIncomeSound, playExpenseSound } from '@/lib/sounds';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

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
    refresh,
  } = useTransactions();

  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [parsedData, setParsedData] = useState<ParsedTransaction | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Animation pulses
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const ringAnim = useRef(new Animated.Value(0)).current;
  const recognitionRef = useRef<any>(null);

  // Start breathing/pulse animation
  useEffect(() => {
    if (isListening) {
      Animated.loop(
        Animated.parallel([
          Animated.sequence([
            Animated.timing(pulseAnim, {
              toValue: 1.18,
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

  // Setup Web Speech Recognition if on web
  const startSpeechRecognition = () => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

      if (SpeechRecognition) {
        try {
          const recognition = new SpeechRecognition();
          recognition.lang = isAr ? 'ar-SA' : 'en-US';
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

    // Native or fallback listening simulation
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
    const result = parseTransactionText(
      text,
      wallets,
      selectedWallet?.id
    );
    setParsedData(result);
  };

  const handleExamplePress = (exampleText: string) => {
    Haptics.selectionAsync();
    setTranscript(exampleText);
    handleTextParse(exampleText);
  };

  const handleSave = async () => {
    if (!parsedData || !parsedData.amount || parsedData.amount <= 0) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }

    setIsSaving(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    try {
      const walletId = parsedData.walletId || selectedWallet?.id || wallets[0]?.id;
      const newTxn = {
        id: Crypto.randomUUID(),
        type: parsedData.type,
        amount: parsedData.amount,
        category: parsedData.category || (parsedData.type === 'income' ? 'salary' : 'food'),
        description: parsedData.description || (isAr ? 'تسجيل صوتي ذكي' : 'Smart Voice Entry'),
        date: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        walletId,
        toWalletId: parsedData.toWalletId || undefined,
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
    onClose();
  };

  const categoryObj = parsedData?.category ? getCategoryById(parsedData.category) : null;
  const categoryName = categoryObj
    ? isAr
      ? categoryObj.nameAr
      : categoryObj.name
    : parsedData?.category || (isAr ? 'طعام' : 'Food');

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
              ? 'تحدث بشكل طبيعي بأي لهجة وسيتم استخراج المبلغ والفئة والمحفظة فوراً!'
              : 'Speak naturally in any dialect and we will extract the amount, category & wallet instantly!'}
          </Text>

          {/* Microphone Central Button & Animation */}
          <View style={styles.micSection}>
            {/* Pulsing ring */}
            <Animated.View
              style={[
                styles.pulseRing,
                {
                  transform: [{ scale: ringScale }],
                  opacity: ringOpacity,
                },
              ]}
            />

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

            <Text style={styles.micStatusText}>
              {isListening
                ? isAr
                  ? 'جاري الاستماع... تفضل بالحديث 🎙️'
                  : 'Listening... Speak now 🎙️'
                : isAr
                ? 'اضغط على الميكروفون للتحدث'
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
                  ? 'مثال: "صرفت خمسين جنيه على الغداء" أو اكتب هنا مباشرة...'
                  : 'e.g. "Spent 50 dollars on lunch" or type here...'
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
                }}
                style={styles.clearInputBtn}
              >
                <Ionicons name="close-circle" size={18} color="rgba(255,255,255,0.5)" />
              </Pressable>
            )}
          </View>

          {/* Extracted Data Card */}
          {parsedData && parsedData.amount && parsedData.amount > 0 ? (
            <View style={styles.parsedCard}>
              <View style={styles.parsedCardHeader}>
                <View style={styles.parsedTypeBadge}>
                  <Text style={styles.parsedTypeText}>
                    {parsedData.type === 'income'
                      ? isAr
                        ? '🟢 دخل / إيداع'
                        : '🟢 Income'
                      : parsedData.type === 'transfer'
                      ? isAr
                        ? '🔄 تحويل'
                        : '🔄 Transfer'
                      : isAr
                      ? '🔴 مصروف'
                      : '🔴 Expense'}
                  </Text>
                </View>
                <Text style={styles.parsedAmount}>
                  {formatCurrency(parsedData.amount, language)} {currencySymbol}
                </Text>
              </View>

              <View style={styles.parsedDetailsRow}>
                <View style={styles.parsedDetailItem}>
                  <Ionicons name="pricetag-outline" size={14} color="#00E676" />
                  <Text style={styles.parsedDetailText}>{categoryName}</Text>
                </View>
                {parsedData.description ? (
                  <View style={styles.parsedDetailItem}>
                    <Ionicons name="document-text-outline" size={14} color="rgba(255,255,255,0.7)" />
                    <Text numberOfLines={1} style={styles.parsedDetailText}>
                      {parsedData.description}
                    </Text>
                  </View>
                ) : null}
              </View>

              {/* Confirm and Save Button */}
              <Pressable
                onPress={handleSave}
                disabled={isSaving}
                style={({ pressed }) => [
                  styles.saveBtn,
                  pressed && { opacity: 0.85 },
                ]}
              >
                {isSaving ? (
                  <ActivityIndicator color="#FFF" size="small" />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle" size={18} color="#FFF" />
                    <Text style={styles.saveBtnText}>
                      {isAr ? 'تأكيد وحفظ المعاملة فوراً' : 'Confirm & Save Transaction'}
                    </Text>
                  </>
                )}
              </Pressable>
            </View>
          ) : (
            /* Inspiration Chips */
            <View style={styles.examplesSection}>
              <Text style={styles.examplesTitle}>
                {isAr ? '💡 أمثلة يمكنك قولها أو تجربتها:' : '💡 Example voice commands:'}
              </Text>
              <View style={styles.examplesChips}>
                {[
                  isAr ? 'صرفت 50 جنيه غداء' : 'Spent $50 on lunch',
                  isAr ? 'شريت بنزين بـ 15 دينار' : 'Paid $30 for fuel',
                  isAr ? 'استلمت راتب 2000 دولار' : 'Received $2000 salary',
                  isAr ? 'فاتورة كهرباء 120' : 'Electricity bill 120',
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
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
    },
    modalSheet: {
      backgroundColor: '#111827',
      borderTopLeftRadius: 32,
      borderTopRightRadius: 32,
      padding: 24,
      paddingBottom: Platform.OS === 'ios' ? 44 : 28,
      borderTopWidth: 1,
      borderTopColor: 'rgba(255, 255, 255, 0.12)',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: -10 },
      shadowOpacity: 0.4,
      shadowRadius: 20,
      elevation: 20,
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
      color: 'rgba(255, 255, 255, 0.65)',
      lineHeight: 18,
      marginBottom: 20,
    },
    micSection: {
      alignItems: 'center',
      justifyContent: 'center',
      marginVertical: 10,
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
      width: 84,
      height: 84,
      borderRadius: 42,
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
      color: 'rgba(255, 255, 255, 0.9)',
      marginTop: 14,
    },
    inputContainer: {
      position: 'relative',
      marginVertical: 14,
    },
    transcriptInput: {
      backgroundColor: 'rgba(255, 255, 255, 0.07)',
      borderRadius: 16,
      padding: 14,
      paddingRight: 40,
      color: '#FFF',
      fontFamily: 'Cairo_600SemiBold',
      fontSize: 14,
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.15)',
      minHeight: 52,
    },
    clearInputBtn: {
      position: 'absolute',
      right: 12,
      top: 16,
    },
    parsedCard: {
      backgroundColor: 'rgba(0, 230, 118, 0.08)',
      borderRadius: 20,
      padding: 16,
      borderWidth: 1.5,
      borderColor: 'rgba(0, 230, 118, 0.35)',
      gap: 12,
    },
    parsedCardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    parsedTypeBadge: {
      backgroundColor: 'rgba(255, 255, 255, 0.1)',
      paddingVertical: 4,
      paddingHorizontal: 10,
      borderRadius: 10,
    },
    parsedTypeText: {
      fontFamily: 'Cairo_700Bold',
      fontSize: 12,
      color: '#FFF',
    },
    parsedAmount: {
      fontFamily: 'Cairo_700Bold',
      fontSize: 20,
      color: '#00E676',
    },
    parsedDetailsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
    },
    parsedDetailItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: 'rgba(0,0,0,0.3)',
      paddingVertical: 5,
      paddingHorizontal: 10,
      borderRadius: 8,
    },
    parsedDetailText: {
      fontFamily: 'Cairo_600SemiBold',
      fontSize: 12,
      color: '#FFF',
    },
    saveBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: '#10B981',
      paddingVertical: 12,
      borderRadius: 14,
      marginTop: 4,
      shadowColor: '#10B981',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 4,
    },
    saveBtnText: {
      fontFamily: 'Cairo_700Bold',
      fontSize: 14,
      color: '#FFF',
    },
    examplesSection: {
      marginTop: 6,
    },
    examplesTitle: {
      fontFamily: 'Cairo_600SemiBold',
      fontSize: 11,
      color: 'rgba(255, 255, 255, 0.5)',
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
