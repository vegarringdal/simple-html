const { fusebox, sparky } = require('fuse-box');
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
                template: `src/index.html`,
                publicPath: './'
            },
            log: false,
            cache: {
                root: '.cache',
                enabled: !prod
            },
            watcher: { 
                enabled:!prod,
                include:['../../packages', './src'],
                ignored: ['dist', 'dev'] 
            },
            hmr : { plugin : "./src/fuseHmrPlugin.ts"},
            devServer: !prod && this.runServer,
            plugins: [
                pluginTypeChecker({
                    basePath: './',
                    tsConfig: './tsconfig.json',
                    skipTsErrors:[6059]
                })
            ]
        });
    }
}
const { task, rm } = sparky(Context);

task('default', async ctx => {
    ctx.runServer = true;
    const fuse = ctx.getConfig();
    await fuse.runDev();
});

task('dist', async ctx => {
    await rm('./dist');
    const frontendConfig = ctx.getConfig(true);
    await frontendConfig.runProd({ uglify: true, bundles: { distRoot: 'dist/frontend', app: 'app.js' } });

});