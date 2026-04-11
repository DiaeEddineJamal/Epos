import fs from 'fs';
import path from 'path';

const walkSync = (dir, filelist = []) => {
  fs.readdirSync(dir).forEach(file => {
    const dirFile = path.join(dir, file);
    if (fs.statSync(dirFile).isDirectory()) {
      filelist = walkSync(dirFile, filelist);
    } else {
      if (dirFile.endsWith('.json')) filelist.push(dirFile);
    }
  });
  return filelist;
};

const localesDir = 'src/i18n/locales';
const files = walkSync(localesDir);
files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(/Handy/g, 'Epos');
  content = content.replace(/handy/g, 'epos');
  fs.writeFileSync(file, content);
});
console.log('Done replacing Handy->Epos in locales');
