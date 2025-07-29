// Familiar Popup Controller
// Handles UI interactions and communicates with background service
//This popup:

//Lets you upload photos of a person

//Uses AI to scan faces in those photos

//Saves those faceprints

//Lets you toggle scanning on/off

//Sends the scan command to Tinder if you're on the site





// Loads the Human.js face detection library and creates an instance of it.
import Human from './human.esm.js';

// Creates a variable to store the Human.js instance. this will hold the face detection model.
let human = null;

// Initialize Human.js. if Human is already set up, just return it.
async function initHuman() {
  if (human) return human;
  
  //Otherwise, create a new Human instance with specific features:
  try {
    human = new Human({
      //Use models from this online path and force it to run on CPU (not GPU) for reliability.
      modelBasePath: 'https://vladmandic.github.io/human/models',
      backend: 'cpu', // Force CPU backend to avoid WebGL issues
      //Turn on face detection and face description (used to create a "faceprint").
      face: { 
        enabled: true, 
        detector: { enabled: true }, 
        mesh: { enabled: false }, 
        description: { enabled: true } 
      },
      // Disable problematic features. Turn off everything else to keep it fast and focused.
      hand: { enabled: false },
      body: { enabled: false },
      gesture: { enabled: false },
      object: { enabled: false }
    });
    //Load the model and handle errors if something goes wrong.
    await human.load();
    return human;
  } catch (error) {
    console.error('Error initializing Human:', error);
    throw error;
  }
}

//These are the buttons, text areas, and progress bar in the popup interface.
//photoInput: where the user selects their photos.
//photoFeedback: shows feedback about the photos.
//photoProgress: shows the progress of the face detection.
//savePhotosButton: saves the photos to the extension's storage.
//scanToggleButton: starts and stops the scanning process.
//scanStatusText: shows the current status of the scanning process.

const photoInput = document.getElementById('photoInput');
const photoFeedback = document.getElementById('photoFeedback');
const photoProgress = document.getElementById('photoProgress');
const savePhotosButton = document.getElementById('savePhotosButton');
const scanToggleButton = document.getElementById('scanToggleButton');
const scanStatusText = document.getElementById('scanStatusText');

//Keeps track of whether we are currently scanning.
let isScanning = false;

// When the "Save Photos" button is clicked…
savePhotosButton.addEventListener('click', async () => {
  //Check that the user selected some photos. If not, ask them to.
  try {
    const files = photoInput.files;
    if (!files || files.length === 0) {
      photoFeedback.textContent = 'Please select 2–3 clear photos.';
      return;
    }
    
    //Let the user know it’s working, and show a progress bar.
    photoFeedback.textContent = 'Loading models...';
    photoProgress.style.display = 'block';
    photoProgress.value = 0;
    
    // Initialize Human.js. Start the Human model and get it ready to analyze photos.
    await initHuman();
    await human.warmup();
    
    //Create an empty array to store the face embeddings.
    const embeddings = [];

    //Load the photo into a temporary image object.
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const img = new Image();
      img.src = URL.createObjectURL(file);
      
      //Wait for the image to fully load.
      await new Promise((resolve) => {
        if (img.complete) resolve();
        else img.onload = resolve;
      });
      
      // Run face detection on the image.
      const result = await human.detect(img);
      //If a face is found, save the "faceprint" (embedding). If not, show a warning.
      if (result.face.length > 0 && result.face[0].embedding) {
        embeddings.push(Array.from(result.face[0].embedding));
        photoFeedback.textContent += `\nFace detected in ${file.name}`;
      } else {
        photoFeedback.textContent += `\nNo face detected in ${file.name}`;
      }
      //Update the progress bar after each photo.
      photoProgress.value = ((i + 1) / files.length) * 100;
    }
    
    //if we detected faces, save them in storage. If not, show an error.
    if (embeddings.length > 0) {
      await chrome.storage.local.set({ userEmbeddings: embeddings });
      photoFeedback.textContent += '\nFace data stored! Now visit Tinder to start scanning.';
    } else {
      photoFeedback.textContent += '\nNo valid faces found. Please try again.';
    }
    //Handle any errors and hide the progress bar afterward.
  } catch (error) {
    console.error('Error processing photos:', error);
    photoFeedback.textContent = 'Error processing photos. Please try again.';
  } finally {
    photoProgress.style.display = 'none';
  }
});

