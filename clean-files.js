const fs = require('fs');

const cleanFile = (filepath) => {
  try {
    const data = fs.readFileSync(filepath);
    // Convert to string assuming valid parts are UTF-8, replacing invalid chars
    let str = new TextDecoder('utf-8', { fatal: false }).decode(data);
    
    // Remove BOM if present
    if (str.charCodeAt(0) === 0xFEFF) {
      str = str.slice(1);
    }
    
    // Also remove any null characters that shouldn't be in source code
    str = str.replace(/\0/g, '');

    fs.writeFileSync(filepath, str, 'utf8');
    console.log(`Successfully cleaned ${filepath}`);
  } catch (err) {
    console.error(`Error processing ${filepath}:`, err.message);
  }
};

cleanFile('components/dashboard/matches-tab.tsx');
cleanFile('components/dashboard/match-card.tsx');
