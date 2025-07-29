// Familiar Popup Controller
// Handles UI interactions and communicates with background service

// Import the Human.js library (ES module)
import Human from './human.esm.js';

// Declare a variable to hold the Human.js instance
let human = null;

// Initialize Human.js (face detection library)
async function initHuman() {
  // If already initialized, return the existing instance
  if (human) return human;
  
  try {
    // Create a new Human instance with only face detection enabled
    human = new Human({
      modelBasePath: 'https://vladmandic.github.io/human/models', // Path to load model files from
      backend: 'cpu', // Use CPU for processing (more stable in extensions)
      face: { 
        enabled: true, 
        detector: { enabled: true }, 
        mesh: { enabled: false }, 
        description: { enabled: true } 
      },
      // Disable problematic features for performance
      hand: { enabled: false },
      body: { enabled: false },
      gesture: { enabled: false },
      object: { enabled: false }
    });
    // Load the face detection models
    await human.load();
    // Return the initialized instance
    return human;
  } catch (error) {
    // Log any errors during initialization
    console.error('Error initializing Human:', error);
    // Rethrow the error to be handled by the caller
    throw error;
  }
}

// Get references to DOM elements in the popup
const photoInput = document.getElementById('photoInput');
const photoFeedback = document.getElementById('photoFeedback');
const photoProgress = document.getElementById('photoProgress');
const savePhotosButton = document.getElementById('savePhotosButton');
const scanToggleButton = document.getElementById('scanToggleButton');
const scanStatusText = document.getElementById('scanStatusText');
const autoScrollToggle = document.getElementById('autoScrollToggle');

// State variable to track if scanning is active
let isScanning = false;

// Persist auto-scroll toggle state
if (autoScrollToggle) {
  autoScrollToggle.addEventListener('change', async () => {
    await chrome.storage.local.set({ autoScrollEnabled: autoScrollToggle.checked });
  });
}

// Add click event listener to the "Process & Save Face Data" button
savePhotosButton.addEventListener('click', async () => {
  try {
    // Get the selected files from the file input
    const files = photoInput.files;
    // If no files selected, show feedback and exit
    if (!files || files.length === 0) {
      photoFeedback.textContent = 'Please select 2–3 clear photos.';
      return;
    }
    
    // Show loading feedback and progress bar
    photoFeedback.textContent = 'Loading models...';
    photoProgress.style.display = 'block';
    photoProgress.value = 0;
    
    // Initialize Human.js and warm up the models
    await initHuman();
    await human.warmup();
    
    // Array to hold face embeddings for each photo
    const embeddings = [];
    // Loop through each selected file
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      // Create an Image element for the file
      const img = new Image();
      img.src = URL.createObjectURL(file);
      
      // Wait for the image to load
      await new Promise((resolve) => {
        if (img.complete) resolve();
        else img.onload = resolve;
      });
      
      // Run face detection on the image
      const result = await human.detect(img);
      // If a face is detected and has an embedding
      if (result.face.length > 0 && result.face[0].embedding) {
        // Store the embedding as an array
        embeddings.push(Array.from(result.face[0].embedding));
        // Show feedback for this photo
        photoFeedback.textContent += `\nFace detected in ${file.name}`;
      } else {
        // Show feedback if no face detected
        photoFeedback.textContent += `\nNo face detected in ${file.name}`;
      }
      // Update progress bar
      photoProgress.value = ((i + 1) / files.length) * 100;
    }
    
    // If at least one embedding was found, save to storage
    if (embeddings.length > 0) {
      await chrome.storage.local.set({ userEmbeddings: embeddings });
      photoFeedback.textContent += '\nFace data stored! Now visit OkCupid to start scanning.';
    } else {
      // If no valid faces found, show feedback
      photoFeedback.textContent += '\nNo valid faces found. Please try again.';
    }
  } catch (error) {
    // Log and show any errors during processing
    console.error('Error processing photos:', error);
    photoFeedback.textContent = 'Error processing photos. Please try again.';
  } finally {
    // Hide the progress bar when done
    photoProgress.style.display = 'none';
  }
});

