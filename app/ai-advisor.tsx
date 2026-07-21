import React, { useMemo, useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/lib/ThemeContext';
import { useLanguage } from '@/lib/LanguageContext';
import { useTransactions } from '@/lib/TransactionContext';
import { generateFinancialRecommendations, Recommendation } from '@/lib/aiAdvisor';
import { getSmartResponse, generateSuggestedQuestions, FinancialContext } from '@/lib/smartAdvisor';
import { askGeminiFinancialAdvisor } from '@/lib/geminiAdvisor';
import { getBudgetsForWallet } from '@/lib/budgetStorage';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  time: string;
}

export default function AIAdvisorScreen() {
  const { colors, theme } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const { language, t } = useLanguage();
  const { transactions, wallets, selectedWallet, totalIncome, totalExpense, balance, currencySymbol } = useTransactions();
  
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [botLoading, setBotLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'tips' | 'chat'>('tips');
  const [budgets, setBudgets] = useState<Record<string, number>>({});
  const [suggestedQuestions, setSuggestedQuestions] = useState<{ textAr: string; textEn: string }[]>([]);

  const flatListRef = useRef<FlatList>(null);

  // Build financial context for the smart advisor
  const buildContext = (): FinancialContext => ({
    transactions,
    wallets,
    selectedWallet,
    budgets,
    totalIncome,
    totalExpense,
    balance,
    currencySymbol,
    language: language as 'ar' | 'en',
  });

  // Load recommendations, budgets, and initial chat message on mount
  useEffect(() => {
    // Load budgets
    async function loadBudgets() {
      if (selectedWallet) {
        const b = await getBudgetsForWallet(selectedWallet.id);
        setBudgets(b);
      }
    }
    loadBudgets();

    // 1. Calculate active wallet balance
    const walletTxns = selectedWallet
      ? transactions.filter(t => t.walletId === selectedWallet.id)
      : transactions;
    const income = walletTxns.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
    const expense = walletTxns.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
    const walletBalance = income - expense;
    
    // We can assume health score is based on savings ratio or forecast
    const health = walletBalance > 0 ? Math.min(100, Math.floor((walletBalance / (income || 1)) * 200)) : 30;

    const recs = generateFinancialRecommendations(transactions, selectedWallet || wallets[0] || null, health);
    setRecommendations(recs);

    // Generate suggested questions
    const ctx = buildContext();
    setSuggestedQuestions(generateSuggestedQuestions(ctx));

    // Initial message
    setChatMessages([
      {
        id: 'init',
        role: 'assistant',
        text: language === 'ar'
          ? `مرحباً بك! أنا مستشارك المالي الذكي 🤖. لقد قمت بتحليل محفظتك ونفقاتك الأخيرة، وجاهز للإجابة على أي استفسارات تخص ميزانيتك، أو تقديم خطط توفير مخصصة. كيف يمكنني مساعدتك اليوم؟`
          : `Hello! I am your AI Financial Advisor 🤖. I have analyzed your wallets and recent transactions and I am ready to help you plan your savings, cut expenses, or answer budget questions. How can I help you today?`,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      }
    ]);
  }, [selectedWallet, transactions, language]);

  const handleSendMessage = async (textToSend?: string) => {
    const messageText = textToSend || chatInput;
    if (!messageText.trim()) return;

    const userMsg: ChatMessage = {
      id: Math.random().toString(),
      role: 'user',
      text: messageText.trim(),
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setChatMessages((prev) => [...prev, userMsg]);
    setChatInput('');
    setBotLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      const res = await askGeminiFinancialAdvisor(messageText, {
        transactions,
        selectedWallet,
        totalIncome,
        totalExpense,
        balance,
        currencySymbol,
        language: language as 'ar' | 'en',
      });

      const botMsg: ChatMessage = {
        id: Math.random().toString(),
        role: 'assistant',
        text: res.answer,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setChatMessages((prev) => [...prev, botMsg]);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      console.error('AI response error:', e);
    } finally {
      setBotLoading(false);
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  };

  const renderRecommendation = ({ item }: { item: Recommendation }) => {
    const getIcon = () => {
      switch (item.type) {
        case 'warning': return 'warning-outline';
        case 'saving': return 'wallet-outline';
        case 'investment': return 'trending-up-outline';
        default: return 'bulb-outline';
      }
    };

    const getColor = () => {
      switch (item.type) {
        case 'warning': return colors.expense;
        case 'saving': return colors.primary;
        case 'investment': return colors.accent;
        default: return colors.primary;
      }
    };

    return (
      <View style={styles.recCard}>
        <View style={styles.recHeader}>
          <View style={[styles.recIconWrap, { backgroundColor: getColor() + '15' }]}>
            <Ionicons name={getIcon()} size={20} color={getColor()} />
          </View>
          <Text style={styles.recTitle}>
            {language === 'ar' ? item.titleAr : item.titleEn}
          </Text>
        </View>
        <Text style={styles.recMessage}>
          {language === 'ar' ? item.messageAr : item.messageEn}
        </Text>
        <View style={styles.recFooter}>
          <Text style={styles.impactText}>
            {language === 'ar' ? `الأهمية: ${item.impactScore}/10` : `Impact: ${item.impactScore}/10`}
          </Text>
        </View>
      </View>
    );
  };

  const renderChatItem = ({ item }: { item: ChatMessage }) => {
    const isBot = item.role === 'assistant';
    return (
      <View style={[
        styles.chatBubbleContainer,
        isBot ? styles.bubbleLeft : styles.bubbleRight
      ]}>
        <View style={[
          styles.chatBubble,
          isBot ? styles.botBubble : styles.userBubble
        ]}>
          <Text style={[
            styles.chatText,
            isBot ? styles.botChatText : styles.userChatText
          ]}>
            {item.text}
          </Text>
          <Text style={styles.chatTime}>{item.time}</Text>
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      style={styles.container}
    >
      {/* Top Header */}
      <View style={styles.headerBar}>
        <Pressable
          onPress={() => {
            Haptics.selectionAsync();
            router.back();
          }}
          style={styles.backBtn}
        >
          <Ionicons name={language === 'ar' ? 'arrow-forward' : 'arrow-back'} size={24} color={colors.text} />
        </Pressable>
        <View style={{ alignItems: 'center' }}>
          <Text style={styles.headerTitle}>
            {language === 'ar' ? 'المستشار المالي الذكي' : 'AI Financial Advisor'}
          </Text>
          <Text style={{ fontFamily: 'Cairo_600SemiBold', fontSize: 10, color: colors.primary, marginTop: -2 }}>
            {selectedWallet 
              ? (language === 'ar' ? `محفظة: ${selectedWallet.name}` : `Wallet: ${selectedWallet.name}`)
              : (language === 'ar' ? 'إجمالي المحافظ الموحدة' : 'All Wallets Consolidated')
            }
          </Text>
        </View>
        <View style={{ width: 44 }} />
      </View>

      {/* Tabs */}
      <View style={styles.tabContainer}>
        <Pressable
          onPress={() => {
            Haptics.selectionAsync();
            setActiveTab('tips');
          }}
          style={[styles.tabBtn, activeTab === 'tips' && styles.tabBtnActive]}
        >
          <Ionicons name="bulb-outline" size={18} color={activeTab === 'tips' ? '#FFF' : colors.textSecondary} />
          <Text style={[styles.tabText, activeTab === 'tips' && styles.tabTextActive]}>
            {language === 'ar' ? 'نصائح ذكية' : 'Smart Tips'}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => {
            Haptics.selectionAsync();
            setActiveTab('chat');
          }}
          style={[styles.tabBtn, activeTab === 'chat' && styles.tabBtnActive]}
        >
          <Ionicons name="chatbubbles-outline" size={18} color={activeTab === 'chat' ? '#FFF' : colors.textSecondary} />
          <Text style={[styles.tabText, activeTab === 'chat' && styles.tabTextActive]}>
            {language === 'ar' ? 'محادثة المستشار' : 'Chat with AI'}
          </Text>
        </Pressable>
      </View>

      {/* Tab Contents */}
      {activeTab === 'tips' ? (
        <FlatList
          data={recommendations}
          keyExtractor={(item) => item.id}
          renderItem={renderRecommendation}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="sparkles-outline" size={48} color={colors.textTertiary} />
              <Text style={styles.emptyText}>
                {language === 'ar'
                  ? 'لا توجد توصيات كافية حالياً. سجل بضع معاملات لرؤية النصائح!'
                  : 'Not enough financial data yet. Log a few transactions to see advice!'}
              </Text>
            </View>
          }
        />
      ) : (
        <View style={styles.chatSection}>
          {/* Suggested Questions */}
          {chatMessages.length <= 1 && suggestedQuestions.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.suggestionsRow} contentContainerStyle={styles.suggestionsContent}>
              {suggestedQuestions.map((sq, idx) => (
                <Pressable
                  key={idx}
                  style={({ pressed }) => [styles.suggestionChip, pressed && { opacity: 0.7 }]}
                  onPress={() => handleSendMessage(language === 'ar' ? sq.textAr : sq.textEn)}
                >
                  <Text style={styles.suggestionText}>
                    {language === 'ar' ? sq.textAr : sq.textEn}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          )}

          <FlatList
            ref={flatListRef}
            data={chatMessages}
            keyExtractor={(item) => item.id}
            renderItem={renderChatItem}
            contentContainerStyle={styles.chatListContent}
            showsVerticalScrollIndicator={false}
            ListFooterComponent={
              botLoading ? (
                <View style={styles.botLoadingBubble}>
                  <ActivityIndicator size="small" color={colors.primary} />
                  <Text style={styles.botLoadingText}>
                    {language === 'ar' ? 'يحلل بياناتك...' : 'Analyzing your data...'}
                  </Text>
                </View>
              ) : null
            }
          />

          {/* Bottom Chat Input */}
          <View style={styles.chatInputWrapper}>
            <TextInput
              style={[styles.chatInput, language === 'ar' ? styles.chatInputAr : styles.chatInputEn]}
              placeholder={language === 'ar' ? 'اسأل المستشار المالي... (مثال: هل أقدر أشتري آيفون؟)' : 'Ask AI Advisor... (e.g. Can I afford an iPhone?)'}
              placeholderTextColor={colors.textTertiary}
              value={chatInput}
              onChangeText={setChatInput}
              onSubmitEditing={() => handleSendMessage()}
              returnKeyType="send"
            />
            <Pressable
              onPress={() => handleSendMessage()}
              style={({ pressed }) => [
                styles.sendBtn,
                { backgroundColor: pressed ? colors.primaryDark : colors.primary }
              ]}
            >
              <Ionicons name="send" size={18} color="#FFF" />
            </Pressable>
          </View>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const getStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 16,
    color: '#FFF',
  },
  tabContainer: {
    flexDirection: 'row',
    margin: 16,
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 4,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    gap: 8,
  },
  tabBtnActive: {
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tabText: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 13,
    color: colors.textSecondary,
  },
  tabTextActive: {
    color: '#FFF',
  },
  listContent: {
    padding: 16,
    paddingBottom: 40,
    gap: 16,
  },
  recCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.04)',
    elevation: 2,
  },
  recHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  recIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  recTitle: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 14,
    color: '#FFF',
    flex: 1,
  },
  recMessage: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 18,
    textAlign: 'left',
  },
  recFooter: {
    marginTop: 12,
    alignItems: 'flex-end',
    borderTopWidth: 1,
    borderColor: colors.border,
    paddingTop: 8,
  },
  impactText: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 10,
    color: colors.primary,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    gap: 12,
  },
  emptyText: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 12,
    color: colors.textTertiary,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  chatSection: {
    flex: 1,
  },
  suggestionsRow: {
    maxHeight: 44,
    paddingVertical: 0,
  },
  suggestionsContent: {
    paddingHorizontal: 16,
    gap: 8,
    alignItems: 'center',
  },
  suggestionChip: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  suggestionText: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 11,
    color: colors.primary,
  },
  chatListContent: {
    padding: 16,
    paddingBottom: 80,
    gap: 16,
  },
  chatBubbleContainer: {
    flexDirection: 'row',
    width: '100%',
  },
  bubbleLeft: {
    justifyContent: 'flex-start',
  },
  bubbleRight: {
    justifyContent: 'flex-end',
  },
  chatBubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 16,
  },
  botBubble: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderBottomLeftRadius: 4,
  },
  userBubble: {
    backgroundColor: colors.primary,
    borderBottomRightRadius: 4,
  },
  chatText: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'left',
  },
  botChatText: {
    color: '#FFF',
  },
  userChatText: {
    color: '#FFF',
  },
  chatTime: {
    fontSize: 9,
    color: colors.textTertiary,
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  botLoadingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.surface,
    padding: 12,
    borderRadius: 16,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: colors.border,
  },
  botLoadingText: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 11,
    color: colors.textSecondary,
  },
  chatInputWrapper: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderColor: colors.border,
    gap: 8,
    alignItems: 'center',
  },
  chatInput: {
    flex: 1,
    height: 44,
    backgroundColor: colors.surfaceAlt,
    borderRadius: 12,
    paddingHorizontal: 12,
    fontFamily: 'Cairo_400Regular',
    fontSize: 13,
    color: '#FFF',
    borderWidth: 1,
    borderColor: colors.border,
  },
  chatInputAr: {
    textAlign: 'right',
  },
  chatInputEn: {
    textAlign: 'left',
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
