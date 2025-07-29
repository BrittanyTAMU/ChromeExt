// MatchGuard Bumble Edition - Enhanced with Robust Event Simulation
console.log('[MatchGuard] Content script loaded on:', window.location.href);

let Human;
let human;

(async () => {
  try {
    const module = await import(chrome.runtime.getURL('human.esm.js'));
    Human = module.default;
    human = new Human({
      modelBasePath: 'https://vladmandic.github.io/human/models',
      backend: 'cpu',
      face: { enabled: true, detector: { enabled: true }, mesh: { enabled: false }, description: { enabled: true } },
      hand: { enabled: false },
      body: { enabled: false },
      gesture: { enabled: false },
      object: { enabled: false }
    });
    console.log('Human.js initialized successfully');
  } catch (error) {
    console.error('Failed to initialize Human.js:', error);
  }
})();

let isScanning = false;
let autoScrollActive = false;
let swipeCount = 0;
const maxSwipes = 25;
let profileObserver = null;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function cosineSimilarity(a, b) {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

function showNotification(msg) {
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

function highlightImage(img) {
  img.style.outline = '4px solid #4ade80';
  img.style.boxShadow = '0 0 16px 4px #4ade80';
}

function randomBetween(min, max) {
  return Math.random() * (max - min) + min;
}

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

// Enhanced swipe function with realistic event simulation
async function swipeLeft() {
  return new Promise((resolve) => {
    setTimeout(async () => {
      const el = document.querySelector('span[data-qa-icon-name="floating-action-no"]')?.closest('div[role="button"]');
      if (!el) {
        console.warn('[MatchGuard] Could not find pass button.');
        resolve(false);
        return;
      }

      console.log('[MatchGuard] Simulating realistic pass click...');
      
      const rect = el.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      
      const options = {
        bubbles: true,
        cancelable: true,
        composed: true,
        clientX: centerX,
        clientY: centerY,
        view: window
      };

      // Simulate complete mouse interaction sequence
      try {
        // Move mouse to element
        ['mousemove', 'mouseover', 'mouseenter'].forEach(type => {
          el.dispatchEvent(new MouseEvent(type, options));
        });
        
        await sleep(50 + Math.random() * 100); // Small random delay
        
        // Press down
        ['pointerdown', 'mousedown'].forEach(type => {
          el.dispatchEvent(new PointerEvent(type, options));
        });
        
        await sleep(30 + Math.random() * 70); // Brief press
        
        // Release
        ['pointerup', 'mouseup'].forEach(type => {
          el.dispatchEvent(new PointerEvent(type, options));
        });
        
        await sleep(20 + Math.random() * 50);
        
        // Final click
        el.dispatchEvent(new MouseEvent('click', options));
        
        console.log('[MatchGuard] Pass click simulation complete.');
        resolve(true);
      } catch (error) {
        console.error('[MatchGuard] Error during click simulation:', error);
        resolve(false);
      }
    }, Math.random() * 1000 + 500); // Random delay between 500ms–1500ms
  });
}

async function swipeRight() {
  return new Promise((resolve) => {
    setTimeout(async () => {
      const el = document.querySelector('span[data-qa-icon-name="floating-action-yes"]')?.closest('div[role="button"]');
      if (!el) {
        console.warn('[MatchGuard] Could not find like button.');
        resolve(false);
        return;
      }

      console.log('[MatchGuard] Simulating realistic like click...');
      
      const rect = el.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      
      const options = {
        bubbles: true,
        cancelable: true,
        composed: true,
        clientX: centerX,
        clientY: centerY,
        view: window
      };

      // Simulate complete mouse interaction sequence
      try {
        // Move mouse to element
        ['mousemove', 'mouseover', 'mouseenter'].forEach(type => {
          el.dispatchEvent(new MouseEvent(type, options));
        });
        
        await sleep(50 + Math.random() * 100);
        
        // Press down
        ['pointerdown', 'mousedown'].forEach(type => {
          el.dispatchEvent(new PointerEvent(type, options));
        });
        
        await sleep(30 + Math.random() * 70);
        
        // Release
        ['pointerup', 'mouseup'].forEach(type => {
          el.dispatchEvent(new PointerEvent(type, options));
        });
        
        await sleep(20 + Math.random() * 50);
        
        // Final click
        el.dispatchEvent(new MouseEvent('click', options));
        
        console.log('[MatchGuard] Like click simulation complete.');
        resolve(true);
      } catch (error) {
        console.error('[MatchGuard] Error during click simulation:', error);
        resolve(false);
      }
    }, Math.random() * 1000 + 500);
  });
}

// MutationObserver to detect profile changes
function setupProfileObserver() {
  if (profileObserver) {
    profileObserver.disconnect();
  }
  
  profileObserver = new MutationObserver((mutations) => {
    const passButton = document.querySelector('div[data-qa-role="encounters-action-dislike"]');
    const likeButton = document.querySelector('div[data-qa-role="encounters-action-like"]');
    
    if (passButton || likeButton) {
      console.log('[Observer] New profile detected, buttons are ready.');
      // Profile is loaded and ready for interaction
    }
  });

  profileObserver.observe(document.body, { 
    childList: true, 
    subtree: true,
    attributes: true,
    attributeFilter: ['class', 'style']
  });
}

async function clickThroughAllPhotos(maxPhotos = 5, delay = 1200) {
  for (let i = 0; i < maxPhotos; i++) {
    const nextBtn = document.querySelector('div.encounters-album__nav-item--next[role="button"]');
    if (!nextBtn || nextBtn.classList.contains('is-disabled')) break;
    
    nextBtn.style.boxShadow = '0 0 10px 3px #4ade80';
    nextBtn.style.transition = 'box-shadow 0.2s';
    nextBtn.click();
    await sleep(200);
    nextBtn.style.boxShadow = '';
    
    window.scrollBy(0, 300);
    await sleep(300);
    window.scrollBy(0, 300);
    await sleep(300);
    await sleep(delay);
  }
}

async function waitForNextProfileImage(prevImages, timeout = 5000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const currentImages = Array.from(document.querySelectorAll('img.media-box__picture-image'))
      .map(img => img.src);
    if (currentImages.some(img => !prevImages.includes(img))) return true;
    await sleep(600);
  }
  return false;
}

async function scanCurrentProfile() {
  if (!human) return { match: false };
  await clickThroughAllPhotos();
  const imgEls = Array.from(document.querySelectorAll('img.media-box__picture-image'));
  const imageUrls = imgEls.map(el => el.src).filter(Boolean);
  const scannedImages = new Set();
  for (const imageUrl of imageUrls) {
    if (scannedImages.has(imageUrl)) continue;
    scannedImages.add(imageUrl);
    console.log('📸 Scanning image:', imageUrl);
    let matchResult = await new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = async () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        try {
          const detection = await human.detect(canvas);
          console.log('[MatchGuard] Human.js face results:', detection.face);
          if (detection.face.length > 0 && detection.face[0].embedding) {
            const embedding = Array.from(detection.face[0].embedding);
            const { userEmbeddings = [] } = await chrome.storage.local.get(['userEmbeddings']);
            for (const userEmb of userEmbeddings) {
              const sim = cosineSimilarity(embedding, userEmb);
              console.log('[MatchGuard] Similarity score:', sim);
              if (sim > 0.7) {
                resolve({ match: true, image: canvas, similarity: sim });
                return;
              }
            }
          }
        } catch (e) {
          console.error('Error during face detection:', e);
        }
        resolve();
      };
      img.onerror = () => {
        console.error('Failed to load image directly in DOM');
        resolve();
      };
      img.src = imageUrl.startsWith('//') ? 'https:' + imageUrl : imageUrl;
    });
    if (matchResult && matchResult.match) return matchResult;
  }
  return { match: false };
}

