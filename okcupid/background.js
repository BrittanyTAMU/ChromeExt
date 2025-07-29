// Familiar Background Service Worker
// Handles extension lifecycle and communication
importScripts('email.min.js');

// Listen for extension installation
chrome.runtime.onInstalled.addListener((details) => {
  // Log the reason for installation (install/update)
  console.log('Familiar for Bumble installed:', details.reason);
  
  // Initialize storage with default values
  chrome.storage.local.set({
    isScanning: false,      // Whether scanning is active
    userEmbeddings: null,  // Stored face embeddings
    scanCount: 0,          // Number of scans performed
    lastScanTime: null     // Timestamp of last scan
  });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Background received message:', message);

  switch (message.action) {
    case 'sendEmailAlert': {
      const { alertEmail, message: msg } = message;
      const emailService = 'service_07phax9'; // your service ID
      const templateId = 'template_44zq4rs';  // your template ID
      const userId = 'lk4ZaknyIfxc-aMTU';     // your user ID

      const templateParams = {
        to_email: alertEmail,
        message: msg
      };

      emailjs.init(userId);

      emailjs.send(emailService, templateId, templateParams)
        .then(result => {
          console.log('📧 Email alert sent to', alertEmail, 'Result:', result);
          sendResponse({ success: true });
        })
        .catch(err => {
          console.log('❌ Email alert failed:', err);
          sendResponse({ success: false, error: err });
        });

      return true; // Keep message channel open
    }

    case 'getScanStatus':
      chrome.storage.local.get(['isScanning'], (result) => {
        sendResponse({ isScanning: result.isScanning || false });
      });
      return true;

    case 'updateScanStatus':
      chrome.storage.local.set({ isScanning: message.isScanning });
      sendResponse({ success: true });
      break;

    case 'getEmbeddings':
      chrome.storage.local.get(['userEmbeddings'], (result) => {
        sendResponse({ embeddings: result.userEmbeddings });
      });
      return true;

    case 'saveEmbeddings':
      chrome.storage.local.set({ userEmbeddings: message.embeddings });
      sendResponse({ success: true });
      break;

    case 'incrementScanCount':
      chrome.storage.local.get(['scanCount'], (result) => {
        const newCount = (result.scanCount || 0) + 1;
        chrome.storage.local.set({
          scanCount: newCount,
          lastScanTime: Date.now()
        });
        sendResponse({ scanCount: newCount });
      });
      return true;

    default:
      console.log('Unknown message action:', message.action);
      sendResponse({ error: 'Unknown action' });
  }
});

// Handle tab updates to inject content scripts when needed
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
// Only act when the page has fully loaded and is a Bumble page
if (changeInfo.status === 'complete' && tab.url && tab.url.includes('bumble.com')) {
  // Check if scanning is enabled
  chrome.storage.local.get(['isScanning'], (result) => {
    if (result.isScanning) {
      // Inject content script if scanning is active
      chrome.scripting.executeScript({
        target: { tabId: tabId },
        files: ['content.js']
      }).catch(err => {
        // Log if script injection fails (already injected or error)
        console.log('Content script already injected or failed:', err);
      });
    }
  });
}
});

// Handle extension icon click
chrome.action.onClicked.addListener((tab) => {
// Only act if the current tab is a Bumble page
if (tab.url && tab.url.includes('bumble.com')) {
  // Toggle scanning status
  chrome.storage.local.get(['isScanning'], (result) => {
    const newStatus = !result.isScanning;
    chrome.storage.local.set({ isScanning: newStatus });
    
    // Notify content script to start or stop scanning
    chrome.tabs.sendMessage(tab.id, { 
      action: newStatus ? 'startScan' : 'stopScan' 
    }).catch(err => {
      // Log if content script is not ready
      console.log('Content script not ready yet:', err);
    });
  });
}
});

// Log that the background service worker has loaded
console.log('Familiar background service worker loaded'); 