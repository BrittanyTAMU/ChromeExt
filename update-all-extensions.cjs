const fs = require('fs');
const path = require('path');

// Function to update popup.js to use ES modules
function updatePopupJs(extensionDir) {
  const popupJsPath = path.join(extensionDir, 'popup.js');
  if (!fs.existsSync(popupJsPath)) {
    console.log(`popup.js not found in ${extensionDir}`);
    return;
  }

  let content = fs.readFileSync(popupJsPath, 'utf8');
  
  // Add import statement at the top
  if (!content.includes('import Human')) {
    content = content.replace(
      '// MatchGuard Popup Controller',
      '// MatchGuard Popup Controller\n\nimport Human from \'./human.esm.js\';'
    );
  }
  
  // Replace loadHuman function with initHuman
  content = content.replace(
    /\/\/ Load Human\.js from local file\s+async function loadHuman\(\) \{[\s\S]*?\}/,
    `// Initialize Human.js
async function initHuman() {
  if (human) return human;
  
  try {
    human = new Human({
      modelBasePath: 'https://vladmandic.github.io/human/models',
      face: { 
        enabled: true, 
        detector: { enabled: true }, 
        mesh: { enabled: false }, 
        description: { enabled: true } 
      }
    });
    await human.load();
    return human;
  } catch (error) {
    console.error('Error initializing Human:', error);
    throw error;
  }
}`
  );
  
  // Replace loadHuman() calls with initHuman()
  content = content.replace(/await loadHuman\(\)/g, 'await initHuman()');
  content = content.replace(/\/\/ Load Human\.js/g, '// Initialize Human.js');
  
  // Remove any remaining load() calls since they're now in initHuman
  content = content.replace(/await human\.load\(\);\s*await human\.warmup\(\);/g, 'await human.warmup();');
  
  fs.writeFileSync(popupJsPath, content, 'utf8');
  console.log(`Updated ${popupJsPath}`);
}

// Function to update popup.html to use module script
function updatePopupHtml(extensionDir) {
  const popupHtmlPath = path.join(extensionDir, 'popup.html');
  if (!fs.existsSync(popupHtmlPath)) {
    console.log(`popup.html not found in ${extensionDir}`);
    return;
  }

  let content = fs.readFileSync(popupHtmlPath, 'utf8');
  content = content.replace(
    '<script src="popup.js"></script>',
    '<script type="module" src="popup.js"></script>'
  );
  
  fs.writeFileSync(popupHtmlPath, content, 'utf8');
  console.log(`Updated ${popupHtmlPath}`);
}

// Function to update manifest.json
function updateManifest(extensionDir) {
  const manifestPath = path.join(extensionDir, 'manifest.json');
  if (!fs.existsSync(manifestPath)) {
    console.log(`manifest.json not found in ${extensionDir}`);
    return;
  }

  let content = fs.readFileSync(manifestPath, 'utf8');
  
  // Update web_accessible_resources to use human.esm.js
  content = content.replace(
    /"resources": \["human\.js"\]/g,
    '"resources": ["human.esm.js"]'
  );
  
  // Add content_security_policy if not present
  if (!content.includes('content_security_policy')) {
    content = content.replace(
      /"web_accessible_resources": \[[\s\S]*?\][\s]*}/,
      `"web_accessible_resources": [
    {
      "resources": ["human.esm.js"],
      "matches": ["https://*.com/*"]
    }
  ],
  "content_security_policy": {
    "extension_pages": "script-src 'self'; object-src 'self';"
  }`
    );
  }
  
  fs.writeFileSync(manifestPath, content, 'utf8');
  console.log(`Updated ${manifestPath}`);
}

// Update all extensions
const extensions = ['bumble', 'tinder', 'grindr', 'premium'];

extensions.forEach(extension => {
  console.log(`\nUpdating ${extension}...`);
  updatePopupJs(extension);
  updatePopupHtml(extension);
  updateManifest(extension);
});

console.log('\nAll extensions updated to use ES modules!'); 