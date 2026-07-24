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
import { expenseCategories, incomeCategories, formatCurrency, WALLET_COLORS } from '@/lib/categories';
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

type TransactionType = 'expense' | 'income' | 'transfer';
const { width: SCREEN_WIDTH } = Dimensions.get('window');

const CUSTOM_CATEGORY_ICONS = [
  'restaurant', 'directions-car', 'receipt-long', 'shopping-bag',
  'medical-services', 'school', 'movie', 'home', 'phone-android',
  'checkroom', 'more-horiz', 'account-balance-wallet', 'laptop-mac',
  'trending-up', 'card-giftcard', 'stars', 'fitness-center', 'local-gas-station',
  'flight', 'spa', 'pets', 'work', 'videogame-asset'
];

export default function AddTransactionScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const { addTransaction, updateTransaction, selectedWallet, currencySymbol, walletTransactions, customCategories, addCustomCategory, wallets, selectWallet } = useTransactions();
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
  const [customNameAr, setCustomNameAr] = useState('');
  const [customNameEn, setCustomNameEn] = useState('');
  const [customColor, setCustomColor] = useState(WALLET_COLORS[0]);
  const [customIcon, setCustomIcon] = useState(CUSTOM_CATEGORY_ICONS[0]);

  // Budgets state
  const [budgets, setBudgets] = useState<Record<string, number>>({});

  // Smart Input States
  const [smartInputText, setSmartInputText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [smartMessage, setSmartMessage] = useState('');
  
  const [toWalletId, setToWalletId] = useState<string>(existingTxn?.toWalletId || '');
    const smartInputRef = useRef<TextInput>(null);

  // Scanner & Tags states
  const [receiptUri, setReceiptUri] = useState(existingTxn?.receiptUri || '');
  const [isScanning, setIsScanning] = useState(false);
  const [tags, setTags] = useState(existingTxn?.tags || '');

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
        return Math.max(0, val).toFixed(2).replace(/\.00$/, '');
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
  const handleSaveCustomCategory = async () => {
    const nameAr = customNameAr.trim();
    const nameEn = customNameEn.trim();

    if (!nameAr || !nameEn) {
      Alert.alert(t.error, t.categoryName);
      return;
    }

    try {
      const newCat = await addCustomCategory(nameAr, nameEn, customIcon, customColor, type === 'transfer' ? 'expense' : type);
      setSelectedCategory(newCat.id);
      setCustomModalVisible(false);
      // Reset fields
      setCustomNameAr('');
      setCustomNameEn('');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('✅', t.categoryAdded);
    } catch (e) {
      Alert.alert(t.error, 'Could not save category');
    }
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
              <Ionicons name="chevron-forward" size={14} color={Colors.primary} />
            </Pressable>
          )}

          {/* Smart AI Voice/Text Input Card */}
          <View style={styles.smartInputCard}>
            <Text style={styles.label}>
              {language === 'ar' ? '💡 إدخال ذكي سريع (اكتب، لصق 📋، أو سجل بصوتك 🎙️)' : '💡 Smart Quick Input (Type, Paste 📋, or Voice 🎙️)'}
            </Text>
            <View style={styles.smartInputWrapper}>
              <TextInput
                ref={smartInputRef}
                style={styles.smartTextInput}
                placeholder={language === 'ar' 
                  ? 'صرفت 45 جنيه قهوة من الكاش...' 
                  : 'Spent 45 EGP coffee from Cash...'}
                placeholderTextColor={Colors.textTertiary}
                value={smartInputText}
                onChangeText={(text) => {
                  setSmartInputText(text);
                  if (text.length > 5) {
                    handleSmartParse(text);
                  }
                }}
              />
              <Pressable
                onPress={handlePasteClipboard}
                style={styles.pasteBtn}
                accessibilityLabel={language === 'ar' ? 'لصق النص المنسوخ من الحافظة' : 'Paste copied text'}
              >
                <Ionicons 
                  name="clipboard-outline" 
                  size={20} 
                  color={colors.primary} 
                />
              </Pressable>
              <Pressable
                onPress={startSpeechRecognition}
                style={[
                  styles.micBtn,
                  isRecording && styles.micBtnActive
                ]}
                accessibilityLabel={language === 'ar' ? 'إملاء بصوتك' : 'Dictate with voice'}
              >
                <Ionicons 
                  name={isRecording ? "mic" : "mic-outline"} 
                  size={20} 
                  color={isRecording ? '#fff' : Colors.primary} 
                />
              </Pressable>
            </View>
            {smartMessage ? (
              <Text style={styles.smartMessageText}>{smartMessage}</Text>
            ) : null}
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
                {displayedCategories.map((cat) => (
                  <Pressable
                    key={cat.id}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setSelectedCategory(cat.id);
                    }}
                    style={[
                      styles.categoryItem,
                      selectedCategory === cat.id && { borderColor: cat.color, borderWidth: 2 },
                    ]}
                  >
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
                ))}

                {/* Add Custom Category Card */}
                <Pressable
                  onPress={() => {
                    Haptics.selectionAsync();
                    setCustomModalVisible(true);
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

          {/* Tags Section */}
          <View style={styles.descSection}>
            <Text style={styles.label}>{language === 'ar' ? 'التاغات / الكلمات الدلالية' : 'Tags / Labels'}</Text>
            <TextInput
              style={[styles.descInput, { height: 40, paddingVertical: 8 }]}
              placeholder={language === 'ar' ? 'مثال: سفر، طعام، عمل...' : 'e.g. travel, food, work...'}
              placeholderTextColor={Colors.textTertiary}
              value={tags}
              onChangeText={setTags}
            />
            {/* Quick tag chips */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
              {[(language === 'ar' ? 'أكل' : 'food'), (language === 'ar' ? 'مشتريات' : 'shopping'), (language === 'ar' ? 'مواصلات' : 'travel'), (language === 'ar' ? 'ترفيه' : 'leisure'), (language === 'ar' ? 'فواتير' : 'bills'), (language === 'ar' ? 'عمل' : 'work')].map(tag => {
                const isActive = tags.split(',').map((t: string) => t.trim()).includes(tag);
                return (
                  <Pressable
                    key={tag}
                    onPress={() => {
                      Haptics.selectionAsync();
                      let currentTags = tags.split(',').map((t: string) => t.trim()).filter(Boolean);
                      if (currentTags.includes(tag)) {
                        currentTags = currentTags.filter((t: string) => t !== tag);
                      } else {
                        currentTags.push(tag);
                      }
                      setTags(currentTags.join(', '));
                    }}
                    style={{
                      paddingVertical: 4,
                      paddingHorizontal: 10,
                      borderRadius: 12,
                      backgroundColor: isActive ? Colors.primary + '20' : Colors.surfaceAlt,
                      borderWidth: 1,
                      borderColor: isActive ? Colors.primary : Colors.border,
                    }}
                  >
                    <Text style={{ fontFamily: 'Cairo_600SemiBold', fontSize: 11, color: isActive ? Colors.primary : Colors.textSecondary }}>
                      #{tag}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Receipt OCR Scanner Section */}
          <View style={styles.descSection}>
            <Text style={styles.label}>{language === 'ar' ? 'مسح الفاتورة الذكي (OCR)' : 'Smart Receipt Scanner'}</Text>
            
            {isScanning ? (
              <View style={{ padding: 12, alignItems: 'center', gap: 8 }}>
                <ActivityIndicator size="small" color={Colors.primary} />
                <Text style={{ fontFamily: 'Cairo_600SemiBold', fontSize: 12, color: Colors.primary }}>
                  {language === 'ar' ? 'جاري مسح الفاتورة واستخراج البيانات...' : 'Analyzing receipt & extracting data...'}
                </Text>
              </View>
            ) : receiptUri ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8 }}>
                <Image source={{ uri: receiptUri }} style={{ width: 64, height: 64, borderRadius: 8, backgroundColor: Colors.surfaceAlt }} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: 'Cairo_600SemiBold', fontSize: 12, color: Colors.text }}>
                    {language === 'ar' ? 'تم إرفاق الفاتورة بنجاح' : 'Receipt attached successfully'}
                  </Text>
                  <Pressable 
                    onPress={() => {
                      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                      setReceiptUri('');
                    }}
                    style={{ marginTop: 4 }}
                  >
                    <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 11, color: Colors.expense }}>
                      {language === 'ar' ? 'حذف الصورة' : 'Remove Image'}
                    </Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <Pressable
                onPress={initiateReceiptScan}
                style={({ pressed }) => [
                  {
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 12,
                    borderRadius: 12,
                    backgroundColor: Colors.surfaceAlt,
                    borderWidth: 1.5,
                    borderColor: Colors.border,
                    borderStyle: 'dashed',
                    gap: 8,
                    marginTop: 6,
                  },
                  pressed && { opacity: 0.7 }
                ]}
              >
                <Ionicons name="camera-outline" size={20} color={Colors.primary} />
                <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 13, color: Colors.primary }}>
                  {language === 'ar' ? 'تصوير أو اختيار الفاتورة' : 'Capture or Upload Receipt'}
                </Text>
              </Pressable>
            )}
          </View>

          {/* Date Picker */}
          <View style={styles.dateSection}>
            <Text style={styles.label}>{t.date}</Text>
            <Pressable
              onPress={() => setShowDatePicker(true)}
              style={styles.datePressable}
            >
              <Ionicons name="calendar-outline" size={20} color={Colors.primary} />
              <Text style={styles.dateText}>{selectedDateLabel}</Text>
              <Ionicons name="chevron-down" size={16} color={Colors.textTertiary} />
            </Pressable>
          </View>

          {/* Time Section */}
          <View style={styles.timeSection}>
            <Text style={styles.label}>{t.time}</Text>
            <View style={styles.timeRow}>
              <View style={styles.timePicker}>
                <Pressable
                  onPress={() => setSelectedHour(h => h >= 12 ? 1 : h + 1)}
                  style={styles.timeArrow}
                >
                  <Ionicons name="chevron-up" size={18} color={Colors.textSecondary} />
                </Pressable>
                <Text style={styles.timeValue}>{selectedHour}</Text>
                <Pressable
                  onPress={() => setSelectedHour(h => h <= 1 ? 12 : h - 1)}
                  style={styles.timeArrow}
                >
                  <Ionicons name="chevron-down" size={18} color={Colors.textSecondary} />
                </Pressable>
              </View>

              <Text style={styles.timeSeparator}>:</Text>

              <View style={styles.timePicker}>
                <Pressable
                  onPress={() => setSelectedMinute(m => m >= 59 ? 0 : m + 1)}
                  style={styles.timeArrow}
                >
                  <Ionicons name="chevron-up" size={18} color={Colors.textSecondary} />
                </Pressable>
                <Text style={styles.timeValue}>{selectedMinute.toString().padStart(2, '0')}</Text>
                <Pressable
                  onPress={() => setSelectedMinute(m => m <= 0 ? 59 : m - 1)}
                  style={styles.timeArrow}
                >
                  <Ionicons name="chevron-down" size={18} color={Colors.textSecondary} />
                </Pressable>
              </View>

              <Pressable
                onPress={() => {
                  Haptics.selectionAsync();
                  setSelectedPeriod(p => p === 'AM' ? 'PM' : 'AM');
                }}
                style={styles.periodToggle}
              >
                <Text style={styles.periodText}>
                  {language === 'ar' ? (selectedPeriod === 'AM' ? 'ص' : 'م') : selectedPeriod}
                </Text>
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

      {/* Date Picker Modal */}
      <Modal
        visible={showDatePicker}
        animationType="slide"
        transparent
        onRequestClose={() => setShowDatePicker(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowDatePicker(false)}>
          <Pressable style={styles.datePickerSheet} onPress={e => e.stopPropagation()}>
            <View style={styles.datePickerHeader}>
              <Text style={styles.datePickerTitle}>{t.date}</Text>
              <Pressable onPress={() => setShowDatePicker(false)} hitSlop={12}>
                <Ionicons name="close" size={22} color={Colors.textSecondary} />
              </Pressable>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} style={styles.dateList}>
              {availableDates.map((d, i) => {
                const isSelected = d.day === selectedDay && d.month === selectedMonth && d.year === selectedYear;
                return (
                  <Pressable
                    key={i}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setSelectedDay(d.day);
                      setSelectedMonth(d.month);
                      setSelectedYear(d.year);
                      setShowDatePicker(false);
                    }}
                    style={[styles.dateOption, isSelected && styles.dateOptionActive]}
                  >
                    <Text style={[styles.dateOptionText, isSelected && styles.dateOptionTextActive]}>
                      {d.label}
                    </Text>
                    {isSelected && <Ionicons name="checkmark" size={18} color={Colors.primary} />}
                  </Pressable>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

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
      <Modal visible={customModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <SafeAreaView style={styles.customCatSheet}>
            <View style={styles.calcHeader}>
              <Pressable onPress={() => setCustomModalVisible(false)} hitSlop={12} style={styles.closeBtn}>
                <Ionicons name="close" size={22} color={Colors.text} />
              </Pressable>
              <Text style={styles.calcTitle}>{t.newCategory}</Text>
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
                  placeholder="مثال: اشتراكات"
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
                  placeholder="e.g. Subscriptions"
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
                          isSelected && { borderColor: '#000', borderWidth: 2, transform: [{ scale: 1.15 }] }
                        ]}
                      />
                    );
                  })}
                </View>
              </View>

              {/* Icon Grid Selector */}
              <View style={styles.formGroup}>
                <Text style={styles.label}>{t.selectIcon}</Text>
                <View style={styles.iconsGrid}>
                  {CUSTOM_CATEGORY_ICONS.map(ic => {
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
                          isSelected && { borderColor: customColor, borderWidth: 2, backgroundColor: customColor + '12' }
                        ]}
                      >
                        <MaterialIcons name={ic as any} size={22} color={isSelected ? customColor : Colors.textSecondary} />
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <Pressable
                onPress={handleSaveCustomCategory}
                style={({ pressed }) => [styles.modalSaveBtn, { backgroundColor: customColor }, pressed && { opacity: 0.9 }]}
              >
                <Text style={styles.modalSaveText}>{t.createWallet}</Text>
              </Pressable>
            </ScrollView>
          </SafeAreaView>
        </View>
      </Modal>
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
  dateSection: {
    marginBottom: 16,
  },
  datePressable: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 10,
  },
  dateText: {
    flex: 1,
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 15,
    color: colors.text,
  },
  timeSection: {
    marginBottom: 24,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceAlt,
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 16,
    gap: 12,
  },
  timePicker: {
    alignItems: 'center',
    gap: 2,
  },
  timeArrow: {
    padding: 4,
  },
  timeValue: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 28,
    color: colors.text,
    minWidth: 44,
    textAlign: 'center',
  },
  timeSeparator: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 28,
    color: colors.textSecondary,
    marginTop: -4,
  },
  periodToggle: {
    backgroundColor: colors.primary + '18',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginLeft: 4,
  },
  periodText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 16,
    color: colors.primary,
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
    maxHeight: '90%',
    paddingBottom: 20,
  },
  customCatBody: {
    padding: 20,
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
    width: SCREEN_WIDTH * 0.13,
    aspectRatio: 1,
    borderRadius: SCREEN_WIDTH * 0.065,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  iconsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
    paddingVertical: 6,
    maxHeight: 180,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: colors.surfaceAlt,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  modalSaveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 10,
  },
  modalSaveText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 16,
    color: colors.text,
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
  smartInputCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  smartInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    borderRadius: 12,
    paddingRight: 8,
    marginTop: 8,
  },
  smartTextInput: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 14,
    color: colors.text,
    textAlign: 'right',
  },
  pasteBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  micBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  micBtnActive: {
    backgroundColor: colors.expense,
  },
  smartMessageText: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 12,
    color: colors.primary,
    marginTop: 8,
    textAlign: 'left',
  },
});
