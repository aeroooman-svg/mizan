import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  Pressable,
  ScrollView,
  Platform,
  KeyboardAvoidingView,
  Alert,
  Modal,
  SafeAreaView,
  Dimensions,
  ActivityIndicator,
  Image,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import * as Crypto from 'expo-crypto';
import * as Clipboard from 'expo-clipboard';
import Colors from '@/constants/colors';
import { useTransactions } from '@/lib/TransactionContext';
import { expenseCategories, incomeCategories, formatCurrency, WALLET_COLORS, EXPANDED_ICON_LIBRARY } from '@/lib/categories';
import { useLanguage } from '@/lib/LanguageContext';
import { useTheme } from '@/lib/ThemeContext';
import { getCategoryName } from '@/lib/i18n';
import { Transaction } from '@/lib/storage';
import { loadSounds, playExpenseSound, playIncomeSound } from '@/lib/sounds';
import { normalizeAmountInput } from '@/lib/arabicNumbers';
import { getBudgetsForWallet } from '@/lib/budgetStorage';
import { parseTransactionText } from '@/lib/nlpParser';
import { parseBankSMS } from '@/lib/smsParser';
import { getLoggedInUser } from '@/lib/syncService';
import ModernDatePickerModal from '@/components/ModernDatePickerModal';
import ModernTimePickerModal from '@/components/ModernTimePickerModal';
import VoiceTransactionModal from '@/components/VoiceTransactionModal';
import { getAllTags, saveCustomTag, Tag, parseTransactionTags, formatTagsToString } from '@/lib/tagStorage';

type TransactionType = 'expense' | 'income' | 'transfer';
const { width: SCREEN_WIDTH } = Dimensions.get('window');

const CUSTOM_CATEGORY_ICONS = [
  // Food & Drinks
  'restaurant', 'local-cafe', 'fastfood', 'local-pizza', 'cake', 'local-grocery-store', 'local-bar',
  // Shopping & Personal
  'shopping-bag', 'shopping-cart', 'checkroom', 'card-giftcard', 'diamond', 'brush',
  // Transport & Travel
  'directions-car', 'local-gas-station', 'flight', 'directions-bus', 'commute', 'build', 'local-taxi', 'pedal-bike',
  // Home & Utilities
  'home', 'receipt-long', 'phone-android', 'lightbulb', 'wifi', 'cleaning-services', 'tv', 'weekend',
  // Health & Sports
  'medical-services', 'spa', 'fitness-center', 'sports-soccer', 'medication', 'pool',
  // Family, Education & Pets
  'child-care', 'school', 'pets', 'family-restroom',
  // Entertainment & Tech
  'movie', 'videogame-asset', 'sports-esports', 'camera-alt', 'music-note', 'beach-access',
  // Finance & Business
  'account-balance-wallet', 'laptop-mac', 'trending-up', 'work', 'credit-card', 'attach-money', 'savings', 'storefront', 'monetization-on', 'subscriptions', 'stars',
  // General
  'star', 'favorite', 'more-horiz'
];

