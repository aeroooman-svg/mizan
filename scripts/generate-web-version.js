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
