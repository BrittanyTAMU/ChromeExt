// MatchGuard Popup Controller

import Human from './human.esm.js';
// Handles UI interactions and communicates with background service

let human = null;

// Initialize Human.js
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
}, 
            mesh: { enabled: false }, 
            description: { enabled: true } 
          }
        });
        resolve(human);
      }, 100);
    };
    script.onerror = reject;
    document.head.appendChild(script);
  });
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
      photoFeedback.textContent += '\nFace data stored! Now visit any dating site to start scanning.';
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
    
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, { action: isScanning ? 'startScan' : 'stopScan' });
      }
    });
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