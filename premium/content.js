// Human.js-powered MatchGuard Content Script - All-in-One Premium Edition
let Human;
let human;

// Initialize Human.js dynamically
(async () => {
  try {
    const module = await import(chrome.runtime.getURL('human.esm.js'));
    Human = module.default;

    human = new Human({
      modelBasePath: 'https://vladmandic.github.io/human/models',
      face: { enabled: true, detector: { enabled: true }, mesh: { enabled: false }, description: { enabled: true } }
    });
    
    console.log('Human.js initialized successfully');
  } catch (error) {
    console.error('Failed to initialize Human.js:', error);
  }
})();

let isScanning = false;
let autoScrollActive = false;
let autoScrollTimeout = null;
let swipeCount = 0;

// Different max swipes for each dating site (free tier limits)
function getMaxSwipes() {
  const hostname = window.location.hostname;
  if (hostname.includes('tinder.com')) return 100; // Tinder: 100 swipes per 12 hours
  if (hostname.includes('bumble.com')) return 25;  // Bumble: 25 swipes per day
  if (hostname.includes('okcupid.com')) return 25; // OKCupid: 25 swipes per day
  if (hostname.includes('grindr.com')) return 100; // Grindr: 100 swipes per day
  return 50; // Default fallback
}

function getSiteName() {
  const hostname = window.location.hostname;
  if (hostname.includes('tinder.com')) return 'Tinder';
  if (hostname.includes('bumble.com')) return 'Bumble';
  if (hostname.includes('okcupid.com')) return 'OKCupid';
  if (hostname.includes('grindr.com')) return 'Grindr';
  return 'this dating site';
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function randomBetween(min, max) {
  return Math.random() * (max - min) + min;
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

function swipeLeft() {
  const swipeButton = document.querySelector('[data-testid="gamepadLike"], .like-button, .swipe-left');
  if (swipeButton) {
    swipeButton.click();
    return true;
  }
  return false;
}

function swipeRight() {
  const swipeButton = document.querySelector('[data-testid="gamepadDislike"], .dislike-button, .swipe-right');
  if (swipeButton) {
    swipeButton.click();
    return true;
  }
  return false;
}

async function sendEmailAlert(message) {
  try {
    // TODO: Replace with your actual EmailJS credentials
    // Get these from: https://www.emailjs.com/
    const emailService = 'service_xxxxxxx'; // Replace with your service ID
    const templateId = 'template_xxxxxxx';  // Replace with your template ID
    const userId = 'user_xxxxxxx';          // Replace with your user ID
    
    const templateParams = {
      to_email: 'your-email@example.com', // Replace with recipient email
      message: message
    };
    
    // Load EmailJS dynamically
    const emailjs = await import('https://cdn.jsdelivr.net/npm/@emailjs/browser@3/dist/email.min.js');
    emailjs.init(userId);
    
    await emailjs.send(emailService, templateId, templateParams);
  } catch (err) {
    console.log('Email alert failed:', err);
  }
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
        <button id="confirmYes" style="
          padding: 12px 24px;
          background: #4ade80;
          color: white;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          font-weight: bold;
        ">Yes, This is a Match</button>
        <button id="confirmNo" style="
          padding: 12px 24px;
          background: #ef4444;
          color: white;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          font-weight: bold;
        ">No, Continue Scanning</button>
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

async function scanCurrentProfile() {
  if (!human) {
    console.log('Human.js not yet initialized');
    return { match: false };
  }
  const images = Array.from(document.querySelectorAll('img'));
  const scannedImages = new Set();
  
  for (const img of images) {
    if (scannedImages.has(img.src)) continue;
    scannedImages.add(img.src);
    
    if (!img.complete) {
      await new Promise(res => { img.onload = res; img.onerror = res; });
    }
    
    try {
      const result = await human.detect(img);
      if (result.face.length > 0 && result.face[0].embedding) {
        const domEmbedding = Array.from(result.face[0].embedding);
        
        // Load user embeddings
        const { userEmbeddings = [] } = await chrome.storage.local.get(['userEmbeddings']);
        
        for (const userEmb of userEmbeddings) {
          const sim = cosineSimilarity(domEmbedding, userEmb);
          if (sim > 0.9) {
            return { match: true, image: img, similarity: sim };
          }
        }
      }
    } catch (err) {
      // Ignore errors for individual images
    }
  }
  
  return { match: false };
}

async function autoScrollAndScan() {
  if (!human) {
    showNotification('Human.js not yet initialized. Please wait...');
    return;
  }
  autoScrollActive = true;
  let matchFound = false;
  const maxSwipes = getMaxSwipes();
  const siteName = getSiteName();

  await human.load();
  await human.warmup();

  // Load user embeddings
  const { userEmbeddings = [] } = await chrome.storage.local.get(['userEmbeddings']);
  if (!userEmbeddings.length) {
    showNotification('No face data found. Please upload photos in the extension popup.');
    return;
  }

  while (autoScrollActive && swipeCount < maxSwipes && !matchFound) {
    // Scan current profile
    const scanResult = await scanCurrentProfile();
    
    if (scanResult.match) {
      // Potential match found!
      highlightImage(scanResult.image);
      showNotification('Potential match found! Please confirm.');
      
      // Send email alert immediately (in case user is not at computer)
      await sendEmailAlert(`A potential match was found on ${siteName}!`);
      
      // Stop scanning temporarily and ask user for confirmation
      autoScrollActive = false;
      
      // Show confirmation dialog
      const isConfirmed = await showMatchConfirmationDialog();
      
      if (isConfirmed) {
        // User confirmed it's a match - stop permanently and leave them on this profile
        showNotification('Match confirmed! You can now interact with this profile.');
        matchFound = true;
        break;
      } else {
        // User said it's not a match, continue scanning
        showNotification('Continuing scan...');
        autoScrollActive = true;
        // Remove highlight from the image
        scanResult.image.style.outline = '';
        scanResult.image.style.boxShadow = '';
      }
    }
    
    // No match found or user denied match, swipe to next profile
    swipeCount++;
    
    // Randomly choose swipe direction (mostly left for efficiency)
    const swipeLeft = Math.random() < 0.8;
    const swipeSuccess = swipeLeft ? swipeLeft() : swipeRight();
    
    if (!swipeSuccess) {
      showNotification('Could not find swipe buttons. Please navigate manually.');
      break;
    }
    
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
    const message = `Scan completed! No match found after ${swipeCount} profiles. Rescan if you have premium access on ${siteName}.`;
    
    // Send email alert
    await sendEmailAlert(message);
    
    // Show DOM message
    showNotification(message);
  }
}

function highlightImage(img) {
  img.style.outline = '4px solid #4ade80';
  img.style.boxShadow = '0 0 16px 4px #4ade80';
}

function showNotification(message) {
  // In-page notification
  const notification = document.createElement('div');
  notification.textContent = message;
  notification.style.position = 'fixed';
  notification.style.top = '20px';
  notification.style.right = '20px';
  notification.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
  notification.style.color = 'white';
  notification.style.padding = '15px 20px';
  notification.style.borderRadius = '10px';
  notification.style.boxShadow = '0 4px 20px rgba(0,0,0,0.3)';
  notification.style.zIndex = 99999;
  document.body.appendChild(notification);
  setTimeout(() => notification.remove(), 4000);
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === 'startScan') {
    if (!isScanning) {
      isScanning = true;
      swipeCount = 0;
      autoScrollAndScan();
    }
  } else if (msg.action === 'stopScan') {
    isScanning = false;
    autoScrollActive = false;
    if (autoScrollTimeout) clearTimeout(autoScrollTimeout);
    showNotification('Scanning stopped.');
  }
}); 