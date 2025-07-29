// MatchGuard Background Service Worker
// Handles extension lifecycle and communication

// Listen for extension installation
chrome.runtime.onInstalled.addListener((details) => {
  console.log('MatchGuard for Bumble installed:', details.reason);
  
  // Initialize storage with default values
  chrome.storage.local.set({
    isScanning: false,
    userEmbeddings: null,
    scanCount: 0,
    lastScanTime: null
  });
});

// Listen for messages from content scripts and popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Background received message:', message);
  
  switch (message.action) {
    case 'getScanStatus':
      chrome.storage.local.get(['isScanning'], (result) => {
        sendResponse({ isScanning: result.isScanning || false });
      });
      return true; // Keep message channel open for async response
      
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
      
    case 'fetchImage':
      if (!message.url) {
        sendResponse({ error: 'Missing URL' });
        return true;
      }

      fetch(message.url)
        .then(response => response.blob())
        .then(blob => {
          const reader = new FileReader();
          reader.onloadend = () => {
            sendResponse({ dataUrl: reader.result });
          };
          reader.readAsDataURL(blob);
        })
        .catch(error => {
          console.error('Error fetching image:', error);
          sendResponse({ error: error.message });
        });
      return true; // Keep the message channel open
      
    default:
      console.log('Unknown message action:', message.action);
      sendResponse({ error: 'Unknown action' });
  }
});

// Handle tab updates to inject content scripts when needed
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url && tab.url.includes('bumble.com')) {
    // Check if scanning is enabled
    chrome.storage.local.get(['isScanning'], (result) => {
      if (result.isScanning) {
        // Inject content script if scanning is active
        chrome.scripting.executeScript({
          target: { tabId: tabId },
          files: ['content.js']
        }).catch(err => {
          console.log('Content script already injected or failed:', err);
        });
      }
    });
  }
});

// Handle extension icon click
chrome.action.onClicked.addListener((tab) => {
  if (tab.url && tab.url.includes('bumble.com')) {
    // Open popup or toggle scanning
    chrome.storage.local.get(['isScanning'], (result) => {
      const newStatus = !result.isScanning;
      chrome.storage.local.set({ isScanning: newStatus });
      
      // Notify content script
      chrome.tabs.sendMessage(tab.id, { 
        action: newStatus ? 'startScan' : 'stopScan' 
      }).catch(err => {
        console.log('Content script not ready yet:', err);
      });
    });
  }
});

console.log('MatchGuard background service worker loaded'); 