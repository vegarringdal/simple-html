/* eslint-disable @typescript-eslint/no-var-requires */

const { clearFolders } = require('esbuild-helpers');
const { readFiles, logInfo } = require('./utils');

async function run() {
    const files = await readFiles('./packages');
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.isDirectory() && file.name !== 'template-package') {
            logInfo(`${file.name}: Remove old dist folder`);
            clearFolders(`./packages/${file.name}/dist/**/*.*`);
        }
    }
}
run();
