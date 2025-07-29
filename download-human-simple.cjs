const https = require('https');
const fs = require('fs');
const path = require('path');

// Function to download file
function downloadFile(url, filepath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(filepath);
    https.get(url, (response) => {
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve();
      });
    }).on('error', (err) => {
      fs.unlink(filepath, () => {}); // Delete the file async. (But we don't check the result)
      reject(err);
    });
  });
}

// Function to patch human.js with global export
function patchHumanJs(filepath) {
  console.log(`Patching ${filepath}...`);
  
  // Read the file
  let content = fs.readFileSync(filepath, 'utf8');
  
  // Remove any existing global assignments
  content = content.replace(/\n\/\/ Make Human globally available[\s\S]*$/, '');
  
  // Add simple global assignment at the end
  const globalAssignment = `

// Make Human globally available
if (typeof window !== "undefined") {
  window.Human = Human;
}
`;
  
  content += globalAssignment;
  
  // Write back to file
  fs.writeFileSync(filepath, content, 'utf8');
  console.log(`Patched ${filepath}`);
}

// Download and patch for all extensions
async function processExtensions() {
  const extensions = ['bumble', 'tinder', 'grindr', 'premium'];
  const humanJsUrl = 'https://cdn.jsdelivr.net/npm/@vladmandic/human@3.2.2/dist/human.js';
  
  for (const ext of extensions) {
    const extPath = path.join(__dirname, ext);
    if (fs.existsSync(extPath)) {
      const humanJsPath = path.join(extPath, 'human.js');
      
      try {
        console.log(`Downloading human.js for ${ext}...`);
        await downloadFile(humanJsUrl, humanJsPath);
        patchHumanJs(humanJsPath);
        console.log(`Completed ${ext}`);
      } catch (error) {
        console.error(`Error processing ${ext}:`, error.message);
      }
    }
  }
  
  console.log('All extensions processed!');
}

processExtensions().catch(console.error); 