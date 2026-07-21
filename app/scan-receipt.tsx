import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  Image,
  ScrollView,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  Dimensions,
  Animated,
  Easing,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { useTransactions } from '@/lib/TransactionContext';
import { useLanguage } from '@/lib/LanguageContext';
import { useTheme } from '@/lib/ThemeContext';
import { scanReceiptImage, ScannedReceipt } from '@/lib/receiptScanner';
import { formatCurrency, expenseCategories } from '@/lib/categories';
import { getCategoryName } from '@/lib/i18n';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function ScanReceiptScreen() {
  const { colors } = useTheme();
  const { language } = useLanguage();
  const { selectedWallet, addTransaction, currencySymbol } = useTransactions();

  const [imageUri, setImageUri] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scannedResult, setScannedResult] = useState<ScannedReceipt | null>(null);
  const [isSaving, setIsSaving] = useState(false);

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

  const handlePickImage = async (useCamera: boolean) => {
    try {
      Haptics.selectionAsync();
      const options: ImagePicker.ImagePickerOptions = {
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.9,
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
    } catch (e) {
      console.error('Scan error:', e);
      setIsScanning(false);
      Alert.alert(
        language === 'ar' ? 'خطأ' : 'Error',
        language === 'ar' ? 'فشل معالجة الفاتورة' : 'Failed to scan receipt'
      );
    }
  };

  const handleConfirmAndAdd = async () => {
    if (!scannedResult || !scannedResult.totalAmount) {
      Alert.alert(
        language === 'ar' ? 'تنبيه' : 'Notice',
        language === 'ar' ? 'لم يتم العثور على مبلغ إجمالي في الفاتورة' : 'No total amount detected'
      );
      return;
    }

    try {
      if (!selectedWallet) return;
      setIsSaving(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      const nowStr = new Date().toISOString();
      await addTransaction({
        id: String(Date.now()),
        type: 'expense',
        amount: scannedResult.totalAmount,
        category: scannedResult.category,
        description: `${scannedResult.merchantName} (قارئ الفواتير)`,
        date: nowStr,
        createdAt: nowStr,
        walletId: selectedWallet.id,
        receiptUri: imageUri || undefined,
        tags: 'فاتورة_ذكية',
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        language === 'ar' ? 'تمت الإضافة بنجاح! 🎉' : 'Transaction Added! 🎉',
        language === 'ar'
          ? `تم إضافة ${scannedResult.totalAmount} ${currencySymbol} من ${scannedResult.merchantName} إلى محفظتك.`
          : `Added ${scannedResult.totalAmount} ${currencySymbol} from ${scannedResult.merchantName}.`,
        [
          {
            text: language === 'ar' ? 'حسناً' : 'OK',
            onPress: () => router.back(),
          },
        ]
      );
    } catch (e) {
      console.error('Failed to save receipt transaction:', e);
      Alert.alert(
        language === 'ar' ? 'خطأ' : 'Error',
        language === 'ar' ? 'حدث خطأ أثناء حفظ المعاملة' : 'Failed to save transaction'
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
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Pressable
          style={styles.closeBtn}
          onPress={() => router.back()}
          hitSlop={10}
        >
          <Ionicons name="close" size={24} color={colors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          {language === 'ar' ? '🧾 مسح الفاتورة بالذكاء الاصطناعي' : '🧾 AI Receipt Scanner'}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Subtitle instructions */}
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          {language === 'ar'
            ? 'التقط صورة الفاتورة لاستخراج المبلغ واسم المتجر والفئة تلقائياً.'
            : 'Capture or select a receipt photo to automatically extract amount, merchant & category.'}
        </Text>

        {/* Image / Camera Container */}
        <View style={[styles.imageCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {imageUri ? (
            <View style={styles.imagePreviewWrapper}>
              <Image source={{ uri: imageUri }} style={styles.receiptImage} resizeMode="contain" />

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
                      {language === 'ar' ? 'جاري تحليل الفاتورة والبيانات...' : 'Scanning & extracting AI data...'}
                    </Text>
                  </View>
                </View>
              )}
            </View>
          ) : (
            <View style={styles.placeholderBox}>
              <Ionicons name="receipt-outline" size={64} color={colors.primary} />
              <Text style={[styles.placeholderTitle, { color: colors.text }]}>
                {language === 'ar' ? 'لم يتم اختيار فاتورة بعد' : 'No receipt selected yet'}
              </Text>
              <Text style={[styles.placeholderSubtitle, { color: colors.textSecondary }]}>
                {language === 'ar' ? 'اختر الكاميرا أو معرض الصور للبدء' : 'Choose camera or gallery to start'}
              </Text>
            </View>
          )}

          {/* Source Picker Buttons */}
          <View style={styles.pickerActions}>
            <Pressable
              style={[styles.pickerBtn, { backgroundColor: colors.primary }]}
              onPress={() => handlePickImage(true)}
            >
              <Ionicons name="camera-outline" size={20} color="#FFF" />
              <Text style={styles.pickerBtnText}>
                {language === 'ar' ? 'الكاميرا' : 'Camera'}
              </Text>
            </Pressable>

            <Pressable
              style={[styles.pickerBtn, { backgroundColor: colors.cardBorder, borderColor: colors.border, borderWidth: 1 }]}
              onPress={() => handlePickImage(false)}
            >
              <Ionicons name="images-outline" size={20} color={colors.text} />
              <Text style={[styles.pickerBtnText, { color: colors.text }]}>
                {language === 'ar' ? 'المعرض' : 'Gallery'}
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Scanned Results Display */}
        {scannedResult && (
          <View style={[styles.resultsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.resultHeader}>
              <Ionicons name="checkmark-circle" size={24} color={colors.income} />
              <Text style={[styles.resultTitle, { color: colors.text }]}>
                {language === 'ar' ? 'نتيجة الفحص بنجاح' : 'Scan Successful'}
              </Text>
            </View>

            <View style={styles.divider} />

            {/* Merchant */}
            <View style={styles.row}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>
                {language === 'ar' ? 'المتجر / الجهة:' : 'Merchant:'}
              </Text>
              <Text style={[styles.value, { color: colors.text }]}>
                {scannedResult.merchantName}
              </Text>
            </View>

            {/* Amount */}
            <View style={styles.row}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>
                {language === 'ar' ? 'المبلغ الإجمالي:' : 'Total Amount:'}
              </Text>
              <Text style={[styles.amountValue, { color: colors.primary }]}>
                {scannedResult.totalAmount} {currencySymbol}
              </Text>
            </View>

            {/* Category */}
            <View style={styles.row}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>
                {language === 'ar' ? 'الفئة المقترحة:' : 'Category:'}
              </Text>
              <Text style={[styles.value, { color: colors.text }]}>
                {getCategoryName(scannedResult.category, language)}
              </Text>
            </View>

            {/* Tax */}
            {scannedResult.taxAmount ? (
              <View style={styles.row}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>
                  {language === 'ar' ? 'الضريبة المخصومة:' : 'Tax Amount:'}
                </Text>
                <Text style={[styles.value, { color: colors.textSecondary }]}>
                  {scannedResult.taxAmount} {currencySymbol}
                </Text>
              </View>
            ) : null}

            {/* Items list if available */}
            {scannedResult.items && scannedResult.items.length > 0 && (
              <View style={styles.itemsSection}>
                <Text style={[styles.itemsTitle, { color: colors.textSecondary }]}>
                  {language === 'ar' ? 'الأغراض المستخرجة:' : 'Detected Items:'}
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
              style={[styles.saveBtn, { backgroundColor: colors.primary }]}
              onPress={handleConfirmAndAdd}
              disabled={isSaving}
            >
              {isSaving ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <>
                  <Ionicons name="add-circle-outline" size={22} color="#FFF" style={{ marginRight: 6 }} />
                  <Text style={styles.saveBtnText}>
                    {language === 'ar' ? 'إضافة المعاملة للمحفظة' : 'Confirm & Add Transaction'}
                  </Text>
                </>
              )}
            </Pressable>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
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
    fontWeight: '700',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 20,
  },
  imageCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    alignItems: 'center',
    marginBottom: 20,
  },
  imagePreviewWrapper: {
    width: '100%',
    height: 260,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#000',
    marginBottom: 16,
  },
  receiptImage: {
    width: '100%',
    height: '100%',
  },
  scanOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
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
    fontWeight: '600',
    fontSize: 14,
  },
  placeholderBox: {
    height: 180,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  placeholderTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 12,
  },
  placeholderSubtitle: {
    fontSize: 13,
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
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  pickerBtnText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '600',
  },
  resultsCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  resultTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(150,150,150,0.2)',
    marginVertical: 12,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  label: {
    fontSize: 14,
  },
  value: {
    fontSize: 15,
    fontWeight: '600',
  },
  amountValue: {
    fontSize: 18,
    fontWeight: '800',
  },
  itemsSection: {
    marginTop: 8,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(150,150,150,0.2)',
  },
  itemsTitle: {
    fontSize: 13,
    marginBottom: 6,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  itemName: {
    fontSize: 13,
  },
  itemPrice: {
    fontSize: 13,
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 16,
  },
  saveBtnText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
