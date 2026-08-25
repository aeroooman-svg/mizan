import { runFinancialEngineTests } from '../__tests__/financialEngine.test';
import { runCurrencyApiTests } from '../__tests__/currencyApi.test';
import { runSmsParserTests } from '../__tests__/smsParser.test';
import { runZakatTests } from '../__tests__/zakat.test';
import { runAnalyticsTests } from '../__tests__/analytics.test';
import { runNlpParserTests } from '../__tests__/nlpParser.test';

console.log('--------------------------------------------------');
console.log('🚀 Running MIZAN Automated Unit Testing Suite...');
console.log('--------------------------------------------------\n');

let passCount = 0;
let failCount = 0;

const suites = [
  { name: 'Financial Engine', runner: runFinancialEngineTests },
  { name: 'Currency API', runner: runCurrencyApiTests },
  { name: 'SMS Bank Parser', runner: runSmsParserTests },
  { name: 'Arabic Voice & NLP Parser', runner: runNlpParserTests },
  { name: 'Zakat Calculator', runner: runZakatTests },
  { name: 'MoM & YoY Analytics', runner: runAnalyticsTests },
];

for (const suite of suites) {
  try {
    console.log(`▶ Executing Suite: ${suite.name}`);
    suite.runner();
    passCount++;
  } catch (error: any) {
    failCount++;
    console.error(`❌ Suite Failed [${suite.name}]:`, error.message);
  }
}

console.log('\n--------------------------------------------------');
if (failCount === 0) {
  console.log(`🎉 SUCCESS: All ${passCount} Test Suites Passed Cleanly! (100% Passing)`);
  console.log('--------------------------------------------------');
  process.exit(0);
} else {
  console.log(`⚠️ FAILURE: ${failCount} Suite(s) Failed out of ${suites.length}`);
  console.log('--------------------------------------------------');
  process.exit(1);
}
