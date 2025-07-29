# Familiar Chrome Extensions

This directory contains site-specific Chrome extensions for face matching on dating platforms. Each extension is domain-locked to prevent unauthorized use on other sites.

## Available Extensions

### 1. Familiar: Tinder Edition
- **Domain:** Only works on `*.tinder.com/*`
- **Swipe Limit:** 100 swipes per 12 hours (free tier)
- **Files:** `tinder/manifest.json`, `tinder/content.js`, `tinder/popup.html`, `tinder/popup.js`

### 2. Familiar: OKCupid Edition
- **Domain:** Only works on `*.OKCupid.com/*`
- **Swipe Limit:** 25 swipes per day (free tier)
- **Files:** `OKCupid/manifest.json`, `OKCupid/content.js`, `OKCupid/popup.html`, `OKCupid/popup.js`


## Security Features

### Domain Locking
Each extension's `manifest.json` contains strict domain restrictions:
```json
"content_scripts": [
  {
    "matches": ["*://*.tinder.com/*"], // Only works on Tinder
    "js": ["content.js"]
  }
]
```

### Anti-Hacking Protection
- **No Cross-Domain Execution:** Chrome prevents scripts from running on unauthorized domains
- **No Backend Required:** Each extension is self-contained
- **No Authentication:** Users get the version they paid for
- **Obfuscated API Keys:** EmailJS credentials are split to avoid easy detection

## How to Install

### For Development/Testing:
1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the appropriate extension folder (e.g., `extensions/tinder/`)

### For Distribution:
1. Zip each extension folder
2. Upload to Chrome Web Store (requires developer account)
3. Or distribute as `.crx` files for manual installation

## Features

### All Extensions Include:
- **Face Detection:** Uses Human.js for accurate face recognition
- **Image Upload:** Users upload 2-3 photos in the popup
- **Automatic Scanning:** Human-like scrolling and swiping
- **Match Confirmation:** User confirms potential matches
- **Email Alerts:** Immediate notifications when matches are found
- **Privacy-First:** All processing done locally, no server storage

### Workflow:
1. User uploads photos → Human.js extracts embeddings
2. User starts scanning → Extension swipes through profiles
3. When potential match found → Email alert + confirmation dialog
4. If confirmed → Stop scanning, leave user on profile
5. If denied → Continue scanning
6. If max swipes reached → Email + DOM notification about premium

## Pricing Strategy

### Individual Editions:
- **Tinder Edition:** $X (single platform)
- **OKCupid Edition:** $X (single platform)



## Technical Notes

### Dependencies:
- **Human.js:** Face detection and embedding extraction
- **EmailJS:** Email notifications (obfuscated)
- **Chrome Extension APIs:** Storage and messaging

### File Structure:
```
extensions/
├── tinder/
│   ├── manifest.json
│   ├── content.js
│   ├── popup.html
│   └── popup.js
├── OKCupid/
│   ├── manifest.json
│   ├── content.js
│   ├── popup.html
│   └── popup.js
```

### Customization:
To modify swipe limits or add new sites:
1. Edit the `getMaxSwipes()` function in `content.js`
2. Update `manifest.json` with new domains
3. Add site-specific logic as needed

## Legal Compliance

- **Terms of Use:** Users responsible for lawful use
- **Privacy Policy:** No biometric data stored on servers
- **Platform Compliance:** Respects each dating site's terms
- **User Consent:** Clear disclosure of functionality

## Support

For technical support or customization requests, contact the development team. 