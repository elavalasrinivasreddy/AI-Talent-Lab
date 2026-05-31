const esbuild = require('esbuild');
const fs = require('fs');

const code = fs.readFileSync('frontend/src/components/Chat/cards/FinalJDCard.jsx', 'utf8');

esbuild.transform(code, { loader: 'jsx' })
  .then(() => console.log("Esbuild parsed successfully"))
  .catch(err => console.error(err));