export default function AddTransactionScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const { addTransaction, updateTransaction, selectedWallet, currencySymbol, walletTransactions, customCategories, addCustomCategory, updateCustomCategory, removeCustomCategory, wallets, selectWallet } = useTransactions();
  const { t, language } = useLanguage();
  const params = useLocalSearchParams<{ 
    editId?: string; 
    prefillAmount?: string; 
    prefillType?: TransactionType; 
    prefillCategory?: string; 
    prefillDesc?: string; 
    type?: TransactionType;
    isQuick?: string;
    quickMode?: string;
  }>();
  const isEditMode = !!params.editId;
  const isQuick = params.isQuick === 'true' || params.quickMode === 'true' || (Platform.OS === 'web' && typeof window !== 'undefined' && window.location.search.includes('isQuick=true'));

  // Find existing transaction if in edit mode
  const existingTxn = isEditMode
    ? walletTransactions.find(tx => tx.id === params.editId)
    : null;

  const [currentUser, setCurrentUser] = useState<{ id: string; username: string } | null>(null);

  useEffect(() => {
    async function checkUser() {
      try {
        const user = await getLoggedInUser();
        setCurrentUser(user);
      } catch (err) {
        console.error('Error fetching user for transaction:', err);
      }
    }
    checkUser();
  }, []);

  const now = new Date();
  const initialDate = existingTxn ? new Date(existingTxn.date) : now;

  const getInitialType = useCallback((): TransactionType => {
    if (existingTxn?.type) return existingTxn.type;
    const pType = params.prefillType || params.type;
    if (pType === 'income' || pType === 'expense' || pType === 'transfer') return pType;
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      try {
        const searchParams = new URLSearchParams(window.location.search);
        const urlType = searchParams.get('type') || searchParams.get('prefillType');
        if (urlType === 'income' || urlType === 'expense' || urlType === 'transfer') {
          return urlType as TransactionType;
        }
      } catch (e) {}
    }
    return 'expense';
  }, [existingTxn, params.prefillType, params.type]);

  const [type, setType] = useState<TransactionType>(getInitialType());

  useEffect(() => {
    if (!existingTxn) {
      const resolved = getInitialType();
      setType(resolved);
    }
  }, [getInitialType, existingTxn]);
  const [amount, setAmount] = useState(existingTxn ? existingTxn.amount.toString() : '');
  const [selectedCategory, setSelectedCategory] = useState<string>(existingTxn?.category || '');
  const [description, setDescription] = useState(existingTxn?.description || '');
  const [isSaving, setIsSaving] = useState(false);

  // Time
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [selectedHour, setSelectedHour] = useState(initialDate.getHours() % 12 || 12);
  const [selectedMinute, setSelectedMinute] = useState(initialDate.getMinutes());
  const [selectedPeriod, setSelectedPeriod] = useState<'AM' | 'PM'>(initialDate.getHours() >= 12 ? 'PM' : 'AM');

  // Date picker state
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedDay, setSelectedDay] = useState(initialDate.getDate());
  const [selectedMonth, setSelectedMonth] = useState(initialDate.getMonth());
  const [selectedYear, setSelectedYear] = useState(initialDate.getFullYear());

  // Calculator state
  const [calcModalVisible, setCalcModalVisible] = useState(false);
  const [calcExpression, setCalcExpression] = useState('');
  const [calcResult, setCalcResult] = useState('');

  // Custom Category state
  const [customModalVisible, setCustomModalVisible] = useState(false);
  const [editingCategory, setEditingCategory] = useState<any | null>(null);
  const [customNameAr, setCustomNameAr] = useState('');
  const [customNameEn, setCustomNameEn] = useState('');
  const [customColor, setCustomColor] = useState(WALLET_COLORS[0]);
  const [customIcon, setCustomIcon] = useState(CUSTOM_CATEGORY_ICONS[0]);

  // Budgets state
  const [budgets, setBudgets] = useState<Record<string, number>>({});

  // Smart Input States
  const [smartInputText, setSmartInputText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);
  const [smartMessage, setSmartMessage] = useState('');
  
  const [toWalletId, setToWalletId] = useState<string>(existingTxn?.toWalletId || '');
    const smartInputRef = useRef<TextInput>(null);

  // Scanner & Tags states
  const [receiptUri, setReceiptUri] = useState(existingTxn?.receiptUri || '');
  const [isScanning, setIsScanning] = useState(false);
  const [tags, setTags] = useState(existingTxn?.tags || '');
  const [availableTags, setAvailableTags] = useState<Tag[]>([]);

  // New Tag Creator Modal state
  const [tagModalVisible, setTagModalVisible] = useState(false);
  const [newTagNameAr, setNewTagNameAr] = useState('');
  const [newTagNameEn, setNewTagNameEn] = useState('');
  const [newTagColor, setNewTagColor] = useState(WALLET_COLORS[0]);

  useEffect(() => {
    async function loadTags() {
      try {
        const tList = await getAllTags().catch(() => []);
        setAvailableTags(tList);
      } catch (e) {}
    }
    loadTags();
  }, []);

  const runImagePicker = async (useCamera: boolean) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      
      let status;
      if (useCamera) {
        const camPermission = await ImagePicker.requestCameraPermissionsAsync();
        status = camPermission.status;
      } else {
        const libPermission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        status = libPermission.status;
      }

      if (status !== 'granted') {
        Alert.alert(
          language === 'ar' ? 'تنبيه' : 'Permission Required',
          language === 'ar' 
            ? 'نحتاج الوصول للكاميرا أو معرض الصور لقراءة الفواتير' 
            : 'Camera or media library permission is required to read receipts'
        );
        return;
      }

      const options = {
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
      };

      const result = useCamera
        ? await ImagePicker.launchCameraAsync(options)
        : await ImagePicker.launchImageLibraryAsync(options);

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const uri = result.assets[0].uri;
        setReceiptUri(uri);
        setIsScanning(true);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

        // Simulate high-tech OCR scan animation for 1.8 seconds
        setTimeout(() => {
          setIsScanning(false);
          // Mock data extraction based on random selection
          const mockAmounts = [185.50, 42.00, 75.00, 240.00, 110.00];
          const mockCategories = ['food', 'shopping', 'transport', 'entertainment', 'phone'];
          const mockDescriptionsAr = ['فاتورة مطعم', 'مشتريات سوبرماركت', 'توصيل طلبات', 'تذكرة سينما', 'شحن رصيد'];
          const mockDescriptionsEn = ['Restaurant receipt', 'Grocery purchases', 'Delivery fare', 'Cinema ticket', 'Mobile credit recharge'];
          
          const idx = Math.floor(Math.random() * mockAmounts.length);
          
          setAmount(mockAmounts[idx].toString());
          setSelectedCategory(mockCategories[idx]);
          setDescription(language === 'ar' ? mockDescriptionsAr[idx] : mockDescriptionsEn[idx]);
          
          // Pre-populate realistic tag based on category
          const mockTags = ['أكل', 'مشتريات', 'مواصلات', 'ترفيه', 'فواتير'];
          setTags(mockTags[idx]);

          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          Alert.alert(
            language === 'ar' ? 'نجاح القراءة' : 'OCR Scan Complete',
            language === 'ar' 
              ? `تم استخراج البيانات بنجاح!\nالمبلغ: ${mockAmounts[idx]} ${currencySymbol}\nالوصف: ${mockDescriptionsAr[idx]}`
              : `Extracted data successfully!\nAmount: ${mockAmounts[idx]} ${currencySymbol}\nDescription: ${mockDescriptionsEn[idx]}`
          );
        }, 1800);
      }
    } catch (e) {
      console.error('Scan receipt error:', e);
      Alert.alert(
        language === 'ar' ? 'خطأ' : 'Error',
        language === 'ar' ? 'فشل مسح الفاتورة' : 'Failed to scan receipt'
      );
    }
  };

  const initiateReceiptScan = () => {
    Haptics.selectionAsync();
    router.push('/scan-receipt');
  };

  const startSpeechRecognition = () => {
    if (Platform.OS !== 'web') {
      Haptics.selectionAsync();
      setSmartMessage(
        language === 'ar' 
          ? '🎙️ اضغط على زر المايك في لوحة مفاتيح هاتفك لإملاء المعاملة بصوتك، أو اكتب النص مباشرة!'
          : '🎙️ Tap the microphone icon on your soft keyboard to dictate using your voice!'
      );
      smartInputRef.current?.focus();
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      Alert.alert(
        language === 'ar' ? 'غير مدعوم' : 'Not Supported',
        language === 'ar' 
          ? 'التعرف على الصوت غير مدعوم مباشرة في هذا المتصفح. يمكنك إملاء المعاملة بصوتك باستخدام مايك لوحة المفاتيح.'
          : 'Speech recognition is not supported in this browser. Try Google Chrome or keyboard mic.'
      );
      return;
    }

    try {
      Haptics.selectionAsync();
      const recognition = new SpeechRecognition();
      recognition.lang = language === 'ar' ? 'ar-EG' : 'en-US';
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        setIsRecording(true);
        setSmartMessage(language === 'ar' ? '🎙️ جاري الاستماع... تحدث الآن (مثال: صرفت 50 جنيه قهوة من الكاش)' : '🎙️ Listening... Speak now (e.g. Spent 50 EGP coffee from Cash)');
      };

      recognition.onerror = (event: any) => {
        console.error('Speech recognition error', event);
        setIsRecording(false);
        setSmartMessage(language === 'ar' ? 'حدث خطأ أو لم يتم التقاط الصوت. حاول مرة أخرى أو استخدم مايك الكيبورد.' : 'Speech recognition error. Try again or use keyboard mic.');
      };

      recognition.onend = () => {
        setIsRecording(false);
      };

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setSmartInputText(transcript);
        handleSmartParse(transcript);
      };

      recognition.start();
    } catch (e) {
      console.error(e);
      setIsRecording(false);
    }
  };

  const handleSmartParse = (textToParse: string) => {
    if (!textToParse.trim()) return;
    
    try {
      // Check if text looks like a bank SMS notification
      const smsParsed = parseBankSMS(textToParse);
      
      if (smsParsed && smsParsed.amount !== null && smsParsed.confidenceScore > 0.5) {
        setAmount(smsParsed.amount.toString());
        setType(smsParsed.type);
        if (smsParsed.category) setSelectedCategory(smsParsed.category);
        setDescription(`${smsParsed.merchant} (${smsParsed.bankName})`);
        
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        const categoryObj = displayedCategories.find(c => c.id === smsParsed.category) || 
                            [...expenseCategories, ...incomeCategories].find(c => c.id === smsParsed.category);
        const catName = categoryObj ? getCategoryName(categoryObj.id, language) : (language === 'ar' ? 'غير معروف' : 'Unknown');

        if (language === 'ar') {
          setSmartMessage(`📱 رسالة بنك (${smsParsed.bankName}): ${smsParsed.amount} ${smsParsed.currency} - ${catName}`);
        } else {
          setSmartMessage(`📱 Bank SMS (${smsParsed.bankName}): ${smsParsed.amount} ${smsParsed.currency} - ${catName}`);
        }
        return;
      }

      // Fallback to standard Arabic NLP parser
      const parsed = parseTransactionText(textToParse, wallets, customCategories);
      
      if (parsed.amount !== null) {
        setAmount(parsed.amount.toString());
      }
      
      setType(parsed.type);
      
      if (parsed.category) {
        setSelectedCategory(parsed.category);
      }
      
      if (parsed.description) {
        setDescription(parsed.description);
      }
      
      if (parsed.walletId) {
        selectWallet(parsed.walletId);
      }

      if (parsed.toWalletId) {
        setToWalletId(parsed.toWalletId);
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
      if (parsed.type === 'transfer') {
        const toWalletObj = wallets.find(w => w.id === parsed.toWalletId);
        const toName = toWalletObj ? toWalletObj.name : '';
        if (language === 'ar') {
          setSmartMessage(`🔄 تم استخراج عملية تحويل: ${parsed.amount || 0} ${currencySymbol} ${toName ? 'إلى ' + toName : ''}`);
        } else {
          setSmartMessage(`🔄 Parsed Transfer: ${parsed.amount || 0} ${currencySymbol} ${toName ? 'to ' + toName : ''}`);
        }
      } else {
        const categoryObj = displayedCategories.find(c => c.id === parsed.category) || 
                            [...expenseCategories, ...incomeCategories].find(c => c.id === parsed.category);
        const catName = categoryObj ? getCategoryName(categoryObj.id, language) : (language === 'ar' ? 'غير معروف' : 'Unknown');
        
        if (language === 'ar') {
          setSmartMessage(`✅ تم الاستخراج: ${parsed.amount || 0} ${currencySymbol} - قسم: ${catName}`);
        } else {
          setSmartMessage(`✅ Parsed: ${parsed.amount || 0} ${currencySymbol} - Category: ${catName}`);
        }
      }
    } catch (err) {
      console.error('Error parsing smart input:', err);
      setSmartMessage(language === 'ar' ? 'فشل تحليل النص. حاول مرة أخرى.' : 'Failed to parse text. Try again.');
    }
  };

  const handlePasteClipboard = async () => {
    try {
      Haptics.selectionAsync();
      const text = await Clipboard.getStringAsync();
      if (!text || !text.trim()) {
        Alert.alert(
          language === 'ar' ? 'تنبيه الحافظة' : 'Clipboard Alert',
          language === 'ar' 
            ? 'لا يوجد نص منسوخ في الحافظة! قم بنسخ نص المعاملة أو رسالة البنك أولاً.' 
            : 'Clipboard is empty! Copy transaction text or bank SMS first.'
        );
        return;
      }
      setSmartInputText(text);
      handleSmartParse(text);
      if (!smartMessage) {
        setSmartMessage(
          language === 'ar' 
            ? '📋 تم لصق النص المنسوخ من الحافظة وتحليله بنجاح' 
            : '📋 Pasted text from clipboard successfully'
        );
      }
    } catch (e) {
      console.error('Failed to read clipboard:', e);
      Alert.alert(
        language === 'ar' ? 'خطأ' : 'Error',
        language === 'ar' ? 'فشل قراءة الحافظة' : 'Failed to read clipboard'
      );
    }
  };

  useEffect(() => {
    loadSounds();
  }, []);

  useEffect(() => {
    async function loadBudgets() {
      if (selectedWallet) {
        const b = await getBudgetsForWallet(selectedWallet.id);
        setBudgets(b);
      }
    }
    loadBudgets();
  }, [selectedWallet]);

  const displayedCategories = useMemo(() => {
    const staticCats = type === 'expense' ? expenseCategories : incomeCategories;
    const userCats = customCategories.filter(c => c.type === type);
    return [...staticCats, ...userCats];
  }, [type, customCategories]);

  // Calculate budget limit warning
  const categorySpentThisMonth = useMemo(() => {
    if (!selectedCategory || !selectedWallet) return 0;
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();

    return walletTransactions
      .filter((tx) => {
        const txDate = new Date(tx.date);
        return (
          tx.walletId === selectedWallet.id &&
          tx.category === selectedCategory &&
          tx.type === 'expense' &&
          txDate.getMonth() === currentMonth &&
          txDate.getFullYear() === currentYear &&
          (!isEditMode || tx.id !== params.editId)
        );
      })
      .reduce((sum, tx) => sum + tx.amount, 0);
  }, [walletTransactions, selectedCategory, selectedWallet, isEditMode, params.editId]);

  const budgetLimit = budgets[selectedCategory] || 0;
  const currentTotalWithNew = categorySpentThisMonth + (parseFloat(amount) || 0);
  const isOverBudget = type === 'expense' && budgetLimit > 0 && currentTotalWithNew > budgetLimit;
  const overBudgetAmount = isOverBudget ? currentTotalWithNew - budgetLimit : 0;

  const handleTypeSwitch = (newType: TransactionType) => {
    Haptics.selectionAsync();
    setType(newType);
    setSelectedCategory('');
  };

  // Build available dates: last 60 days
  const getAvailableDates = () => {
    const dates: { day: number; month: number; year: number; label: string }[] = [];
    const today = new Date();
    for (let i = 0; i < 60; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      let label: string;
      if (i === 0) label = t.today;
      else if (i === 1) label = t.yesterday;
      else label = `${d.getDate()} ${t.months[d.getMonth()]} ${d.getFullYear()}`;
      dates.push({ day: d.getDate(), month: d.getMonth(), year: d.getFullYear(), label });
    }
    return dates;
  };

  const availableDates = getAvailableDates();
  const selectedDateLabel = (() => {
    const idx = availableDates.findIndex(
      d => d.day === selectedDay && d.month === selectedMonth && d.year === selectedYear
    );
    if (idx === 0) return t.today;
    if (idx === 1) return t.yesterday;
    return `${selectedDay} ${t.months[selectedMonth]} ${selectedYear}`;
  })();

  const handleSave = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      Alert.alert(t.error, t.enterAmount);
      return;
    }
    if (type !== 'transfer' && !selectedCategory) {
      Alert.alert(t.error, t.selectCategory);
      return;
    }
    if (type === 'transfer' && !toWalletId) {
      Alert.alert(t.error, language === 'ar' ? 'يرجى اختيار المحفظة المستهدفة للتحويل' : 'Please select the destination wallet');
      return;
    }
    if (!selectedWallet) {
      Alert.alert(t.error, t.noWalletSelected);
      return;
    }

    setIsSaving(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    if (!isEditMode) {
      if (type === 'expense') {
        playExpenseSound();
      } else {
        playIncomeSound();
      }
    }

    const transactionDate = new Date(selectedYear, selectedMonth, selectedDay);
    let hours24 = selectedHour % 12;
    if (selectedPeriod === 'PM') hours24 += 12;
    if (selectedPeriod === 'AM' && selectedHour === 12) hours24 = 0;
    transactionDate.setHours(hours24, selectedMinute, 0, 0);

    const transaction: Transaction = {
      id: existingTxn?.id || Crypto.randomUUID(),
      type,
      amount: parseFloat(amount),
      category: type === 'transfer' ? 'transfer' : selectedCategory,
      description: description.trim(),
      date: transactionDate.toISOString(),
      createdAt: existingTxn?.createdAt || new Date().toISOString(),
      walletId: selectedWallet.id,
      toWalletId: type === 'transfer' ? toWalletId : undefined,
      tags: tags || undefined,
      receiptUri: receiptUri || undefined,
      addedBy: existingTxn?.addedBy || currentUser?.username || undefined,
    };

    if (isEditMode && existingTxn) {
      await updateTransaction(transaction);
    } else {
      await addTransaction(transaction);
    }

    setIsSaving(false);
    router.back();
  };

  // Calculator operations
  const evaluateExpression = (expr: string): string => {
    try {
      const sanitized = expr.replace(/[^0-9.+\-*/\s]/g, '');
      if (!sanitized.trim()) return '';
      const fn = new Function(`return (${sanitized})`);
      const val = fn();
      if (typeof val === 'number' && isFinite(val)) {
        return Number(Math.max(0, val).toFixed(8)).toString();
      }
      return '';
    } catch {
      return '';
    }
  };

  const handleCalcKeyPress = (key: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    let nextExpr = calcExpression;

    if (['+', '-', '*', '/'].includes(key)) {
      if (calcExpression.endsWith(' ') && !calcExpression.endsWith(' * ') && !calcExpression.endsWith(' / ') && !calcExpression.endsWith(' + ') && !calcExpression.endsWith(' - ')) return;
      if (calcExpression.length === 0) return;
      nextExpr = calcExpression + ` ${key} `;
    } else {
      nextExpr = calcExpression + key;
    }

    setCalcExpression(nextExpr);
    const res = evaluateExpression(nextExpr);
    setCalcResult(res);
  };

  const handleCalcBackspace = () => {
    if (calcExpression.length === 0) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    let nextExpr = calcExpression;
    if (calcExpression.endsWith(' ')) {
      nextExpr = calcExpression.slice(0, -3); // Remove operator like ' + '
    } else {
      nextExpr = calcExpression.slice(0, -1);
    }

    setCalcExpression(nextExpr);
    const res = evaluateExpression(nextExpr);
    setCalcResult(res);
  };

  const handleCalcClear = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setCalcExpression('');
    setCalcResult('');
  };

  const handleCalcConfirm = () => {
    const finalVal = calcResult || evaluateExpression(calcExpression) || '0';
    if (parseFloat(finalVal) > 0) {
      setAmount(finalVal);
    }
    setCalcModalVisible(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  // Custom category operations
  const handleOpenNewCategory = () => {
    setEditingCategory(null);
    setCustomNameAr('');
    setCustomNameEn('');
    setCustomColor(WALLET_COLORS[0]);
    setCustomIcon(CUSTOM_CATEGORY_ICONS[0]);
    setCustomModalVisible(true);
  };

  const handleOpenEditCategory = (cat: any) => {
    setEditingCategory(cat);
    setCustomNameAr(cat.nameAr || cat.name || '');
    setCustomNameEn(cat.name || cat.nameAr || '');
    setCustomColor(cat.color || WALLET_COLORS[0]);
    setCustomIcon(cat.icon || CUSTOM_CATEGORY_ICONS[0]);
    setCustomModalVisible(true);
  };

  const handleSaveCustomCategory = async () => {
    const nameAr = customNameAr.trim();
    let nameEn = customNameEn.trim();
    if (!nameEn) nameEn = nameAr;

    if (!nameAr) {
      Alert.alert(t.error, language === 'ar' ? 'يرجى كتابة اسم الفئة' : 'Please enter category name');
      return;
    }

    try {
      if (editingCategory) {
        await updateCustomCategory({
          ...editingCategory,
          nameAr,
          name: nameEn,
          icon: customIcon,
          color: customColor,
        });
        setSelectedCategory(editingCategory.id);
      } else {
        const newCat = await addCustomCategory(nameAr, nameEn, customIcon, customColor, type === 'transfer' ? 'expense' : type);
        setSelectedCategory(newCat.id);
      }
      setCustomModalVisible(false);
      setEditingCategory(null);
      setCustomNameAr('');
      setCustomNameEn('');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      Alert.alert(t.error, 'Could not save category');
    }
  };

  const handleDeleteCategory = async () => {
    if (!editingCategory) return;
    Alert.alert(
      language === 'ar' ? 'حذف الفئة' : 'Delete Category',
      language === 'ar' ? `هل أنت متأكد من حذف فئة "${editingCategory.nameAr || editingCategory.name}"؟` : `Are you sure you want to delete "${editingCategory.name}"?`,
      [
        { text: language === 'ar' ? 'إلغاء' : 'Cancel', style: 'cancel' },
        {
          text: language === 'ar' ? 'حذف' : 'Delete',
          style: 'destructive',
          onPress: async () => {
            await removeCustomCategory(editingCategory.id);
            if (selectedCategory === editingCategory.id) {
              setSelectedCategory('');
            }
            setCustomModalVisible(false);
            setEditingCategory(null);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          },
        },
      ]
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      <View style={styles.container}>
        <View style={[styles.headerRow, { backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border, paddingBottom: 12, zIndex: 10, elevation: 10 }]}>
          <Text style={styles.sheetTitle}>
            {isEditMode 
              ? t.editTransaction 
              : isQuick
                ? (type === 'income' ? (language === 'ar' ? 'إضافة دخل جديد 🟢' : 'Add Income') : (language === 'ar' ? 'إضافة مصروف جديد 🔴' : 'Add Expense'))
                : type === 'income' 
                  ? (language === 'ar' ? 'إضافة دخل جديد 🟢' : 'Add New Income')
                  : type === 'transfer'
                    ? (language === 'ar' ? 'تحويل بين المحافظ 🔄' : 'Transfer Funds')
                    : (language === 'ar' ? 'إضافة مصروف جديد 🔴' : 'Add New Expense')}
          </Text>
          <Pressable 
            onPress={() => {
              Haptics.selectionAsync();
              router.replace('/');
            }} 
            hitSlop={20}
          >
            <Ionicons name="close" size={24} color={Colors.textSecondary} />
          </Pressable>
        </View>

        <ScrollView
          style={{ flex: 1 }}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 20, paddingTop: 16 }]}
          keyboardShouldPersistTaps="handled"
        >
          {selectedWallet && (
            <View style={[styles.walletBadge, { marginHorizontal: 0, marginBottom: 12, marginTop: 0 }]}>
              <MaterialIcons name={selectedWallet.icon as any} size={16} color={selectedWallet.color} />
              <Text style={[styles.walletBadgeText, { color: selectedWallet.color }]}>
                {selectedWallet.name} ({currencySymbol})
              </Text>
            </View>
          )}

          {!isEditMode && !isQuick && (
            <Pressable
              onPress={() => {
                Haptics.selectionAsync();
                router.replace('/add-recurring');
              }}
              style={[styles.recurringAlertBanner, { marginHorizontal: 0, marginBottom: 16, marginTop: 0 }]}
            >
              <Ionicons name="calendar-outline" size={16} color={Colors.primary} />
              <Text style={styles.recurringAlertText}>
                {language === 'ar' 
                  ? 'هل تريد تسجيل فاتورة أو مصروف متكرر؟ اضغط هنا' 
                  : 'Want to log a monthly bill or recurring expense? Click here'}
              </Text>
              <Ionicons name={language === 'ar' ? 'chevron-back' : 'chevron-forward'} size={14} color={Colors.primary} />
            </Pressable>
          )}

          {/* Smart AI Voice/Text/OCR Input Card */}
          <View style={[styles.smartInputCard, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
            <View style={styles.smartCardHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="sparkles" size={16} color="#F59E0B" />
                <Text style={[styles.smartCardTitle, { color: colors.text }]}>
                  {language === 'ar' ? 'إدخال ذكي سريع (اكتب، تحدث، أو امسح الفاتورة)' : 'Smart Quick Input (Type, Voice, or Scan)'}
                </Text>
              </View>
            </View>

            <View style={[styles.smartInputWrapper, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <TextInput
                ref={smartInputRef}
                style={[styles.smartTextInput, { color: colors.text }]}
                placeholder={language === 'ar' 
                  ? 'اكتب أو أملِ: صرفت 45 قهوة من الكاش...' 
                  : 'Type or speak: Spent 45 coffee from Cash...'}
                placeholderTextColor={colors.textTertiary}
                value={smartInputText}
                onChangeText={(text) => {
                  setSmartInputText(text);
                  if (text.length > 3) {
                    handleSmartParse(text);
                  }
                }}
              />

              {/* 1. Paste Button */}
              <Pressable
                onPress={handlePasteClipboard}
                style={[styles.smartActionBtn, { backgroundColor: colors.primary + '14' }]}
                accessibilityLabel="Paste"
                hitSlop={4}
              >
                <Ionicons name="clipboard-outline" size={18} color={colors.primary} />
              </Pressable>

              {/* 2. Voice Input Button */}
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  setIsVoiceModalOpen(true);
                }}
                style={[
                  styles.smartActionBtn,
                  { backgroundColor: colors.primary + '14' },
                  isRecording && { backgroundColor: '#EF4444' },
                ]}
                accessibilityLabel="Voice"
                hitSlop={4}
              >
                <Ionicons 
                  name="mic" 
                  size={18} 
                  color={colors.primary} 
                />
              </Pressable>


              {/* 3. Smart OCR Camera Button */}
              <Pressable
                onPress={initiateReceiptScan}
                style={[styles.smartActionBtn, { backgroundColor: colors.primary + '14' }]}
                accessibilityLabel="OCR Scan"
                hitSlop={4}
              >
                <Ionicons name="camera-outline" size={19} color={colors.primary} />
              </Pressable>
            </View>

            {/* Smart NLP / SMS Feedback */}
            {smartMessage ? (
              <View style={[styles.smartFeedbackPill, { backgroundColor: colors.primary + '14', borderColor: colors.primary + '30' }]}>
                <Ionicons name="information-circle-outline" size={15} color={colors.primary} />
                <Text style={[styles.smartMessageText, { color: colors.primary }]}>{smartMessage}</Text>
              </View>
            ) : null}

            {/* Receipt Scan / Upload Preview Area */}
            {isScanning ? (
              <View style={styles.ocrScanningWrap}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={[styles.ocrScanningText, { color: colors.primary }]}>
                  {language === 'ar' ? 'جاري مسح الفاتورة واستخراج البيانات الذكي...' : 'Analyzing receipt & extracting data...'}
                </Text>
              </View>
            ) : receiptUri ? (
              <View style={[styles.receiptPreviewCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Image source={{ uri: receiptUri }} style={styles.receiptThumb} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.receiptAttachedText, { color: colors.text }]}>
                    {language === 'ar' ? '📷 تم إرفاق الفاتورة بالمعاملة' : '📷 Receipt attached successfully'}
                  </Text>
                </View>
                <Pressable 
                  onPress={() => {
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                    setReceiptUri('');
                  }}
                  style={styles.removeReceiptBtn}
                  hitSlop={8}
                >
                  <Ionicons name="trash-outline" size={14} color={colors.expense} />
                  <Text style={[styles.removeReceiptText, { color: colors.expense }]}>
                    {language === 'ar' ? 'حذف' : 'Remove'}
                  </Text>
                </Pressable>
              </View>
            ) : (
              <Pressable
                onPress={initiateReceiptScan}
                style={({ pressed }) => [
                  styles.ocrQuickBanner,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                  pressed && { opacity: 0.7 }
                ]}
              >
                <Ionicons name="scan-outline" size={16} color={colors.primary} />
                <Text style={[styles.ocrQuickBannerText, { color: colors.primary }]}>
                  {language === 'ar' ? 'مسح الفاتورة الذكي (OCR) | تصوير واستخراج تلقائي' : 'Smart Receipt Scanner (OCR) | Auto Extract'}
                </Text>
              </Pressable>
            )}
          </View>

          {!isQuick && (
            <View style={styles.typeToggle}>
              <Pressable
                onPress={() => handleTypeSwitch('expense')}
                style={[styles.typeBtn, type === 'expense' && styles.typeBtnActiveExpense]}
              >
                <Ionicons name="arrow-up" size={18} color={type === 'expense' ? '#fff' : Colors.expense} />
                <Text style={[styles.typeText, type === 'expense' && styles.typeTextActive]}>{t.expense}</Text>
              </Pressable>
              <Pressable
                onPress={() => handleTypeSwitch('income')}
                style={[styles.typeBtn, type === 'income' && styles.typeBtnActiveIncome]}
              >
                <Ionicons name="arrow-down" size={18} color={type === 'income' ? '#fff' : Colors.income} />
                <Text style={[styles.typeText, type === 'income' && styles.typeTextActive]}>{t.incomeType}</Text>
              </Pressable>
              <Pressable
                onPress={() => handleTypeSwitch('transfer')}
                style={[styles.typeBtn, type === 'transfer' && styles.typeBtnActiveTransfer]}
              >
                <Ionicons name="swap-horizontal" size={18} color={type === 'transfer' ? '#fff' : Colors.textSecondary} />
                <Text style={[styles.typeText, type === 'transfer' && styles.typeTextActive]}>
                  {language === 'ar' ? 'تحويل' : 'Transfer'}
                </Text>
              </Pressable>
            </View>
          )}

          <View style={styles.amountSection}>
            <Text style={styles.label}>{t.amount}</Text>
            <View style={styles.amountInputWrap}>
              <View style={styles.currencyTag}>
                <Text style={[styles.currencyTagCode, { color: selectedWallet?.color || Colors.primary }]}>
                  {selectedWallet?.currency || 'EGP'}
                </Text>
                <Text style={styles.currencyTagSymbol}>{currencySymbol}</Text>
              </View>
              <TextInput
                style={styles.amountInput}
                placeholder="0.00"
                placeholderTextColor={Colors.textTertiary}
                keyboardType="decimal-pad"
                value={amount}
                onChangeText={(text) => setAmount(normalizeAmountInput(text))}
                textAlign="right"
              />
              <Pressable
                onPress={() => {
                  Haptics.selectionAsync();
                  setCalcExpression(amount);
                  setCalcResult(amount);
                  setCalcModalVisible(true);
                }}
                style={({ pressed }) => [styles.calcTriggerBtn, pressed && { opacity: 0.7 }]}
                hitSlop={8}
              >
                <Ionicons name="calculator-outline" size={24} color={selectedWallet?.color || Colors.primary} />
              </Pressable>
            </View>

            {/* Budget Warning Alert on Screen */}
            {isOverBudget && (
              <View style={styles.budgetWarningContainer}>
                <Ionicons name="warning-outline" size={18} color={Colors.expense} />
                <Text style={styles.budgetWarningText}>
                  {t.budgetExceededWarning
                    .replace('{category}', getCategoryName(selectedCategory, language))
                    .replace('{over}', formatCurrency(overBudgetAmount) + ' ' + currencySymbol)}
                </Text>
              </View>
            )}
          </View>

          {type === 'transfer' ? (
            <View style={styles.section}>
              <Text style={styles.label}>
                {language === 'ar' ? 'إلى محفظة' : 'To Wallet'}
              </Text>
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.walletsScrollContent}
              >
                {wallets.filter(w => w.id !== selectedWallet?.id).map(w => (
                  <Pressable
                    key={w.id}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setToWalletId(w.id);
                    }}
                    style={[
                      styles.walletChip,
                      toWalletId === w.id && { backgroundColor: w.color + '18', borderColor: w.color },
                    ]}
                  >
                    <MaterialIcons name={w.icon as any || 'account-balance-wallet'} size={18} color={w.color} />
                    <Text style={[styles.walletChipText, toWalletId === w.id && { color: w.color, fontFamily: 'Cairo_700Bold' }]}>
                      {w.name}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          ) : (
            <View style={styles.categorySection}>
              <Text style={styles.label}>{t.category}</Text>
              <View style={styles.categoryGrid}>
                {displayedCategories.map((cat) => {
                  const isCustom = Boolean((cat as any).isCustom);
                  return (
                    <Pressable
                      key={cat.id}
                      onPress={() => {
                        Haptics.selectionAsync();
                        setSelectedCategory(cat.id);
                      }}
                      onLongPress={() => {
                        if (isCustom) {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                          handleOpenEditCategory(cat);
                        }
                      }}
                      style={[
                        styles.categoryItem,
                        selectedCategory === cat.id && { borderColor: cat.color, borderWidth: 2 },
                        { position: 'relative' }
                      ]}
                    >
                      {isCustom && (
                        <Pressable
                          onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            handleOpenEditCategory(cat);
                          }}
                          hitSlop={8}
                          style={{
                            position: 'absolute',
                            top: 4,
                            right: 4,
                            zIndex: 10,
                            backgroundColor: colors.surfaceAlt || '#0F172A',
                            borderRadius: 10,
                            padding: 3,
                            borderWidth: 1,
                            borderColor: cat.color + '60',
                          }}
                        >
                          <Ionicons name="pencil" size={11} color={cat.color} />
                        </Pressable>
                      )}
                      <View style={[styles.categoryIcon, { backgroundColor: cat.color + '18' }]}>
                        <MaterialIcons name={cat.icon as any} size={22} color={cat.color} />
                      </View>
                      <Text style={[
                        styles.categoryName,
                        selectedCategory === cat.id && { color: cat.color, fontFamily: 'Cairo_700Bold' as const },
                      ]}>
                        {getCategoryName(cat.id, language)}
                      </Text>
                    </Pressable>
                  );
                })}

                {/* Add Custom Category Card */}
                <Pressable
                  onPress={() => {
                    Haptics.selectionAsync();
                    handleOpenNewCategory();
                  }}
                  style={[styles.categoryItem, styles.addCategoryItem]}
                >
                  <View style={[styles.categoryIcon, { backgroundColor: Colors.primary + '15' }]}>
                    <Ionicons name="add" size={24} color={Colors.primary} />
                  </View>
                  <Text style={[styles.categoryName, { color: Colors.primary, fontFamily: 'Cairo_700Bold' as const }]}>
                    {t.newCategory}
                  </Text>
                </Pressable>
              </View>
            </View>
          )}

          {/* Description / Note */}
          <View style={styles.descSection}>
            <Text style={styles.label}>{t.noteOptional}</Text>
            <TextInput
              style={styles.descInput}
              placeholder={t.notePlaceholder}
              placeholderTextColor={Colors.textTertiary}
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={2}
              textAlignVertical="top"
            />
          </View>

          {/* Smart Tags Section */}
          <View style={styles.descSection}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <Text style={[styles.label, { marginBottom: 0 }]}>
                {language === 'ar' ? 'الوسوم الذكية (Tags)' : 'Smart Tags'}
              </Text>
              <Pressable
                onPress={() => {
                  Haptics.selectionAsync();
                  setNewTagNameAr('');
                  setNewTagNameEn('');
                  setNewTagColor(WALLET_COLORS[0]);
                  setTagModalVisible(true);
                }}
                hitSlop={6}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
              >
                <Ionicons name="add-circle" size={16} color={colors.primary} />
                <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 11, color: colors.primary }}>
                  {language === 'ar' ? 'وسم مخصص' : 'New Tag'}
                </Text>
              </Pressable>
            </View>

            {/* Selected / custom tags input */}
            <TextInput
              style={[styles.descInput, { height: 40, paddingVertical: 8 }]}
              placeholder={language === 'ar' ? 'اختر من الأسفل أو اكتب وسوماً مفصولة بفاصلة...' : 'Pick below or type tags comma-separated...'}
              placeholderTextColor={Colors.textTertiary}
              value={tags}
              onChangeText={setTags}
            />

            {/* Smart Tag Chips */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
              {availableTags.map(tagObj => {
                const currentTags = parseTransactionTags(tags);
                const isActive = currentTags.includes(tagObj.id) || currentTags.includes(tagObj.nameAr) || currentTags.includes(tagObj.nameEn);

                return (
                  <Pressable
                    key={tagObj.id}
                    onPress={() => {
                      Haptics.selectionAsync();
                      let updated: string[];
                      if (isActive) {
                        updated = currentTags.filter(
                          t => t !== tagObj.id && t !== tagObj.nameAr && t !== tagObj.nameEn
                        );
                      } else {
                        updated = [...currentTags, tagObj.id];
                      }
                      setTags(formatTagsToString(updated));
                    }}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 4,
                      paddingVertical: 5,
                      paddingHorizontal: 10,
                      borderRadius: 10,
                      backgroundColor: isActive ? tagObj.color + '25' : colors.surfaceAlt,
                      borderWidth: 1,
                      borderColor: isActive ? tagObj.color : colors.border,
                    }}
                  >
                    <Ionicons name="pricetag" size={11} color={isActive ? tagObj.color : colors.textTertiary} />
                    <Text
                      style={{
                        fontFamily: isActive ? 'Cairo_700Bold' : 'Cairo_600SemiBold',
                        fontSize: 11,
                        color: isActive ? tagObj.color : colors.textSecondary,
                      }}
                    >
                      {language === 'ar' ? tagObj.nameAr : tagObj.nameEn}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Unified Date & Time Duo-Pill Section */}
          <View style={[styles.dateTimeCard, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
            <View style={styles.dateTimeHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="calendar-outline" size={16} color={colors.primary} />
                <Text style={[styles.label, { marginBottom: 0, color: colors.text }]}>
                  {language === 'ar' ? 'التاريخ والوقت' : 'Date & Time'}
                </Text>
              </View>
              <Pressable
                onPress={() => {
                  Haptics.selectionAsync();
                  const now = new Date();
                  setSelectedDay(now.getDate());
                  setSelectedMonth(now.getMonth());
                  setSelectedYear(now.getFullYear());
                  let h = now.getHours();
                  const m = now.getMinutes();
                  const p: 'AM' | 'PM' = h >= 12 ? 'PM' : 'AM';
                  h = h % 12 || 12;
                  setSelectedHour(h);
                  setSelectedMinute(m);
                  setSelectedPeriod(p);
                }}
                style={({ pressed }) => [
                  styles.quickNowBadge,
                  { backgroundColor: colors.primary + '18' },
                  pressed && { opacity: 0.7 }
                ]}
              >
                <Ionicons name="flash" size={12} color={colors.primary} />
                <Text style={[styles.quickNowBadgeText, { color: colors.primary }]}>
                  {language === 'ar' ? 'الآن' : 'Now'}
                </Text>
              </Pressable>
            </View>

            <View style={styles.dateTimeRow}>
              {/* Date Button Pill */}
              <Pressable
                onPress={() => {
                  Haptics.selectionAsync();
                  setShowDatePicker(true);
                }}
                style={({ pressed }) => [
                  styles.dateTimePill,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                  pressed && { opacity: 0.8 }
                ]}
              >
                <Ionicons name="calendar" size={18} color={colors.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.dateTimePillSub, { color: colors.textTertiary }]}>
                    {language === 'ar' ? 'التاريخ' : 'Date'}
                  </Text>
                  <Text style={[styles.dateTimePillMain, { color: colors.text }]} numberOfLines={1}>
                    {selectedDateLabel}
                  </Text>
                </View>
                <Ionicons name="chevron-down" size={14} color={colors.textTertiary} />
              </Pressable>

              {/* Time Button Pill */}
              <Pressable
                onPress={() => {
                  Haptics.selectionAsync();
                  setShowTimePicker(true);
                }}
                style={({ pressed }) => [
                  styles.dateTimePill,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                  pressed && { opacity: 0.8 }
                ]}
              >
                <Ionicons name="time" size={18} color={colors.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.dateTimePillSub, { color: colors.textTertiary }]}>
                    {language === 'ar' ? 'الوقت' : 'Time'}
                  </Text>
                  <Text style={[styles.dateTimePillMain, { color: colors.text }]} numberOfLines={1}>
                    {selectedHour}:{selectedMinute.toString().padStart(2, '0')} {language === 'ar' ? (selectedPeriod === 'AM' ? 'ص' : 'م') : selectedPeriod}
                  </Text>
                </View>
                <Ionicons name="chevron-down" size={14} color={colors.textTertiary} />
              </Pressable>
            </View>
          </View>

          {(() => {
            const isDisabled = isSaving || !amount || parseFloat(amount) <= 0 || (type === 'transfer' ? !toWalletId : !selectedCategory);
            const btnColor = type === 'expense'
              ? Colors.expense
              : type === 'income'
                ? Colors.income
                : '#3b82f6'; // Transfer blue color

            let buttonLabel = '';
            if (language === 'ar') {
              if (isEditMode) {
                if (type === 'expense') buttonLabel = 'تحديث المصروف';
                else if (type === 'income') buttonLabel = 'تحديث الدخل';
                else buttonLabel = 'تحديث التحويل';
              } else {
                if (type === 'expense') buttonLabel = 'حفظ المصروف';
                else if (type === 'income') buttonLabel = 'حفظ الدخل';
                else buttonLabel = 'حفظ التحويل';
              }
            } else {
              if (isEditMode) {
                if (type === 'expense') buttonLabel = 'Update Expense';
                else if (type === 'income') buttonLabel = 'Update Income';
                else buttonLabel = 'Update Transfer';
              } else {
                if (type === 'expense') buttonLabel = 'Save Expense';
                else if (type === 'income') buttonLabel = 'Save Income';
                else buttonLabel = 'Save Transfer';
              }
            }

            return (
              <Pressable
                onPress={handleSave}
                disabled={isDisabled}
                style={({ pressed }) => [
                  styles.saveButton,
                  {
                    backgroundColor: btnColor,
                    opacity: isDisabled ? 0.5 : pressed ? 0.9 : 1,
                    transform: [{ scale: pressed ? 0.98 : 1 }],
                  },
                ]}
              >
                <Ionicons name={type === 'transfer' ? "swap-horizontal" : "checkmark"} size={22} color="#fff" />
                <Text style={styles.saveText}>
                  {buttonLabel}
                </Text>
              </Pressable>
            );
          })()}
        </ScrollView>
      </View>

      {/* Modern Calendar Date Picker Modal */}
      <ModernDatePickerModal
        visible={showDatePicker}
        onClose={() => setShowDatePicker(false)}
        selectedDay={selectedDay}
        selectedMonth={selectedMonth}
        selectedYear={selectedYear}
        onSelectDate={(d, m, y) => {
          setSelectedDay(d);
          setSelectedMonth(m);
          setSelectedYear(y);
        }}
      />

      {/* Modern Time Picker Modal (iOS Wheel + Manual Keypad) */}
      <ModernTimePickerModal
        visible={showTimePicker}
        onClose={() => setShowTimePicker(false)}
        hour={selectedHour}
        minute={selectedMinute}
        period={selectedPeriod}
        onConfirm={(h, m, p) => {
          setSelectedHour(h);
          setSelectedMinute(m);
          setSelectedPeriod(p);
        }}
      />

      {/* Calculator Modal */}
      <Modal visible={calcModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <SafeAreaView style={styles.calcSheet}>
            <View style={styles.calcHeader}>
              <Pressable onPress={() => setCalcModalVisible(false)} hitSlop={12} style={styles.closeBtn}>
                <Ionicons name="close" size={22} color={Colors.text} />
              </Pressable>
              <Text style={styles.calcTitle}>{t.calculator}</Text>
              <Pressable onPress={handleCalcConfirm} hitSlop={12} style={styles.calcConfirmBtn}>
                <Ionicons name="checkmark" size={22} color={Colors.primary} />
              </Pressable>
            </View>

            {/* Display screen */}
            <View style={styles.calcDisplay}>
              <Text style={styles.calcExprText} numberOfLines={1}>
                {calcExpression || '0'}
              </Text>
              <Text style={styles.calcResultText} numberOfLines={1}>
                {calcResult ? `= ${calcResult}` : ''}
              </Text>
            </View>

            {/* Pad Grid */}
            <View style={styles.calcPad}>
              {/* Row 1 */}
              <View style={styles.calcRow}>
                {['7', '8', '9', '/'].map(key => (
                  <Pressable
                    key={key}
                    style={({ pressed }) => [styles.calcKey, ['/'].includes(key) && styles.calcKeyOp, pressed && styles.calcKeyPressed]}
                    onPress={() => handleCalcKeyPress(key)}
                  >
                    <Text style={[styles.calcKeyText, ['/'].includes(key) && styles.calcKeyOpText]}>
                      {key === '/' ? '÷' : key}
                    </Text>
                  </Pressable>
                ))}
              </View>
              {/* Row 2 */}
              <View style={styles.calcRow}>
                {['4', '5', '6', '*'].map(key => (
                  <Pressable
                    key={key}
                    style={({ pressed }) => [styles.calcKey, ['*'].includes(key) && styles.calcKeyOp, pressed && styles.calcKeyPressed]}
                    onPress={() => handleCalcKeyPress(key)}
                  >
                    <Text style={[styles.calcKeyText, ['*'].includes(key) && styles.calcKeyOpText]}>
                      {key === '*' ? '×' : key}
                    </Text>
                  </Pressable>
                ))}
              </View>
              {/* Row 3 */}
              <View style={styles.calcRow}>
                {['1', '2', '3', '-'].map(key => (
                  <Pressable
                    key={key}
                    style={({ pressed }) => [styles.calcKey, ['-'].includes(key) && styles.calcKeyOp, pressed && styles.calcKeyPressed]}
                    onPress={() => handleCalcKeyPress(key)}
                  >
                    <Text style={[styles.calcKeyText, ['-'].includes(key) && styles.calcKeyOpText]}>
                      {key}
                    </Text>
                  </Pressable>
                ))}
              </View>
              {/* Row 4 */}
              <View style={styles.calcRow}>
                <Pressable
                  style={({ pressed }) => [styles.calcKey, styles.calcKeyClear, pressed && styles.calcKeyPressed]}
                  onPress={handleCalcClear}
                >
                  <Text style={styles.calcKeyClearText}>C</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [styles.calcKey, pressed && styles.calcKeyPressed]}
                  onPress={() => handleCalcKeyPress('0')}
                >
                  <Text style={styles.calcKeyText}>0</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [styles.calcKey, pressed && styles.calcKeyPressed]}
                  onPress={() => handleCalcKeyPress('.')}
                >
                  <Text style={styles.calcKeyText}>.</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [styles.calcKey, styles.calcKeyOp, pressed && styles.calcKeyPressed]}
                  onPress={() => handleCalcKeyPress('+')}
                >
                  <Text style={[styles.calcKeyText, styles.calcKeyOpText]}>+</Text>
                </Pressable>
              </View>
              {/* Confirm Row */}
              <View style={styles.calcRow}>
                <Pressable
                  style={({ pressed }) => [styles.calcKeyBackspace, pressed && styles.calcKeyPressed]}
                  onPress={handleCalcBackspace}
                >
                  <Ionicons name="backspace-outline" size={24} color={Colors.text} />
                </Pressable>
                <Pressable
                  style={({ pressed }) => [styles.calcKeyConfirm, { backgroundColor: selectedWallet?.color || Colors.primary }, pressed && { opacity: 0.9 }]}
                  onPress={handleCalcConfirm}
                >
                  <Text style={styles.calcKeyConfirmText}>{t.save}</Text>
                </Pressable>
              </View>
            </View>
          </SafeAreaView>
        </View>
      </Modal>

      {/* Custom Category Modal */}
      <Modal visible={customModalVisible} animationType="slide" transparent onRequestClose={() => setCustomModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <SafeAreaView style={styles.customCatSheet}>
            <View style={styles.calcHeader}>
              <Pressable onPress={() => setCustomModalVisible(false)} hitSlop={12} style={styles.closeBtn}>
                <Ionicons name="close" size={22} color={Colors.text} />
              </Pressable>
              <Text style={styles.calcTitle}>
                {editingCategory ? (language === 'ar' ? 'تعديل الفئة' : 'Edit Category') : t.newCategory}
              </Text>
              <Pressable onPress={handleSaveCustomCategory} hitSlop={12} style={styles.calcConfirmBtn}>
                <Ionicons name="checkmark" size={22} color={Colors.primary} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.customCatBody} keyboardShouldPersistTaps="handled">
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

              {/* Color Grid Selector (Including Soft Light Pink & Pastel Colors) */}
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
                          isSelected && { borderColor: '#FFFFFF', borderWidth: 2.5, transform: [{ scale: 1.12 }] }
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
                          isSelected && { borderColor: customColor, borderWidth: 2, backgroundColor: customColor + '20' }
                        ]}
                      >
                        <MaterialIcons name={ic as any} size={22} color={isSelected ? customColor : Colors.textSecondary} />
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            </ScrollView>

            {/* Pinned Bottom Footer Save & Delete Buttons */}
            <View style={[styles.modalFooter, { flexDirection: 'row', gap: 10, paddingBottom: Math.max(insets.bottom, 16) + 8 }]}>
              {editingCategory && (
                <Pressable
                  onPress={handleDeleteCategory}
                  style={({ pressed }) => [
                    styles.modalSaveBtn,
                    { flex: 1, backgroundColor: '#EF4444' },
                    pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] }
                  ]}
                >
                  <Ionicons name="trash-outline" size={18} color="#FFFFFF" style={{ marginRight: 4 }} />
                  <Text style={styles.modalSaveText}>
                    {language === 'ar' ? 'حذف الفئة' : 'Delete'}
                  </Text>
                </Pressable>
              )}

              <Pressable
                onPress={handleSaveCustomCategory}
                style={({ pressed }) => [
                  styles.modalSaveBtn,
                  { flex: 2, backgroundColor: customColor || Colors.primary },
                  pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] }
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

      {/* Custom Tag Creator Modal */}
      <Modal visible={tagModalVisible} animationType="slide" transparent onRequestClose={() => setTagModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <SafeAreaView style={styles.customCatSheet}>
            <View style={styles.calcHeader}>
              <Pressable onPress={() => setTagModalVisible(false)} hitSlop={12} style={styles.closeBtn}>
                <Ionicons name="close" size={22} color={Colors.text} />
              </Pressable>
              <Text style={styles.calcTitle}>
                {language === 'ar' ? 'إنشاء وسم جديد' : 'New Custom Tag'}
              </Text>
              <Pressable
                onPress={async () => {
                  const ar = newTagNameAr.trim();
                  let en = newTagNameEn.trim();
                  if (!ar && !en) {
                    Alert.alert(language === 'ar' ? 'تنبيه' : 'Alert', language === 'ar' ? 'يرجى كتابة اسم الوسم' : 'Please enter tag name');
                    return;
                  }
                  if (!en) en = ar;
                  const finalAr = ar || en;
                  try {
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                    const created = await saveCustomTag({
                      nameAr: finalAr,
                      nameEn: en,
                      color: newTagColor,
                      icon: 'pricetag',
                    });
                    setAvailableTags(prev => [...prev, created]);
                    const currentTags = parseTransactionTags(tags);
                    setTags(formatTagsToString([...currentTags, created.id]));
                    setTagModalVisible(false);
                  } catch (e) {
                    console.error('Error saving tag:', e);
                  }
                }}
                hitSlop={12}
                style={styles.calcConfirmBtn}
              >
                <Ionicons name="checkmark" size={22} color={Colors.primary} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.customCatBody} keyboardShouldPersistTaps="handled">
              <View style={styles.formGroup}>
                <Text style={styles.label}>{language === 'ar' ? 'اسم الوسم بالعربية' : 'Tag Name (Arabic)'}</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="مثال: مشروع تخرج، رحلة أبها، مناسبة..."
                  placeholderTextColor={Colors.textTertiary}
                  value={newTagNameAr}
                  onChangeText={setNewTagNameAr}
                  textAlign={language === 'ar' ? 'right' : 'left'}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>{language === 'ar' ? 'اسم الوسم بالإنجليزية (اختياري)' : 'Tag Name (English)'}</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="e.g. Abha Trip, Project..."
                  placeholderTextColor={Colors.textTertiary}
                  value={newTagNameEn}
                  onChangeText={setNewTagNameEn}
                  textAlign="left"
                />
              </View>

              {/* Color Grid Selector */}
              <View style={styles.formGroup}>
                <Text style={styles.label}>{t.selectColor}</Text>
                <View style={styles.colorsGrid}>
                  {WALLET_COLORS.map(c => {
                    const isSelected = newTagColor === c;
                    return (
                      <Pressable
                        key={c}
                        onPress={() => {
                          Haptics.selectionAsync();
                          setNewTagColor(c);
                        }}
                        style={[
                          styles.colorCircle,
                          { backgroundColor: c },
                          isSelected && { borderColor: '#FFFFFF', borderWidth: 2.5, transform: [{ scale: 1.12 }] }
                        ]}
                      >
                        {isSelected && <Ionicons name="checkmark" size={18} color="#FFFFFF" />}
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            </ScrollView>
          </SafeAreaView>
        </View>
      </Modal>

      {/* Voice-to-Transaction AI Modal */}
      <VoiceTransactionModal
        visible={isVoiceModalOpen}
        onClose={() => setIsVoiceModalOpen(false)}
        onSuccess={() => {
          router.replace('/');
        }}
      />
    </KeyboardAvoidingView>
  );
}


const getStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 4,
  },
  sheetTitle: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 20,
    color: colors.text,
  },
  walletBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginHorizontal: 20,
    marginTop: 4,
    marginBottom: 4,
    backgroundColor: colors.surfaceAlt,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 4,
    gap: 6,
  },
  walletBadgeText: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 12,
  },
  scrollContent: {
    paddingHorizontal: 20,
  },
  typeToggle: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceAlt,
    borderRadius: 14,
    padding: 4,
    marginBottom: 20,
    marginTop: 8,
  },
  typeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    gap: 6,
  },
  typeBtnActiveExpense: {
    backgroundColor: colors.expense,
  },
  typeBtnActiveIncome: {
    backgroundColor: colors.income,
  },
  typeBtnActiveTransfer: {
    backgroundColor: '#3b82f6',
  },
  typeText: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 15,
    color: colors.textSecondary,
  },
  typeTextActive: {
    color: colors.text,
  },
  amountSection: {
    marginBottom: 20,
  },
  section: {
    marginBottom: 20,
  },
  walletsScrollContent: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 4,
  },
  walletChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    borderWidth: 2,
    borderColor: 'transparent',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  walletChipText: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 14,
    color: colors.textSecondary,
  },
  label: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 8,
  },
  amountInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    borderRadius: 16,
    paddingRight: 16,
    paddingLeft: 4,
    height: 72,
    gap: 12,
  },
  currencyTag: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  currencyTagCode: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 15,
  },
  currencyTagSymbol: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: -2,
  },
  amountInput: {
    flex: 1,
    fontFamily: 'Cairo_700Bold',
    fontSize: 32,
    color: colors.text,
  },
  calcTriggerBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  budgetWarningContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.expense + '12',
    borderWidth: 1,
    borderColor: colors.expense + '24',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 10,
    gap: 8,
  },
  budgetWarningText: {
    flex: 1,
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 12,
    color: colors.expense,
    textAlign: 'left',
  },
  categorySection: {
    marginBottom: 20,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryItem: {
    width: '30%',
    flexGrow: 1,
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 4,
    gap: 6,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  addCategoryItem: {
    borderColor: colors.primary + '30',
    borderStyle: 'dashed',
    backgroundColor: 'transparent',
  },
  categoryIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryName: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 12,
    color: colors.text,
    textAlign: 'center',
  },
  descSection: {
    marginBottom: 16,
  },
  descInput: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: 14,
    padding: 14,
    fontFamily: 'Cairo_400Regular',
    fontSize: 15,
    color: colors.text,
    minHeight: 60,
  },
  smartInputCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    marginBottom: 16,
  },
  smartCardHeader: {
    marginBottom: 8,
  },
  smartCardTitle: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 13,
  },
  smartInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 10,
    height: 48,
    gap: 6,
  },
  smartTextInput: {
    flex: 1,
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 13,
    paddingVertical: 0,
  },
  smartActionBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  micBtnActive: {
    backgroundColor: '#EF4444',
  },
  smartFeedbackPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 8,
  },
  smartMessageText: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 12,
  },
  ocrScanningWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 10,
    paddingVertical: 6,
  },
  ocrScanningText: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 12,
  },
  receiptPreviewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 10,
    padding: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  receiptThumb: {
    width: 44,
    height: 44,
    borderRadius: 6,
  },
  receiptAttachedText: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 12,
  },
  removeReceiptBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  removeReceiptText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 12,
  },
  ocrQuickBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 10,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  ocrQuickBannerText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 12,
  },
  dateTimeCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    marginBottom: 20,
  },
  dateTimeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  quickNowBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  quickNowBadgeText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 11,
  },
  dateTimeRow: {
    flexDirection: 'row',
    gap: 10,
  },
  dateTimePill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  dateTimePillSub: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 10,
    lineHeight: 13,
  },
  dateTimePillMain: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 13,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 14,
    gap: 8,
    marginBottom: 20,
  },
  saveText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 17,
    color: colors.text,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  datePickerSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '70%',
    paddingBottom: 32,
  },
  datePickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  datePickerTitle: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 18,
    color: colors.text,
  },
  dateList: {
    paddingHorizontal: 16,
  },
  dateOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginVertical: 2,
  },
  dateOptionActive: {
    backgroundColor: colors.primary + '12',
  },
  dateOptionText: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 15,
    color: colors.text,
  },
  dateOptionTextActive: {
    fontFamily: 'Cairo_600SemiBold',
    color: colors.primary,
  },
  // Calculator Modal styles
  calcSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 20,
  },
  calcHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  calcTitle: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 18,
    color: colors.text,
  },
  calcConfirmBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.primary + '12',
  },
  calcDisplay: {
    backgroundColor: colors.surfaceAlt,
    padding: 20,
    alignItems: 'flex-end',
    height: 100,
    justifyContent: 'center',
    gap: 4,
  },
  calcExprText: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 22,
    color: colors.textSecondary,
  },
  calcResultText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 28,
    color: colors.text,
  },
  calcPad: {
    padding: 16,
    gap: 10,
  },
  calcRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  calcKey: {
    flex: 1,
    aspectRatio: 1.6,
    borderRadius: 12,
    backgroundColor: colors.surfaceAlt,
    justifyContent: 'center',
    alignItems: 'center',
  },
  calcKeyPressed: {
    opacity: 0.7,
  },
  calcKeyOp: {
    backgroundColor: colors.primary + '12',
  },
  calcKeyText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 20,
    color: colors.text,
  },
  calcKeyOpText: {
    color: colors.primary,
    fontSize: 22,
  },
  calcKeyClear: {
    backgroundColor: colors.expense + '15',
  },
  calcKeyClearText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 20,
    color: colors.expense,
  },
  calcKeyBackspace: {
    flex: 1,
    aspectRatio: 1.6,
    borderRadius: 12,
    backgroundColor: colors.surfaceAlt,
    justifyContent: 'center',
    alignItems: 'center',
  },
  calcKeyConfirm: {
    flex: 3,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  calcKeyConfirmText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 18,
    color: colors.text,
  },
  // Custom Category Modal styles
  customCatSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
    flexDirection: 'column',
  },
  customCatBody: {
    padding: 20,
    paddingBottom: 30,
    gap: 16,
  },
  formGroup: {
    gap: 8,
  },
  modalInput: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 16,
    color: colors.text,
  },
  colorsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'center',
    paddingVertical: 6,
  },
  colorCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 2,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
    paddingVertical: 6,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.surfaceAlt,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  modalFooter: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  modalSaveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
    borderRadius: 14,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  modalSaveText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 15,
    color: '#FFFFFF',
  },
  recurringAlertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary + '10',
    marginHorizontal: 20,
    marginTop: 8,
    padding: 12,
    borderRadius: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: colors.primary + '25',
  },
  recurringAlertText: {
    flex: 1,
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 12,
    color: colors.primary,
    textAlign: 'left',
  },
});
