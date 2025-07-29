const fs = require('fs');
const path = require('path');

// Function to fix content script
function fixContentScript(extensionDir) {
  const contentJsPath = path.join(extensionDir, 'content.js');
  if (!fs.existsSync(contentJsPath)) {
    console.log(`content.js not found in ${extensionDir}`);
    return;
  }

  let content = fs.readFileSync(contentJsPath, 'utf8');
  
  // Replace CDN import with local import
  content = content.replace(
    /import Human from 'https:\/\/cdn\.jsdelivr\.net\/npm\/@vladmandic\/human\/dist\/human\.esm\.js';/g,
    "import Human from './human.esm.js';"
  );
  
  // Fix message listener to include sendResponse
  content = content.replace(
    /chrome\.runtime\.onMessage\.addListener\(\(msg, sender, sendResponse\) => \{[\s\S]*?\}\);$/,
    `chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === 'startScan') {
    if (!isScanning) {
      isScanning = true;
      swipeCount = 0;
      autoScrollAndScan();
      sendResponse({ success: true, message: 'Scanning started' });
    } else {
      sendResponse({ success: false, message: 'Already scanning' });
    }
  } else if (msg.action === 'stopScan') {
    isScanning = false;
    autoScrollActive = false;
    if (autoScrollTimeout) clearTimeout(autoScrollTimeout);
    showNotification('Scanning stopped.');
    sendResponse({ success: true, message: 'Scanning stopped' });
  } else {
    sendResponse({ success: false, message: 'Unknown action' });
  }
  
  // Return true to indicate we will send a response asynchronously
  return true;
});`
  );
  
  fs.writeFileSync(contentJsPath, content, 'utf8');
  console.log(`Fixed ${contentJsPath}`);
}

// Fix all extensions
const extensions = ['bumble', 'tinder', 'grindr', 'premium'];

extensions.forEach(extension => {
  console.log(`\nFixing ${extension} content script...`);
  fixContentScript(extension);
});

console.log('\nAll content scripts fixed!'); 