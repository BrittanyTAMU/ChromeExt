const fs = require('fs');
const path = require('path');

// Function to fix content script with dynamic import
function fixContentScriptDynamicImport(extensionDir) {
  const contentJsPath = path.join(extensionDir, 'content.js');
  if (!fs.existsSync(contentJsPath)) {
    console.log(`content.js not found in ${extensionDir}`);
    return;
  }

  let content = fs.readFileSync(contentJsPath, 'utf8');
  
  // Replace top-level import with dynamic import
  content = content.replace(
    /import Human from '\.\/human\.esm\.js';[\s\S]*?const human = new Human\([\s\S]*?\);[\s]*/,
    `let Human;
let human;

// Initialize Human.js dynamically
(async () => {
  try {
    const module = await import(chrome.runtime.getURL('human.esm.js'));
    Human = module.default;

    human = new Human({
      modelBasePath: 'https://vladmandic.github.io/human/models',
      face: { enabled: true, detector: { enabled: true }, mesh: { enabled: false }, description: { enabled: true } }
    });
    
    console.log('Human.js initialized successfully');
  } catch (error) {
    console.error('Failed to initialize Human.js:', error);
  }
})();

`
  );
  
  // Add safety checks for human object
  content = content.replace(
    /async function scanCurrentProfile\(\) \{/,
    `async function scanCurrentProfile() {
  if (!human) {
    console.log('Human.js not yet initialized');
    return { match: false };
  }`
  );
  
  content = content.replace(
    /async function autoScrollAndScan\(\) \{/,
    `async function autoScrollAndScan() {
  if (!human) {
    showNotification('Human.js not yet initialized. Please wait...');
    return;
  }`
  );
  
  fs.writeFileSync(contentJsPath, content, 'utf8');
  console.log(`Fixed ${contentJsPath} with dynamic import`);
}

// Fix all extensions
const extensions = ['bumble', 'tinder', 'grindr', 'premium'];

extensions.forEach(extension => {
  console.log(`\nFixing ${extension} content script with dynamic import...`);
  fixContentScriptDynamicImport(extension);
});

console.log('\nAll content scripts updated with dynamic imports!'); 