const fs = require('fs');
const path = require('path');

// Function to patch human.js files with the correct global assignment
function patchHumanJs(extensionDir) {
  const humanJsPath = path.join(extensionDir, 'human.js');
  
  if (!fs.existsSync(humanJsPath)) {
    console.log(`human.js not found in ${extensionDir}`);
    return;
  }
  
  console.log(`Patching ${humanJsPath}...`);
  
  // Read the current file
  let content = fs.readFileSync(humanJsPath, 'utf8');
  
  // Remove any existing global assignment at the end
  content = content.replace(/\n\/\/ Make Human globally available[\s\S]*$/, '');
  
  // Add simple global assignment - just assign the result of the IIFE
  const globalAssignment = `

// Make Human globally available
if (typeof window !== "undefined") {
  window.Human = Human;
}`;

  // Add the global assignment at the end
  content += globalAssignment;
  
  // Write the patched file
  fs.writeFileSync(humanJsPath, content, 'utf8');
  console.log(`Patched ${humanJsPath}`);
}

// Patch all extension directories
const extensions = ['bumble', 'tinder', 'grindr', 'premium'];

extensions.forEach(extension => {
  patchHumanJs(extension);
});

console.log('All human.js files patched successfully!'); 