function showMatchConfirmationDialog() {
  return new Promise((resolve) => {
    const dialog = document.createElement('div');
    dialog.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: white;
      padding: 30px;
      border-radius: 15px;
      box-shadow: 0 10px 30px rgba(0,0,0,0.3);
      z-index: 100000;
      text-align: center;
      font-family: Arial, sans-serif;
      min-width: 300px;
    `;
    dialog.innerHTML = `
      <h3 style="margin: 0 0 20px 0; color: #333;">Potential Match Found!</h3>
      <p style="margin: 0 0 25px 0; color: #666;">Is this the person you're looking for?</p>
      <div style="display: flex; gap: 15px; justify-content: center;">
        <button id="confirmYes" style="padding: 12px 24px; background: #4ade80; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: bold;">Yes, This is a Match</button>
        <button id="confirmNo" style="padding: 12px 24px; background: #ef4444; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: bold;">No, Continue Scanning</button>
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
      const confirmed = await showMatchConfirmationDialog();
      if (confirmed) return;
      break;
    }
    await sleep(checkInterval);
  }
  showNotification('No match found. Starting auto-scan...');
  autoScrollAndScan();
}

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
  
  // Setup profile observer
  setupProfileObserver();
  
  while (autoScrollActive && swipeCount < maxSwipes && !matchFound) {
    const prevImages = Array.from(document.querySelectorAll('img.media-box__picture-image'))
      .map(img => img.src);
    const scanResult = await scanCurrentProfile();
    if (scanResult.match) {
      highlightImage(scanResult.image);
      showNotification('Potential match found! Please confirm.');
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
    const doLeft = Math.random() < 0.8;
    const swipeSuccess = await (doLeft ? swipeLeft() : swipeRight());
    if (!swipeSuccess) {
      showNotification('Could not find swipe buttons. Please navigate manually.');
      break;
    }
    const profileChanged = await waitForNextProfileImage(prevImages);
    if (!profileChanged) {
      showNotification('Profile did not change after swipe. Stopping scan.');
      break;
    }
    await sleep(randomBetween(1000, 3000));
    if (swipeCount % 5 === 0) {
      await sleep(randomBetween(2000, 4000));
    }
    if (Math.random() < 0.3) {
      simulateMouseMove(
        Math.floor(Math.random() * window.innerWidth),
        Math.floor(Math.random() * window.innerHeight)
      );
    }
  }
  autoScrollActive = false;
  if (profileObserver) {
    profileObserver.disconnect();
  }
  if (!matchFound) {
    const message = `Scan completed! No match found after ${swipeCount} profiles.`;
    showNotification(message);
  }
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === 'startScan') {
    if (!isScanning) {
      isScanning = true;
      swipeCount = 0;
      startInitialScanThenAutoscroll();
      sendResponse({ success: true, message: 'Initial scan started' });
    } else {
      sendResponse({ success: false, message: 'Already scanning' });
    }
  } else if (msg.action === 'stopScan') {
    isScanning = false;
    autoScrollActive = false;
    if (profileObserver) {
      profileObserver.disconnect();
    }
    showNotification('Scanning stopped.');
    sendResponse({ success: true, message: 'Scanning stopped' });
  } else {
    sendResponse({ success: false, message: 'Unknown action' });
  }
  return true;
}); 