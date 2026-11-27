const fs = require('node:fs');
const { logInfo, spawner } = require('./utils');

/**
 * Packs the package into a tgz in ./build - wiped and recreated each run, so it only holds the
 * latest. `npm pack` runs the `prepare` script first, which builds dist, so there is no
 * separate build step here.
 */
async function run() {
    fs.rmSync('./build', { recursive: true, force: true });
    fs.mkdirSync('./build', { recursive: true });

    logInfo('pack tgz into ./build');
    const code = await spawner('npm', ['pack', '--pack-destination', './build'], process.cwd(), true);
    if (code !== 0) {
        throw new Error(`npm pack failed with exit code ${code}`);
    }
}

run().catch((err) => {
    console.error(err);
    process.exit(1);
});