// Add click event listener to the scan toggle button
scanToggleButton.addEventListener('click', async () => {
  try {
    // Toggle the scanning state
    isScanning = !isScanning;
    // Update the button text and style
    scanToggleButton.textContent = isScanning ? 'Stop Scanning' : 'Start Scanning';
    scanToggleButton.classList.toggle('stop', isScanning);
    // Update the status text
    scanStatusText.textContent = isScanning ? 'Scanning is active.' : 'Scanning is stopped.';
    
    // Save the scanning state to storage
    await chrome.storage.local.set({ isScanning });
    
    // Get the current active tab
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    // Get the URL of the active tab
    const url = tabs[0]?.url;
    // If not on okcupid.com, show error and exit
    if (!url || !url.includes('okcupid.com')) {
      scanStatusText.textContent = 'This page is not supported. Please open okcupid.com.';
      return;
    }
    // If the tab has an ID, send a message to the content script
    if (tabs[0]?.id) {
      try {
        // Always read the current value from the checkbox
        const autoScroll = autoScrollToggle ? autoScrollToggle.checked : true;
        const response = await chrome.tabs.sendMessage(
          tabs[0].id,
          isScanning
            ? { action: 'startScan', autoScroll }
            : { action: 'stopScan' }
        );
        
        // Update the status text based on the response
        if (response && response.success) {
          scanStatusText.textContent = response.message;
        } else {
          scanStatusText.textContent = 'Error: ' + (response?.message || 'Unknown error');
        }
      } catch (error) {
        // Log and show error if content script is not found
        console.error('Error sending message to content script:', error);
        scanStatusText.textContent = 'Error: Content script not found. Please refresh the page and try again.';
        // Revert the toggle state
        isScanning = !isScanning;
        scanToggleButton.textContent = isScanning ? 'Stop Scanning' : 'Start Scanning';
        scanToggleButton.classList.toggle('stop', isScanning);
      }
    } else {
      // If no active tab found, show error
      scanStatusText.textContent = 'Error: No active tab found.';
    }
  } catch (error) {
    // Log and show any errors toggling scan
    console.error('Error toggling scan:', error);
    scanStatusText.textContent = 'Error toggling scan. Please try again.';
  }
});

// Initialize popup when DOM is ready
// Add event listener for DOMContentLoaded
document.addEventListener('DOMContentLoaded', async () => {
  try {
    // Check current scan status from storage
    const result = await chrome.storage.local.get(['isScanning', 'autoScrollEnabled']);
    isScanning = result.isScanning || false;
    
    // Update UI to reflect current state
    scanToggleButton.textContent = isScanning ? 'Stop Scanning' : 'Start Scanning';
    scanToggleButton.classList.toggle('stop', isScanning);
    scanStatusText.textContent = isScanning ? 'Scanning is active.' : 'Scanning is stopped.';
    // Restore auto-scroll toggle state
    if (autoScrollToggle) {
      autoScrollToggle.checked = result.autoScrollEnabled !== undefined ? result.autoScrollEnabled : true;
    }

    // Check if we have stored embeddings
    const embeddingsResult = await chrome.storage.local.get(['userEmbeddings']);
    if (embeddingsResult.userEmbeddings) {
      photoFeedback.textContent = `Face data loaded (${embeddingsResult.userEmbeddings.length} photos). Ready to scan.`;
    }
  } catch (error) {
    // Log and show any errors initializing popup
    console.error('Error initializing popup:', error);
  }
}); 

document.getElementById('saveEmail').addEventListener('click', async () => {
  const email = document.getElementById('userEmail').value.trim();
  if (email && email.includes('@')) {
    await chrome.storage.local.set({ alertEmail: email });
    document.getElementById('saveStatus').textContent = '✅ Email saved!';
  } else {
    document.getElementById('saveStatus').textContent = '❌ Enter a valid email.';
  }
});

// Pre-fill if already saved
chrome.storage.local.get('alertEmail', ({ alertEmail }) => {
  if (alertEmail) {
    document.getElementById('userEmail').value = alertEmail;
  }
}); 