import fs from 'node:fs';
import path from 'node:path';

const dir = './public/menu';
const files = fs.readdirSync(dir);

files.forEach(file => {
  if (file.includes('%20') || file.includes(' ')) {
    const decoded = decodeURIComponent(file);
    const newName = decoded.replace(/\s+/g, '-');
    const oldPath = path.join(dir, file);
    const newPath = path.join(dir, newName);
    
    if (oldPath !== newPath) {
      if (fs.existsSync(newPath)) {
        console.log(`Skipping ${file} -> ${newName} (already exists)`);
      } else {
        fs.renameSync(oldPath, newPath);
        console.log(`Renamed: ${file} -> ${newName}`);
      }
    }
  }
});
