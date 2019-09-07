const path = require('path');
const { readFiles, spawner, logInfo, logError } = require('./utils');

const main = async () => {
    const files = await readFiles('./packages');
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.isDirectory() && file.name !== 'template-package') {
            const npm = process.platform === 'win32' ? 'npm.cmd' : 'node';
            let mainPath = path.resolve(process.cwd(), `./packages/${file.name}`);
            logInfo(`Running publish on ${file.name}`, 'green');
            const err = await spawner(npm, ['publish'], mainPath, true);
            if (err) {
                logError(`\nNode app failed: ${err}\n`, 'green');
            } else {
                logInfo(`Publish done : ${file.name}`, 'green');
            }
        }
    }
};
main();
