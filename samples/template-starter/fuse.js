const { fusebox, sparky, pluginPostCSS } = require('fuse-box');
const { pluginTypeChecker } = require('fuse-box-typechecker');

class Context {
    isProduction;
    runServer;
    getConfig(prod) {
        return fusebox({
            target: 'browser',
            output: `dev`,
            entry: `./src/index.ts`,
            webIndex: {
                template: `src/index.html`
            },
            log: false,
            cache: {
                root: '.cache',
                enabled: !prod
            },
            watcher: {
                enabled: !prod,
                include: ['../../packages', './src'],
                ignored: ['dist', 'dev']
            },
            hmr: { plugin: './src/fuseHmrPlugin.ts' },
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
                    tsConfig: './tsconfig.json',
                    skipTsErrors: [6059]
                })
            ]
        });
    }
}

const { task, rm } = sparky(Context);

task('default', async (ctx) => {
    await rm('./.cache');
    ctx.runServer = true;
    const fuse = ctx.getConfig(false);
    await fuse.runDev();
});

task('dist', async (ctx) => {
    await rm('./dist');
    const frontendConfig = ctx.getConfig(true);
    await frontendConfig.runProd({
        uglify: true,
        bundles: { distRoot: 'dist/', app: 'app.js' }
    });
});
