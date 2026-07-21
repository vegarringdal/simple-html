/* eslint-disable @typescript-eslint/no-var-requires */

const { clearFolders } = require('esbuild-helpers');
const { logInfo } = require('./utils');

logInfo('Remove old dist folder');
clearFolders('./dist/**/*.*');
