const fs = require('fs-extra');
const path = require('node:path');
const replace = require('replace-in-file');

// fix long prisma loading times caused by scanning from process.cwd(), which returns "/" when run in electron
// (thus it scans all files on the computer.) See https://github.com/prisma/prisma/issues/8484
const files = path.join(__dirname, 'electron', 'generated', 'client', '**/*.js');

replace.sync({
  files: files,
  from: /process.cwd\(\)/g,
  to: `require('electron').app.getAppPath()`,
  countMatches: true,
});

// Copy the generated prisma client to the dist folder
fs.copySync(
  path.join(__dirname, 'electron', 'generated'),
  path.join(__dirname, 'dist-electron', 'generated'),
  {
    filter: (src, _dest) => {
      // Prevent duplicate copy of query engine. It will already be in extraResources in electron-builder.yml
      if (src.match(/query_engine/) || src.match(/libquery_engine/) || src.match(/esm/)) {
        return false;
      }
      return true;
    },
  },
);
