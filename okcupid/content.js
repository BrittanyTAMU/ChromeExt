// Log to the console that the content script has loaded and show the current page URL
console.log('[Familiar] Content script loaded on:', window.location.href);
// Human.js-powered Familiar Content Script - OkCupid Edition
// TODO: Update selectors below for OkCupid's DOM structure

// Declare a variable to hold the Human.js class after import
let Human;
// Declare a variable to hold the Human.js instance for face detection
let human;

// Dynamically import and initialize Human.js
(async () => {
  // Start a try/catch block to handle errors during initialization
  try {
    // Import the Human.js module from the extension's local files using Chrome's runtime API
    const module = await import(chrome.runtime.getURL('human.esm.js'));
    // Assign the default export (the Human class) to the Human variable
    Human = module.default;

    // Create a new Human instance with only face detection enabled
    human = new Human({
      modelBasePath: 'https://vladmandic.github.io/human/models', // Where to load models from
      backend: 'cpu', // Force CPU backend to avoid WebGL issues
      face: { enabled: true, detector: { enabled: true }, mesh: { enabled: false }, description: { enabled: true } }, // Enable face detection only
      hand: { enabled: false }, // Disable hand tracking
      body: { enabled: false }, // Disable body tracking
      gesture: { enabled: false }, // Disable gesture detection
      object: { enabled: false } // Disable object detection
    });
    
    // Log to the console that Human.js was initialized successfully
    console.log('Human.js initialized successfully');
  } catch (error) {
    // Log any errors that occur during initialization
    console.error('Failed to initialize Human.js:', error);
  }
})();

// State variable to track if a scan is currently in progress
let isScanning = false; // Whether a scan is in progress
// State variable to track if auto-scroll/auto-scan is active
let autoScrollActive = false; // Whether auto-scroll/auto-scan is active
// State variable for a timeout (not used in all workflows)
let autoScrollTimeout = null; // Timeout for auto-scroll
// State variable to count how many profiles have been swiped
let swipeCount = 0; // How many profiles have been swiped
// Constant for the maximum number of profiles to scan in one session
const maxSwipes = 25; // Maximum number of profiles to scan in one session

// Utility function: Sleep for a given number of milliseconds
function sleep(ms) {
  // Return a Promise that resolves after ms milliseconds
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Utility function: Get a random number between min and max
function randomBetween(min, max) {
  // Return a random float between min and max
  return Math.random() * (max - min) + min;
}

// Utility function: Calculate cosine similarity between two vectors (face embeddings)
function cosineSimilarity(a, b) {
  // Initialize dot product and norms
  let dot = 0, normA = 0, normB = 0;
  // Loop through each element of the vectors
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]; // Add to dot product
    normA += a[i] * a[i]; // Add to normA
    normB += b[i] * b[i]; // Add to normB
  }
  // Return the cosine similarity score between 0 and 1
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

// Utility function: Simulate a mouse move event at (x, y) on the page
function simulateMouseMove(x, y) {
  // Create a new MouseEvent for 'mousemove' at the given coordinates
  const evt = new MouseEvent('mousemove', {
    clientX: x, // X coordinate
    clientY: y, // Y coordinate
    bubbles: true, // Event bubbles up the DOM
    cancelable: true, // Event can be canceled
    view: window // The window object
  });
  // Dispatch the event on the document
  document.dispatchEvent(evt);
}

// OkCupid swipe button selectors
// Click the "Pass" (left swipe) button
function swipeLeft() {
  // Find the pass button using its data-cy attribute
  const btn = document.querySelector('button[data-cy="discover.actionButtonPass"]');
  // If the button exists, click it and return true
  if (btn) {
    btn.click();
    return true;
  }
  // If not found, return false
  return false;
}

// Click the "Like" (right swipe) button
function swipeRight() {
  // Find the like button using its data-cy attribute
  const btn = document.querySelector('button[data-cy="discover.actionButtonLike"]');
  // If the button exists, click it and return true
  if (btn) {
    btn.click();
    return true;
  }
  // If not found, return false
  return false;
}

