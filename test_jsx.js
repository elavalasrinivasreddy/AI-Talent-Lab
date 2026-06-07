const fs = require('fs');
const babel = require('@babel/core');
try {
  babel.transformFileSync('frontend/src/components/Chat/cards/FinalJDCard.jsx', {
    presets: ['@babel/preset-react']
  });
  console.log("No syntax errors found.");
} catch (e) {
  console.error(e.message);
}
