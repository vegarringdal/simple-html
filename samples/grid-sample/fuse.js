const { fusebox, sparky } = require('fuse-box');
const { pluginTypeChecker } = require('fuse-box-typechecker');
const PATH = '.' + __dirname.replace(process.cwd(), '').split()[0];

class Context {
    isProduction;
    runServer;
    getConfig() {
        return fusebox({
            target: 'browser',
            homeDir: '../../',
            output: `dev`,
            entry: `${PATH}/src/index.ts`,
            webIndex: {
                template: `src/index.html`
            },
            log: false,
            cache: {
                root: '.cache',
                enabled: true
            },
            watch: { ignored: ['dist', 'dev'] },
            hmr: true,
            devServer: this.runServer,
            plugins: [
                pluginTypeChecker({
                    basePath: PATH,
                    tsConfig: './tsconfig.json',
                    skipTsErrors:[6059]
                })
            ]
        });
    }
}
const { task } = sparky(Context);

task('default', async ctx => {
    ctx.runServer = true;
    const fuse = ctx.getConfig();
    await fuse.runDev();
});
