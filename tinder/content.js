//The extension loads Human.js for face recognition.

//It scans Tinder profiles by clicking through their photos.

//It compares faces against stored ones from the extension popup.

//It automatically swipes through profiles, scans, and alerts you if a match is found.

//It mimics human behavior to avoid detection as a bot.


// Updated Tinder Content Script based on OkCupid logic
// Familiar Tinder Edition (refactored)
//Logs the fact that this script is running on a Tinder page.
console.log('[Familiar] Content script loaded on:', window.location.href);

//Prepares two variables: one to load the Human.js face detection library, and one to create an instance of it.
let Human;
let human;

//Loads the Human.js face detection library and creates an instance of it.
(async () => {
  try {
    const module = await import(chrome.runtime.getURL('human.esm.js'));
    //Assigns the default export (main class)  of the Human.js module to the Human variable.
    Human = module.default;

    //Initializes Human.js, telling it to only detect faces (not hands, body, etc.). It will download face detection models from a public GitHub URL.
    human = new Human({
      modelBasePath: 'https://vladmandic.github.io/human/models',
      backend: 'cpu',
      face: { enabled: true, detector: { enabled: true }, mesh: { enabled: false }, description: { enabled: true } },
      hand: { enabled: false },
      body: { enabled: false },
      gesture: { enabled: false },
      object: { enabled: false }
    });
//Logs the fact that Human.js was initialized successfully.
    console.log('Human.js initialized successfully');
  } catch (error) {
    console.error('Failed to initialize Human.js:', error);
  }
})();

// State variable to track if a scan is currently in progress
let isScanning = false;
// State variable to track if auto-scroll/auto-scan is active
let autoScrollActive = false;
// State variable for a timeout (not used in all workflows)
let autoScrollTimeout = null;
// State variable to count how many profiles have been swiped
let swipeCount = 0;
// Constant for the maximum number of profiles to scan in one session
const maxSwipes = 25;

// Profile observer variables for manual scanning
let profileObserver = null;
let lastProfileId = null;
// Flag to prevent multiple simultaneous manual scans
let isManualScanning = false;

//A function that pauses the script for a given number of milliseconds.
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Compares two face “fingerprints” (embeddings) to see how similar they are. Used to decide if the detected face matches the saved one.
function cosineSimilarity(a, b) {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

//Simulates clicking Tinder’s “Nope” (left) or “Like” (right) button by finding and clicking it in the webpage.
function swipeLeft() {
  const btns = Array.from(document.querySelectorAll('button'));
  const btn = btns.find(b => {
    const hidden = b.querySelector('span.Hidden');
    return hidden && hidden.textContent.trim().toLowerCase() === 'nope';
  });
  if (btn) {
    btn.click();
    return true;
  }
  return false;
}

//Simulates clicking Tinder’s “Nope” (left) or “Like” (right) button by finding and clicking it in the webpage.
function swipeRight() {
  const btns = Array.from(document.querySelectorAll('button'));
  const btn = btns.find(b => {
    const hidden = b.querySelector('span.Hidden');
    return hidden && hidden.textContent.trim().toLowerCase() === 'like';
  });
  if (btn) {
    btn.click();
    return true;
  }
  return false;
}

// Automatically clicks through all the profile’s photos (up to 5), giving the face scanner more angles to detect a match.
async function clickThroughAllPhotos(maxPhotos = 5, delay = 1200) {
  for (let i = 0; i < maxPhotos; i++) {
    const nextBtn = document.querySelector('button[aria-label="Next Photo"]');
    if (!nextBtn || nextBtn.disabled) break;
    // Highlight the button to show interaction
    nextBtn.style.boxShadow = '0 0 10px 3px #4ade80';
    nextBtn.style.transition = 'box-shadow 0.2s';
    nextBtn.click();
    await sleep(200); // Short highlight
    nextBtn.style.boxShadow = '';
    await sleep(delay); // Wait for new image to render
  }
}

//Waits for the next profile image to load, checking every 5 seconds.
async function waitForNextProfileImage(prevImages, timeout = 5000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const currentImages = Array.from(document.querySelectorAll('div.Bdrs\\(8px\\).Bgz\\(cv\\).Bgp\\(c\\)[style*="background-image"]'))
      .map(div => getComputedStyle(div).backgroundImage);
    if (currentImages.some(img => !prevImages.includes(img))) return true;
    await sleep(300);
  }
  return false;
}

