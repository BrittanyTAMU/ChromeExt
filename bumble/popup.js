// MatchGuard Popup Controller
// Handles UI interactions and communicates with background service

import Human from './human.esm.js';

let human = null;

// Initialize Human.js
async function initHuman() {
  if (human) return human;
  
  try {
    human = new Human({
      modelBasePath: 'https://vladmandic.github.io/human/models',
      backend: 'cpu', // Force CPU backend to avoid WebGL issues
      face: { 
        enabled: true, 
        detector: { enabled: true }, 
        mesh: { enabled: false }, 
        description: { enabled: true } 
      },
      // Disable problematic features
      hand: { enabled: false },
      body: { enabled: false },
      gesture: { enabled: false },
      object: { enabled: false }
    });
    await human.load();
    return human;
  } catch (error) {
    console.error('Error initializing Human:', error);
    throw error;
  }
}

const photoInput = document.getElementById('photoInput');
const photoFeedback = document.getElementById('photoFeedback');
const photoProgress = document.getElementById('photoProgress');
const savePhotosButton = document.getElementById('savePhotosButton');
const scanToggleButton = document.getElementById('scanToggleButton');
const scanStatusText = document.getElementById('scanStatusText');

let isScanning = false;

savePhotosButton.addEventListener('click', async () => {
  try {
    const files = photoInput.files;
    if (!files || files.length === 0) {
      photoFeedback.textContent = 'Please select 2–3 clear photos.';
      return;
    }
    
    photoFeedback.textContent = 'Loading models...';
    photoProgress.style.display = 'block';
    photoProgress.value = 0;
    
    // Initialize Human.js
    await initHuman();
    await human.warmup();
    
    const embeddings = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const img = new Image();
      img.src = URL.createObjectURL(file);
      
      await new Promise((resolve) => {
        if (img.complete) resolve();
        else img.onload = resolve;
      });
      
      const result = await human.detect(img);
      if (result.face.length > 0 && result.face[0].embedding) {
        embeddings.push(Array.from(result.face[0].embedding));
        photoFeedback.textContent += `\nFace detected in ${file.name}`;
      } else {
        photoFeedback.textContent += `\nNo face detected in ${file.name}`;
      }
      photoProgress.value = ((i + 1) / files.length) * 100;
    }
    
    if (embeddings.length > 0) {
      await chrome.storage.local.set({ userEmbeddings: embeddings });
      photoFeedback.textContent += '\nFace data stored! Now visit Bumble to start scanning.';
    } else {
      photoFeedback.textContent += '\nNo valid faces found. Please try again.';
    }
  } catch (error) {
    console.error('Error processing photos:', error);
    photoFeedback.textContent = 'Error processing photos. Please try again.';
  } finally {
    photoProgress.style.display = 'none';
  }
});

scanToggleButton.addEventListener('click', async () => {
  try {
    isScanning = !isScanning;
    scanToggleButton.textContent = isScanning ? 'Stop Scanning' : 'Start Scanning';
    scanToggleButton.classList.toggle('stop', isScanning);
    scanStatusText.textContent = isScanning ? 'Scanning is active.' : 'Scanning is stopped.';
    
    await chrome.storage.local.set({ isScanning });
    
    // Get the current active tab
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const url = tabs[0]?.url;
    if (!url || !url.includes('bumble.com')) {
      scanStatusText.textContent = 'This page is not supported. Please open bumble.com.';
      return;
    }
    if (tabs[0]?.id) {
      try {
        // Send message to content script
        const response = await chrome.tabs.sendMessage(tabs[0].id, { 
          action: isScanning ? 'startScan' : 'stopScan' 
        });
        
        if (response && response.success) {
          scanStatusText.textContent = response.message;
        } else {
          scanStatusText.textContent = 'Error: ' + (response?.message || 'Unknown error');
        }
      } catch (error) {
        console.error('Error sending message to content script:', error);
        scanStatusText.textContent = 'Error: Content script not found. Please refresh the page and try again.';
        // Revert the toggle state
        isScanning = !isScanning;
        scanToggleButton.textContent = isScanning ? 'Stop Scanning' : 'Start Scanning';
        scanToggleButton.classList.toggle('stop', isScanning);
      }
    } else {
      scanStatusText.textContent = 'Error: No active tab found.';
    }
  } catch (error) {
    console.error('Error toggling scan:', error);
    scanStatusText.textContent = 'Error toggling scan. Please try again.';
  }
});

// Initialize popup when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
  try {
    // Check current scan status
    const result = await chrome.storage.local.get(['isScanning']);
    isScanning = result.isScanning || false;
    
    // Update UI to reflect current state
    scanToggleButton.textContent = isScanning ? 'Stop Scanning' : 'Start Scanning';
    scanToggleButton.classList.toggle('stop', isScanning);
    scanStatusText.textContent = isScanning ? 'Scanning is active.' : 'Scanning is stopped.';
    
    // Check if we have stored embeddings
    const embeddingsResult = await chrome.storage.local.get(['userEmbeddings']);
    if (embeddingsResult.userEmbeddings) {
      photoFeedback.textContent = `Face data loaded (${embeddingsResult.userEmbeddings.length} photos). Ready to scan.`;
    }
  } catch (error) {
    console.error('Error initializing popup:', error);
  }
}); 