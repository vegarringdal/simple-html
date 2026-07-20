import { addDefaultIndex, clearFolders, client, TypeChecker } from 'esbuild-helpers';
import { clientOptions, DEMO_OUTPUT_ROOT, INDEX_TEMPLATE, TS_CONFIG } from './config_shared';

clearFolders('dist_client', 'dist_nodejs');

const sample = process.argv[2] || 'demo';

/**
 * client bundle, minified, no watch
 */
client(
    { watch: [] },
    clientOptions({ entrySample: 'grid01', outSample: sample, outputRoot: DEMO_OUTPUT_ROOT, development: false })
);

/**
 * index file for project
 */
addDefaultIndex({
    distFolder: `${DEMO_OUTPUT_ROOT}/${sample}`,
    publicFolders: [],
    entry: './index.js',
    hbr: false,
    devServer: false,
    devServerPort: 8080,
    indexTemplate: INDEX_TEMPLATE
});

const checker_client = TypeChecker({
    basePath: './',
    name: 'checker_client',
    tsConfigJsonContent: TS_CONFIG
});

checker_client.printSettings();
checker_client.inspectAndPrint();