// Wait for a new profile to load by detecting DOM changes
async function waitForNewProfile(timeout = 8000) {
  return new Promise((resolve) => {
    const container = document.querySelector('div[data-keyboard-gamepad="true"]')?.parentElement;
    if (!container) {
      console.warn('❌ Could not find card container');
      resolve(false);
      return;
    }

    const observer = new MutationObserver(() => {
      console.log('[waitForNewProfile] DOM changed, assuming new profile.');
      observer.disconnect();
      resolve(true);
    });

    observer.observe(container, { childList: true, subtree: true });

    setTimeout(() => {
      observer.disconnect();
      console.warn('[waitForNewProfile] Timeout waiting for next profile.');
      resolve(false);
    }, timeout);
  });
}

// Updated scanCurrentProfile with robust selector and detailed debug logs
async function scanCurrentProfile() {
  // Check if Human.js is ready
  if (!human) {
    console.log('[Familiar] Human.js not yet initialized');
    return { match: false };
  }

  // Click through all photos to ensure all are loaded and visible
  await clickThroughAllPhotos();

  // Try up to 3 times to find visible images (in case they're still loading)
  let imgDivs = [];
  let attempts = 0;
  const maxAttempts = 3;
  
  while (attempts < maxAttempts) {
    attempts++;
    console.log(`[Familiar] Attempt ${attempts}/${maxAttempts} to find visible images...`);
    
    // Use updated selector for Tinder profile images and filter only visible ones
    imgDivs = Array.from(document.querySelectorAll(
      'div.Bdrs\\(8px\\).Bgz\\(cv\\).Bgp\\(c\\).StretchedBox[style*="background-image"]'
    )).filter(div => {
      // Only keep images from visible cards
      return div.closest('[data-keyboard-gamepad="true"]')?.getAttribute('aria-hidden') === 'false';
    });
    
    console.log(`[Familiar] Found ${imgDivs.length} visible image divs on attempt ${attempts}`);
    
    if (imgDivs.length > 0) {
      break; // Found images, proceed with scan
    }
    
    if (attempts < maxAttempts) {
      console.log(`[Familiar] No images found, waiting 1 second before retry...`);
      await sleep(1000);
    }
  }
  
  if (imgDivs.length === 0) {
    console.log('[Familiar] ❌ No visible images found after all attempts');
    return { match: false };
  }
  
  console.log('[Familiar] Found visible image divs:', imgDivs.length, imgDivs);
  const scannedImages = new Set();

  //For each image found, extract the image URL from the CSS background-image style.
  for (const div of imgDivs) {
    // Extract background-image style
    const bg = getComputedStyle(div).backgroundImage;
    // Extract the image URL using regex
    const match = bg.match(/url\(["']?(.*?)["']?\)/);
    if (!match) {
      console.log('[Familiar] No URL found in background-image:', bg);
      continue;
    }
    const imageUrl = match[1];
    console.log('[Familiar] Extracted image URL:', imageUrl);
    if (scannedImages.has(imageUrl)) {
      console.log('[Familiar] Already scanned image:', imageUrl);
      continue;
    }
    scannedImages.add(imageUrl);

    // Fetch the image via the background script to bypass CORS...basicallyAsks the background script to download the image for you, which bypasses CORS security restrictions.
    const dataUrl = await new Promise((resolve) => {
      chrome.runtime.sendMessage({ action: 'fetchImage', url: imageUrl }, (response) => {
        if (response?.dataUrl) {
          resolve(response.dataUrl);
        } else {
          console.error('[Familiar] Failed to fetch image via background:', response?.error);
          resolve(null);
        }
      });
    });

    if (!dataUrl) {
      console.log('[Familiar] Skipping image due to fetch failure:', imageUrl);
      continue;
    }

    // Load the image from the data URL...basically Converts the downloaded image data into an image object that can be analyzed.
    const img = new Image();
    img.src = dataUrl;
    await new Promise((resolve) => {
      if (img.complete) resolve();
      else img.onload = resolve;
      img.onerror = resolve;
    });
    console.log('[Familiar] Image loaded from dataUrl:', imageUrl);

    // Now run face detection...basically Uses Human.js to analyze the image and find the face. and generate a face embedding.
    let detection;
    try {
      console.log('[Familiar] Running face detection on:', imageUrl);
      detection = await human.detect(img);
      console.log('[Familiar] Face detection result:', detection.face);
    } catch (e) {
      console.error('[Familiar] Error during face detection:', e);
      continue;
    }

    // If a face is detected and has an embedding
    if (detection && detection.face.length > 0 && detection.face[0].embedding) {
      const embedding = Array.from(detection.face[0].embedding);
      // Load user embeddings from storage (from the extension popup/upload).
      const { userEmbeddings = [] } = await chrome.storage.local.get(['userEmbeddings']);
      if (!userEmbeddings.length) {
        console.log('[Familiar] No user embeddings found in storage');
        continue;
      }
      // Compare the detected embedding to each user embedding...If similarity is over 70%, we consider it a match.
      for (const userEmb of userEmbeddings) {
        const sim = cosineSimilarity(embedding, userEmb);
        console.log('[Familiar] Similarity score:', sim);
        if (sim > 0.7) {
          console.log('[Familiar] Match found! Similarity:', sim);
          return { match: true, image: div, similarity: sim };
        }
      }
    } else {
      console.log('[Familiar] No face embedding found for image:', imageUrl);
    }
  }
  // No match found in any image return false
  console.log('[Familiar] No match found in current profile');
  return { match: false };
}

//Shows a dialog to the user to confirm if the detected face is a match.
function showMatchConfirmationDialog() {
  return new Promise((resolve) => {
    const dialog = document.createElement('div');
    
    // Set explicit styles to ensure top-right positioning
    dialog.style.position = 'fixed';
    dialog.style.top = '20px';
    dialog.style.right = '20px';
    dialog.style.left = 'auto';
    dialog.style.bottom = 'auto';
    dialog.style.transform = 'none';
    dialog.style.width = 'auto';
    dialog.style.height = 'auto';
    dialog.style.background = 'white';
    dialog.style.padding = '20px';
    dialog.style.borderRadius = '10px';
    dialog.style.boxShadow = '0 4px 20px rgba(0,0,0,0.3)';
    dialog.style.zIndex = '100000';
    dialog.style.textAlign = 'center';
    dialog.style.fontFamily = 'Arial, sans-serif';
    dialog.style.minWidth = '250px';
    dialog.style.maxWidth = '300px';
    dialog.style.margin = '0';
    dialog.style.border = 'none';

    dialog.innerHTML = `
      <h3 style="margin: 0 0 15px 0; color: #333; font-size: 16px;">Potential Match Found!</h3>
      <p style="margin: 0 0 20px 0; color: #666; font-size: 14px;">Is this the person you're looking for?</p>
      <div style="display: flex; gap: 10px; justify-content: center;">
        <button id="confirmYes" style="padding: 8px 16px; background: #4ade80; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 12px;">Yes, This is a Match</button>
        <button id="confirmNo" style="padding: 8px 16px; background: #ef4444; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 12px;">No, Continue Scanning</button>
      </div>
    `;

    document.body.appendChild(dialog);

    dialog.querySelector('#confirmYes').addEventListener('click', () => {
      document.body.removeChild(dialog);
      resolve(true);
    });

    dialog.querySelector('#confirmNo').addEventListener('click', () => {
      document.body.removeChild(dialog);
      resolve(false);
    });
  });
}

//Highlights the image in green to show the user that it's a match.
function highlightImage(img) {
  img.style.outline = '4px solid #4ade80';
  img.style.boxShadow = '0 0 16px 4px #4ade80';
}

//Shows a notification to the user. like a toast.
function showNotification(msg) {
  console.log('[Notification] 📢 Showing notification:', msg);
  const div = document.createElement('div');
  div.textContent = msg;
  div.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: #667eea;
    color: white;
    padding: 15px;
    border-radius: 8px;
    z-index: 9999;
  `;
  document.body.appendChild(div);
  setTimeout(() => div.remove(), 4000);
}

//Returns a random number between two values — used to simulate random timing.
function randomBetween(min, max) {
  return Math.random() * (max - min) + min;
}

//Triggers fake mouse movement to appear more human-like and avoid detection as a bot.
function simulateMouseMove(x, y) {
  const evt = new MouseEvent('mousemove', {
    clientX: x,
    clientY: y,
    bubbles: true,
    cancelable: true,
    view: window
  });
  document.dispatchEvent(evt);
}

//Starts by scanning the first profile manually.

//If a match is found: shows a dialog for confirmation.

//If not: begins the automatic swiping and scanning loop.
async function startInitialScanThenAutoscroll() {
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

  showNotification('Scanning initial profile for match...');

  const timeoutMs = 30000; // 30 seconds
  const checkInterval = 2000;
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    const result = await scanCurrentProfile();
    if (result.match) {
      highlightImage(result.image);
      showNotification('Match found on first profile!');
      console.log('[Familiar] Calling sendEmailAlert...');
      sendEmailAlert('Potential match found on Tinder! Please confirm.');
      const confirmed = await showMatchConfirmationDialog();
      if (confirmed) return;
      // User said no — go to autoscroll
      break;
    }
    await sleep(checkInterval);
  }

  showNotification('No match found. Starting auto-scan...');
  autoScrollAndScan();
}

//Keeps swiping through profiles and scanning until:A match is found, It hits the max number of swipes, Or the user cancels.
//It mimics human behavior with:

//Random swipe directions,

//Occasional delays,

//Simulated mouse movement.
async function autoScrollAndScan() {
  if (!human) {
    showNotification('Human.js not yet initialized. Please wait...');
    return;
  }

  autoScrollActive = true;
  let matchFound = false;

  await human.load();
  await human.warmup();

  const { userEmbeddings = [] } = await chrome.storage.local.get(['userEmbeddings']);
  if (!userEmbeddings.length) {
    showNotification('No face data found. Please upload photos in the extension popup.');
    return;
  }

  while (autoScrollActive && swipeCount < maxSwipes && !matchFound) {
    // Store current images before swipe
    const prevImages = Array.from(document.querySelectorAll('div.Bdrs\\(8px\\).Bgz\\(cv\\).Bgp\\(c\\)[style*="background-image"]'))
      .map(div => getComputedStyle(div).backgroundImage);

    // Scan current profile
    const scanResult = await scanCurrentProfile();
    if (scanResult.match) {
      highlightImage(scanResult.image);
      showNotification('Potential match found! Please confirm.');
      console.log('[Familiar] Calling sendEmailAlert...');
      sendEmailAlert('Potential match detected on Tinder during auto-scan.');
      autoScrollActive = false;
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

    swipeCount++;

    // Randomly choose swipe direction (mostly left for efficiency)
    const doLeft = Math.random() < 0.8;
    const swipeSuccess = doLeft ? swipeLeft() : swipeRight();

    if (!swipeSuccess) {
      showNotification('Could not find swipe buttons. Please navigate manually.');
      break;
    }

    // Wait for new profile to load
    await waitForNewProfile();

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

  autoScrollActive = false;

  if (!matchFound) {
    const message = `Scan completed! No match found after ${swipeCount} profiles.`;
    showNotification(message);
  }
}

async function sendEmailAlert(message) {
  console.log('Sending email alert...');
  const { alertEmail } = await chrome.storage.local.get('alertEmail');
  if (!alertEmail) {
    console.log('❌ No email found for alerts.');
    return;
  }
  const now = new Date().toLocaleString();
  const msg = message || `A match was found on Tinder at ${now}!`;

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

// Profile observer functions for manual scanning
function startProfileObserver() {
  stopProfileObserver();

  const allProfilesContainer = document.querySelector('div[data-keyboard-gamepad="true"]')?.parentElement;
  if (!allProfilesContainer) {
    console.warn('[Observer] ❌ Could not find Tinder card container');
    return;
  }

  console.log('[Observer] ✅ Watching Tinder profile card container:', allProfilesContainer);

  // Track the last visible profile to detect changes
  let lastVisibleProfile = null;

  profileObserver = new MutationObserver((mutationsList) => {
    console.log('[Observer] 🔁 Mutation detected:', mutationsList);

    const cards = Array.from(document.querySelectorAll('div[data-keyboard-gamepad="true"]'));
    const visible = cards.find(el => el.getAttribute('aria-hidden') === 'false');
    const name = visible?.querySelector('[aria-label$="photos"]')?.getAttribute('aria-label')?.replace(/'s photos$/, '');

    // console.log('[Observer] ➕ Visible name detected:', name, '| Cards in DOM:', cards.length, '| Last visible:', lastVisibleProfile);

    // Check if the visible profile has changed
    if (visible && name && name !== lastVisibleProfile && isScanning && !autoScrollActive) {
      // console.log('[Observer] 🎯 Profile changed from', lastVisibleProfile, 'to', name, '- triggering scan!');
      lastVisibleProfile = name;
      handleManualProfileScan();
    } else if (visible && name) {
      lastVisibleProfile = name;
    }
  });

  profileObserver.observe(allProfilesContainer, {
    childList: true,
    attributes: true,
    subtree: true,
    attributeFilter: ['aria-hidden', 'style', 'class'],
  });

  // Also watch for swipe button clicks as a backup trigger
  const swipeButtons = document.querySelectorAll('button');
  swipeButtons.forEach(button => {
    button.addEventListener('click', () => {
      console.log('[Observer] 🖱️ Swipe button clicked');
      // Wait a bit for the profile to change, then trigger scan
      setTimeout(() => {
        if (isScanning && !autoScrollActive) {
          console.log('[Observer] 🔄 Swipe detected, triggering manual scan...');
          handleManualProfileScan();
        }
      }, 1000);
    });
  });

  console.log('[Observer] 👀 Now observing for Tinder profile changes...');
}

function stopProfileObserver() {
  if (profileObserver) {
    profileObserver.disconnect();
    profileObserver = null;
  }
}

async function handleManualProfileScan() {
  // Prevent multiple simultaneous scans
  if (isManualScanning) {
    console.log('[ManualScan] ⏳ Scan already in progress, skipping...');
    return;
  }
  
  isManualScanning = true;
  console.log('[ManualScan] 🔍 Starting manual profile scan...');
  
  try {
    const result = await scanCurrentProfile();
    console.log('[ManualScan] 📊 Scan result:', result);
    
    if (result.match) {
      console.log('[ManualScan] ✅ Match found!');
      highlightImage(result.image);
      showNotification('Match found!');
      // Send email immediately when match is found (before confirmation)
      console.log('[Familiar] Calling sendEmailAlert...');
      sendEmailAlert('Potential match found on Tinder! Please confirm.');
      
      const confirmed = await showMatchConfirmationDialog();
      if (confirmed) {
        console.log('[ManualScan] ✅ Match confirmed, stopping scan...');
        isScanning = false;
        stopProfileObserver();
        showNotification('Match confirmed! Scanning stopped.');
        return;
      } else {
        console.log('[ManualScan] ❌ Match not confirmed, continuing...');
        showNotification('No match confirmed. Awaiting next profile...');
      }
    } else {
      console.log('[ManualScan] ❌ No match found, showing notification...');
      showNotification('No match on this profile. Awaiting next profile...');
    }
  } catch (error) {
    console.error('[ManualScan] ❌ Error during manual scan:', error);
  } finally {
    isManualScanning = false;
    console.log('[ManualScan] ✅ Manual profile scan completed');
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

// Listen for messages from popup (start/stop scan)
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === 'startScan') {
    if (!isScanning) {
      isScanning = true;
      swipeCount = 0;
      
      if (msg.autoScroll === false) {
        showNotification('Scanning first profile only (no auto-scroll)...');
        startInitialScanOnly();
      } else {
        stopProfileObserver(); // Stop observer if switching to auto-scroll
        startInitialScanThenAutoscroll();
      }
      
      sendResponse({ success: true, message: 'Scan started' });
    } else {
      sendResponse({ success: false, message: 'Already scanning' });
    }
  } else if (msg.action === 'stopScan') {
    isScanning = false;
    autoScrollActive = false;
    stopProfileObserver();
    showNotification('Scanning stopped.');
    sendResponse({ success: true, message: 'Scanning stopped' });
  } else {
    sendResponse({ success: false, message: 'Unknown action' });
  }
  return true;
}); 