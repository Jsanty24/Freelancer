const fs = require('node:fs');
const path = require('node:path');

const sourceDir = path.resolve(__dirname, '../../Frontend');
const outputDir = path.resolve(__dirname, '../www');
const files = ['index.html'];
const directories = ['css', 'js', 'public'];

if (!fs.existsSync(path.join(sourceDir, 'index.html'))) {
  throw new Error(`No se encontró la interfaz web en ${sourceDir}`);
}

fs.mkdirSync(outputDir, { recursive: true });

for (const file of files) {
  fs.copyFileSync(path.join(sourceDir, file), path.join(outputDir, file));
}

for (const directory of directories) {
  fs.cpSync(
    path.join(sourceDir, directory),
    path.join(outputDir, directory),
    { recursive: true }
  );
}

console.log(`Interfaz copiada desde ${sourceDir} a ${outputDir}`);
