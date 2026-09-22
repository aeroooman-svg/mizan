const fs = require('fs');
const path = require('path');

const distDir = path.join(__dirname, '..', 'dist');

if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

const privacyPolicySrc = path.join(__dirname, '..', 'privacy-policy.html');
const privacyPolicyDest = path.join(distDir, 'privacy-policy.html');
if (fs.existsSync(privacyPolicySrc)) {
  fs.copyFileSync(privacyPolicySrc, privacyPolicyDest);
  console.log('✓ Successfully copied privacy-policy.html to dist/');
}

const promoVideoSrc = path.join(__dirname, '..', 'promo-video.html');
const promoVideoDest = path.join(distDir, 'promo-video.html');
if (fs.existsSync(promoVideoSrc)) {
  fs.copyFileSync(promoVideoSrc, promoVideoDest);
  console.log('✓ Successfully copied promo-video.html to dist/');
}

// Copy store-assets into dist/assets/store-assets
const storeAssetsSrc = path.join(__dirname, '..', 'assets', 'store-assets');
const storeAssetsDest = path.join(distDir, 'assets', 'store-assets');
if (fs.existsSync(storeAssetsSrc)) {
  fs.cpSync(storeAssetsSrc, storeAssetsDest, { recursive: true });
  console.log('✓ Successfully copied assets/store-assets to dist/assets/store-assets');
}

// Inject iOS Safari touch and callout fixes into dist/index.html
const indexHtmlPath = path.join(distDir, 'index.html');
if (fs.existsSync(indexHtmlPath)) {
  let html = fs.readFileSync(indexHtmlPath, 'utf8');
  const touchStyles = `
    <style id="mizan-ios-touch-fix">
      * {
        -webkit-tap-highlight-color: transparent !important;
        -webkit-touch-callout: none !important;
      }
      [role="button"], [role="tab"], button, a, svg {
        -webkit-touch-callout: none !important;
        -webkit-user-select: none !important;
        user-select: none !important;
      }
      input, textarea {
        -webkit-user-select: text !important;
        user-select: text !important;
      }
    </style>
  </head>`;

  if (!html.includes('id="mizan-ios-touch-fix"')) {
    html = html.replace('</head>', touchStyles);
    fs.writeFileSync(indexHtmlPath, html, 'utf8');
    console.log('✓ Injected iOS Safari touch fixes into dist/index.html');
  }
}

const versionInfo = {
  version: Date.now(),
  buildTime: new Date().toISOString()
};

fs.writeFileSync(
  path.join(distDir, 'version.json'),
  JSON.stringify(versionInfo, null, 2),
  'utf8'
);
console.log('✓ Successfully generated dist/version.json:', versionInfo);
