const { execSync } = require('child_process');
const path = require('path');

exports.default = async function(context) {
  if (context.electronPlatformName === 'darwin') {
    const appPath = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`);
    console.log(`Forcefully re-signing ${appPath}...`);
    try {
      execSync(`codesign --force --deep --sign - "${appPath}"`);
      console.log('App successfully re-signed!');
    } catch (e) {
      console.error('Failed to re-sign app:', e);
    }
  }
};
