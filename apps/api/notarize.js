require('dotenv').config();
const fs = require('node:fs');
const path = require('node:path');
const electron_notarize = require('electron-notarize');

module.exports = async (params) => {
  if (process.platform !== 'darwin') {
    return;
  }

  console.log('afterSign hook triggered', params);

  const appId = 'ai.refly.desktop';

  const appPath = path.join(params.appOutDir, `${params.packager.appInfo.productFilename}.app`);
  if (!fs.existsSync(appPath)) {
    console.log('skip');
    return;
  }

  console.log(`Notarizing ${appId} found at ${appPath} with Apple ID ${process.env.APPLE_ID}`);

  try {
    await electron_notarize.notarize({
      tool: 'notarytool',
      appBundleId: appId,
      appPath: appPath,
      appleId: process.env.APPLE_ID,
      appleIdPassword: process.env.APPLE_ID_PASSWORD,
      teamId: process.env.APPLE_TEAM_ID,
    });
  } catch (error) {
    console.error(error);
  }

  console.log(`Done notarizing ${appId}`);
};
