# دليل بناء ونشر تطبيق ميزان (MIZAN Build & Release Guide)

تم إعداد ملفات البناء الخاصة بالتطبيق بنجاح. يصف هذا الملف كيفية استخراج ملفات البناء المباشرة لتطبيق أندرويد و آيفون.

---

## 🛠️ الملفات المجهزة
1. **[eas.json](file:///c:/Users/mm_al/OneDrive/Desktop/Daily-Expense-Tracker/eas.json)**: يحتوي على ملفات تعريف البناء لخدمات Expo (Preview APK, Production Android App Bundle `.aab`, Production iOS `.ipa`).
2. **[app.json](file:///c:/Users/mm_al/OneDrive/Desktop/Daily-Expense-Tracker/app.json)**: مجهز بمعرف التطبيق `com.mizan.app` والأذونات المطلوبة (الكاميرا والبصمة).

---

## 🚀 أوامر البناء المتاحة

### 1. بناء ملف تجريبي أندرويد (APK لتثبيته مباشرة على الهواتف):
```bash
npm run build:apk
```

### 2. بناء ملف أندرويد لمتجر Google Play (App Bundle .aab):
```bash
npm run build:android
```

### 3. بناء ملف آيفون لمتجر App Store (.ipa):
```bash
npm run build:ios
```

---

## 📋 خطوات التشغيل لأول مرة عبر Expo EAS:
1. تأكد من إعداد حساب مجاني على [expo.dev](https://expo.dev).
2. قم بتسجيل الدخول في الطرفية عبر:
   ```bash
   npx eas-cli login
   ```
3. ربط المشروع بحسابك:
   ```bash
   npx eas-cli project:init
   ```
4. شغّل أمر البناء المطلوب (مثل `npm run build:apk`) وسيتم بناء التطبيق على سيرفرات سحابية مجاناً وتحميل الملف فور انتهاء العملية.
