const fs = require('fs');
const parser = require('@babel/parser');

const code = fs.readFileSync('frontend/src/components/Chat/cards/FinalJDCard.jsx', 'utf8');

try {
  parser.parse(code, {
    sourceType: 'module',
    plugins: ['jsx']
  });
  console.log("Parsed perfectly.");
} catch (e) {
  console.error(e.message);
  console.error(e.loc);
}
