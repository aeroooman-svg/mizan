import React, { useMemo, useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
  Platform,
  Dimensions,
  Modal,
  TextInput,
  SafeAreaView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { useTransactions } from '@/lib/TransactionContext';
import { formatCurrency, expenseCategories, incomeCategories, Category, getCategoryById } from '@/lib/categories';
import { useLanguage } from '@/lib/LanguageContext';
import { useTheme } from '@/lib/ThemeContext';
import { getCategoryName } from '@/lib/i18n';
import MonthlyDigestModal from '@/components/MonthlyDigestModal';
import Svg, { Circle, Rect, Text as SvgText, Path, Defs, LinearGradient as SvgGradient, Stop, G } from 'react-native-svg';
import { getBudgetsForWallet, setCategoryBudget, removeCategoryBudget } from '@/lib/budgetStorage';
import { getJameyas, Jameya } from '@/lib/jameyaStorage';
import { getDebts, Debt } from '@/lib/debtStorage';
import { getGoals, SavingsGoal } from '@/lib/goalStorage';
import { getAllTags, Tag, parseTransactionTags } from '@/lib/tagStorage';
import { getExchangeRates, convertAmount } from '@/lib/currencyApi';
import { BarChartMonthly } from '@/components/stats/BarChartMonthly';
import { YearlyOverview } from '@/components/stats/YearlyOverview';
import { TagBreakdown } from '@/components/stats/TagBreakdown';
import { DonutChart } from '@/components/stats/DonutChart';
import { BudgetManagerModal } from '@/components/stats/BudgetManagerModal';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CHART_SIZE = 180;
const STROKE_WIDTH = 26;
const RADIUS = (CHART_SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

const BAR_CHART_HEIGHT = 160;
const BAR_CHART_WIDTH = SCREEN_WIDTH - 64;

const HIGH_CONTRAST_DISTINCT_COLORS = [
  '#FF6B6B', // 🔴 Coral Red
  '#10B981', // 🟢 Emerald Green
  '#F59E0B', // 🟡 Golden Amber
  '#3B82F6', // 🔵 Electric Blue
  '#EC4899', // 🌸 Hot Pink
  '#8B5CF6', // 🟣 Vivid Purple
  '#14B8A6', // 🌊 Dark Teal
  '#F97316', // 🟠 Bright Orange
  '#06B6D4', // 🌐 Cyan
];

const generateSparklinePath = (points: { day: number; netWorth: number }[], width = 140, height = 38) => {
  if (!points || points.length === 0) {
    return { pathD: `M 0,${height/2} L ${width},${height/2}`, areaD: `M 0,${height/2} L ${width},${height/2} L ${width},${height} L 0,${height} Z`, lastX: width, lastY: height/2, min: 0, max: 0, actualMin: 0, actualMax: 0, coords: [] };
  }

  const values = points.map(p => p.netWorth);
  const actualMin = Math.min(...values);
  const actualMax = Math.max(...values);

  let min = actualMin;
  let max = actualMax;

  if (min === max) {
    min = min - Math.max(10, Math.abs(min) * 0.1 || 10);
    max = max + Math.max(10, Math.abs(max) * 0.1 || 10);
  } else {
    const range = max - min;
    min = min - range * 0.08;
    max = max + range * 0.08;
  }

  const paddingX = 16;
  const usableW = Math.max(10, width - paddingX * 2);
  const paddingY = 14;
  const usableH = Math.max(10, height - paddingY * 2);

  const coords = points.map((p, i) => {
    const x = paddingX + (i / (points.length - 1 || 1)) * usableW;
    const normY = max === min ? 0.5 : (p.netWorth - min) / (max - min);
    const y = height - paddingY - (normY * usableH);
    return { x, y };
  });

  let pathD = `M ${coords[0].x.toFixed(1)},${coords[0].y.toFixed(1)}`;
  for (let i = 1; i < coords.length; i++) {
    const prev = coords[i - 1];
    const curr = coords[i];
    const cpX = (prev.x + curr.x) / 2;
    pathD += ` C ${cpX.toFixed(1)},${prev.y.toFixed(1)} ${cpX.toFixed(1)},${curr.y.toFixed(1)} ${curr.x.toFixed(1)},${curr.y.toFixed(1)}`;
  }

  const lastCoord = coords[coords.length - 1];
  const areaD = `${pathD} L ${lastCoord.x.toFixed(1)},${height} L ${coords[0].x.toFixed(1)},${height} Z`;

  return { pathD, areaD, lastX: lastCoord.x, lastY: lastCoord.y, min, max, actualMin, actualMax, coords };
};

interface CategoryStat {
  category: Category;
  total: number;
  percentage: number;
}

interface DailyData {
  day: number;
  income: number;
  expense: number;
}

export default function StatsScreen() {
  const { colors, theme } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const webTopInset = Platform.OS === 'web' ? 10 : 0;
  const { walletTransactions, transactions, totalIncome, totalExpense, allTimeIncome, allTimeExpense, currencySymbol, selectedWallet, customCategories, wallets, selectWallet } = useTransactions();
  const { t, language } = useLanguage();
  const [viewType, setViewType] = useState<'expense' | 'income'>('expense');
  const [scope, setScope] = useState<'monthly' | 'yearly'>('monthly');
  const [netWorthScope, setNetWorthScope] = useState<'current' | 'all'>('current');
  const [rates, setRates] = useState<Record<string, number>>({});

  useEffect(() => {
    async function loadRates() {
      try {
        const r = await getExchangeRates();
        setRates(r);
      } catch (e) {}
    }
    loadRates();
  }, []);

  const now = new Date();
  const [viewMonth, setViewMonth] = useState(now.getMonth());
  const [viewYear, setViewYear] = useState(now.getFullYear());

  // Budgets state
  const [budgets, setBudgets] = useState<Record<string, number>>({});
  const [manageBudgetsVisible, setManageBudgetsVisible] = useState(false);
  const [availableTags, setAvailableTags] = useState<Tag[]>([]);
  const [isMonthlyDigestOpen, setIsMonthlyDigestOpen] = useState(false);

  const isCurrentMonth = viewMonth === now.getMonth() && viewYear === now.getFullYear();

  const loadBudgets = async () => {
    if (selectedWallet) {
      const b = await getBudgetsForWallet(selectedWallet.id);
      setBudgets(b);
    }
  };

  useEffect(() => {
    loadBudgets();
  }, [selectedWallet]);

  useEffect(() => {
    async function loadTags() {
      try {
        const tList = await getAllTags();
        setAvailableTags(tList);
      } catch (e) {}
    }
    loadTags();
  }, []);

  const handlePrevMonth = () => {
    Haptics.selectionAsync();
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(y => y - 1);
    } else {
      setViewMonth(m => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (isCurrentMonth) return;
    Haptics.selectionAsync();
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(y => y + 1);
    } else {
      setViewMonth(m => m + 1);
    }
  };

  const handlePrevYear = () => {
    Haptics.selectionAsync();
    setViewYear(y => y - 1);
  };

  const handleNextYear = () => {
    if (viewYear >= now.getFullYear()) return;
    Haptics.selectionAsync();
    setViewYear(y => y + 1);
  };

  const currentMonth = viewMonth;
  const currentYear = viewYear;

  const monthlyTransactions = useMemo(() => {
    return walletTransactions.filter(t => {
      const d = new Date(t.date);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });
  }, [walletTransactions, currentMonth, currentYear]);

  const yearlyMonthsData = useMemo(() => {
    const months = [];
    for (let m = 0; m < 12; m++) {
      const txns = walletTransactions.filter(t => {
        const d = new Date(t.date);
        return d.getMonth() === m && d.getFullYear() === currentYear;
      });

      const income = txns
        .filter(t => (t.type === 'income' && t.category !== 'debt_loan') || (t.type === 'transfer' && selectedWallet && t.toWalletId === selectedWallet.id))
        .reduce((s, t) => s + t.amount, 0);

      const expense = txns
        .filter(t => (t.type === 'expense' && t.category !== 'jameya_savings' && t.category !== 'debt_loan') || (t.type === 'transfer' && selectedWallet && t.walletId === selectedWallet.id))
        .reduce((s, t) => s + t.amount, 0);

      const savings = income - expense;

      months.push({
        monthIndex: m,
        monthName: t.months[m],
        income,
        expense,
        savings,
        txCount: txns.length,
      });
    }
    return months;
  }, [walletTransactions, currentYear, selectedWallet, t]);

  const yearlyTotals = useMemo(() => {
    const totalIncome = yearlyMonthsData.reduce((s, m) => s + m.income, 0);
    const totalExpense = yearlyMonthsData.reduce((s, m) => s + m.expense, 0);
    const totalSavings = totalIncome - totalExpense;
    const savingsRate = totalIncome > 0 ? Math.round((totalSavings / totalIncome) * 100) : 0;
    const maxVal = Math.max(...yearlyMonthsData.map(m => Math.max(m.income, m.expense)), 1);

    return {
      totalIncome,
      totalExpense,
      totalSavings,
      savingsRate,
      maxVal,
    };
  }, [yearlyMonthsData]);

  const categoryStats = useMemo((): CategoryStat[] => {
    const isExpense = viewType === 'expense';
    const filtered = monthlyTransactions.filter(t => {
      if (isExpense) {
        return (t.type === 'expense' && t.category !== 'jameya_savings' && t.category !== 'debt_loan') || (t.type === 'transfer' && selectedWallet && t.walletId === selectedWallet.id);
      } else {
        return (t.type === 'income' && t.category !== 'debt_loan') || (t.type === 'transfer' && selectedWallet && t.toWalletId === selectedWallet.id);
      }
    });

    const total = filtered.reduce((sum, t) => sum + t.amount, 0);
    const catMap = new Map<string, number>();

    filtered.forEach(t => {
      const catKey = t.type === 'transfer' ? (isExpense ? 'transfer_out' : 'transfer_in') : t.category;
      catMap.set(catKey, (catMap.get(catKey) || 0) + t.amount);
    });

    const staticCategories = isExpense ? expenseCategories : incomeCategories;
    const userCategories = customCategories.filter(c => c.type === viewType);
    const allCategories = [...staticCategories, ...userCategories];

    const transferCategory: Category = isExpense
      ? {
          id: 'transfer_out',
          name: 'Transfer to Wallet',
          nameAr: 'تحويل لمحفظة أخرى',
          icon: 'swap-horiz',
          iconFamily: 'MaterialIcons',
          color: '#8B5CF6',
        }
      : {
          id: 'transfer_in',
          name: 'Transfer from Wallet',
          nameAr: 'تحويل وارد من محفظة أخرى',
          icon: 'swap-horiz',
          iconFamily: 'MaterialIcons',
          color: '#10B981',
        };

    const stats: CategoryStat[] = [];

    catMap.forEach((catTotal, catId) => {
      if (catId === 'transfer_out' || catId === 'transfer_in') {
        stats.push({
          category: transferCategory,
          total: catTotal,
          percentage: total > 0 ? (catTotal / total) * 100 : 0,
        });
      } else {
        const category = allCategories.find(c => c.id === catId);
        if (category) {
          stats.push({
            category,
            total: catTotal,
            percentage: total > 0 ? (catTotal / total) * 100 : 0,
          });
        }
      }
    });

    stats.sort((a, b) => b.total - a.total);
    return stats;
  }, [monthlyTransactions, viewType, customCategories, selectedWallet, language]);

  const categoryStatsWithColors = useMemo(() => {
    return categoryStats.map((stat, idx) => {
      const distinctColor = HIGH_CONTRAST_DISTINCT_COLORS[idx % HIGH_CONTRAST_DISTINCT_COLORS.length];
      return {
        ...stat,
        displayColor: distinctColor,
      };
    });
  }, [categoryStats]);

  const [netWorthModalVisible, setNetWorthModalVisible] = useState(false);
  const [detailedBreakdownVisible, setDetailedBreakdownVisible] = useState(false);
  const [breakdownType, setBreakdownType] = useState<'expense' | 'income' | 'rosca'>('expense');
  const [breakdownSearchQuery, setBreakdownSearchQuery] = useState('');
  const [jameyaList, setJameyaList] = useState<Jameya[]>([]);
  const [debtList, setDebtList] = useState<Debt[]>([]);
  const [goalList, setGoalList] = useState<SavingsGoal[]>([]);
  const [selectedChartPointIndex, setSelectedChartPointIndex] = useState<number | null>(null);

  useEffect(() => {
    async function loadExtraAssets() {
      try {
        const [jData, dData, gData] = await Promise.all([
          getJameyas(),
          getDebts(),
          getGoals(),
        ]);
        if (selectedWallet) {
          setJameyaList(jData.filter(j => j.walletId === selectedWallet.id));
          setDebtList(dData.filter(d => d.walletId === selectedWallet.id));
          setGoalList(gData.filter(g => g.walletId === selectedWallet.id));
        } else {
          setJameyaList(jData);
          setDebtList(dData);
          setGoalList(gData);
        }
      } catch (e) {
        console.error('Error loading extra assets in stats:', e);
      }
    }
    loadExtraAssets();
  }, [selectedWallet, walletTransactions.length]);

  const totalJameyaSavings = useMemo(() => {
    return jameyaList.reduce((sum, j) => {
      const paidCount = Math.min(j.paidMonthsCount || 0, j.totalMonths || 0);
      return sum + (paidCount * j.monthlyAmount);
    }, 0);
  }, [jameyaList]);

  const totalSavedInGoals = useMemo(() => {
    return goalList.reduce((sum, g) => sum + (g.savedAmount || 0), 0);
  }, [goalList]);

  const totalLoansOwedToMe = useMemo(() => {
    return debtList
      .filter(d => d.type === 'debt_to_me' && d.status !== 'paid')
      .reduce((sum, d) => sum + Math.max(0, d.amount - (d.paidAmount || 0)), 0);
  }, [debtList]);

  const totalDebtsOwedByMe = useMemo(() => {
    return debtList
      .filter(d => d.type === 'debt_to_others' && d.status !== 'paid')
      .reduce((sum, d) => sum + Math.max(0, d.amount - (d.paidAmount || 0)), 0);
  }, [debtList]);

  const totalExtraNetAssets = useMemo(() => {
    return totalSavedInGoals + totalJameyaSavings + totalLoansOwedToMe - totalDebtsOwedByMe;
  }, [totalSavedInGoals, totalJameyaSavings, totalLoansOwedToMe, totalDebtsOwedByMe]);

  const targetCurrency = selectedWallet?.currency || 'KWD';

  const includedWallets = useMemo(() => {
    return (wallets || []).filter(w => !w.excludeFromTotal);
  }, [wallets]);

  const excludedWallets = useMemo(() => {
    return (wallets || []).filter(w => !!w.excludeFromTotal);
  }, [wallets]);

  const consolidatedInitialBalance = useMemo(() => {
    return includedWallets.reduce((sum, w) => {
      const init = w.initialBalance || 0;
      return sum + (Object.keys(rates).length > 0 ? convertAmount(init, w.currency, targetCurrency, rates) : init);
    }, 0);
  }, [includedWallets, rates, targetCurrency]);

  const consolidatedAllTimeIncome = useMemo(() => {
    const includedIds = new Set(includedWallets.map(w => w.id));
    return (transactions || []).filter(t => {
      if (t.type === 'income' && includedIds.has(t.walletId)) return true;
      if (t.type === 'transfer' && t.toWalletId && includedIds.has(t.toWalletId) && !includedIds.has(t.walletId)) return true;
      return false;
    }).reduce((sum, t) => {
      const fromW = wallets.find(w => w.id === t.walletId);
      const fromCurr = fromW ? fromW.currency : targetCurrency;
      return sum + (Object.keys(rates).length > 0 ? convertAmount(t.amount, fromCurr, targetCurrency, rates) : t.amount);
    }, 0);
  }, [transactions, includedWallets, wallets, rates, targetCurrency]);

  const consolidatedAllTimeExpense = useMemo(() => {
    const includedIds = new Set(includedWallets.map(w => w.id));
    return (transactions || []).filter(t => {
      if (t.type === 'expense' && includedIds.has(t.walletId)) return true;
      if (t.type === 'transfer' && includedIds.has(t.walletId) && (!t.toWalletId || !includedIds.has(t.toWalletId))) return true;
      return false;
    }).reduce((sum, t) => {
      const fromW = wallets.find(w => w.id === t.walletId);
      const fromCurr = fromW ? fromW.currency : targetCurrency;
      return sum + (Object.keys(rates).length > 0 ? convertAmount(t.amount, fromCurr, targetCurrency, rates) : t.amount);
    }, 0);
  }, [transactions, includedWallets, wallets, rates, targetCurrency]);

  const currentWalletNetWorth = useMemo(() => {
    const raw = (selectedWallet?.initialBalance || 0) + allTimeIncome - allTimeExpense;
    return raw + totalExtraNetAssets;
  }, [selectedWallet, allTimeIncome, allTimeExpense, totalExtraNetAssets]);

  const consolidatedNetWorth = useMemo(() => {
    const raw = consolidatedInitialBalance + consolidatedAllTimeIncome - consolidatedAllTimeExpense;
    return raw + totalExtraNetAssets;
  }, [consolidatedInitialBalance, consolidatedAllTimeIncome, consolidatedAllTimeExpense, totalExtraNetAssets]);

  const activeNetWorth = netWorthScope === 'all' ? consolidatedNetWorth : currentWalletNetWorth;
  const activeInitialBalance = netWorthScope === 'all' ? consolidatedInitialBalance : (selectedWallet?.initialBalance || 0);
  const activeAllTimeIncome = netWorthScope === 'all' ? consolidatedAllTimeIncome : allTimeIncome;
  const activeAllTimeExpense = netWorthScope === 'all' ? consolidatedAllTimeExpense : allTimeExpense;

  const realNetWorthPoints = useMemo(() => {
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const isCurrent = currentMonth === now.getMonth() && currentYear === now.getFullYear();
    const maxDay = isCurrent ? Math.max(1, now.getDate()) : daysInMonth;

    const points: { day: number; netWorth: number }[] = [];

    if (netWorthScope === 'all') {
      const includedIds = new Set(includedWallets.map(w => w.id));

      const priorTxns = (transactions || []).filter(t => {
        const d = new Date(t.date);
        return d.getFullYear() < currentYear || (d.getFullYear() === currentYear && d.getMonth() < currentMonth);
      });

      const priorIncome = priorTxns
        .filter(t => {
          if (t.type === 'income' && includedIds.has(t.walletId)) return true;
          if (t.type === 'transfer' && t.toWalletId && includedIds.has(t.toWalletId) && !includedIds.has(t.walletId)) return true;
          return false;
        })
        .reduce((s, t) => {
          const fromW = wallets.find(w => w.id === t.walletId);
          const fromCurr = fromW ? fromW.currency : targetCurrency;
          return s + (Object.keys(rates).length > 0 ? convertAmount(t.amount, fromCurr, targetCurrency, rates) : t.amount);
        }, 0);

      const priorExpense = priorTxns
        .filter(t => {
          if (t.type === 'expense' && includedIds.has(t.walletId)) return true;
          if (t.type === 'transfer' && includedIds.has(t.walletId) && (!t.toWalletId || !includedIds.has(t.toWalletId))) return true;
          return false;
        })
        .reduce((s, t) => {
          const fromW = wallets.find(w => w.id === t.walletId);
          const fromCurr = fromW ? fromW.currency : targetCurrency;
          return s + (Object.keys(rates).length > 0 ? convertAmount(t.amount, fromCurr, targetCurrency, rates) : t.amount);
        }, 0);

      let running = consolidatedInitialBalance + priorIncome - priorExpense + totalExtraNetAssets;

      const monthlyAllTxns = (transactions || []).filter(t => {
        const d = new Date(t.date);
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
      });

      for (let day = 1; day <= maxDay; day++) {
        const dayTxns = monthlyAllTxns.filter(t => new Date(t.date).getDate() === day);
        const inc = dayTxns
          .filter(t => {
            if (t.type === 'income' && includedIds.has(t.walletId)) return true;
            if (t.type === 'transfer' && t.toWalletId && includedIds.has(t.toWalletId) && !includedIds.has(t.walletId)) return true;
            return false;
          })
          .reduce((s, t) => {
            const fromW = wallets.find(w => w.id === t.walletId);
            const fromCurr = fromW ? fromW.currency : targetCurrency;
            return s + (Object.keys(rates).length > 0 ? convertAmount(t.amount, fromCurr, targetCurrency, rates) : t.amount);
          }, 0);

        const exp = dayTxns
          .filter(t => {
            if (t.type === 'expense' && includedIds.has(t.walletId)) return true;
            if (t.type === 'transfer' && includedIds.has(t.walletId) && (!t.toWalletId || !includedIds.has(t.toWalletId))) return true;
            return false;
          })
          .reduce((s, t) => {
            const fromW = wallets.find(w => w.id === t.walletId);
            const fromCurr = fromW ? fromW.currency : targetCurrency;
            return s + (Object.keys(rates).length > 0 ? convertAmount(t.amount, fromCurr, targetCurrency, rates) : t.amount);
          }, 0);

        running += (inc - exp);
        points.push({ day, netWorth: running });
      }
    } else {
      const priorTxns = walletTransactions.filter(t => {
        const d = new Date(t.date);
        return d.getFullYear() < currentYear || (d.getFullYear() === currentYear && d.getMonth() < currentMonth);
      });

      const priorIncome = priorTxns
        .filter(t => t.type === 'income' || (t.type === 'transfer' && selectedWallet && t.toWalletId === selectedWallet.id))
        .reduce((s, t) => {
          if (t.type === 'transfer' && selectedWallet && t.toWalletId === selectedWallet.id) {
            const fromW = wallets.find(w => w.id === t.walletId);
            const fromCurr = fromW ? fromW.currency : selectedWallet.currency;
            return s + (Object.keys(rates).length > 0 ? convertAmount(t.amount, fromCurr, selectedWallet.currency, rates) : t.amount);
          }
          return s + t.amount;
        }, 0);

      const priorExpense = priorTxns
        .filter(t => t.type === 'expense' || (t.type === 'transfer' && selectedWallet && t.walletId === selectedWallet.id))
        .reduce((s, t) => s + t.amount, 0);

      let running = (selectedWallet?.initialBalance || 0) + priorIncome - priorExpense + totalExtraNetAssets;

      for (let day = 1; day <= maxDay; day++) {
        const dayTxns = monthlyTransactions.filter(t => new Date(t.date).getDate() === day);
        const inc = dayTxns
          .filter(t => t.type === 'income' || (t.type === 'transfer' && selectedWallet && t.toWalletId === selectedWallet.id))
          .reduce((s, t) => {
            if (t.type === 'transfer' && selectedWallet && t.toWalletId === selectedWallet.id) {
              const fromW = wallets.find(w => w.id === t.walletId);
              const fromCurr = fromW ? fromW.currency : selectedWallet.currency;
              return s + (Object.keys(rates).length > 0 ? convertAmount(t.amount, fromCurr, selectedWallet.currency, rates) : t.amount);
            }
            return s + t.amount;
          }, 0);

        const exp = dayTxns
          .filter(t => t.type === 'expense' || (t.type === 'transfer' && selectedWallet && t.walletId === selectedWallet.id))
          .reduce((s, t) => s + t.amount, 0);

        running += (inc - exp);
        points.push({ day, netWorth: running });
      }
    }

    return points;
  }, [walletTransactions, monthlyTransactions, transactions, currentYear, currentMonth, now, selectedWallet, totalExtraNetAssets, netWorthScope, includedWallets, consolidatedInitialBalance, wallets, rates, targetCurrency]);

  const realSparkline = useMemo(() => {
    return generateSparklinePath(realNetWorthPoints, 140, 38);
  }, [realNetWorthPoints]);

  const dailyData = useMemo((): DailyData[] => {
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const displayDays = Math.min(daysInMonth, now.getDate());
    const lastDays = Math.min(displayDays, 14);
    const startDay = displayDays - lastDays + 1;

    const data: DailyData[] = [];
    for (let d = startDay; d <= displayDays; d++) {
      const dayTxns = monthlyTransactions.filter(t => {
        const date = new Date(t.date);
        return date.getDate() === d;
      });
      data.push({
        day: d,
        income: dayTxns.filter(t => (t.type === 'income' && t.category !== 'debt_loan') || (t.type === 'transfer' && selectedWallet && t.toWalletId === selectedWallet.id)).reduce((s, t) => s + t.amount, 0),
        expense: dayTxns.filter(t => (t.type === 'expense' && t.category !== 'jameya_savings' && t.category !== 'debt_loan') || (t.type === 'transfer' && selectedWallet && t.walletId === selectedWallet.id)).reduce((s, t) => s + t.amount, 0),
      });
    }
    return data;
  }, [monthlyTransactions, currentYear, currentMonth, now]);

  const momStats = useMemo(() => {
    const prevMonthIndex = currentMonth === 0 ? 11 : currentMonth - 1;
    const prevMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;

    const prevMonthTxns = walletTransactions.filter(t => {
      const d = new Date(t.date);
      return d.getMonth() === prevMonthIndex && d.getFullYear() === prevMonthYear;
    });

    const currentMonthExpense = monthlyTransactions
      .filter(t => (t.type === 'expense' && t.category !== 'jameya_savings' && t.category !== 'debt_loan') || (t.type === 'transfer' && selectedWallet && t.walletId === selectedWallet.id))
      .reduce((s, t) => s + t.amount, 0);

    const prevMonthExpense = prevMonthTxns
      .filter(t => (t.type === 'expense' && t.category !== 'jameya_savings' && t.category !== 'debt_loan') || (t.type === 'transfer' && selectedWallet && t.walletId === selectedWallet.id))
      .reduce((s, t) => s + t.amount, 0);

    const currentMonthIncome = monthlyTransactions
      .filter(t => t.type === 'income' || (t.type === 'transfer' && selectedWallet && t.toWalletId === selectedWallet.id))
      .reduce((s, t) => s + t.amount, 0);

    const prevMonthIncome = prevMonthTxns
      .filter(t => t.type === 'income' || (t.type === 'transfer' && selectedWallet && t.toWalletId === selectedWallet.id))
      .reduce((s, t) => s + t.amount, 0);

    let expenseChangePercent = 0;
    if (prevMonthExpense > 0) {
      expenseChangePercent = Math.round(((currentMonthExpense - prevMonthExpense) / prevMonthExpense) * 100);
    } else if (currentMonthExpense > 0) {
      expenseChangePercent = 100;
    }

    let incomeChangePercent = 0;
    if (prevMonthIncome > 0) {
      incomeChangePercent = Math.round(((currentMonthIncome - prevMonthIncome) / prevMonthIncome) * 100);
    } else if (currentMonthIncome > 0) {
      incomeChangePercent = 100;
    }

    const lastYearTxns = walletTransactions.filter(t => {
      const d = new Date(t.date);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear - 1;
    });

    const lastYearExpense = lastYearTxns
      .filter(t => (t.type === 'expense' && t.category !== 'jameya_savings' && t.category !== 'debt_loan') || (t.type === 'transfer' && selectedWallet && t.walletId === selectedWallet.id))
      .reduce((s, t) => s + t.amount, 0);

    let yoyExpenseChangePercent = 0;
    if (lastYearExpense > 0) {
      yoyExpenseChangePercent = Math.round(((currentMonthExpense - lastYearExpense) / lastYearExpense) * 100);
    }

    return {
      currentMonthExpense,
      prevMonthExpense,
      expenseChangePercent,
      currentMonthIncome,
      prevMonthIncome,
      incomeChangePercent,
      lastYearExpense,
      yoyExpenseChangePercent,
      prevMonthName: t.months[prevMonthIndex],
    };
  }, [walletTransactions, currentMonth, currentYear, monthlyTransactions, selectedWallet, t]);

  const maxDailyValue = useMemo(() => {
    return Math.max(...dailyData.map(d => Math.max(d.income, d.expense)), 1);
  }, [dailyData]);

  // Recalculate income/expense totals for selected month
  const monthlyIncome = useMemo(() => {
    return monthlyTransactions.filter(t => (t.type === 'income' && t.category !== 'debt_loan') || (t.type === 'transfer' && selectedWallet && t.toWalletId === selectedWallet.id)).reduce((s, t) => s + t.amount, 0);
  }, [monthlyTransactions, selectedWallet]);

  const monthlyExpense = useMemo(() => {
    return monthlyTransactions.filter(t => (t.type === 'expense' && t.category !== 'jameya_savings' && t.category !== 'debt_loan') || (t.type === 'transfer' && selectedWallet && t.walletId === selectedWallet.id)).reduce((s, t) => s + t.amount, 0);
  }, [monthlyTransactions, selectedWallet]);

  const monthlyJameyaSavings = useMemo(() => {
    return monthlyTransactions.filter(t => t.category === 'jameya_savings').reduce((s, t) => s + t.amount, 0);
  }, [monthlyTransactions]);

  const totalAmount = viewType === 'expense' ? monthlyExpense : monthlyIncome;
  const totalAll = monthlyIncome + monthlyExpense;

  const netWorth = activeNetWorth;

  const savingsRate = useMemo(() => {
    if (monthlyIncome <= 0) return 0;
    const net = monthlyIncome - monthlyExpense;
    return Math.max(0, Math.min(100, Math.round((net / monthlyIncome) * 100)));
  }, [monthlyIncome, monthlyExpense]);

  const tagStats = useMemo(() => {
    const map: Record<string, number> = {};

    monthlyTransactions.forEach(tx => {
      if (tx.type !== viewType) return;
      const tagsList = parseTransactionTags(tx.tags);
      tagsList.forEach(tagId => {
        map[tagId] = (map[tagId] || 0) + tx.amount;
      });
    });

    const entries = Object.entries(map).map(([tagId, amount]) => {
      const tagObj = availableTags.find(t => t.id === tagId);
      const percentage = totalAmount > 0 ? (amount / totalAmount) * 100 : 0;
      return {
        tagId,
        tagObj,
        amount,
        percentage,
      };
    });

    entries.sort((a, b) => b.amount - a.amount);
    return entries;
  }, [monthlyTransactions, viewType, totalAmount, availableTags]);

  const allExpenseCategories = useMemo(() => {
    const userCats = customCategories.filter(c => c.type === 'expense');
    return [...expenseCategories, ...userCats];
  }, [customCategories]);

  return (
    <LinearGradient
      colors={theme === 'dark' ? ['#070B14', '#0D1424', '#05070B'] : ['#F8FAFC', '#F1F5F9', '#E2E8F0']}
      style={styles.container}
      start={{ x: 0.1, y: 0.1 }}
      end={{ x: 0.9, y: 0.9 }}
    >
      <ScrollView
        contentInsetAdjustmentBehavior="never"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 180 + (insets.bottom || 20) }}
      >
        {/* Header Row */}
        <View style={[styles.header, { paddingTop: (insets.top || webTopInset) + 12 }]}>
          <View style={styles.headerRow}>
            <Text style={styles.headerTitle}>{t.stats}</Text>
            <Pressable
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                backgroundColor: colors.primary + '18',
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: colors.primary + '35',
              }}
              onPress={() => {
                Haptics.selectionAsync();
                setIsMonthlyDigestOpen(true);
              }}
            >
              <Ionicons name="sparkles" size={15} color={colors.primary} />
              <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 12, color: colors.primary }}>
                {language === 'ar' ? 'التقرير الشهري 📊' : 'Monthly Digest 📊'}
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Wallet Selector Row */}
        <View style={{ marginBottom: 4 }}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.walletSelectorScroll}
          >
            {wallets.map((wallet) => {
              const isSelected = selectedWallet?.id === wallet.id;
              return (
                <Pressable
                  key={wallet.id}
                  onPress={() => {
                    Haptics.selectionAsync();
                    selectWallet(wallet.id);
                  }}
                  style={[
                    styles.walletChip,
                    isSelected && { borderColor: wallet.color, backgroundColor: wallet.color + '15' }
                  ]}
                >
                  <MaterialIcons name={wallet.icon as any} size={16} color={isSelected ? wallet.color : colors.textSecondary} />
                  <Text style={[styles.walletChipText, { color: isSelected ? wallet.color : colors.textSecondary }]}>
                    {wallet.name}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {/* Executive Financial Status Hero Banner (Inspired by Image 2) */}
        <View style={{ marginHorizontal: 20, marginTop: 4, marginBottom: 16 }}>
          <LinearGradient
            colors={theme === 'dark' ? ['#0A2E28', '#071F1C', '#0A0F1D'] : ['#ECFDF5', '#D1FAE5', '#F1F5F9']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              borderRadius: 24,
              padding: 16,
              borderWidth: 1.5,
              borderColor: theme === 'dark' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(16, 185, 129, 0.2)',
              shadowColor: '#10B981',
              shadowOffset: { width: 0, height: 6 },
              shadowOpacity: theme === 'dark' ? 0.35 : 0.1,
              shadowRadius: 14,
              gap: 14,
            }}
          >
            {/* Top Greeting Row */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{ flex: 1, paddingRight: 8 }}>
                <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 18, color: colors.text, textAlign: 'left' }}>
                  {language === 'ar' ? `أهلاً بك، ${selectedWallet?.name || 'في ميزان'}` : `Welcome, ${selectedWallet?.name || 'Mizan'}`}
                </Text>
                <Text style={{ fontFamily: 'Cairo_400Regular', fontSize: 11, color: colors.textSecondary, textAlign: 'left' }}>
                  {language === 'ar' ? 'ملخص الملاءة والوضع المالي الشامل' : 'Your Financial Status & Wealth Overview'}
                </Text>
              </View>
              <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: '#10B98120', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#10B98140' }}>
                <Ionicons name="wallet-outline" size={20} color="#10B981" />
              </View>
            </View>

            {/* 3-Card Grid (Image 2 Replica) */}
            <View style={{ flexDirection: 'row', gap: 10 }}>
              {/* Left Card: Real Net Worth & Smooth Sparkline Wave Curve */}
              <Pressable
                onPress={() => {
                  Haptics.selectionAsync();
                  setNetWorthModalVisible(true);
                }}
                style={({ pressed }) => [
                  { flex: 1, backgroundColor: theme === 'dark' ? 'rgba(15, 23, 42, 0.85)' : '#FFFFFF', borderRadius: 18, padding: 12, borderWidth: 1, borderColor: colors.border, justifyContent: 'space-between', minHeight: 135 },
                  pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] }
                ]}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ fontFamily: 'Cairo_600SemiBold', fontSize: 11, color: colors.textSecondary, textAlign: 'left' }}>
                    {language === 'ar' ? 'صافي الملاءة' : 'Net Worth'}
                  </Text>
                  <View style={{ backgroundColor: '#10B98115', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                    <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 9, color: '#10B981' }}>
                      {language === 'ar' ? 'تفاصيل 🔍' : 'Details 🔍'}
                    </Text>
                  </View>
                </View>

                {/* Real Dynamic Bezier Wave SVG Calculated from Transactions */}
                <View style={{ marginVertical: 2, height: 42 }}>
                  <Svg width="100%" height="42" viewBox="0 0 140 42">
                    <Defs>
                      <SvgGradient id="netWorthGrad" x1="0" y1="0" x2="0" y2="1">
                        <Stop offset="0" stopColor="#10B981" stopOpacity="0.45" />
                        <Stop offset="1" stopColor="#10B981" stopOpacity="0.0" />
                      </SvgGradient>
                    </Defs>
                    <Path
                      d={realSparkline.areaD}
                      fill="url(#netWorthGrad)"
                    />
                    <Path
                      d={realSparkline.pathD}
                      fill="none"
                      stroke="#10B981"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                    />
                    <Circle cx={realSparkline.lastX} cy={realSparkline.lastY} r="3.5" fill="#10B981" />
                  </Svg>
                </View>

                <View style={{ alignItems: 'flex-start' }}>
                  <Text style={{ fontFamily: 'Cairo_400Regular', fontSize: 9, color: colors.textSecondary }}>
                    {language === 'ar' ? 'النمو الحقيقي الصافي' : 'Real Net Assets'}
                  </Text>
                  <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 14, color: colors.text }} numberOfLines={1} adjustsFontSizeToFit>
                    {netWorth >= 0 ? '+' : ''}{formatCurrency(netWorth)} <Text style={{ fontSize: 10, fontFamily: 'Cairo_600SemiBold' }}>{currencySymbol}</Text>
                  </Text>
                </View>
              </Pressable>

              {/* Right Column: Monthly Spending Donut & Savings Goal Bar */}
              <View style={{ flex: 1, gap: 10 }}>
                {/* Right Top Card: Monthly Spending Ring */}
                <Pressable
                  onPress={() => {
                    Haptics.selectionAsync();
                    setBreakdownType('expense');
                    setBreakdownSearchQuery('');
                    setDetailedBreakdownVisible(true);
                  }}
                  style={({ pressed }) => [
                    { backgroundColor: theme === 'dark' ? 'rgba(15, 23, 42, 0.85)' : '#FFFFFF', borderRadius: 16, padding: 10, borderWidth: 1, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', gap: 10 },
                    pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] }
                  ]}
                >
                  {/* Mini Donut Segment SVG */}
                  <Svg width={38} height={38}>
                    <Circle cx={19} cy={19} r={13} stroke={colors.borderLight} strokeWidth={5} fill="none" />
                    <Circle cx={19} cy={19} r={13} stroke="#10B981" strokeWidth={5} strokeDasharray="45 35" fill="none" strokeLinecap="round" transform="rotate(-90 19 19)" />
                    <Circle cx={19} cy={19} r={13} stroke="#F59E0B" strokeWidth={5} strokeDasharray="20 60" strokeDashoffset={-45} fill="none" strokeLinecap="round" transform="rotate(-90 19 19)" />
                    <Circle cx={19} cy={19} r={13} stroke="#FB7185" strokeWidth={5} strokeDasharray="14 66" strokeDashoffset={-65} fill="none" strokeLinecap="round" transform="rotate(-90 19 19)" />
                  </Svg>
                  <View style={{ flex: 1, alignItems: 'flex-start' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Text style={{ fontFamily: 'Cairo_400Regular', fontSize: 9, color: colors.textSecondary }}>
                        {language === 'ar' ? 'مصاريف الشهر' : 'Monthly Spending'}
                      </Text>
                      <Ionicons name="chevron-forward" size={10} color={colors.textTertiary} />
                    </View>
                    <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 13, color: colors.text }} numberOfLines={1} adjustsFontSizeToFit>
                      {formatCurrency(monthlyExpense)} <Text style={{ fontSize: 9, fontFamily: 'Cairo_600SemiBold' }}>{currencySymbol}</Text>
                    </Text>
                  </View>
                </Pressable>

                {/* Right Bottom Card: Savings Goal Progress */}
                <View style={{ backgroundColor: theme === 'dark' ? 'rgba(15, 23, 42, 0.85)' : '#FFFFFF', borderRadius: 16, padding: 10, borderWidth: 1, borderColor: colors.border, gap: 6 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ fontFamily: 'Cairo_600SemiBold', fontSize: 10, color: colors.textSecondary }}>
                      {language === 'ar' ? 'معدل الادخار' : 'Savings Goal'}
                    </Text>
                    <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 11, color: '#10B981' }}>
                      {savingsRate}%
                    </Text>
                  </View>

                  {/* Progress Bar */}
                  <View style={{ height: 6, backgroundColor: colors.borderLight, borderRadius: 3, overflow: 'hidden' }}>
                    <LinearGradient
                      colors={['#10B981', '#06B6D4']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={{ width: `${Math.min(100, Math.max(5, savingsRate))}%`, height: '100%', borderRadius: 3 }}
                    />
                  </View>
                </View>
              </View>
            </View>
          </LinearGradient>
        </View>

        {/* Control Center: Scope Switcher (Zoom In / Zoom Out) + Nav in a Glass Card */}
        <View style={styles.controlCard}>
          {Platform.OS === 'ios' && (
            <BlurView intensity={theme === 'dark' ? 20 : 45} tint={theme === 'dark' ? 'dark' : 'light'} style={[StyleSheet.absoluteFill, { borderRadius: 18 }]} />
          )}

          {/* Scope Segmented Switcher */}
          <View style={{ flexDirection: 'row', backgroundColor: colors.surfaceAlt, borderRadius: 14, padding: 3, marginBottom: 12, borderWidth: 1, borderColor: colors.border }}>
            <Pressable
              onPress={() => {
                Haptics.selectionAsync();
                setScope('monthly');
              }}
              style={[
                { flex: 1, paddingVertical: 8, borderRadius: 11, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 },
                scope === 'monthly' && { backgroundColor: colors.primary }
              ]}
            >
              <Ionicons name="calendar-outline" size={16} color={scope === 'monthly' ? '#FFF' : colors.textSecondary} />
              <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 13, color: scope === 'monthly' ? '#FFF' : colors.textSecondary }}>
                {language === 'ar' ? 'شهري' : 'Monthly'}
              </Text>
            </Pressable>

            <Pressable
              onPress={() => {
                Haptics.selectionAsync();
                setScope('yearly');
              }}
              style={[
                { flex: 1, paddingVertical: 8, borderRadius: 11, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 },
                scope === 'yearly' && { backgroundColor: colors.primary }
              ]}
            >
              <Ionicons name="stats-chart-outline" size={16} color={scope === 'yearly' ? '#FFF' : colors.textSecondary} />
              <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 13, color: scope === 'yearly' ? '#FFF' : colors.textSecondary }}>
                {language === 'ar' ? 'سنوي' : 'Yearly'}
              </Text>
            </Pressable>
          </View>

          {/* Navigation Controls */}
          {scope === 'monthly' ? (
            <View style={styles.monthNav}>
              <Pressable onPress={handlePrevMonth} style={styles.monthNavBtn} hitSlop={8}>
                <Ionicons name="chevron-back" size={20} color={colors.primary} />
              </Pressable>
              <Text style={styles.monthNavLabel}>{t.months[currentMonth]} {currentYear}</Text>
              <Pressable
                onPress={handleNextMonth}
                style={[styles.monthNavBtn, isCurrentMonth && styles.monthNavBtnDisabled]}
                hitSlop={8}
              >
                <Ionicons name="chevron-forward" size={20} color={isCurrentMonth ? colors.textTertiary : colors.primary} />
              </Pressable>
            </View>
          ) : (
            <View style={styles.monthNav}>
              <Pressable onPress={handlePrevYear} style={styles.monthNavBtn} hitSlop={8}>
                <Ionicons name="chevron-back" size={20} color={colors.primary} />
              </Pressable>
              <Text style={styles.monthNavLabel}>{language === 'ar' ? `عام ${currentYear}` : `Year ${currentYear}`}</Text>
              <Pressable
                onPress={handleNextYear}
                style={[styles.monthNavBtn, currentYear >= now.getFullYear() && styles.monthNavBtnDisabled]}
                hitSlop={8}
              >
                <Ionicons name="chevron-forward" size={20} color={currentYear >= now.getFullYear() ? colors.textTertiary : colors.primary} />
              </Pressable>
            </View>
          )}

          {scope === 'monthly' && (
            <View style={styles.segmentedControl}>
              <Pressable
                onPress={() => {
                  Haptics.selectionAsync();
                  setViewType('expense');
                }}
                style={[styles.segmentBtn, viewType === 'expense' && styles.segmentBtnActiveExpense]}
              >
                <Text style={[styles.segmentText, viewType === 'expense' && styles.segmentTextActive]}>
                  {t.expenses}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  Haptics.selectionAsync();
                  setViewType('income');
                }}
                style={[styles.segmentBtn, viewType === 'income' && styles.segmentBtnActiveIncome]}
              >
                <Text style={[styles.segmentText, viewType === 'income' && styles.segmentTextActive]}>
                  {t.income}
                </Text>
              </Pressable>
            </View>
          )}
        </View>

        {/* YEARLY ZOOM OUT VIEW */}
        {scope === 'yearly' ? (
          <YearlyOverview
            yearlyTotals={yearlyTotals}
            yearlyMonthsData={yearlyMonthsData}
            currentYear={currentYear}
            currentMonth={currentMonth}
            currencySymbol={currencySymbol}
            language={language}
            colors={colors}
            onSelectMonth={(monthIndex) => {
              setViewMonth(monthIndex);
              setScope('monthly');
            }}
          />
        ) : null}

        {/* MONTHLY ZOOM IN VIEW */}
        {scope === 'monthly' && (
          <>
            {/* MoM & YoY Comparison Banner */}
            <View style={{ marginHorizontal: 20, marginBottom: 12, backgroundColor: colors.surface, padding: 14, borderRadius: 20, borderWidth: 1, borderColor: colors.border, gap: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name="trending-up" size={18} color={colors.primary} />
                  <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 13, color: colors.text }}>
                    {language === 'ar' ? 'مقارنة بالشهر السابق (MoM)' : 'Month-over-Month (MoM)'}
                  </Text>
                </View>
                <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, backgroundColor: momStats.expenseChangePercent <= 0 ? '#10B98118' : '#EF444418' }}>
                  <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 11, color: momStats.expenseChangePercent <= 0 ? '#10B981' : '#EF4444' }}>
                    {momStats.expenseChangePercent <= 0 ? `${momStats.expenseChangePercent}%` : `+${momStats.expenseChangePercent}%`}
                  </Text>
                </View>
              </View>

              <Text style={{ fontFamily: 'Cairo_600SemiBold', fontSize: 12, color: colors.textSecondary, lineHeight: 18 }}>
                {momStats.expenseChangePercent <= 0
                  ? (language === 'ar'
                      ? `ممتاز! مصاريفك هذا الشهر أقل بنسبة ${Math.abs(momStats.expenseChangePercent)}% مقارنة بشهر ${momStats.prevMonthName}.`
                      : `Great! Your expenses this month are ${Math.abs(momStats.expenseChangePercent)}% lower than ${momStats.prevMonthName}.`)
                  : (language === 'ar'
                      ? `تنبيه: مصاريفك هذا الشهر ارتفعت بنسبة ${momStats.expenseChangePercent}% مقارنة بشهر ${momStats.prevMonthName}.`
                      : `Notice: Your expenses increased by ${momStats.expenseChangePercent}% compared to ${momStats.prevMonthName}.`)}
              </Text>

              {momStats.lastYearExpense > 0 && (
                <View style={{ paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.borderLight, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={{ fontFamily: 'Cairo_400Regular', fontSize: 11, color: colors.textSecondary }}>
                    {language === 'ar' ? `مقارنة بنتيجة العام الماضي (${currentYear - 1}):` : `YoY (vs ${currentYear - 1}):`}
                  </Text>
                  <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 11, color: momStats.yoyExpenseChangePercent <= 0 ? '#10B981' : '#EF4444' }}>
                    {momStats.yoyExpenseChangePercent <= 0 ? `${momStats.yoyExpenseChangePercent}%` : `+${momStats.yoyExpenseChangePercent}%`}
                  </Text>
                </View>
              )}
            </View>

            {/* Overview Row Cards with dynamic ambient shadows */}
            <View style={styles.overviewCards}>
              <Pressable
                onPress={() => {
                  Haptics.selectionAsync();
                  setBreakdownType('income');
                  setBreakdownSearchQuery('');
                  setDetailedBreakdownVisible(true);
                }}
                style={({ pressed }) => [
                  styles.overviewCard, 
                  { 
                    shadowColor: colors.income, 
                    shadowOpacity: theme === 'dark' ? 0.25 : 0.08, 
                    shadowRadius: 10,
                    shadowOffset: { width: 0, height: 4 }
                  },
                  pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] }
                ]}
              >
                {Platform.OS === 'ios' && (
                  <BlurView intensity={theme === 'dark' ? 15 : 40} tint={theme === 'dark' ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
                )}
                <View style={styles.overviewRow}>
                  <View style={[styles.overviewIconWrap, { backgroundColor: colors.income + '12' }]}>
                    <Ionicons name="arrow-down" size={16} color={colors.income} />
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                    <Text style={styles.overviewLabel}>{t.income}</Text>
                    <Ionicons name="chevron-forward" size={10} color={colors.textTertiary} />
                  </View>
                </View>
                <Text style={[styles.overviewValue, { color: colors.income }]} numberOfLines={1}>
                  {formatCurrency(monthlyIncome)} <Text style={styles.overviewCurrency}>{currencySymbol}</Text>
                </Text>
              </Pressable>

              <Pressable
                onPress={() => {
                  Haptics.selectionAsync();
                  setBreakdownType('expense');
                  setBreakdownSearchQuery('');
                  setDetailedBreakdownVisible(true);
                }}
                style={({ pressed }) => [
                  styles.overviewCard, 
                  { 
                    shadowColor: colors.expense, 
                    shadowOpacity: theme === 'dark' ? 0.25 : 0.08, 
                    shadowRadius: 10,
                    shadowOffset: { width: 0, height: 4 }
                  },
                  pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] }
                ]}
              >
                {Platform.OS === 'ios' && (
                  <BlurView intensity={theme === 'dark' ? 15 : 40} tint={theme === 'dark' ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
                )}
                <View style={styles.overviewRow}>
                  <View style={[styles.overviewIconWrap, { backgroundColor: colors.expense + '12' }]}>
                    <Ionicons name="arrow-up" size={16} color={colors.expense} />
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                    <Text style={styles.overviewLabel}>{t.expenses}</Text>
                    <Ionicons name="chevron-forward" size={10} color={colors.textTertiary} />
                  </View>
                </View>
                <Text style={[styles.overviewValue, { color: colors.expense }]} numberOfLines={1}>
                  {formatCurrency(monthlyExpense)} <Text style={styles.overviewCurrency}>{currencySymbol}</Text>
                </Text>
              </Pressable>

              {monthlyJameyaSavings > 0 && (
                <Pressable
                  onPress={() => {
                    Haptics.selectionAsync();
                    setBreakdownType('rosca');
                    setBreakdownSearchQuery('');
                    setDetailedBreakdownVisible(true);
                  }}
                  style={({ pressed }) => [
                    styles.overviewCard, 
                    { 
                      shadowColor: '#0D7C66', 
                      shadowOpacity: theme === 'dark' ? 0.25 : 0.08, 
                      shadowRadius: 10,
                      shadowOffset: { width: 0, height: 4 }
                    },
                    pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] }
                  ]}
                >
                  {Platform.OS === 'ios' && (
                    <BlurView intensity={theme === 'dark' ? 15 : 40} tint={theme === 'dark' ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
                  )}
                  <View style={styles.overviewRow}>
                    <View style={[styles.overviewIconWrap, { backgroundColor: '#0D7C6615' }]}>
                      <Ionicons name="gift-outline" size={16} color="#0D7C66" />
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                      <Text style={styles.overviewLabel}>{language === 'ar' ? 'ادخار جمعيات' : 'ROSCA Savings'}</Text>
                      <Ionicons name="chevron-forward" size={10} color={colors.textTertiary} />
                    </View>
                  </View>
                  <Text style={[styles.overviewValue, { color: '#0D7C66' }]} numberOfLines={1}>
                    +{formatCurrency(monthlyJameyaSavings)} <Text style={styles.overviewCurrency}>{currencySymbol}</Text>
                  </Text>
                </Pressable>
              )}
            </View>

        {/* Donut Chart & Category Breakdown */}
        <DonutChart
          categoryStatsWithColors={categoryStatsWithColors}
          totalAmount={totalAmount}
          currencySymbol={currencySymbol}
          language={language}
          colors={colors}
          theme={theme}
          t={t}
          budgets={budgets}
        />

        {/* Smart Tags Analytics Section */}
        <TagBreakdown
          tagStats={tagStats}
          currencySymbol={currencySymbol}
          language={language}
          colors={colors}
        />

        {/* Daily Spending Bar Chart Section */}
        <BarChartMonthly
          dailyData={dailyData}
          maxDailyValue={maxDailyValue}
          colors={colors}
          theme={theme}
          t={t}
        />
        </>
        )}

        {/* Dedicated Premium Budgets Dashboard */}
        <View style={styles.budgetsSection}>
          <View style={styles.budgetsHeaderRow}>
            <Text style={styles.sectionTitle}>{language === 'ar' ? 'الميزانيات والحدود الذكية' : 'Smart Budgets & Limits'}</Text>
            <Pressable
              onPress={() => {
                Haptics.selectionAsync();
                setManageBudgetsVisible(true);
              }}
              style={styles.manageBudgetsBtn}
            >
              <Ionicons name="add-circle-outline" size={18} color={colors.primary} />
              <Text style={styles.manageBudgetsBtnText}>{language === 'ar' ? 'إدارة' : 'Manage'}</Text>
            </Pressable>
          </View>

          {Object.keys(budgets).length === 0 ? (
            <Pressable 
              onPress={() => {
                Haptics.selectionAsync();
                setManageBudgetsVisible(true);
              }}
              style={styles.emptyBudgetCard}
            >
              <Ionicons name="wallet-outline" size={32} color={colors.primary} />
              <Text style={styles.emptyBudgetTitle}>
                {language === 'ar' ? 'لم تحدد أي ميزانية بعد' : 'No Budgets Configured Yet'}
              </Text>
              <Text style={styles.emptyBudgetSubtitle}>
                {language === 'ar' ? 'اضغط هنا لتحديد حد إنفاق شهري للفئات وتجنب الإسراف' : 'Tap here to set monthly spending limits for categories and save money'}
              </Text>
            </Pressable>
          ) : (
            <View style={styles.budgetsGrid}>
              {allExpenseCategories
                .filter(cat => budgets[cat.id] > 0)
                .map(cat => {
                  const limit = budgets[cat.id];
                  const catStat = categoryStats.find(s => s.category.id === cat.id);
                  const spent = catStat ? catStat.total : 0;
                  const percent = Math.min(100, (spent / limit) * 100);
                  const remaining = limit - spent;
                  const isOver = spent > limit;
                  const barColor = isOver ? colors.expense : (percent > 85 ? '#F59E0B' : cat.color);

                  return (
                    <View key={cat.id} style={styles.premiumBudgetCard}>
                      <View style={styles.budgetCardTop}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                          <View style={[styles.budgetIconWrap, { backgroundColor: cat.color + '15' }]}>
                            <MaterialIcons name={cat.icon as any} size={18} color={cat.color} />
                          </View>
                          <Text style={styles.budgetName}>{getCategoryName(cat.id, language)}</Text>
                        </View>
                        <Pressable
                          onPress={() => {
                            Haptics.selectionAsync();
                            setManageBudgetsVisible(true);
                          }}
                          hitSlop={12}
                        >
                          <Ionicons name="pencil" size={16} color={colors.textTertiary} />
                        </Pressable>
                      </View>

                      <View style={{ marginVertical: 8 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                          <Text style={styles.budgetAmountText}>
                            {formatCurrency(spent)} / {formatCurrency(limit)} {currencySymbol}
                          </Text>
                          <Text style={[styles.budgetPercentText, { color: barColor }]}>
                            {Math.round(percent)}%
                          </Text>
                        </View>
                        <View style={styles.budgetProgressBg}>
                          <View style={[styles.budgetProgressFill, { width: `${percent}%`, backgroundColor: barColor }]} />
                        </View>
                      </View>

                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text style={[styles.budgetRemainingText, isOver && { color: colors.expense, fontFamily: 'Cairo_700Bold' }]}>
                          {isOver 
                            ? (language === 'ar' ? `⚠️ تجاوزت بـ ${formatCurrency(Math.abs(remaining))}` : `⚠️ Over by ${formatCurrency(Math.abs(remaining))}`)
                            : (language === 'ar' ? `متبقي ${formatCurrency(remaining)}` : `${formatCurrency(remaining)} left`)
                          }
                        </Text>
                      </View>
                    </View>
                  );
                })}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Manage Budgets Modal */}
      <BudgetManagerModal
        visible={manageBudgetsVisible}
        onClose={() => setManageBudgetsVisible(false)}
        allExpenseCategories={allExpenseCategories}
        budgets={budgets}
        currencySymbol={currencySymbol}
        language={language}
        colors={colors}
        t={t}
        onSaveBudget={async (cat, limit) => {
          if (!selectedWallet) return;
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          if (limit > 0) {
            await setCategoryBudget(selectedWallet.id, cat.id, limit);
          } else {
            await removeCategoryBudget(selectedWallet.id, cat.id);
          }
          await loadBudgets();
        }}
      />

      {/* Detailed Net Worth & Solvency Interactive Modal */}
      <Modal visible={netWorthModalVisible} animationType="slide" transparent onRequestClose={() => setNetWorthModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <SafeAreaView style={[styles.modalSheet, { flex: 1, maxHeight: '90%' }]}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <Pressable onPress={() => setNetWorthModalVisible(false)} hitSlop={12} style={styles.closeBtn}>
                <Ionicons name="close" size={22} color={colors.text} />
              </Pressable>
              <Text style={styles.modalTitle}>
                {language === 'ar' ? 'تحليل ومسار صافي الملاءة' : 'Net Worth & Solvency Breakdown'}
              </Text>
              <View style={{ width: 32 }} />
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, gap: 16 }}>
              {/* Scope Switcher: Active Wallet vs Consolidated All Wallets */}
              <View style={{ flexDirection: 'row', backgroundColor: theme === 'dark' ? '#0F172A' : '#E2E8F0', borderRadius: 14, padding: 4, gap: 4 }}>
                <Pressable
                  onPress={() => {
                    Haptics.selectionAsync();
                    setNetWorthScope('current');
                  }}
                  style={{
                    flex: 1,
                    paddingVertical: 9,
                    borderRadius: 10,
                    alignItems: 'center',
                    backgroundColor: netWorthScope === 'current' ? (theme === 'dark' ? '#1E293B' : '#FFFFFF') : 'transparent',
                    shadowColor: '#000',
                    shadowOpacity: netWorthScope === 'current' ? 0.08 : 0,
                    shadowRadius: 4,
                  }}
                >
                  <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 12, color: netWorthScope === 'current' ? colors.primary : colors.textSecondary }}>
                    💳 {language === 'ar' ? (selectedWallet?.name || 'المحفظة الحالية') : (selectedWallet?.name || 'Active Wallet')}
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => {
                    Haptics.selectionAsync();
                    setNetWorthScope('all');
                  }}
                  style={{
                    flex: 1,
                    paddingVertical: 9,
                    borderRadius: 10,
                    alignItems: 'center',
                    backgroundColor: netWorthScope === 'all' ? (theme === 'dark' ? '#1E293B' : '#FFFFFF') : 'transparent',
                    shadowColor: '#000',
                    shadowOpacity: netWorthScope === 'all' ? 0.08 : 0,
                    shadowRadius: 4,
                  }}
                >
                  <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 12, color: netWorthScope === 'all' ? '#10B981' : colors.textSecondary }}>
                    🌐 {language === 'ar' ? 'الإجمالي الشامل (كل المحافظ)' : 'Consolidated Total'}
                  </Text>
                </Pressable>
              </View>

              {/* Solvency Summary Card */}
              <View style={{ backgroundColor: theme === 'dark' ? '#0F172A' : '#F1F5F9', borderRadius: 20, padding: 16, borderWidth: 1, borderColor: colors.border, gap: 8 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ fontFamily: 'Cairo_600SemiBold', fontSize: 12, color: colors.textSecondary, textAlign: 'left' }}>
                    {netWorthScope === 'all'
                      ? (language === 'ar' ? 'صافي الملاءة الإجمالي الشامل' : 'Consolidated Total Net Solvency')
                      : (language === 'ar' ? 'إجمالي الأصول والصافي الحالي' : 'Current Net Solvency Assets')}
                  </Text>
                  {netWorthScope === 'all' && (
                    <View style={{ backgroundColor: '#10B98120', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 }}>
                      <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 10, color: '#10B981' }}>
                        {language === 'ar' ? `${includedWallets.length} محافظ مشمولة` : `${includedWallets.length} Wallets`}
                      </Text>
                    </View>
                  )}
                </View>

                <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 24, color: activeNetWorth >= 0 ? '#10B981' : '#EF4444', textAlign: 'left' }}>
                  {activeNetWorth >= 0 ? '+' : ''}{formatCurrency(activeNetWorth)} <Text style={{ fontSize: 14 }}>{currencySymbol}</Text>
                </Text>

                <Text style={{ fontFamily: 'Cairo_400Regular', fontSize: 11, color: colors.textSecondary, textAlign: 'left' }}>
                  {netWorthScope === 'all'
                    ? (language === 'ar'
                        ? `مسار الثروة المالي الشامل المجمع لكافة محافظك المشمولة بعد تحويل العملات.${excludedWallets.length > 0 ? ` (تم استبعاد: ${excludedWallets.map(w => w.name).join('، ')})` : ''}`
                        : `Consolidated financial trajectory across all included wallets with automatic currency conversions.${excludedWallets.length > 0 ? ` (Excluded: ${excludedWallets.map(w => w.name).join(', ')})` : ''}`)
                    : (language === 'ar'
                        ? `يعبر هذا الجراف عن التغيّر اليومي الفعلي لملاءتك المالية في محفظة "${selectedWallet?.name || 'الرئيسية'}" بناءً على مدفوعاتك ومقبوضاتك.`
                        : `This graph calculates the real daily trajectory of your solvency in "${selectedWallet?.name || 'Main Wallet'}".`)}
                </Text>
              </View>

              {/* If Consolidated: Show Breakdown of Included vs Excluded Wallets */}
              {netWorthScope === 'all' && includedWallets.length > 0 && (
                <View style={{ backgroundColor: theme === 'dark' ? '#0F172A' : '#FFFFFF', borderRadius: 20, padding: 14, borderWidth: 1, borderColor: colors.border, gap: 8 }}>
                  <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 13, color: colors.text, textAlign: 'left' }}>
                    {language === 'ar' ? '💳 المحافظ المشمولة في الإجمالي' : '💳 Included Wallets in Total'}
                  </Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    {includedWallets.map(w => {
                      const wTxns = transactions.filter(t => t.walletId === w.id || (t.type === 'transfer' && t.toWalletId === w.id));
                      const inc = wTxns.filter(t => t.type === 'income' || (t.type === 'transfer' && t.toWalletId === w.id)).reduce((s, t) => s + t.amount, 0);
                      const exp = wTxns.filter(t => t.type === 'expense' || (t.type === 'transfer' && t.walletId === w.id)).reduce((s, t) => s + t.amount, 0);
                      const bal = (w.initialBalance || 0) + inc - exp;
                      return (
                        <View
                          key={w.id}
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 6,
                            backgroundColor: theme === 'dark' ? '#1E293B' : '#F8FAFC',
                            paddingHorizontal: 10,
                            paddingVertical: 6,
                            borderRadius: 10,
                            borderWidth: 1,
                            borderColor: w.color || colors.border,
                          }}
                        >
                          <MaterialIcons name={w.icon as any || 'account-balance-wallet'} size={14} color={w.color || colors.primary} />
                          <Text style={{ fontFamily: 'Cairo_600SemiBold', fontSize: 11, color: colors.text }}>{w.name}:</Text>
                          <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 11, color: bal >= 0 ? colors.income : colors.expense }}>
                            {formatCurrency(bal)} {w.currency}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                  {excludedWallets.length > 0 && (
                    <Text style={{ fontFamily: 'Cairo_400Regular', fontSize: 10, color: '#F59E0B', textAlign: 'left', marginTop: 4 }}>
                      ⚠️ {language === 'ar' ? `محافظ مستبعدة حسب طلبك: ${excludedWallets.map(w => w.name).join('، ')}` : `Excluded wallets per your settings: ${excludedWallets.map(w => w.name).join(', ')}`}
                    </Text>
                  )}
                </View>
              )}

              {/* Full High-Resolution Dynamic Net Worth Chart */}
              <View style={{ backgroundColor: theme === 'dark' ? '#0B132B' : '#FFFFFF', borderRadius: 20, padding: 16, borderWidth: 1, borderColor: colors.border, gap: 12 }}>
                <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 14, color: colors.text, textAlign: 'left' }}>
                  {netWorthScope === 'all'
                    ? (language === 'ar' ? '📈 مسار صافي الملاءة الكلي لجميع المحافظ هذا الشهر' : '📈 Consolidated Solvency Trajectory')
                    : (language === 'ar' ? '📈 منحنى المسار اليومي للملاءة هذا الشهر' : '📈 Daily Net Worth Trajectory')}
                </Text>

                {(() => {
                  const yAxisW = 60;
                  const totalW = SCREEN_WIDTH - 64;
                  const chartW = totalW - yAxisW;
                  const chartH = 160;
                  const fullSpark = generateSparklinePath(realNetWorthPoints, chartW, chartH);
                  const selectedPt = selectedChartPointIndex !== null ? realNetWorthPoints[selectedChartPointIndex] : null;
                  const selectedCoord = selectedChartPointIndex !== null && fullSpark.coords ? fullSpark.coords[selectedChartPointIndex] : null;

                  const maxValStr = `${formatCurrency(fullSpark.actualMax, language)}`;
                  const midValStr = `${formatCurrency((fullSpark.actualMax + fullSpark.actualMin) / 2, language)}`;
                  const minValStr = `${formatCurrency(fullSpark.actualMin, language)}`;

                  // Calculate 4-5 clean milestone indices for X-axis
                  const totalPts = realNetWorthPoints.length;
                  const step = Math.max(1, Math.floor((totalPts - 1) / 4));
                  const milestoneIndices = [0];
                  for (let idx = step; idx < totalPts - 1; idx += step) {
                    if (!milestoneIndices.includes(idx)) milestoneIndices.push(idx);
                  }
                  if (totalPts > 1 && !milestoneIndices.includes(totalPts - 1)) {
                    milestoneIndices.push(totalPts - 1);
                  }

                  const lastCoord = fullSpark.coords && fullSpark.coords.length > 0 ? fullSpark.coords[fullSpark.coords.length - 1] : null;

                  return (
                    <View style={{ gap: 10 }}>
                      {/* Active Selected Point Floating Tooltip / Banner */}
                      {selectedPt && selectedCoord ? (
                        <View style={{
                          backgroundColor: theme === 'dark' ? '#0F172A' : '#F8FAFC',
                          borderRadius: 14,
                          paddingHorizontal: 14,
                          paddingVertical: 9,
                          borderWidth: 1.5,
                          borderColor: '#10B981',
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          shadowColor: '#10B981',
                          shadowOpacity: 0.15,
                          shadowRadius: 8,
                        }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Ionicons name="calendar-outline" size={16} color="#10B981" />
                            <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 13, color: colors.text }}>
                              {language === 'ar' ? `اليوم ${selectedPt.day}` : `Day ${selectedPt.day}`}
                            </Text>
                          </View>
                          <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 14, color: '#10B981' }}>
                            {selectedPt.netWorth >= 0 ? '+' : ''}{formatCurrency(selectedPt.netWorth, language)} {currencySymbol}
                          </Text>
                        </View>
                      ) : (
                        <Text style={{ fontFamily: 'Cairo_400Regular', fontSize: 11, color: colors.textTertiary, textAlign: 'center' }}>
                          {language === 'ar' ? '💡 اضغط على أي نقطة في الرسم البياني لعرض القيمة اليومية' : '💡 Tap anywhere on the graph to inspect daily value'}
                        </Text>
                      )}

                      <View style={{ height: chartH + 34, alignItems: 'center', justifyContent: 'center' }}>
                        <Svg width={totalW} height={chartH + 34}>
                          <Defs>
                            <SvgGradient id="modalNetGrad" x1="0" y1="0" x2="0" y2="1">
                              <Stop offset="0" stopColor="#10B981" stopOpacity="0.45" />
                              <Stop offset="0.7" stopColor="#10B981" stopOpacity="0.08" />
                              <Stop offset="1" stopColor="#10B981" stopOpacity="0.0" />
                            </SvgGradient>
                          </Defs>

                          {/* Y-Axis Labels on Left side */}
                          <SvgText x={yAxisW - 8} y={16} fontSize={9} fontFamily="Cairo_700Bold" fill={colors.textSecondary} textAnchor="end">
                            {maxValStr}
                          </SvgText>
                          <SvgText x={yAxisW - 8} y={chartH / 2 + 3} fontSize={9} fontFamily="Cairo_600SemiBold" fill={colors.textSecondary} textAnchor="end">
                            {midValStr}
                          </SvgText>
                          <SvgText x={yAxisW - 8} y={chartH - 8} fontSize={9} fontFamily="Cairo_600SemiBold" fill={colors.textSecondary} textAnchor="end">
                            {minValStr}
                          </SvgText>

                          {/* Vertical Axis Separator Line */}
                          <Path d={`M ${yAxisW},10 L ${yAxisW},${chartH}`} stroke={colors.border} strokeWidth={1} />

                          {/* Translated Main Chart Area */}
                          <G transform={`translate(${yAxisW}, 0)`}>
                            {/* Horizontal Dotted Grid lines */}
                            <Path d={`M 0,14 L ${chartW},14`} stroke={colors.borderLight} strokeDasharray="3 3" opacity={0.7} />
                            <Path d={`M 0,${chartH/2}`} stroke={colors.borderLight} strokeDasharray="3 3" opacity={0.7} />
                            <Path d={`M 0,${chartH - 12}`} stroke={colors.borderLight} strokeDasharray="3 3" opacity={0.7} />

                            {/* Area Fill & Smooth Curve */}
                            <Path d={fullSpark.areaD} fill="url(#modalNetGrad)" />
                            <Path d={fullSpark.pathD} fill="none" stroke="#10B981" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />

                            {/* Latest Value Pulse Beacon at the end */}
                            {lastCoord && selectedChartPointIndex === null && (
                              <>
                                <Circle cx={lastCoord.x} cy={lastCoord.y} r={8} fill="#10B981" opacity={0.25} />
                                <Circle cx={lastCoord.x} cy={lastCoord.y} r={4.5} fill="#10B981" stroke="#FFFFFF" strokeWidth={2} />
                              </>
                            )}

                            {/* Active Selection Vertical Guideline and Highlight Beacon */}
                            {selectedCoord && (
                              <>
                                <Path d={`M ${selectedCoord.x},10 L ${selectedCoord.x},${chartH}`} stroke="#10B981" strokeWidth={1.5} strokeDasharray="3 3" />
                                <Circle cx={selectedCoord.x} cy={selectedCoord.y} r={10} fill="#10B981" opacity={0.2} />
                                <Circle cx={selectedCoord.x} cy={selectedCoord.y} r={5.5} fill="#10B981" stroke="#FFFFFF" strokeWidth={2.5} />
                              </>
                            )}

                            {/* X-Axis Milestone Day Labels */}
                            {fullSpark.coords && milestoneIndices.map((idx) => {
                              const c = fullSpark.coords[idx];
                              if (!c) return null;
                              const isFirst = idx === 0;
                              const isLast = idx === totalPts - 1;
                              const anchor = isFirst ? 'start' : isLast ? 'end' : 'middle';
                              return (
                                <SvgText
                                  key={`axis-${idx}`}
                                  x={c.x}
                                  y={chartH + 22}
                                  fontSize={9.5}
                                  fontFamily="Cairo_600SemiBold"
                                  fill={colors.textSecondary}
                                  textAnchor={anchor}
                                >
                                  {realNetWorthPoints[idx]?.day}
                                </SvgText>
                              );
                            })}

                            {/* Interactive Touch Areas */}
                            {fullSpark.coords && fullSpark.coords.map((c, i) => {
                              const touchWidth = Math.max(16, chartW / totalPts);
                              return (
                                <Rect
                                  key={`touch-${i}`}
                                  x={Math.max(0, c.x - touchWidth / 2)}
                                  y={0}
                                  width={touchWidth}
                                  height={chartH + 34}
                                  fill="transparent"
                                  onPress={() => {
                                    Haptics.selectionAsync().catch(() => {});
                                    setSelectedChartPointIndex(i);
                                  }}
                                />
                              );
                            })}
                          </G>
                        </Svg>
                      </View>
                    </View>
                  );
                })()}
              </View>

              {/* Financial Solvency Components Breakdown */}
              <View style={{ backgroundColor: theme === 'dark' ? '#0F172A' : '#FFFFFF', borderRadius: 20, padding: 16, borderWidth: 1, borderColor: colors.border, gap: 12 }}>
                <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 14, color: colors.text, textAlign: 'left' }}>
                  {netWorthScope === 'all'
                    ? (language === 'ar' ? '📑 تفاصيل الملاءة المجمعة الشاملة' : '📑 Consolidated Components')
                    : (language === 'ar' ? '📑 مكونات وتفاصيل الملاءة' : '📑 Solvency Components')}
                </Text>

                <View style={{ gap: 10 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.borderLight }}>
                    <Text style={{ fontFamily: 'Cairo_600SemiBold', fontSize: 12, color: colors.textSecondary }}>
                      {netWorthScope === 'all'
                        ? (language === 'ar' ? 'إجمالي الأرصدة الافتتاحية للمحافظ' : 'Total Initial Balances')
                        : (language === 'ar' ? 'رصيد المحفظة الافتتاحي' : 'Initial Wallet Balance')}
                    </Text>
                    <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 13, color: colors.text }}>
                      {formatCurrency(activeInitialBalance)} {currencySymbol}
                    </Text>
                  </View>

                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.borderLight }}>
                    <Text style={{ fontFamily: 'Cairo_600SemiBold', fontSize: 12, color: colors.income }}>
                      {language === 'ar' ? 'إجمالي المقبوضات والدخل' : 'Total All-Time Income'}
                    </Text>
                    <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 13, color: colors.income }}>
                      +{formatCurrency(activeAllTimeIncome)} {currencySymbol}
                    </Text>
                  </View>

                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.borderLight }}>
                    <Text style={{ fontFamily: 'Cairo_600SemiBold', fontSize: 12, color: colors.expense }}>
                      {language === 'ar' ? 'إجمالي المدفوعات والمصاريف' : 'Total All-Time Expense'}
                    </Text>
                    <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 13, color: colors.expense }}>
                      -{formatCurrency(activeAllTimeExpense)} {currencySymbol}
                    </Text>
                  </View>

                  {/* Calculated Cash Bank Balance Row */}
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.borderLight, backgroundColor: theme === 'dark' ? '#1E293B50' : '#F1F5F9', paddingHorizontal: 8, borderRadius: 8 }}>
                    <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 12, color: colors.text }}>
                      {netWorthScope === 'all'
                        ? (language === 'ar' ? '💳 الرصيد المتاح بالمحافظ المشمولة' : '💳 Available Wallets Cash Balance')
                        : (language === 'ar' ? '💳 الرصيد المتاح بالمحفظة (البنك)' : '💳 Available Wallet Cash Balance')}
                    </Text>
                    <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 13, color: (activeInitialBalance + activeAllTimeIncome - activeAllTimeExpense) >= 0 ? colors.income : colors.expense }}>
                      {formatCurrency(activeInitialBalance + activeAllTimeIncome - activeAllTimeExpense)} {currencySymbol}
                    </Text>
                  </View>

                  {totalSavedInGoals > 0 && (
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.borderLight }}>
                      <Text style={{ fontFamily: 'Cairo_600SemiBold', fontSize: 12, color: colors.income }}>
                        {language === 'ar' ? 'الحصالات والأهداف الادخارية' : 'Saved in Goals & Jars'}
                      </Text>
                      <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 13, color: colors.income }}>
                        +{formatCurrency(totalSavedInGoals)} {currencySymbol}
                      </Text>
                    </View>
                  )}

                  {totalJameyaSavings > 0 && (
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.borderLight }}>
                      <Text style={{ fontFamily: 'Cairo_600SemiBold', fontSize: 12, color: '#10B981' }}>
                        🤝 {language === 'ar' ? 'أصول ادخار الجمعيات' : 'Jameya Savings Asset'}
                      </Text>
                      <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 13, color: '#10B981' }}>
                        +{formatCurrency(totalJameyaSavings)} {currencySymbol}
                      </Text>
                    </View>
                  )}

                  {totalLoansOwedToMe > 0 && (
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.borderLight }}>
                      <Text style={{ fontFamily: 'Cairo_600SemiBold', fontSize: 12, color: colors.income }}>
                        {language === 'ar' ? 'قروض مستردة (لي)' : 'Loans Owed to Me'}
                      </Text>
                      <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 13, color: colors.income }}>
                        +{formatCurrency(totalLoansOwedToMe)} {currencySymbol}
                      </Text>
                    </View>
                  )}

                  {totalDebtsOwedByMe > 0 && (
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.borderLight }}>
                      <Text style={{ fontFamily: 'Cairo_600SemiBold', fontSize: 12, color: colors.expense }}>
                        {language === 'ar' ? 'ديون مستحقة (عليّ)' : 'Debts Owed by Me'}
                      </Text>
                      <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 13, color: colors.expense }}>
                        -{formatCurrency(totalDebtsOwedByMe)} {currencySymbol}
                      </Text>
                    </View>
                  )}

                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, backgroundColor: '#10B98115', paddingHorizontal: 12, borderRadius: 12 }}>
                    <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 13, color: '#10B981' }}>
                      {language === 'ar' ? 'إجمالي صافي الملاءة الشاملة' : 'Total Net Solvency Assets'}
                    </Text>
                    <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 15, color: '#10B981' }}>
                      {formatCurrency(activeNetWorth)} {currencySymbol}
                    </Text>
                  </View>
                </View>
              </View>
            </ScrollView>
          </SafeAreaView>
        </View>
      </Modal>

      {/* Monthly Financial Digest Modal */}
      <MonthlyDigestModal
        visible={isMonthlyDigestOpen}
        transactions={walletTransactions}
        selectedWallet={selectedWallet}
        currencySymbol={currencySymbol}
        language={language as 'ar' | 'en'}
        onClose={() => setIsMonthlyDigestOpen(false)}
      />

      {/* Interactive Detailed Breakdown Modal (Drill-down for Income, Expense & ROSCA) */}
      <Modal visible={detailedBreakdownVisible} animationType="slide" transparent onRequestClose={() => setDetailedBreakdownVisible(false)}>
        <View style={styles.modalOverlay}>
          <SafeAreaView style={[styles.modalSheet, { flex: 1, maxHeight: '90%' }]}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <Pressable onPress={() => setDetailedBreakdownVisible(false)} hitSlop={12} style={styles.closeBtn}>
                <Ionicons name="close" size={22} color={colors.text} />
              </Pressable>
              <Text style={styles.modalTitle}>
                {breakdownType === 'income'
                  ? (language === 'ar' ? `تفاصيل الدخل (${t.months[viewMonth]})` : `Income Breakdown (${t.months[viewMonth]})`)
                  : breakdownType === 'expense'
                  ? (language === 'ar' ? `تفاصيل المصاريف (${t.months[viewMonth]})` : `Expenses Breakdown (${t.months[viewMonth]})`)
                  : (language === 'ar' ? `تفاصيل ادخار الجمعيات (${t.months[viewMonth]})` : `ROSCA Savings Breakdown (${t.months[viewMonth]})`)}
              </Text>
              <View style={{ width: 32 }} />
            </View>

            {/* Sub-Switch inside Modal if user wants to toggle between Income and Expense */}
            <View style={{ flexDirection: 'row', backgroundColor: theme === 'dark' ? '#0F172A' : '#E2E8F0', borderRadius: 14, padding: 4, marginHorizontal: 16, marginTop: 10, gap: 4 }}>
              <Pressable
                onPress={() => {
                  Haptics.selectionAsync();
                  setBreakdownType('expense');
                }}
                style={{
                  flex: 1,
                  paddingVertical: 8,
                  borderRadius: 10,
                  alignItems: 'center',
                  backgroundColor: breakdownType === 'expense' ? (theme === 'dark' ? '#1E293B' : '#FFFFFF') : 'transparent',
                }}
              >
                <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 12, color: breakdownType === 'expense' ? colors.expense : colors.textSecondary }}>
                  🔴 {t.expenses}
                </Text>
              </Pressable>

              <Pressable
                onPress={() => {
                  Haptics.selectionAsync();
                  setBreakdownType('income');
                }}
                style={{
                  flex: 1,
                  paddingVertical: 8,
                  borderRadius: 10,
                  alignItems: 'center',
                  backgroundColor: breakdownType === 'income' ? (theme === 'dark' ? '#1E293B' : '#FFFFFF') : 'transparent',
                }}
              >
                <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 12, color: breakdownType === 'income' ? colors.income : colors.textSecondary }}>
                  🟢 {t.income}
                </Text>
              </Pressable>

              {monthlyJameyaSavings > 0 && (
                <Pressable
                  onPress={() => {
                    Haptics.selectionAsync();
                    setBreakdownType('rosca');
                  }}
                  style={{
                    flex: 1,
                    paddingVertical: 8,
                    borderRadius: 10,
                    alignItems: 'center',
                    backgroundColor: breakdownType === 'rosca' ? (theme === 'dark' ? '#1E293B' : '#FFFFFF') : 'transparent',
                  }}
                >
                  <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 12, color: breakdownType === 'rosca' ? '#0D7C66' : colors.textSecondary }}>
                    🎁 {language === 'ar' ? 'الجمعيات' : 'ROSCA'}
                  </Text>
                </Pressable>
              )}
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, gap: 14 }}>
              {/* Grand Total Highlight Banner */}
              {(() => {
                const isExp = breakdownType === 'expense';
                const isInc = breakdownType === 'income';
                const totalVal = isExp ? monthlyExpense : isInc ? monthlyIncome : monthlyJameyaSavings;
                const totalColor = isExp ? colors.expense : isInc ? colors.income : '#0D7C66';

                // Sub totals calculation
                const pureExp = monthlyTransactions.filter(t => t.type === 'expense' && t.category !== 'jameya_savings' && t.category !== 'debt_loan').reduce((s, t) => s + t.amount, 0);
                const transfersOut = monthlyTransactions.filter(t => t.type === 'transfer' && selectedWallet && t.walletId === selectedWallet.id).reduce((s, t) => s + t.amount, 0);

                const pureInc = monthlyTransactions.filter(t => t.type === 'income' && t.category !== 'debt_loan').reduce((s, t) => s + t.amount, 0);
                const transfersIn = monthlyTransactions.filter(t => t.type === 'transfer' && selectedWallet && t.toWalletId === selectedWallet.id).reduce((s, t) => s + t.amount, 0);

                // Filter transactions based on breakdownType and search
                const currentFilteredTxns = monthlyTransactions.filter(t => {
                  if (isExp) {
                    return (t.type === 'expense' && t.category !== 'jameya_savings' && t.category !== 'debt_loan') || (t.type === 'transfer' && selectedWallet && t.walletId === selectedWallet.id);
                  } else if (isInc) {
                    return (t.type === 'income' && t.category !== 'debt_loan') || (t.type === 'transfer' && selectedWallet && t.toWalletId === selectedWallet.id);
                  } else {
                    return t.category === 'jameya_savings';
                  }
                }).filter(t => {
                  if (!breakdownSearchQuery) return true;
                  const q = breakdownSearchQuery.toLowerCase();
                  const catName = getCategoryName(t.category, language).toLowerCase();
                  const note = (t.note || '').toLowerCase();
                  return catName.includes(q) || note.includes(q);
                });

                return (
                  <View style={{ gap: 14 }}>
                    {/* Total Hero Card */}
                    <View style={{ backgroundColor: theme === 'dark' ? '#0F172A' : '#F8FAFC', borderRadius: 18, padding: 16, borderWidth: 1, borderColor: colors.border, gap: 6, alignItems: 'center' }}>
                      <Text style={{ fontFamily: 'Cairo_600SemiBold', fontSize: 12, color: colors.textSecondary }}>
                        {isExp
                          ? (language === 'ar' ? 'إجمالي المنصرف والتحويلات' : 'Total Monthly Outflow')
                          : isInc
                          ? (language === 'ar' ? 'إجمالي المقبوضات والدخل' : 'Total Monthly Inflow')
                          : (language === 'ar' ? 'إجمالي ادخار الجمعيات' : 'Total ROSCA Savings')}
                      </Text>
                      <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 26, color: totalColor }}>
                        {isExp ? '-' : '+'}{formatCurrency(totalVal)} {currencySymbol}
                      </Text>
                      <Text style={{ fontFamily: 'Cairo_400Regular', fontSize: 11, color: colors.textSecondary }}>
                        {language === 'ar' ? `${currentFilteredTxns.length} معاملة مسجلة في محفظة "${selectedWallet?.name || ''}"` : `${currentFilteredTxns.length} transactions recorded`}
                      </Text>
                    </View>

                    {/* Sub-Components Breakdown Pills */}
                    {isExp && (
                      <View style={{ flexDirection: 'row', gap: 8 }}>
                        <View style={{ flex: 1, backgroundColor: theme === 'dark' ? '#1E293B' : '#FFFFFF', padding: 12, borderRadius: 14, borderWidth: 1, borderColor: colors.border, gap: 4 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Ionicons name="cart-outline" size={15} color={colors.expense} />
                            <Text style={{ fontFamily: 'Cairo_600SemiBold', fontSize: 11, color: colors.textSecondary }}>
                              {language === 'ar' ? 'مصاريف استهلاكية' : 'Pure Spending'}
                            </Text>
                          </View>
                          <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 14, color: colors.expense }}>
                            -{formatCurrency(pureExp)} {currencySymbol}
                          </Text>
                        </View>

                        {transfersOut > 0 && (
                          <View style={{ flex: 1, backgroundColor: theme === 'dark' ? '#1E293B' : '#FFFFFF', padding: 12, borderRadius: 14, borderWidth: 1, borderColor: colors.border, gap: 4 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                              <Ionicons name="swap-horizontal" size={15} color="#8B5CF6" />
                              <Text style={{ fontFamily: 'Cairo_600SemiBold', fontSize: 11, color: colors.textSecondary }}>
                                {language === 'ar' ? 'تحويل لمحافظ أخرى' : 'Transfers Out'}
                              </Text>
                            </View>
                            <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 14, color: '#8B5CF6' }}>
                              -{formatCurrency(transfersOut)} {currencySymbol}
                            </Text>
                          </View>
                        )}
                      </View>
                    )}

                    {isInc && (
                      <View style={{ flexDirection: 'row', gap: 8 }}>
                        <View style={{ flex: 1, backgroundColor: theme === 'dark' ? '#1E293B' : '#FFFFFF', padding: 12, borderRadius: 14, borderWidth: 1, borderColor: colors.border, gap: 4 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Ionicons name="cash-outline" size={15} color={colors.income} />
                            <Text style={{ fontFamily: 'Cairo_600SemiBold', fontSize: 11, color: colors.textSecondary }}>
                              {language === 'ar' ? 'دخل وإيرادات مباشرة' : 'Direct Income'}
                            </Text>
                          </View>
                          <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 14, color: colors.income }}>
                            +{formatCurrency(pureInc)} {currencySymbol}
                          </Text>
                        </View>

                        {transfersIn > 0 && (
                          <View style={{ flex: 1, backgroundColor: theme === 'dark' ? '#1E293B' : '#FFFFFF', padding: 12, borderRadius: 14, borderWidth: 1, borderColor: colors.border, gap: 4 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                              <Ionicons name="swap-horizontal" size={15} color="#10B981" />
                              <Text style={{ fontFamily: 'Cairo_600SemiBold', fontSize: 11, color: colors.textSecondary }}>
                                {language === 'ar' ? 'تحويلات واردة' : 'Transfers In'}
                              </Text>
                            </View>
                            <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 14, color: '#10B981' }}>
                              +{formatCurrency(transfersIn)} {currencySymbol}
                            </Text>
                          </View>
                        )}
                      </View>
                    )}

                    {/* Search / Filter Input */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surfaceAlt, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, gap: 8, borderWidth: 1, borderColor: colors.border }}>
                      <Ionicons name="search" size={16} color={colors.textTertiary} />
                      <TextInput
                        placeholder={language === 'ar' ? 'بحث في المعاملات...' : 'Search transactions...'}
                        placeholderTextColor={colors.textTertiary}
                        value={breakdownSearchQuery}
                        onChangeText={setBreakdownSearchQuery}
                        style={{ flex: 1, fontFamily: 'Cairo_400Regular', fontSize: 12, color: colors.text, padding: 0 }}
                      />
                      {breakdownSearchQuery ? (
                        <Pressable onPress={() => setBreakdownSearchQuery('')} hitSlop={8}>
                          <Ionicons name="close-circle" size={16} color={colors.textTertiary} />
                        </Pressable>
                      ) : null}
                    </View>

                    {/* Transaction List */}
                    <View style={{ gap: 8 }}>
                      <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 13, color: colors.text, textAlign: 'left' }}>
                        {language === 'ar' ? 'قائمة المعاملات بالتفصيل' : 'Transaction Details'}
                      </Text>

                      {currentFilteredTxns.length === 0 ? (
                        <View style={{ padding: 24, alignItems: 'center' }}>
                          <Text style={{ fontFamily: 'Cairo_400Regular', fontSize: 12, color: colors.textSecondary }}>
                            {language === 'ar' ? 'لا توجد معاملات مسجلة تطابق البحث' : 'No transactions found'}
                          </Text>
                        </View>
                      ) : (
                        currentFilteredTxns.map(tx => {
                          const isTransfer = tx.type === 'transfer';
                          const toW = isTransfer && tx.toWalletId ? wallets.find(w => w.id === tx.toWalletId) : null;
                          const fromW = isTransfer && tx.walletId ? wallets.find(w => w.id === tx.walletId) : null;

                          let title = getCategoryName(tx.category, language);
                          if (isTransfer) {
                            if (tx.walletId === selectedWallet?.id) {
                              title = language === 'ar' ? `تحويل إلى "${toW?.name || 'محفظة أخرى'}"` : `Transfer to "${toW?.name || 'Wallet'}"`;
                            } else {
                              title = language === 'ar' ? `تحويل من "${fromW?.name || 'محفظة أخرى'}"` : `Transfer from "${fromW?.name || 'Wallet'}"`;
                            }
                          }

                          const d = new Date(tx.date);
                          const dateStr = `${d.getDate()} ${t.months[d.getMonth()]}`;
                          const catObj = getCategoryById(tx.category);

                          return (
                            <View
                              key={tx.id}
                              style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                backgroundColor: theme === 'dark' ? '#0F172A' : '#FFFFFF',
                                padding: 12,
                                borderRadius: 14,
                                borderWidth: 1,
                                borderColor: colors.borderLight,
                              }}
                            >
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, paddingRight: 10 }}>
                                <View style={{
                                  width: 36,
                                  height: 36,
                                  borderRadius: 10,
                                  backgroundColor: isTransfer ? '#8B5CF620' : (catObj?.color ? catObj.color + '20' : (isExp ? '#EF444415' : '#10B98115')),
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                }}>
                                  <MaterialIcons
                                    name={isTransfer ? 'swap-horiz' : (catObj?.icon as any || 'receipt')}
                                    size={20}
                                    color={isTransfer ? '#8B5CF6' : (catObj?.color || (isExp ? colors.expense : colors.income))}
                                  />
                                </View>
                                <View style={{ flex: 1, alignItems: 'flex-start' }}>
                                  <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 12, color: colors.text }} numberOfLines={1}>
                                    {title}
                                  </Text>
                                  <Text style={{ fontFamily: 'Cairo_400Regular', fontSize: 10, color: colors.textSecondary }} numberOfLines={1}>
                                    {dateStr} {tx.note ? `• ${tx.note}` : ''}
                                  </Text>
                                </View>
                              </View>

                              <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 13, color: isTransfer ? '#8B5CF6' : isExp ? colors.expense : colors.income }}>
                                {isExp ? '-' : '+'}{formatCurrency(tx.amount)} {currencySymbol}
                              </Text>
                            </View>
                          );
                        })
                      )}
                    </View>
                  </View>
                );
              })()}
            </ScrollView>
          </SafeAreaView>
        </View>
      </Modal>
    </LinearGradient>
  );
}

const getStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent', // Transparent to let the LinearGradient show through!
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  headerTitle: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 24,
    color: colors.text,
  },
  walletBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    gap: 4,
  },
  walletBadgeText: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 12,
  },
  controlCard: {
    marginHorizontal: 20,
    marginTop: 8,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 12,
    gap: 12,
    overflow: 'hidden',
  },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  monthNavBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary + '12',
  },
  monthNavBtnDisabled: {
    backgroundColor: 'transparent',
    opacity: 0.3,
  },
  monthNavLabel: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 15,
    color: colors.text,
  },
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceAlt,
    borderRadius: 10,
    padding: 3,
    borderWidth: 0.5,
    borderColor: colors.border,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentBtnActiveExpense: {
    backgroundColor: colors.expense,
  },
  segmentBtnActiveIncome: {
    backgroundColor: colors.income,
  },
  segmentText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 12,
    color: colors.textSecondary,
  },
  segmentTextActive: {
    color: '#FFF',
  },
  overviewCards: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginTop: 12,
    gap: 12,
  },
  overviewCard: {
    flex: 1,
    borderRadius: 16,
    padding: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    elevation: 4,
    overflow: 'hidden',
  },
  overviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  overviewIconWrap: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  overviewLabel: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 12,
    color: colors.textSecondary,
  },
  overviewValue: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 18,
  },
  overviewCurrency: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 11,
    color: colors.textSecondary,
  },
  donutSection: {
    gap: 16,
    marginTop: 16,
  },
  donutCard: {
    marginHorizontal: 20,
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  chartContainer: {
    width: CHART_SIZE,
    height: CHART_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chartCenter: {
    position: 'absolute',
    alignItems: 'center',
  },
  chartTotal: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 22,
    color: colors.text,
  },
  chartLabel: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: -2,
  },
  categoriesSection: {
    marginHorizontal: 20,
  },
  sectionTitle: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 15,
    color: colors.text,
    textAlign: 'left',
  },
  categoriesList: {
    gap: 10,
    marginTop: 10,
  },
  premiumCategoryCard: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  categoryRowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  catIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryName: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 13,
    color: colors.text,
    textAlign: 'left',
  },
  categoryPercent: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 10,
    color: colors.textSecondary,
    textAlign: 'left',
    marginTop: -2,
  },
  categoryAmount: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 13,
    color: colors.text,
  },
  categoryBarBg: {
    height: 6,
    backgroundColor: colors.surfaceAlt + '60',
    borderRadius: 3,
    overflow: 'hidden',
    marginTop: 8,
  },
  categoryBarFill: {
    height: 6,
    borderRadius: 3,
  },
  budgetStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  },
  budgetProgressBgSmall: {
    height: 4,
    backgroundColor: colors.surfaceAlt + '60',
    borderRadius: 2,
    overflow: 'hidden',
  },
  budgetProgressFillSmall: {
    height: 4,
    borderRadius: 2,
  },
  budgetStatusText: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 9,
    color: colors.textTertiary,
  },
  barChartSection: {
    marginHorizontal: 20,
    marginTop: 20,
  },
  barChartLegend: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 8,
    marginTop: 4,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  legendText: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 10,
    color: colors.textSecondary,
  },
  barChartCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    padding: 16,
    alignItems: 'center',
    overflow: 'hidden',
  },
  budgetsSection: {
    marginHorizontal: 20,
    marginTop: 20,
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  budgetsHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  manageBudgetsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary + '12',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    gap: 4,
  },
  manageBudgetsBtnText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 11,
    color: colors.primary,
  },
  emptyBudgetCard: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    paddingHorizontal: 16,
    backgroundColor: colors.surfaceAlt + '40',
    borderRadius: 12,
    borderStyle: 'dashed',
    borderWidth: 1.5,
    borderColor: colors.primary + '40',
    gap: 8,
  },
  emptyBudgetTitle: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 14,
    color: colors.text,
    marginTop: 4,
  },
  emptyBudgetSubtitle: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 11,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 16,
  },
  budgetsGrid: {
    gap: 12,
  },
  premiumBudgetCard: {
    backgroundColor: colors.surfaceAlt + '40',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  budgetCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  budgetIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  budgetName: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 14,
    color: colors.text,
  },
  budgetAmountText: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 12,
    color: colors.textSecondary,
  },
  budgetPercentText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 12,
  },
  budgetProgressBg: {
    height: 8,
    backgroundColor: colors.surface + '60',
    borderRadius: 4,
    overflow: 'hidden',
  },
  budgetProgressFill: {
    height: 8,
    borderRadius: 4,
  },
  budgetRemainingText: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 11,
    color: colors.textTertiary,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 50,
    gap: 8,
  },
  emptyTitle: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 15,
    color: colors.textSecondary,
  },
  emptySubtitle: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 13,
    color: colors.textTertiary,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
    paddingBottom: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalTitle: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 18,
    color: colors.text,
  },
  budgetsList: {
    padding: 16,
  },
  budgetListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 12,
  },
  pressedItem: {
    backgroundColor: colors.surfaceAlt,
  },
  budgetCatName: {
    flex: 1,
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 14,
    color: colors.text,
    textAlign: 'left',
  },
  budgetLimitValueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  budgetLimitValue: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 13,
    color: colors.textSecondary,
  },
  modalOverlayCenter: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  editBudgetCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 24,
    width: SCREEN_WIDTH * 0.85,
    maxWidth: 320,
    alignItems: 'center',
    gap: 12,
  },
  editBudgetTitle: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 18,
    color: colors.text,
  },
  editBudgetSubtitle: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 13,
    color: colors.textSecondary,
  },
  budgetInput: {
    width: '100%',
    backgroundColor: colors.surfaceAlt,
    borderRadius: 12,
    paddingVertical: 14,
    fontSize: 24,
    fontFamily: 'Cairo_700Bold',
    color: colors.text,
    textAlign: 'center',
  },
  modalActionRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  modalActionBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  modalActionCancel: {
    backgroundColor: colors.surfaceAlt,
  },
  modalActionCancelText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 14,
    color: colors.textSecondary,
  },
  modalActionSave: {
    // bgColor dynamically loaded
  },
  modalActionSaveText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 14,
    color: colors.text,
  },
  catIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  walletSelectorScroll: {
    paddingHorizontal: 20,
    gap: 8,
    marginVertical: 10,
    flexDirection: 'row',
  },
  walletChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.surfaceAlt + '80',
    borderWidth: 1.5,
    borderColor: 'transparent',
    gap: 6,
  },
  walletChipText: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 12,
  },
});
