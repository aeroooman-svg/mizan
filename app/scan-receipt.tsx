import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  Image,
  ScrollView,
  ActivityIndicator,
  Alert,
  Dimensions,
  Animated,
  Easing,
  TextInput,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { useTransactions } from '@/lib/TransactionContext';
import { useLanguage } from '@/lib/LanguageContext';
import { useTheme } from '@/lib/ThemeContext';
import { scanReceiptImage, ScannedReceipt, SAMPLE_RECEIPTS, isRealOCRAvailable } from '@/lib/receiptScanner';
import { formatCurrency, expenseCategories } from '@/lib/categories';
import { getCategoryName } from '@/lib/i18n';
import { normalizeAmountInput } from '@/lib/arabicNumbers';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function ScanReceiptScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { language } = useLanguage();
  const isAr = language === 'ar';
  const { selectedWallet, addTransaction, currencySymbol } = useTransactions();

  const [imageUri, setImageUri] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scannedResult, setScannedResult] = useState<ScannedReceipt | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Editable parsed values
  const [editMerchant, setEditMerchant] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editCategory, setEditCategory] = useState('shopping');
  const [editTax, setEditTax] = useState('');

  // Scan line animation
  const scanAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isScanning) {
      scanAnim.setValue(0);
      Animated.loop(
        Animated.sequence([
          Animated.timing(scanAnim, {
            toValue: 1,
            duration: 1500,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(scanAnim, {
            toValue: 0,
            duration: 1500,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      scanAnim.stopAnimation();
    }
  }, [isScanning]);

  // Sync editable fields when scanned result changes
  useEffect(() => {
    if (scannedResult) {
      setEditMerchant(scannedResult.merchantName || '');
      setEditAmount(scannedResult.totalAmount !== null ? String(scannedResult.totalAmount) : '');
      setEditCategory(scannedResult.category || 'shopping');
      setEditTax(scannedResult.taxAmount ? String(scannedResult.taxAmount) : '');
    }
  }, [scannedResult]);

  const handlePickImage = async (useCamera: boolean) => {
    try {
      Haptics.selectionAsync();

      if (useCamera) {
        const { status: currentStatus } = await ImagePicker.getCameraPermissionsAsync();
        let finalStatus = currentStatus;
        if (currentStatus !== ImagePicker.PermissionStatus.GRANTED) {
          const { status: reqStatus } = await ImagePicker.requestCameraPermissionsAsync();
          finalStatus = reqStatus;
        }

        if (finalStatus !== ImagePicker.PermissionStatus.GRANTED) {
          Alert.alert(
            isAr ? 'إذن الكاميرا مطلوب 📷' : 'Camera Permission Required 📷',
            isAr
              ? 'يرجى تفعيل إذن الوصول إلى الكاميرا من إعدادات الهاتف لمسح الفواتير.'
              : 'Please enable camera access permission in device settings to scan receipts.'
          );
          return;
        }
      } else {
        const { status: currentStatus } = await ImagePicker.getMediaLibraryPermissionsAsync();
        let finalStatus = currentStatus;
        if (currentStatus !== ImagePicker.PermissionStatus.GRANTED) {
          const { status: reqStatus } = await ImagePicker.requestMediaLibraryPermissionsAsync();
          finalStatus = reqStatus;
        }

        if (finalStatus !== ImagePicker.PermissionStatus.GRANTED) {
          Alert.alert(
            isAr ? 'إذن المعرض مطلوب 🖼️' : 'Gallery Permission Required 🖼️',
            isAr
              ? 'يرجى تفعيل إذن الوصول إلى معرض الصور لاختيار الفاتورة.'
              : 'Please enable photo library access in device settings to select receipt images.'
          );
          return;
        }
      }

      const options: ImagePicker.ImagePickerOptions = {
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false, // Prevents Android cropping activity crash/cancel bug
        quality: 0.85,
        base64: false,
      };

      const result = useCamera
        ? await ImagePicker.launchCameraAsync(options)
        : await ImagePicker.launchImageLibraryAsync(options);

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const uri = result.assets[0].uri;
        setImageUri(uri);
        setScannedResult(null);
        setIsScanning(true);

        const data = await scanReceiptImage(uri);
        setIsScanning(false);
        setScannedResult(data);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (e: any) {
      console.error('Scan error:', e);
      setIsScanning(false);
      Alert.alert(
        isAr ? 'تنبيه' : 'Notice',
        isAr
          ? 'تعذر التقاط الصورة، يرجى المحاولة مرة أخرى أو اختيار صورة من المعرض.'
          : 'Failed to access camera/gallery. Please try selecting an image from gallery.'
      );
    }
  };

  const handleTestSampleReceipt = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const randomSample = SAMPLE_RECEIPTS[Math.floor(Math.random() * SAMPLE_RECEIPTS.length)];
    setImageUri('https://images.unsplash.com/photo-1554415707-9e49019eeb61?w=600');
    setScannedResult({ ...randomSample, date: new Date().toISOString() });
  };

  const handleManualEntryFallback = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setImageUri(null);
    setScannedResult({
      merchantName: isAr ? 'فاتورة جديدة' : 'New Receipt',
      totalAmount: 0,
      category: 'shopping',
      date: new Date().toISOString(),
      items: [],
      confidenceScore: 1.0,
    });
  };

  const handleConfirmAndAdd = async () => {
    const cleanAmountStr = normalizeAmountInput(editAmount);
    const parsedAmount = parseFloat(cleanAmountStr);

    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      Alert.alert(
        isAr ? 'تنبيه' : 'Notice',
        isAr ? 'يرجى إدخال مبلغ إجمالي صحيح للفاتورة' : 'Please enter a valid total amount'
      );
      return;
    }

    if (!selectedWallet) {
      Alert.alert(
        isAr ? 'تنبيه' : 'Notice',
        isAr ? 'يرجى اختيار محفظة نشطة أولاً' : 'Please select an active wallet first'
      );
      return;
    }

    try {
      setIsSaving(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      const nowStr = new Date().toISOString();
      const merchantClean = editMerchant.trim() || (isAr ? 'مشتريات فاتورة' : 'Receipt Purchase');

      await addTransaction({
        id: String(Date.now()),
        type: 'expense',
        amount: parsedAmount,
        category: editCategory,
        description: `${merchantClean} (مسح الفاتورة 🧾)`,
        date: nowStr,
        createdAt: nowStr,
        walletId: selectedWallet.id,
        receiptUri: imageUri || undefined,
        tags: 'فاتورة_ذكية',
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        isAr ? 'تمت الإضافة بنجاح! 🎉' : 'Transaction Added! 🎉',
        isAr
          ? `تم إضافة ${formatCurrency(parsedAmount)} ${currencySymbol} من ${merchantClean} إلى محفظتك.`
          : `Added ${formatCurrency(parsedAmount)} ${currencySymbol} from ${merchantClean}.`,
        [
          {
            text: isAr ? 'حسناً' : 'OK',
            onPress: () => router.back(),
          },
        ]
      );
    } catch (e) {
      console.error('Failed to save receipt transaction:', e);
      Alert.alert(
        isAr ? 'خطأ' : 'Error',
        isAr ? 'حدث خطأ أثناء حفظ المعاملة' : 'Failed to save transaction'
      );
    } finally {
      setIsSaving(false);
    }
  };

  const scanLineTranslateY = scanAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 220],
  });

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border, paddingTop: Math.max(insets.top, 12) }]}>
        <Pressable
          style={styles.closeBtn}
          onPress={() => {
            if (router.canGoBack()) router.back();
            else router.replace('/(tabs)' as any);
          }}
          hitSlop={10}
        >
          <Ionicons name="close" size={24} color={colors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          {isAr ? '🧾 مسح الفاتورة بالذكاء الاصطناعي' : '🧾 AI Receipt Scanner'}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView 
        contentContainerStyle={[styles.scrollContent, { paddingBottom: Math.max(insets.bottom, 16) + 30 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Subtitle instructions */}
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          {isAr
            ? 'التقط صورة الفاتورة أو اخترها من المعرض لاستخراج المبلغ واسم المتجر والفئة تلقائياً.'
            : 'Capture or select a receipt photo to automatically extract amount, merchant & category.'}
        </Text>

        {/* Image / Camera Container */}
        <View style={[styles.imageCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {imageUri ? (
            <View style={styles.imagePreviewWrapper}>
              <Image source={{ uri: imageUri }} style={styles.receiptImage} resizeMode="cover" />

              {/* Scanning Overlay Animation */}
              {isScanning && (
                <View style={styles.scanOverlay}>
                  <Animated.View
                    style={[
                      styles.scanLine,
                      { transform: [{ translateY: scanLineTranslateY }] },
                    ]}
                  />
                  <View style={styles.scanningTextBadge}>
                    <ActivityIndicator size="small" color="#FFF" style={{ marginRight: 8 }} />
                    <Text style={styles.scanningText}>
                      {isAr ? 'جاري تحليل الفاتورة والبيانات بالذكاء الاصطناعي...' : 'Scanning & analyzing with AI...'}
                    </Text>
                  </View>
                </View>
              )}
            </View>
          ) : (
            <View style={styles.placeholderBox}>
              <View style={[styles.iconCircle, { backgroundColor: colors.primary + '18' }]}>
                <Ionicons name="receipt-outline" size={48} color={colors.primary} />
              </View>
              <Text style={[styles.placeholderTitle, { color: colors.text }]}>
                {isAr ? 'لم يتم اختيار فاتورة بعد' : 'No receipt selected yet'}
              </Text>
              <Text style={[styles.placeholderSubtitle, { color: colors.textSecondary }]}>
                {isAr ? 'اختر الكاميرا أو معرض الصور للبدء الفوري' : 'Choose camera or gallery to start'}
              </Text>
            </View>
          )}

          {/* Source Picker Buttons */}
          <View style={styles.pickerActions}>
            <Pressable
              style={({ pressed }) => [
                styles.pickerBtn, 
                { backgroundColor: colors.primary },
                pressed && { opacity: 0.88, transform: [{ scale: 0.98 }] }
              ]}
              onPress={() => handlePickImage(true)}
              disabled={isScanning}
            >
              <Ionicons name="camera" size={20} color="#FFF" />
              <Text style={styles.pickerBtnText}>
                {isAr ? 'الكاميرا' : 'Camera'}
              </Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.pickerBtn, 
                { backgroundColor: colors.surfaceAlt, borderColor: colors.border, borderWidth: 1 },
                pressed && { opacity: 0.88, transform: [{ scale: 0.98 }] }
              ]}
              onPress={() => handlePickImage(false)}
              disabled={isScanning}
            >
              <Ionicons name="images" size={20} color={colors.text} />
              <Text style={[styles.pickerBtnText, { color: colors.text }]}>
                {isAr ? 'المعرض' : 'Gallery'}
              </Text>
            </Pressable>
          </View>

          {/* Fallback & Sample Test Buttons */}
          <View style={styles.quickOptionsRow}>
            <Pressable onPress={handleTestSampleReceipt} style={styles.textOptionBtn} hitSlop={8}>
              <Text style={[styles.textOptionBtnLabel, { color: colors.primary }]}>
                {isAr ? '⚡ تجربة فاتورة نموذجية' : '⚡ Try Sample Receipt'}
              </Text>
            </Pressable>
            <Text style={{ color: colors.textTertiary }}>•</Text>
            <Pressable onPress={handleManualEntryFallback} style={styles.textOptionBtn} hitSlop={8}>
              <Text style={[styles.textOptionBtnLabel, { color: colors.textSecondary }]}>
                {isAr ? '✍️ إدخال يدوي مباشر' : '✍️ Manual Entry'}
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Scanned & Editable Results Display */}
        {scannedResult && (
          <View style={[styles.resultsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.resultHeader}>
              <Ionicons name="checkmark-circle" size={24} color={colors.income} />
              <Text style={[styles.resultTitle, { color: colors.text }]}>
                {isAr ? 'بيانات الفاتورة المستخرجة (قابلة للتعديل)' : 'Extracted Receipt Data (Editable)'}
              </Text>
            </View>

            <View style={styles.divider} />

            {/* Merchant input */}
            <View style={styles.inputGroup}>
              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                {isAr ? 'المتجر / الجهة:' : 'Merchant Name:'}
              </Text>
              <TextInput
                style={[styles.fieldInput, { backgroundColor: colors.surfaceAlt, color: colors.text, borderColor: colors.border }]}
                value={editMerchant}
                onChangeText={setEditMerchant}
                placeholder={isAr ? 'اسم المتجر...' : 'Merchant name...'}
                placeholderTextColor={colors.textTertiary}
                textAlign={isAr ? 'right' : 'left'}
              />
            </View>

            {/* Total Amount input */}
            <View style={styles.inputGroup}>
              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                {isAr ? `المبلغ الإجمالي (${currencySymbol}):` : `Total Amount (${currencySymbol}):`}
              </Text>
              <TextInput
                style={[
                  styles.fieldInput, 
                  styles.amountInput, 
                  { backgroundColor: colors.surfaceAlt, color: colors.primary, borderColor: colors.primary + '50' }
                ]}
                value={editAmount}
                onChangeText={setEditAmount}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor={colors.textTertiary}
                textAlign={isAr ? 'right' : 'left'}
              />
            </View>

            {/* Category selection chips */}
            <View style={styles.inputGroup}>
              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                {isAr ? 'الفئة المقترحة:' : 'Suggested Category:'}
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
                {expenseCategories.map(cat => {
                  const isSelected = editCategory === cat.id;
                  return (
                    <Pressable
                      key={cat.id}
                      onPress={() => {
                        Haptics.selectionAsync();
                        setEditCategory(cat.id);
                      }}
                      style={[
                        styles.catChip,
                        { backgroundColor: colors.surfaceAlt, borderColor: colors.border },
                        isSelected && { borderColor: cat.color, backgroundColor: cat.color + '20', borderWidth: 2 }
                      ]}
                    >
                      <MaterialIcons name={cat.icon as any} size={16} color={isSelected ? cat.color : colors.textSecondary} />
                      <Text style={[
                        styles.catChipText, 
                        { color: colors.textSecondary },
                        isSelected && { color: cat.color, fontFamily: 'Cairo_700Bold' }
                      ]}>
                        {getCategoryName(cat.id, language)}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>

            {/* Tax Amount */}
            <View style={styles.inputGroup}>
              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                {isAr ? `الضريبة المخصومة (اختياري):` : `Tax Amount (Optional):`}
              </Text>
              <TextInput
                style={[styles.fieldInput, { backgroundColor: colors.surfaceAlt, color: colors.text, borderColor: colors.border }]}
                value={editTax}
                onChangeText={setEditTax}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor={colors.textTertiary}
                textAlign={isAr ? 'right' : 'left'}
              />
            </View>

            {/* Items list if available */}
            {scannedResult.items && scannedResult.items.length > 0 && (
              <View style={styles.itemsSection}>
                <Text style={[styles.itemsTitle, { color: colors.textSecondary }]}>
                  {isAr ? 'الأغراض المستخرجة من الفاتورة:' : 'Extracted Line Items:'}
                </Text>
                {scannedResult.items.map((item, idx) => (
                  <View key={idx} style={styles.itemRow}>
                    <Text style={[styles.itemName, { color: colors.text }]}>• {item.name}</Text>
                    <Text style={[styles.itemPrice, { color: colors.textSecondary }]}>
                      {item.price} {currencySymbol}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            {/* Add Button */}
            <Pressable
              style={({ pressed }) => [
                styles.saveBtn, 
                { backgroundColor: colors.primary },
                pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] }
              ]}
              onPress={handleConfirmAndAdd}
              disabled={isSaving}
            >
              {isSaving ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <>
                  <Ionicons name="add-circle" size={22} color="#FFF" style={{ marginRight: 6 }} />
                  <Text style={styles.saveBtnText}>
                    {isAr ? 'إضافة المعاملة للمحفظة' : 'Confirm & Add Transaction'}
                  </Text>
                </>
              )}
            </Pressable>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  closeBtn: {
    padding: 6,
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: 'Cairo_700Bold',
  },
  scrollContent: {
    padding: 16,
  },
  subtitle: {
    fontSize: 13,
    fontFamily: 'Cairo_400Regular',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 20,
  },
  imageCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  imagePreviewWrapper: {
    width: '100%',
    height: 240,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#0F172A',
    marginBottom: 16,
  },
  receiptImage: {
    width: '100%',
    height: '100%',
  },
  scanOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanLine: {
    position: 'absolute',
    top: 10,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: '#10B981',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 10,
    elevation: 8,
  },
  scanningTextBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.85)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  scanningText: {
    color: '#FFF',
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 13,
  },
  placeholderBox: {
    height: 170,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  placeholderTitle: {
    fontSize: 16,
    fontFamily: 'Cairo_700Bold',
  },
  placeholderSubtitle: {
    fontSize: 12,
    fontFamily: 'Cairo_400Regular',
    marginTop: 4,
  },
  pickerActions: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  pickerBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    borderRadius: 14,
    gap: 8,
  },
  pickerBtnText: {
    color: '#FFF',
    fontSize: 15,
    fontFamily: 'Cairo_700Bold',
  },
  quickOptionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 14,
  },
  textOptionBtn: {
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  textOptionBtnLabel: {
    fontSize: 12,
    fontFamily: 'Cairo_600SemiBold',
  },
  resultsCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  resultTitle: {
    fontSize: 15,
    fontFamily: 'Cairo_700Bold',
    flex: 1,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(150,150,150,0.15)',
    marginVertical: 14,
  },
  inputGroup: {
    marginBottom: 14,
    gap: 6,
  },
  fieldLabel: {
    fontSize: 13,
    fontFamily: 'Cairo_600SemiBold',
  },
  fieldInput: {
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    fontFamily: 'Cairo_600SemiBold',
    borderWidth: 1,
  },
  amountInput: {
    fontSize: 18,
    fontFamily: 'Cairo_700Bold',
  },
  catChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
  catChipText: {
    fontSize: 12,
    fontFamily: 'Cairo_600SemiBold',
  },
  itemsSection: {
    marginTop: 4,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(150,150,150,0.15)',
  },
  itemsTitle: {
    fontSize: 12,
    fontFamily: 'Cairo_600SemiBold',
    marginBottom: 6,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  itemName: {
    fontSize: 12,
    fontFamily: 'Cairo_400Regular',
  },
  itemPrice: {
    fontSize: 12,
    fontFamily: 'Cairo_600SemiBold',
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 12,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  saveBtnText: {
    color: '#FFF',
    fontSize: 15,
    fontFamily: 'Cairo_700Bold',
  },
});
