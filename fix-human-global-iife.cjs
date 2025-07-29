const fs = require('fs');
const path = require('path');

// Patch function to wrap the IIFE in a global assignment
function patchHumanJs(extensionDir) {
  const humanJsPath = path.join(extensionDir, 'human.js');
  if (!fs.existsSync(humanJsPath)) {
    console.log(`human.js not found in ${extensionDir}`);
    return;
  }
  let content = fs.readFileSync(humanJsPath, 'utf8');

  // Find the last IIFE and wrap it in a global assignment
  // The IIFE ends with '})();' and is the last return statement
  const iifeStart = content.lastIndexOf('(function(');
  const iifeEnd = content.lastIndexOf('})();') + 5;
  if (iifeStart === -1 || iifeEnd === -1) {
    console.log(`IIFE not found in ${humanJsPath}`);
    return;
  }

  // Remove any existing global assignment at the end
  content = content.replace(/\n\/\/ Make Human globally available[\s\S]*$/, '');

  // Extract the IIFE
  const before = content.slice(0, iifeStart);
  const iife = content.slice(iifeStart, iifeEnd);
  const after = content.slice(iifeEnd);

  // Wrap the IIFE in a global assignment
  const wrapped = `${before}\nif (typeof window !== "undefined") {\n  window.Human = ${iife};\n}${after}`;

  fs.writeFileSync(humanJsPath, wrapped, 'utf8');
  console.log(`Patched ${humanJsPath}`);
}

// Patch all extension directories
const extensions = ['bumble', 'tinder', 'grindr', 'premium'];
extensions.forEach(extension => {
  patchHumanJs(extension);
});
console.log('All human.js files patched with global IIFE!'); 