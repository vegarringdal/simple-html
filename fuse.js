const { fusebox, sparky, pluginPostCSS } = require('fuse-box');
const { pluginTypeChecker } = require('fuse-box-typechecker');

class Context {
    isProduction;
    runServer;
    getConfig(folderInSamples, prod) {
        return fusebox({
            target: 'browser',
            entry: `./samples/${folderInSamples}/index.ts`,
            webIndex: {
                template: `./samples/${folderInSamples}/index.html`,
                publicPath: './'
            },
            cache: {
                root: `./.cache/${folderInSamples}`,
                enabled: !prod
            },
            watcher: {
                enabled: !prod,
                include: ['./packages', `./samples/${folderInSamples}`],
                ignored: ['dist']
            },
            hmr: { plugin: `./samples/${folderInSamples}/fuseHmrPlugin.ts` },
            devServer: !prod,
            plugins: [
                pluginPostCSS(/\.css$/, {
                    stylesheet: {
                        postCSS: {
                            plugins: [require('tailwindcss'), require('autoprefixer')]
                        }
                    }
                }),
                pluginTypeChecker({
                    basePath: './',
                    tsConfigOverride: {
                        extends: './tsconfig.json',
                        compilerOptions: {
                            rootDirs: [`./samples/${folderInSamples}`, './packages']
                        }
                    }
                })
            ]
        });
    }
}
const { rm } = sparky(Context);
// commen runner for all samples
async function run(folderInSamples, ctx) {
    await rm(`./.cache/${folderInSamples}`);
    await rm(`./dist/${folderInSamples}`);
    ctx.runServer = true;
    const fuse = ctx.getConfig(folderInSamples, false);
    await fuse.runDev({ bundles: { distRoot: `./dist/${folderInSamples}`, app: 'app.js' } });
}

run(process.argv[2], new Context());

/* 
task('dist', async (ctx) => {
    await rm('./dist');
    const frontendConfig = ctx.getConfig('core', true);
    await frontendConfig.runProd({
        uglify: true,
        bundles: { distRoot: 'dist/', app: 'app.js' }
    });
}); */
