//The background script runs quietly in the background and of the extension and is responsible for:

//This is the central “brain” that coordinates activity between the extension popup, content script, and Chrome APIs.
//Manages extension state (e.g. are we scanning?)

//Stores face data from uploaded photos

//Responds to scan requests from the main script

//Downloads images from Tinder to analyze them

//Automatically activates when you're on Tinder

//Lets you click the icon to toggle scanning on/off

// Familiar Background Service Worker
// Handles extension lifecycle and communication

importScripts('email.min.js');

// Listen for extension installation. runs once when the extension is installed.
chrome.runtime.onInstalled.addListener((details) => {
  console.log('Familiar for Tinder installed:', details.reason);
  
  // Initialize storage with default values
  chrome.storage.local.set({
    isScanning: false,// controls whether scanning is active
    userEmbeddings: null,// stores the user's face embeddings
    scanCount: 0,// tracks how many profiles have been scanned
    lastScanTime: null// tracks the last time a scan was performed
  });
});

// Listen for messages from content scripts and popup.
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Background received message:', message);
  
  switch (message.action) {
    case 'sendEmailAlert': {
      const { alertEmail, message: msg } = message;
      const emailService = 'your service ID'; // your service ID  ${{ secrets.EXTENSION_ID }}
      const templateId = 'your template ID';  // your template ID
      const userId = 'your user ID';    
      
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
      
      //updates the scanning status.
    case 'updateScanStatus':
      chrome.storage.local.set({ isScanning: message.isScanning });
      sendResponse({ success: true });
      break;
      
      //Sends back the saved face data (user's facial embeddings) so it can be used for comparison.
    case 'getEmbeddings':
      chrome.storage.local.get(['userEmbeddings'], (result) => {
        sendResponse({ embeddings: result.userEmbeddings });
      });
      return true;
      
      //Saves the user's face data (user's facial embeddings) so it can be used for comparison.
    case 'saveEmbeddings':
      chrome.storage.local.set({ userEmbeddings: message.embeddings });
      sendResponse({ success: true });
      break;
      
      //Adds 1 to the number of profiles scanned and saves the current time.
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
      
      // Tries to download an image from Tinder using the image URL.
    case 'fetchImage':
      fetch(message.url)
        .then(response => response.blob())
        //Converts the image into a format (dataUrl) the scanner can read.
        .then(blob => {
          const reader = new FileReader();
          reader.onloadend = () => {
            sendResponse({ dataUrl: reader.result });
          };
          reader.onerror = () => {
            sendResponse({ error: 'Failed to read blob as DataURL' });
          };
          reader.readAsDataURL(blob);
        })
        //If anything goes wrong (e.g., network error), logs it and returns an error.
        .catch(error => {
          console.error('Background image fetch error:', error);
          sendResponse({ error: error.message });
        });
      return true; // Important for async response

      //If a message comes in that’s not recognized, it logs a warning.
    default:
      console.warn('Unknown action:', message.action);
      sendResponse({ error: 'Unknown action' });
  }
});

// Handle tab updates to inject content scripts when needed..When a Tinder tab finishes loading...
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url && tab.url.includes('tinder.com')) {
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

// Handle extension icon click the extension icon in the toolbar.
chrome.action.onClicked.addListener((tab) => {
  if (tab.url && tab.url.includes('tinder.com')) {
    // Toggle scanning: if it's on, turn it off — if it's off, turn it on.
    chrome.storage.local.get(['isScanning'], (result) => {
      const newStatus = !result.isScanning;
      chrome.storage.local.set({ isScanning: newStatus });
      
      // Sends a message to the content script telling it to start or stop scanning. If the script isn’t ready, it logs a warning.
      chrome.tabs.sendMessage(tab.id, { 
        action: newStatus ? 'startScan' : 'stopScan' 
      }).catch(err => {
        console.log('Content script not ready yet:', err);
      });
    });
  }
});

console.log('Familiar background service worker loaded'); 