// Click through all photos on the current profile (simulate user viewing all images)
async function clickThroughAllPhotos(maxPhotos = 5, delay = 1200) {
  // Loop up to maxPhotos times
  for (let i = 0; i < maxPhotos; i++) {
    // Find the "next photo" button
    const nextBtn = document.querySelector('button.sliding-pagination-button.next');
    // If no next button or it's disabled, stop
    if (!nextBtn || nextBtn.disabled) break;
    // Click the next photo button
    nextBtn.click();
    // Wait for the new image to render
    await sleep(delay); // Wait for new image to render
  }
}

// Wait for the next profile's images to load after a swipe
async function waitForNextProfileImage(prevImages, timeout = 5000) {
  // Record the start time
  const start = Date.now();
  // Loop until timeout
  while (Date.now() - start < timeout) {
    // Get all current profile images
    const currentImages = Array.from(document.querySelectorAll('.preloaded-image-content[aria-label="photo of them"]'))
      .map(div => div.style.backgroundImage);
    // If any new image is present, return true
    if (currentImages.some(img => !prevImages.includes(img))) return true;
    // Wait a bit before checking again
    await sleep(300);
  }
  // Timed out waiting for new profile
  return false;
}

// Scan all visible and navigated photos for a match
async function scanCurrentProfile() {
  // If Human.js is not ready, abort
  if (!human) {
    console.log('Human.js not yet initialized');
    return { match: false };
  }

  // Step through all photos first
  await clickThroughAllPhotos();

  // Get all image divs with a background image
  const imageDivs = Array.from(document.querySelectorAll('.preloaded-image-content[aria-label="photo of them"][style*="background-image"]'));
  // Create a Set to keep track of already scanned images
  const scannedImages = new Set();

  // Loop through each image div
  for (const div of imageDivs) {
    // Extract the image URL from the background-image style
    const style = div.style.backgroundImage;
    const match = style.match(/url\(["']?(.*?)["']?\)/);
    // If no URL found, skip this div
    if (!match) continue;
    const imageUrl = match[1];

    // Skip if we've already scanned this image
    if (scannedImages.has(imageUrl)) continue;
    scannedImages.add(imageUrl);

    // Debug log to show which image is being scanned
    console.log('📸 Scanning image:', imageUrl);

    // Create an Image element and set its src
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = imageUrl;

    // Wait for the image to load (handle both cached and new loads)
    await new Promise(resolve => {
      if (img.complete) resolve();
      else img.onload = resolve;
      img.onerror = resolve;
    });

    try {
      // Run face detection on the image using Human.js
      const result = await human.detect(img);
      // Log the face detection results
      console.log('[Familiar] Human.js face results:', result.face);
      // If a face is detected and has an embedding
      if (result.face.length > 0 && result.face[0].embedding) {
        // Get the face embedding from the detection result
        const domEmbedding = Array.from(result.face[0].embedding);
        // Load user embeddings from storage
        const { userEmbeddings = [] } = await chrome.storage.local.get(['userEmbeddings']);

        // Compare the detected embedding to each user embedding
        for (const userEmb of userEmbeddings) {
          // Calculate similarity score
          const sim = cosineSimilarity(domEmbedding, userEmb);
          // Log the similarity score for debugging
          console.log('[Familiar] Similarity score:', sim); // Debug log
          // If similarity is above threshold, return a match
          if (sim > 0.70) { // Lowered threshold
            return { match: true, image: img, similarity: sim };
          }
        }
      }
    } catch (err) {
      // Log any errors during face detection
      console.error('Error during face detection:', err);
    }
  }

  // No match found after scanning all images
  return { match: false };
}

// Try to send an email alert using EmailJS
async function sendEmailAlert(message) {
  const { alertEmail } = await chrome.storage.local.get('alertEmail');
  if (!alertEmail) {
    console.log('❌ No email found for alerts.');
    return;
  }
  const now = new Date().toLocaleString();
  const msg = message || `A match was found on OkCupid at ${now}!`;

  chrome.runtime.sendMessage(
    {
      action: 'sendEmailAlert',
      alertEmail,
      message: msg
    },
    (response) => {
      if (response && response.success) {
        console.log('📧 Email alert sent to', alertEmail);
      } else {
        console.log('❌ Email alert failed:', response && response.error);
  }
    }
  );
}

// Show a confirmation dialog to the user when a potential match is found
function showMatchConfirmationDialog() {
  // Return a Promise that resolves when the user clicks a button
  return new Promise((resolve) => {
    // Create a dialog element
    const dialog = document.createElement('div');
    // Style the dialog for top-left positioning and appearance
    dialog.style.cssText = `
      position: fixed;
      top: 20px;
      left: 20px;
      background: white;
      padding: 20px;
      border-radius: 10px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.3);
      z-index: 100000;
      text-align: center;
      font-family: Arial, sans-serif;
      min-width: 250px;
      max-width: 300px;
    `;
    
    // Set the dialog's HTML content (heading, text, and two buttons)
    dialog.innerHTML = `
      <h3 style="margin: 0 0 15px 0; color: #333; font-size: 16px;">Potential Match Found!</h3>
      <p style="margin: 0 0 20px 0; color: #666; font-size: 14px;">Is this the person you're looking for?</p>
      <div style="display: flex; gap: 10px; justify-content: center;">
        <button id="confirmYes" style="
          padding: 8px 16px;
          background: #4ade80;
          color: white;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-weight: bold;
          font-size: 12px;
        ">Yes, This is a Match</button>
        <button id="confirmNo" style="
          padding: 8px 16px;
          background: #ef4444;
          color: white;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-weight: bold;
          font-size: 12px;
        ">No, Continue Scanning</button>
      </div>
    `;
    
    // Add the dialog to the page
    document.body.appendChild(dialog);
    
    // Handle the "Yes" button click
    dialog.querySelector('#confirmYes').addEventListener('click', () => {
      document.body.removeChild(dialog);
      resolve(true);
    });
    
    // Handle the "No" button click
    dialog.querySelector('#confirmNo').addEventListener('click', () => {
      document.body.removeChild(dialog);
      resolve(false);
    });
  });
}

let profileObserver = null;
let lastProfileId = null;

function startProfileObserver() {
  stopProfileObserver();

  const card = document.querySelector('[data-cy="discover.userCard"]');
  if (!card) {
    console.warn('[Observer] Could not find user card');
    return;
  }

  lastProfileId = card.getAttribute('data-user-id');
  console.log('[Observer] Initial profile ID:', lastProfileId);

  profileObserver = new MutationObserver(() => {
    const updatedCard = document.querySelector('[data-cy="discover.userCard"]');
    if (!updatedCard) return;

    const newProfileId = updatedCard.getAttribute('data-user-id');

    if (newProfileId && newProfileId !== lastProfileId) {
      console.log('[Observer] Profile changed:', lastProfileId, '→', newProfileId);
      lastProfileId = newProfileId;

      if (isScanning && !autoScrollActive) {
        handleManualProfileScan();
      }
    }
  });

  profileObserver.observe(card, {
    attributes: true,                   // 👈 Watch for attribute changes
    attributeFilter: ['data-user-id'], // 👈 Only care about this one
  });

  console.log('[Observer] Watching userCard for data-user-id changes...');
}

function stopProfileObserver() {
  if (profileObserver) {
    profileObserver.disconnect();
    profileObserver = null;
  }
}

async function handleManualProfileScan() {
  const result = await scanCurrentProfile();

  if (result.match) {
    highlightImage(result.image);
    showNotification('Match found!');
    await sendEmailAlert('Match found on OkCupid!');
    const confirmed = await showMatchConfirmationDialog();
    if (confirmed) {
      isScanning = false;
      stopProfileObserver();
      showNotification('Match confirmed! Scanning stopped.');
      return;
    } else {
      showNotification('No match confirmed. Awaiting next profile...');
    }
  } else {
    showNotification('No match on this profile. Awaiting next profile...');
  }
}

async function startInitialScanOnly() {
  if (!human) {
    showNotification('Human.js not yet initialized.');
    return;
  }

  await human.load();
  await human.warmup();

  const { userEmbeddings = [] } = await chrome.storage.local.get(['userEmbeddings']);
  if (!userEmbeddings.length) {
    showNotification('No face data found. Please upload photos.');
    return;
  }

  showNotification('Scanning current profile...');
  startProfileObserver(); // Begin watching for manual profile changes

  isScanning = true; // 🔄 Keep scanning active across manual swipes

  await handleManualProfileScan(); // First scan
}


// // Start the initial scan of the first profile, then auto-scroll if no match is found
// async function startInitialScanThenAutoscroll() {
//   // If Human.js is not ready, abort
//   if (!human) {
//     showNotification('Human.js not yet initialized.');
//     return;
//   }

//   // Load and warm up the Human.js models
//   await human.load();
//   await human.warmup();

//   // Load user face embeddings from storage
//   const { userEmbeddings = [] } = await chrome.storage.local.get(['userEmbeddings']);
//   // If no embeddings found, notify user and abort
//   if (!userEmbeddings.length) {
//     showNotification('No face data found. Please upload photos.');
//     return;
//   }

//   // Notify the user that scanning is starting
//   showNotification('Scanning initial profile for match...');

//   // Scan the first profile for up to 30 seconds
//   const timeoutMs = 30000; // 30 seconds
//   const checkInterval = 2000;
//   const start = Date.now();

//   // Loop for up to 30 seconds, scanning the current profile for a match
//   while (Date.now() - start < timeoutMs) {
//     // Scan the current profile for a match
//     const result = await scanCurrentProfile();
//     // If a match is found, highlight the image and notify the user
//     if (result.match) {
//       // If a match is found, highlight the image and notify the user
//       highlightImage(result.image);
//       showNotification('Match found on first profile!');
//       await sendEmailAlert('Match found on first profile!');
//       // Ask the user to confirm if this is the person they're looking for
//       const confirmed = await showMatchConfirmationDialog();
//       if (confirmed) return;
//       // If not confirmed, break and start auto-scroll
//       break;
//     }
//     // Wait before scanning again
//     await sleep(checkInterval);
//     }
    
//   // If no match found, start auto-scroll scanning
//   showNotification('No match found. Starting auto-scan...');
//   autoScrollAndScan();
// }

// Highlight a matched image with a green outline and shadow
function highlightImage(img) {
  // Set a green outline on the image
  img.style.outline = '4px solid #4ade80';
  // Add a green box shadow for extra emphasis
  img.style.boxShadow = '0 0 16px 4px #4ade80';
}

// Show a notification message in the top-right corner of the page
function showNotification(message) {
  // Create a new div for the notification
  const notification = document.createElement('div');
  // Set the notification text
  notification.textContent = message;
  // Style the notification for visibility and appearance
  notification.style.position = 'fixed';
  notification.style.top = '20px';
  notification.style.right = '20px';
  notification.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
  notification.style.color = 'white';
  notification.style.padding = '15px 20px';
  notification.style.borderRadius = '10px';
  notification.style.boxShadow = '0 4px 20px rgba(0,0,0,0.3)';
  notification.style.zIndex = 99999;
  // Add the notification to the page
  document.body.appendChild(notification);
  // Remove the notification after 4 seconds
  setTimeout(() => notification.remove(), 4000);
}

// Main auto-scroll and scan loop
async function autoScrollAndScan() {
  // Abort if Human.js is not ready
  if (!human) {
    showNotification('Human.js not yet initialized. Please wait...');
    return;
  }
  
  // Set the auto-scroll flag to true
  autoScrollActive = true;
  // Track if a match is found
  let matchFound = false;

  // Load and warm up Human.js models
  await human.load();
  await human.warmup();

  // Load user embeddings
  const { userEmbeddings = [] } = await chrome.storage.local.get(['userEmbeddings']);
  // If no embeddings, notify user and abort
  if (!userEmbeddings.length) {
    showNotification('No face data found. Please upload photos in the extension popup.');
    return;
  }

  // Loop through profiles, scanning each one
  while (autoScrollActive && swipeCount < maxSwipes && !matchFound) {
    // Store current images before swipe
    const prevImages = Array.from(document.querySelectorAll('.preloaded-image-content[aria-label="photo of them"]'))
      .map(div => div.style.backgroundImage);

    // Scan current profile
    const scanResult = await scanCurrentProfile();
    if (scanResult.match) {
      // If a match is found, highlight and notify
      highlightImage(scanResult.image);
      showNotification('Potential match found! Please confirm.');
      await sendEmailAlert('A potential match was found on OkCupid!');
      autoScrollActive = false;
      // Ask the user to confirm
      const isConfirmed = await showMatchConfirmationDialog();
      if (isConfirmed) {
        showNotification('Match confirmed! You can now interact with this profile.');
        matchFound = true;
        break;
      } else {
        showNotification('Continuing scan...');
        autoScrollActive = true;
        scanResult.image.style.outline = '';
        scanResult.image.style.boxShadow = '';
      }
    }
    
    // Increment the swipe count
    swipeCount++;
    
    // Randomly choose swipe direction (mostly left for efficiency)
    const doLeft = Math.random() < 0.8;
    const swipeSuccess = doLeft ? swipeLeft() : swipeRight();
    
    // If swipe fails, notify user and stop
    if (!swipeSuccess) {
      showNotification('Could not find swipe buttons. Please navigate manually.');
      break;
    }

    // Wait for next profile to load
    await waitForNextProfileImage(prevImages);
    
    // Human-like delay between swipes
    await sleep(randomBetween(1000, 3000));
    
    // Occasionally pause like reading
    if (swipeCount % 5 === 0) {
      await sleep(randomBetween(2000, 4000));
    }
    
    // Simulate mouse movement
    if (Math.random() < 0.3) {
      simulateMouseMove(
        Math.floor(Math.random() * window.innerWidth),
        Math.floor(Math.random() * window.innerHeight)
      );
    }
  }
  
  // Mark auto-scroll as inactive
  autoScrollActive = false;
  
  // If no match was found after all swipes, notify the user
  if (!matchFound) {
    const message = `Scan completed! No match found after ${swipeCount} profiles. Rescan if you have premium access on OkCupid.`;
    await sendEmailAlert(message);
    showNotification(message);
  }
}

// Listen for messages from popup (start/stop scan)
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  // If the popup requests to start scanning
  if (msg.action === 'startScan') {
    // Only start if not already scanning
    if (!isScanning) {
      isScanning = true; // Set scanning flag
      swipeCount = 0;    // Reset swipe counter
      if (msg.autoScroll === false) {
        showNotification('Scanning first profile only (no auto-scroll)...');
        startInitialScanOnly(); // Create a separate function
      } else {
        stopProfileObserver(); // Stop observer if switching to auto-scroll
        autoScrollAndScan(); // Default behavior
      }
  
      sendResponse({ success: true, message: 'Scan started' });
    } else {
      sendResponse({ success: false, message: 'Already scanning' });
    }
  // If the popup requests to stop scanning
  } else if (msg.action === 'stopScan') {
    isScanning = false;         // Clear scanning flag
    autoScrollActive = false;   // Stop auto-scroll
    stopProfileObserver();      // Stop observing profile changes
    showNotification('Scanning stopped.'); // Notify the user
    sendResponse({ success: true, message: 'Scanning stopped' });
  } else {
    // Handle unknown actions
    sendResponse({ success: false, message: 'Unknown action' });
  }
  return true; // Indicate async response is possible
}); 