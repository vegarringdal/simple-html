import { addDefaultIndex, clearFolders, client, TypeChecker } from 'esbuild-helpers';
import { clientOptions, DEV_OUTPUT_ROOT, INDEX_TEMPLATE, TS_CONFIG } from './config_shared';

clearFolders('dist_client', 'dist_nodejs');

const sample = process.argv[2] || 'grid01';

/**
 * client bundle, watched and unminified
 */
client(
    { watch: [`./samples/${sample}/**/*.*`, './packages/**/*.*'] },
    clientOptions({ entrySample: sample, outSample: sample, outputRoot: DEV_OUTPUT_ROOT, development: true })
);

/**
 * index file for project
 */
addDefaultIndex({
    distFolder: `${DEV_OUTPUT_ROOT}/${sample}`,
    publicFolders: [],
    entry: './index.js',
    hbr: true,
    devServer: true,
    devServerPort: 8080,
    userInjectOnHbr: 'window.location.reload();',
    indexTemplate: INDEX_TEMPLATE
});

const checker_client = TypeChecker({
    basePath: './',
    name: 'checker_client',
    tsConfigJsonContent: TS_CONFIG
});

checker_client.printSettings();
checker_client.inspectAndPrint();
checker_client.worker_watch(['./samples', './packages']);
