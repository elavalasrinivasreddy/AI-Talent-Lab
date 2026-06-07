const fs = require('fs');
const code = fs.readFileSync('frontend/src/components/Chat/cards/FinalJDCard.jsx', 'utf8');

const returnMatch = code.match(/return\s*\(\s*(<>\s*[\s\S]+?)\s*\);\s*};/);
if (!returnMatch) {
  console.log("Could not find return block");
  process.exit(1);
}

const jsx = returnMatch[1];
let braceDepth = 0;
for (let i = 0; i < jsx.length; i++) {
  if (jsx[i] === '{') braceDepth++;
  if (jsx[i] === '}') braceDepth--;
}
console.log("Brace depth at end:", braceDepth);
