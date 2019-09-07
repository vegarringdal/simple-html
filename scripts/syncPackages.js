const { logInfo, readFile, writeFile, readFiles, path } = require('./utils');
const prettier = require('prettier');

const mainPackage = './package.json';
const packages = ['./package-lock.json'];

const main = async function() {
    let mainVersion = JSON.parse(await readFile(mainPackage)).version;
    logInfo(`\n Will update all packages to: ${mainVersion}`);
    packages.forEach(async (packageFile, i) => {
        const packageRaw = await readFile(packageFile);
        const package = JSON.parse(packageRaw);
        package.version = mainVersion;
        const packageFixed = prettier.format(JSON.stringify(package), { tabWidth: 4 , printWidth: 5, parser: 'json' });
        await writeFile(packages[i], packageFixed);
        logInfo(`Updated version on ${packages[i]}`);
    });

    const files = await readFiles('./packages');
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.isDirectory() && file.name !== 'template-package') {
            const packageFile = path.resolve('./packages', file.name, `package.json`);
            const packageRaw = await readFile(packageFile);
            const package = JSON.parse(packageRaw);
            package.version = mainVersion;
            const packageFixed = prettier.format(JSON.stringify(package), { tabWidth: 4, printWidth: 5, parser: 'json' });
            await writeFile(packageFile, packageFixed);
            logInfo(`Updated version on ${packageFile}`);
        }
    }
};
main();
