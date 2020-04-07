const path = require('path');
const { readFiles, spawner, logInfo, logError } = require('./utils');

const { sparky } = require('fuse-box');
class Context {}
const { task, src } = sparky(Context);

task('default', async context => {
    const files = await readFiles('./packages');
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.isDirectory() && file.name !== 'template-package') {
            logInfo(`${file.name}: Remove old dist folder`);
            await src(`../packages/${file.name}/dist/**/*.*`)
                .clean()
                .exec();
        }
    }
})