// When the "Start/Stop Scanning" button is clicked…
scanToggleButton.addEventListener('click', async () => {
  //Toggle the scanning state.
  try {
    // Update the button text and status label in the UI.
    isScanning = !isScanning;
    scanToggleButton.textContent = isScanning ? 'Stop Scanning' : 'Start Scanning';
    scanToggleButton.classList.toggle('stop', isScanning);
    scanStatusText.textContent = isScanning ? 'Scanning is active.' : 'Scanning is stopped.';
    
    //Save the new scanning state to Chrome’s storage.
    await chrome.storage.local.set({ isScanning });
    
    // Get the current active tab
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const url = tabs[0]?.url;
    if (!url || !url.includes('tinder.com')) {
      scanStatusText.textContent = 'This page is not supported. Please open tinder.com.';
      return;
    }
    // Tell the content script to start or stop scanning.
    if (tabs[0]?.id) {
      try {
        // Send message to content script
        const response = await chrome.tabs.sendMessage(tabs[0].id, { 
          action: isScanning ? 'startScan' : 'stopScan' 
        });
        
        // Update the status message based on response.
        if (response && response.success) {
          scanStatusText.textContent = response.message;
        } else {
          scanStatusText.textContent = 'Error: ' + (response?.message || 'Unknown error');
        }

        // If the message fails (like script didn’t load), show an error and undo the toggle.
      } catch (error) {
        console.error('Error sending message to content script:', error);
        scanStatusText.textContent = 'Error: Content script not found. Please refresh the page and try again.';
        // Revert the toggle state
        isScanning = !isScanning;
        scanToggleButton.textContent = isScanning ? 'Stop Scanning' : 'Start Scanning';
        scanToggleButton.classList.toggle('stop', isScanning);
      }
      // Catch any unexpected errors and show a generic failure message.
    } else {
      scanStatusText.textContent = 'Error: No active tab found.';
    }
  } catch (error) {
    console.error('Error toggling scan:', error);
    scanStatusText.textContent = 'Error toggling scan. Please try again.';
  }
});

// Initialize popup when DOM is ready, when it first loads.
document.addEventListener('DOMContentLoaded', function() {
  const scanToggleButton = document.getElementById('scanToggleButton');
  const autoScrollToggle = document.getElementById('autoScrollToggle');
  const userEmail = document.getElementById('userEmail');
  const saveEmail = document.getElementById('saveEmail');
  const saveStatus = document.getElementById('saveStatus');
  const errorMessage = document.getElementById('errorMessage');
  const successMessage = document.getElementById('successMessage');

  // Load saved auto-scroll preference
  chrome.storage.local.get('autoScrollEnabled', ({ autoScrollEnabled }) => {
    if (autoScrollEnabled !== undefined) {
      autoScrollToggle.checked = autoScrollEnabled;
    }
  });

  // Save auto-scroll preference when changed
  autoScrollToggle.addEventListener('change', () => {
    chrome.storage.local.set({ autoScrollEnabled: autoScrollToggle.checked });
  });

  // Load saved email
  chrome.storage.local.get('alertEmail', ({ alertEmail }) => {
    if (alertEmail) {
      userEmail.value = alertEmail;
    }
  });

  // Save email when button is clicked
  saveEmail.addEventListener('click', async () => {
    const email = userEmail.value.trim();
    if (email && email.includes('@')) {
      await chrome.storage.local.set({ alertEmail: email });
      saveStatus.textContent = '✅ Email saved!';
      setTimeout(() => {
        saveStatus.textContent = '';
      }, 3000);
    } else {
      saveStatus.textContent = '❌ Enter a valid email.';
      setTimeout(() => {
        saveStatus.textContent = '';
      }, 3000);
    }
  });

  scanToggleButton.addEventListener('click', () => {
    const autoScroll = autoScrollToggle.checked;
    
    chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
      chrome.tabs.sendMessage(tabs[0].id, { 
        action: 'startScan', 
        autoScroll 
      }, response => {
        if (response && response.success) {
          showStatus('Scan started successfully!', 'success');
          scanToggleButton.textContent = 'Stop Scan';
          scanToggleButton.classList.add('stop');
        } else {
          showStatus(response ? response.message : 'Failed to start scan', 'error');
        }
      });
    });
  });

  function showStatus(message, type) {
    // Hide both messages first
    errorMessage.classList.add('hidden');
    successMessage.classList.add('hidden');
    
    if (type === 'success') {
      successMessage.textContent = message;
      successMessage.classList.remove('hidden');
    } else {
      errorMessage.textContent = message;
      errorMessage.classList.remove('hidden');
    }
    
    setTimeout(() => {
      errorMessage.classList.add('hidden');
      successMessage.classList.add('hidden');
    }, 3000);
  }
}); 