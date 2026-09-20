import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  SafeAreaView,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import getAddTransactionStyles from './addTransactionStyles';

interface TransactionCalculatorModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (amount: string) => void;
  title: string;
  saveText: string;
  primaryColor?: string;
  colors: any;
  initialAmount?: string;
}

export default function TransactionCalculatorModal({
  visible,
  onClose,
  onConfirm,
  title,
  saveText,
  primaryColor,
  colors,
  initialAmount,
}: TransactionCalculatorModalProps) {
  const styles = getAddTransactionStyles(colors);
  const [calcExpression, setCalcExpression] = useState(initialAmount || '');
  const [calcResult, setCalcResult] = useState(initialAmount || '');

  React.useEffect(() => {
    if (visible) {
      setCalcExpression(initialAmount || '');
      setCalcResult(initialAmount || '');
    }
  }, [visible, initialAmount]);

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
      if (
        calcExpression.endsWith(' ') &&
        !calcExpression.endsWith(' * ') &&
        !calcExpression.endsWith(' / ') &&
        !calcExpression.endsWith(' + ') &&
        !calcExpression.endsWith(' - ')
      ) return;
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
      nextExpr = calcExpression.slice(0, -3);
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

  const handleConfirm = () => {
    const finalVal = calcResult || evaluateExpression(calcExpression) || '0';
    if (parseFloat(finalVal) > 0) {
      onConfirm(finalVal);
    }
    setCalcExpression('');
    setCalcResult('');
    onClose();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleClose = () => {
    setCalcExpression('');
    setCalcResult('');
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <View style={styles.modalOverlay}>
        <SafeAreaView style={styles.calcSheet}>
          <View style={styles.calcHeader}>
            <Pressable onPress={handleClose} hitSlop={12} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color={Colors.text} />
            </Pressable>
            <Text style={styles.calcTitle}>{title}</Text>
            <Pressable onPress={handleConfirm} hitSlop={12} style={styles.calcConfirmBtn}>
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
                  style={({ pressed }) => [
                    styles.calcKey,
                    ['/'].includes(key) && styles.calcKeyOp,
                    pressed && styles.calcKeyPressed,
                  ]}
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
                  style={({ pressed }) => [
                    styles.calcKey,
                    ['*'].includes(key) && styles.calcKeyOp,
                    pressed && styles.calcKeyPressed,
                  ]}
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
                  style={({ pressed }) => [
                    styles.calcKey,
                    ['-'].includes(key) && styles.calcKeyOp,
                    pressed && styles.calcKeyPressed,
                  ]}
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
                style={({ pressed }) => [
                  styles.calcKeyConfirm,
                  { backgroundColor: primaryColor || Colors.primary },
                  pressed && { opacity: 0.9 },
                ]}
                onPress={handleConfirm}
              >
                <Text style={styles.calcKeyConfirmText}>{saveText}</Text>
              </Pressable>
            </View>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}
