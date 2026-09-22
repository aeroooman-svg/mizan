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
