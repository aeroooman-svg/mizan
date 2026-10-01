import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import { Transaction, Wallet } from './storage';
import { Language, getCurrencyName } from './i18n';
import { formatCurrency } from './categories';
import { computeFinancialReportData } from './financialReportAnalytics';

export async function exportTransactionsToPDF(
  transactions: Transaction[],
  wallet: Wallet,
  language: Language,
  wallets: Wallet[] = []
): Promise<void> {
  const isAr = language === 'ar';
  const isMl = language === 'ml' || language === 'hi';
  const dir = isAr ? 'rtl' : 'ltr';

  const data = computeFinancialReportData(transactions, wallet, language, wallets);
  const currencySymbol = data.currency;

  const reportId = `MZN-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}${String(new Date().getDate()).padStart(2, '0')}-${Math.floor(1000 + Math.random() * 9000)}`;
  const exportDateStr = new Date().toLocaleDateString(isAr ? 'ar-EG' : 'en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  // Localization strings
  const L = {
    title: isAr ? 'التقرير المالي الذكي الشامل' : isMl ? 'സമഗ്ര സാമ്പത്തിക റിപ്പോർട്ട്' : 'Comprehensive Financial Intelligence Report',
    subTitle: isAr ? 'تحليل شامل للوضع المالي الشهري والتراكمي • تطبيق ميزان' : isMl ? 'പ്രതിമാസ, മൊത്തത്തിലുള്ള സാമ്പത്തിക വിശകലനം' : 'Holistic Monthly & Overall Financial Performance • Mizan App',
    walletLabel: isAr ? 'المحفظة / الحساب' : isMl ? 'വാലറ്റ് / അക്കൗണ്ട്' : 'Wallet / Account',
    reportIdLabel: isAr ? 'رقم التقرير المرجعي' : isMl ? 'റഫറൻസ് നമ്പർ' : 'Report Ref ID',
    issueDateLabel: isAr ? 'تاريخ الإصدار' : isMl ? 'ഇഷ്യൂ തീയതി' : 'Date of Issue',
    periodLabel: isAr ? 'الفترة المغطاة' : isMl ? 'കാലയളവ്' : 'Reporting Period',
    currencyLabel: isAr ? 'العملة الأساسية' : isMl ? 'കറൻസി' : 'Base Currency',
    
    // KPI Cards
    totalInflow: isAr ? 'إجمالي الدخل والتدفقات' : isMl ? 'ആകെ വരുമാനം' : 'Total Inflow',
    totalOutflow: isAr ? 'إجمالي المصروفات والنفقات' : isMl ? 'ആകെ ചെലവുകൾ' : 'Total Outflow',
    netSurplus: isAr ? 'صافي الفائض والوفر' : isMl ? 'മൊത്തം മിച്ചം' : 'Net Surplus',
    savingsRate: isAr ? 'معدل الادخار ومؤشر العافية' : isMl ? 'സമ്പാദ്യ നിരക്കും ആരോഗ്യവും' : 'Savings Rate & Health',
    txCountLabel: isAr ? 'معاملة' : isMl ? 'ഇടപാടുകൾ' : 'transactions',
    ofIncome: isAr ? 'من الدخل' : isMl ? 'വരുമാനത്തിൽ നിന്ന്' : 'of inflow',

    // AI Diagnostics
    aiDiagnosticsTitle: isAr ? '🧠 التشخيص والتحليل المالي الذكي' : isMl ? '🧠 സ്മാർട്ട് സാമ്പത്തിക വിശകലനം' : '🧠 Smart Financial Diagnostics & Insights',
    aiDiagnosticsDesc: isAr ? 'رؤى وتحليلات استراتيجية مستخلصة تلقائياً من واقع بياناتك وأنماط إنفاقك' : isMl ? 'നിങ്ങളുടെ ഇടപാടുകളിൽ നിന്നുള്ള സ്മാർട്ട് നിർദ്ദേശങ്ങൾ' : 'Automated strategic observations and tailored advice derived from your transaction patterns',

    // Monthly Table
    monthlyBreakdownTitle: isAr ? '📊 التحليل المالي التفصيلي للشهور' : isMl ? '📊 പ്രതിമാസ സാമ്പത്തിക വിവരങ്ങൾ' : '📊 Month-by-Month Financial Performance',
    monthCol: isAr ? 'الشهر' : isMl ? 'മാസം' : 'Month',
    inflowCol: isAr ? 'الدخل الوارد' : isMl ? 'വരുമാനം' : 'Inflow (+)',
    outflowCol: isAr ? 'المصروفات' : isMl ? 'ചെലവ്' : 'Outflow (-)',
    netCol: isAr ? 'صافي الفائض' : isMl ? 'മിച്ചം' : 'Net Balance',
    rateCol: isAr ? 'معدل الادخار' : isMl ? 'സമ്പാദ്യ നിരക്ക്' : 'Savings Rate',
    topCatCol: isAr ? 'أعلى فئة إنفاقاً' : isMl ? 'പ്രധാന ചെലവ്' : 'Top Category',
    momCol: isAr ? 'المقارنة الشهرية' : isMl ? 'മാറ്റങ്ങൾ' : 'MoM Trend',
    totalRow: isAr ? 'الإجمالي التراكمي' : isMl ? 'ആകെ' : 'Overall Total',

    // Categories
    catBreakdownTitle: isAr ? '🏷️ توزيع النفقات حسب الفئات' : isMl ? '🏷️ ചെലവ് വിഭാഗങ്ങൾ' : '🏷️ Category Spending Distribution',
    rankCol: '#',
    categoryCol: isAr ? 'الفئة' : isMl ? 'വിഭാഗം' : 'Category',
    amountCol: isAr ? 'المبلغ الإجمالي' : isMl ? 'ആകെ തുക' : 'Total Spent',
    percentCol: isAr ? 'النسبة المئوية' : isMl ? 'ശതമാനം' : 'Share %',

    // Ledger
    ledgerTitle: isAr ? '📑 سجل المعاملات المالي المفصل' : isMl ? '📑 ഇടപാടുകളുടെ പൂർണ്ണ വിവരണം' : '📑 Comprehensive Transaction Register',
    dateCol: isAr ? 'التاريخ والوقت' : isMl ? 'തീയതി' : 'Date & Time',
    descCol: isAr ? 'الوصف والبيان' : isMl ? 'വിവരണം' : 'Description / Payee',
    methodCol: isAr ? 'طريقة الدفع' : isMl ? 'പേയ്മെന്റ് രീതി' : 'Payment Method',
    typeCol: isAr ? 'النوع' : isMl ? 'തരം' : 'Type',
    incomeText: isAr ? 'دخل' : isMl ? 'വരുമാനം' : 'Income',
    expenseText: isAr ? 'مصروف' : isMl ? 'ചെലവ്' : 'Expense',
    transferText: isAr ? 'تحويل' : isMl ? 'കൈമാറ്റം' : 'Transfer',
    cashText: isAr ? 'نقدي' : isMl ? 'പണം' : 'Cash',
    cardText: isAr ? 'بطاقة/بنك' : isMl ? 'കാർഡ്/ബാങ്ക്' : 'Card/Bank',

    // Footer
    footerNote: isAr
      ? 'تم إصدار هذا التقرير المالي آلياً بواسطة تطبيق ميزان (MIZAN) لإدارة المصاريف الذكية • تقرير معتمد للاستخدام الشخصي والمحاسبي'
      : isMl
      ? 'മിസാൻ ആപ്പ് വഴി സ്വയമേവ തയ്യാറാക്കിയ സാമ്പത്തിക റിപ്പോർട്ട്'
      : 'This financial intelligence report was automatically generated by MIZAN Smart Finance System • Confidential',
  };

  // Build Monthly Rows
  const monthlyRowsHtml = data.months.length > 0
    ? data.months.map((m, idx) => {
        const netPositive = m.net >= 0;
        const netClass = netPositive ? 'text-positive' : 'text-negative';
        const netPrefix = netPositive ? '+' : '';
        const topCatText = m.topCategory ? `${m.topCategory.name} (${formatCurrency(m.topCategory.amount, language)} ${currencySymbol})` : '-';
        
        let momBadge = `<span class="badge neutral">-</span>`;
        if (m.momExpenseChange !== null) {
          if (m.momExpenseChange > 0) {
            momBadge = `<span class="badge negative">↑ ${m.momExpenseChange}%</span>`;
          } else if (m.momExpenseChange < 0) {
            momBadge = `<span class="badge positive">↓ ${Math.abs(m.momExpenseChange)}%</span>`;
          } else {
            momBadge = `<span class="badge neutral">0%</span>`;
          }
        }

        return `
          <tr>
            <td style="font-weight: 600;">${m.monthName}</td>
            <td class="text-positive">+${formatCurrency(m.income, language)} ${currencySymbol}</td>
            <td class="text-negative">-${formatCurrency(m.expense, language)} ${currencySymbol}</td>
            <td class="${netClass}" style="font-weight: 700;">${netPrefix}${formatCurrency(m.net, language)} ${currencySymbol}</td>
            <td>
              <span class="badge ${netPositive ? 'positive' : 'negative'}">${m.savingsRate}%</span>
            </td>
            <td style="font-size: 13px;">${topCatText}</td>
            <td>${momBadge}</td>
            <td style="text-align: center; color: #64748B;">${m.txCount}</td>
          </tr>
        `;
      }).join('')
    : `<tr><td colspan="8" style="text-align:center; padding: 20px; color: #94A3B8;">${isAr ? 'لا توجد بيانات شهرية مسجلة' : 'No monthly records found'}</td></tr>`;

  // Build Category Rows with Visual Progress Bars
  const categoryRowsHtml = data.categories.length > 0
    ? data.categories.map((c, idx) => {
        return `
          <div class="category-item">
            <div class="category-info">
              <div class="category-name-wrapper">
                <span class="category-color-dot" style="background-color: ${c.color};"></span>
                <span class="category-name">${c.name}</span>
                <span class="category-count">(${c.count} ${L.txCountLabel})</span>
              </div>
              <div class="category-amounts">
                <span class="category-val">${formatCurrency(c.amount, language)} ${currencySymbol}</span>
                <span class="category-pct">${c.percentage}%</span>
              </div>
            </div>
            <div class="progress-track">
              <div class="progress-bar" style="width: ${Math.min(100, Math.max(3, c.percentage))}%; background-color: ${c.color};"></div>
            </div>
          </div>
        `;
      }).join('')
    : `<div style="text-align:center; padding: 20px; color: #94A3B8;">${isAr ? 'لا توجد نفقات مسجلة' : 'No category expenses recorded'}</div>`;

  // Build AI Insights Cards
  const insightsHtml = data.diagnosis.insights.map(item => {
    let borderColor = '#3B82F6';
    let bgColor = '#EFF6FF';
    if (item.type === 'positive') {
      borderColor = '#10B981';
      bgColor = '#F0FDF4';
    } else if (item.type === 'warning') {
      borderColor = '#EF4444';
      bgColor = '#FEF2F2';
    } else if (item.type === 'tip') {
      borderColor = '#8B5CF6';
      bgColor = '#F5F3FF';
    }

    return `
      <div class="insight-card" style="border-right-color: ${borderColor}; background-color: ${bgColor};">
        <div class="insight-icon">${item.icon}</div>
        <div class="insight-body">
          <div class="insight-title">${item.title}</div>
          <div class="insight-text">${item.text}</div>
        </div>
      </div>
    `;
  }).join('');

  // Build Detailed Transactions Rows (capped at 500 for print safety)
  const txRowsHtml = data.sortedTransactions.slice(0, 500).map((t, idx) => {
    const isInc = t.type === 'income';
    const isExp = t.type === 'expense';
    const typeLabel = isInc ? L.incomeText : isExp ? L.expenseText : L.transferText;
    const typeColor = isInc ? '#10B981' : isExp ? '#EF4444' : '#6366F1';
    const sign = isInc ? '+' : isExp ? '-' : '⇄';
    const methodStr = t.paymentMethod === 'cash' ? L.cashText : L.cardText;

    const d = new Date(t.date);
    const dateFormatted = d.toLocaleDateString(isAr ? 'ar-EG' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
    const timeFormatted = d.toLocaleTimeString(isAr ? 'ar-EG' : 'en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });

    const catObj = data.categories.find(c => c.id === t.category);
    const catName = catObj ? catObj.name : t.category;

    return `
      <tr>
        <td style="color: #94A3B8; font-size: 12px; text-align: center;">${idx + 1}</td>
        <td style="white-space: nowrap;">
          <div style="font-weight: 600;">${dateFormatted}</div>
          <div style="font-size: 11px; color: #64748B;">${timeFormatted}</div>
        </td>
        <td>
          <span class="cat-pill" style="background-color: ${catObj?.color || '#0D9488'}15; color: ${catObj?.color || '#0D9488'}; border-color: ${catObj?.color || '#0D9488'}40;">
            ${catName}
          </span>
        </td>
        <td style="max-width: 200px;">
          <div style="font-weight: 500; color: #1E293B;">${t.description || '-'}</div>
          ${t.note ? `<div style="font-size: 11px; color: #64748B; margin-top: 2px;">💬 ${t.note}</div>` : ''}
        </td>
        <td style="font-size: 12px; color: #475569;">${methodStr}</td>
        <td>
          <span class="badge" style="background-color: ${typeColor}15; color: ${typeColor}; border: 1px solid ${typeColor}30;">
            ${typeLabel}
          </span>
        </td>
        <td style="font-weight: 700; color: ${typeColor}; white-space: nowrap; text-align: ${isAr ? 'left' : 'right'};">
          ${sign}${formatCurrency(t.amount, language)} ${currencySymbol}
        </td>
      </tr>
    `;
  }).join('');

  const htmlContent = `
    <!DOCTYPE html>
    <html dir="${dir}" lang="${language}">
    <head>
      <meta charset="utf-8">
      <title>${L.title} - ${data.walletName}</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800&family=Inter:wght@400;500;600;700&display=swap');
        
        * {
          box-sizing: border-box;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }

        body {
          font-family: ${isAr ? "'Cairo', sans-serif" : "'Inter', 'Segoe UI', sans-serif"};
          margin: 0;
          padding: 30px;
          background-color: #F8FAFC;
          color: #0F172A;
          font-size: 14px;
          line-height: 1.5;
        }

        /* Executive Header Banner */
        .header-banner {
          background: linear-gradient(135deg, #0F172A 0%, #1E293B 55%, #064E3B 100%);
          color: #FFFFFF;
          border-radius: 16px;
          padding: 32px;
          margin-bottom: 25px;
          box-shadow: 0 10px 25px -5px rgba(15, 23, 42, 0.15);
        }

        .header-top {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          border-bottom: 1px solid rgba(255, 255, 255, 0.15);
          padding-bottom: 22px;
          margin-bottom: 20px;
        }

        .brand-section {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .brand-logo {
          width: 52px;
          height: 52px;
          background: linear-gradient(135deg, #10B981 0%, #059669 100%);
          border-radius: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 26px;
          box-shadow: 0 4px 12px rgba(16, 185, 129, 0.35);
        }

        .brand-title {
          font-size: 26px;
          font-weight: 800;
          margin: 0;
          letter-spacing: -0.5px;
          color: #FFFFFF;
        }

        .brand-subtitle {
          font-size: 13px;
          color: #94A3B8;
          margin-top: 4px;
        }

        .header-meta-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 16px;
        }

        .meta-box {
          background: rgba(255, 255, 255, 0.08);
          backdrop-filter: blur(8px);
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 10px;
          padding: 10px 14px;
        }

        .meta-box-label {
          font-size: 11px;
          color: #94A3B8;
          text-transform: uppercase;
          margin-bottom: 4px;
        }

        .meta-box-value {
          font-size: 14px;
          font-weight: 700;
          color: #F8FAFC;
        }

        /* KPI Dashboard Cards */
        .kpi-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 16px;
          margin-bottom: 25px;
        }

        .kpi-card {
          background: #FFFFFF;
          border-radius: 14px;
          padding: 20px;
          border: 1px solid #E2E8F0;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.03);
          position: relative;
          overflow: hidden;
        }

        .kpi-card::before {
          content: "";
          position: absolute;
          top: 0;
          ${isAr ? 'right' : 'left'}: 0;
          width: 100%;
          height: 4px;
        }

        .kpi-card.inflow::before { background: #10B981; }
        .kpi-card.outflow::before { background: #EF4444; }
        .kpi-card.surplus::before { background: #3B82F6; }
        .kpi-card.health::before { background: #8B5CF6; }

        .kpi-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 10px;
        }

        .kpi-title {
          font-size: 13px;
          font-weight: 600;
          color: #64748B;
        }

        .kpi-icon {
          font-size: 18px;
        }

        .kpi-amount {
          font-size: 22px;
          font-weight: 800;
          color: #0F172A;
          margin-bottom: 6px;
        }

        .kpi-footer {
          font-size: 12px;
          color: #64748B;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        /* AI Diagnostics Container */
        .section-box {
          background: #FFFFFF;
          border-radius: 14px;
          border: 1px solid #E2E8F0;
          padding: 24px;
          margin-bottom: 25px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.03);
          page-break-inside: avoid;
        }

        .section-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 1px solid #F1F5F9;
          padding-bottom: 14px;
          margin-bottom: 18px;
        }

        .section-title {
          font-size: 18px;
          font-weight: 700;
          color: #0F172A;
          margin: 0;
        }

        .section-desc {
          font-size: 12px;
          color: #64748B;
          margin-top: 4px;
        }

        .health-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 14px;
          border-radius: 20px;
          font-weight: 700;
          font-size: 13px;
        }

        .insights-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 14px;
        }

        .insight-card {
          border-radius: 10px;
          border-${isAr ? 'right' : 'left'}: 4px solid;
          padding: 14px 16px;
          display: flex;
          gap: 12px;
        }

        .insight-icon {
          font-size: 22px;
          line-height: 1;
        }

        .insight-body {
          flex: 1;
        }

        .insight-title {
          font-weight: 700;
          font-size: 13px;
          color: #0F172A;
          margin-bottom: 4px;
        }

        .insight-text {
          font-size: 12px;
          color: #475569;
          line-height: 1.5;
        }

        /* Tables */
        table {
          width: 100%;
          border-collapse: collapse;
          text-align: ${isAr ? 'right' : 'left'};
          font-size: 13px;
        }

        thead {
          display: table-header-group;
        }

        th {
          background-color: #F8FAFC;
          color: #475569;
          font-weight: 700;
          padding: 12px 14px;
          border-bottom: 2px solid #E2E8F0;
          font-size: 12px;
        }

        td {
          padding: 12px 14px;
          border-bottom: 1px solid #F1F5F9;
          color: #334155;
        }

        tr:nth-child(even) td {
          background-color: #FAFCFE;
        }

        tr:last-child td {
          border-bottom: none;
        }

        tr {
          page-break-inside: avoid;
        }

        .total-row td {
          background-color: #F1F5F9 !important;
          font-weight: 800;
          color: #0F172A;
          border-top: 2px solid #CBD5E1;
          border-bottom: 2px solid #CBD5E1;
          font-size: 14px;
        }

        /* Badges & Pills */
        .badge {
          display: inline-block;
          padding: 3px 8px;
          border-radius: 6px;
          font-size: 11px;
          font-weight: 700;
        }

        .badge.positive { background-color: #DCFCE7; color: #166534; }
        .badge.negative { background-color: #FEE2E2; color: #991B1B; }
        .badge.neutral { background-color: #F1F5F9; color: #475569; }

        .cat-pill {
          display: inline-block;
          padding: 3px 10px;
          border-radius: 12px;
          font-size: 11px;
          font-weight: 600;
          border: 1px solid;
        }

        .text-positive { color: #10B981; }
        .text-negative { color: #EF4444; }

        /* Categories Progress Grid */
        .category-container {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 16px;
        }

        .category-item {
          background: #F8FAFC;
          border: 1px solid #E2E8F0;
          border-radius: 10px;
          padding: 12px 14px;
        }

        .category-info {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
        }

        .category-name-wrapper {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .category-color-dot {
          width: 10px;
          height: 10px;
          border-radius: 50%;
        }

        .category-name {
          font-weight: 700;
          color: #1E293B;
          font-size: 13px;
        }

        .category-count {
          font-size: 11px;
          color: #94A3B8;
        }

        .category-amounts {
          text-align: ${isAr ? 'left' : 'right'};
        }

        .category-val {
          font-weight: 700;
          color: #0F172A;
          font-size: 13px;
          margin-left: 8px;
        }

        .category-pct {
          font-size: 12px;
          color: #64748B;
          font-weight: 600;
        }

        .progress-track {
          width: 100%;
          height: 6px;
          background-color: #E2E8F0;
          border-radius: 3px;
          overflow: hidden;
        }

        .progress-bar {
          height: 100%;
          border-radius: 3px;
        }

        /* Footer */
        .report-footer {
          margin-top: 35px;
          border-top: 1px solid #E2E8F0;
          padding-top: 20px;
          text-align: center;
          color: #94A3B8;
          font-size: 12px;
        }

        @media print {
          body {
            background-color: #FFFFFF;
            padding: 15px;
          }
          .header-banner {
            box-shadow: none;
            border: 1px solid #CBD5E1;
          }
          .kpi-card {
            box-shadow: none;
            border: 1px solid #CBD5E1;
          }
          .section-box {
            box-shadow: none;
            border: 1px solid #CBD5E1;
          }
        }
      </style>
    </head>
    <body>

      <!-- Executive Header -->
      <div class="header-banner">
        <div class="header-top">
          <div class="brand-section">
            <div class="brand-logo">⚖️</div>
            <div>
              <h1 class="brand-title">${L.title}</h1>
              <div class="brand-subtitle">${L.subTitle}</div>
            </div>
          </div>
          <div style="text-align: ${isAr ? 'left' : 'right'};">
            <div style="display: inline-block; background: rgba(16, 185, 129, 0.2); border: 1px solid #10B981; color: #34D399; font-weight: 700; padding: 4px 12px; border-radius: 8px; font-size: 12px;">
              ${data.diagnosis.healthStatusText}
            </div>
          </div>
        </div>

        <div class="header-meta-grid">
          <div class="meta-box">
            <div class="meta-box-label">${L.walletLabel}</div>
            <div class="meta-box-value">${data.walletName}</div>
          </div>
          <div class="meta-box">
            <div class="meta-box-label">${L.reportIdLabel}</div>
            <div class="meta-box-value" style="font-family: monospace; font-size: 13px;">${reportId}</div>
          </div>
          <div class="meta-box">
            <div class="meta-box-label">${L.issueDateLabel}</div>
            <div class="meta-box-value">${exportDateStr}</div>
          </div>
          <div class="meta-box">
            <div class="meta-box-label">${L.periodLabel}</div>
            <div class="meta-box-value">${data.startDateStr} - ${data.endDateStr}</div>
          </div>
        </div>
      </div>

      <!-- KPI Overview Cards -->
      <div class="kpi-grid">
        <div class="kpi-card inflow">
          <div class="kpi-header">
            <span class="kpi-title">${L.totalInflow}</span>
            <span class="kpi-icon">📥</span>
          </div>
          <div class="kpi-amount text-positive">+${formatCurrency(data.totalIncome, language)} <span style="font-size: 14px;">${currencySymbol}</span></div>
          <div class="kpi-footer">
            <span>${data.incomeCount} ${L.txCountLabel}</span>
          </div>
        </div>

        <div class="kpi-card outflow">
          <div class="kpi-header">
            <span class="kpi-title">${L.totalOutflow}</span>
            <span class="kpi-icon">📤</span>
          </div>
          <div class="kpi-amount text-negative">-${formatCurrency(data.totalExpense, language)} <span style="font-size: 14px;">${currencySymbol}</span></div>
          <div class="kpi-footer">
            <span>${data.expenseCount} ${L.txCountLabel}</span>
          </div>
        </div>

        <div class="kpi-card surplus">
          <div class="kpi-header">
            <span class="kpi-title">${L.netSurplus}</span>
            <span class="kpi-icon">💰</span>
          </div>
          <div class="kpi-amount ${data.netSavings >= 0 ? 'text-positive' : 'text-negative'}">
            ${data.netSavings >= 0 ? '+' : ''}${formatCurrency(data.netSavings, language)} <span style="font-size: 14px;">${currencySymbol}</span>
          </div>
          <div class="kpi-footer">
            <span>${data.netSavings >= 0 ? (isAr ? 'فائض مالي إيجابي' : 'Positive Surplus') : (isAr ? 'عجز في السيولة' : 'Deficit')}</span>
          </div>
        </div>

        <div class="kpi-card health">
          <div class="kpi-header">
            <span class="kpi-title">${L.savingsRate}</span>
            <span class="kpi-icon">⚡</span>
          </div>
          <div class="kpi-amount" style="color: ${data.diagnosis.healthColor};">
            ${data.savingsRate}%
          </div>
          <div class="kpi-footer">
            <span class="badge" style="background-color: ${data.diagnosis.healthColor}18; color: ${data.diagnosis.healthColor};">
              ${data.diagnosis.healthScore}/100
            </span>
          </div>
        </div>
      </div>

      <!-- Smart Financial Diagnostics & AI Insights -->
      <div class="section-box">
        <div class="section-header">
          <div>
            <h2 class="section-title">${L.aiDiagnosticsTitle}</h2>
            <div class="section-desc">${L.aiDiagnosticsDesc}</div>
          </div>
          <div>
            <span class="health-badge" style="background-color: ${data.diagnosis.healthColor}20; color: ${data.diagnosis.healthColor}; border: 1px solid ${data.diagnosis.healthColor}40;">
              ★ ${data.diagnosis.healthStatusText}
            </span>
          </div>
        </div>
        <div class="insights-grid">
          ${insightsHtml}
        </div>
      </div>

      <!-- Month-by-Month Analytics Table -->
      <div class="section-box">
        <div class="section-header">
          <div>
            <h2 class="section-title">${L.monthlyBreakdownTitle}</h2>
            <div class="section-desc">${isAr ? 'مقارنة دقيقة لأداء كل شهر وإجمالي التدفقات ونسبة الفائض والتغير' : 'Accurate comparison of each month performance and surplus trends'}</div>
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th>${L.monthCol}</th>
              <th>${L.inflowCol}</th>
              <th>${L.outflowCol}</th>
              <th>${L.netCol}</th>
              <th>${L.rateCol}</th>
              <th>${L.topCatCol}</th>
              <th>${L.momCol}</th>
              <th style="text-align: center;">${isAr ? 'العمليات' : 'Count'}</th>
            </tr>
          </thead>
          <tbody>
            ${monthlyRowsHtml}
            <tr class="total-row">
              <td>${L.totalRow}</td>
              <td class="text-positive">+${formatCurrency(data.totalIncome, language)} ${currencySymbol}</td>
              <td class="text-negative">-${formatCurrency(data.totalExpense, language)} ${currencySymbol}</td>
              <td class="${data.netSavings >= 0 ? 'text-positive' : 'text-negative'}">
                ${data.netSavings >= 0 ? '+' : ''}${formatCurrency(data.netSavings, language)} ${currencySymbol}
              </td>
              <td><span class="badge ${data.savingsRate >= 0 ? 'positive' : 'negative'}">${data.savingsRate}%</span></td>
              <td>-</td>
              <td>-</td>
              <td style="text-align: center;">${data.totalTransactionsCount}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Category Spending Breakdown -->
      <div class="section-box">
        <div class="section-header">
          <div>
            <h2 class="section-title">${L.catBreakdownTitle}</h2>
            <div class="section-desc">${isAr ? 'ترتيب فئات الإنفاق تنازلياً مع مؤشرات الحصة النسبية من الميزانية' : 'Expense distribution ranked by share of total outflow'}</div>
          </div>
        </div>
        <div class="category-container">
          ${categoryRowsHtml}
        </div>
      </div>

      <!-- Detailed Transaction Register -->
      <div class="section-box">
        <div class="section-header">
          <div>
            <h2 class="section-title">${L.ledgerTitle}</h2>
            <div class="section-desc">${isAr ? `كافة المعاملات المسجلة مرتبة زمنياً من الأحدث إلى الأقدم (${data.sortedTransactions.length} عملية)` : `All transactions recorded sorted descending (${data.sortedTransactions.length} items)`}</div>
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th style="width: 30px; text-align: center;">#</th>
              <th>${L.dateCol}</th>
              <th>${L.categoryCol}</th>
              <th>${L.descCol}</th>
              <th>${L.methodCol}</th>
              <th>${L.typeCol}</th>
              <th style="text-align: ${isAr ? 'left' : 'right'};">${L.amountCol}</th>
            </tr>
          </thead>
          <tbody>
            ${txRowsHtml}
          </tbody>
        </table>
      </div>

      <!-- Report Footer -->
      <div class="report-footer">
        <p>${L.footerNote}</p>
        <p style="font-size: 11px; margin-top: 4px;">${exportDateStr} • ID: ${reportId}</p>
      </div>

    </body>
    </html>
  `;

  if (Platform.OS === 'web') {
    // Open clean print window on Web for direct PDF saving or printing
    try {
      const printWin = window.open('', '_blank');
      if (printWin) {
        printWin.document.open();
        printWin.document.write(htmlContent);
        printWin.document.close();
        printWin.focus();
        setTimeout(() => {
          printWin.print();
        }, 400);
        return;
      }
    } catch (e) {
      console.warn('Web popup blocked, falling back to printAsync', e);
    }
    await Print.printAsync({ html: htmlContent });
    return;
  }

  // Native Mobile (iOS & Android)
  try {
    const { uri } = await Print.printToFileAsync({ html: htmlContent });
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        dialogTitle: `${L.title} - ${data.walletName}`,
        UTI: 'com.adobe.pdf',
      });
    }
  } catch (error) {
    console.error('PDF export error:', error);
    throw error;
  }
}
