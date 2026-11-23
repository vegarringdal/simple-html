import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// plain node, as the pre-push hook runs it
const { checksOf } = require('../verify.js');

/**
 * scripts/verify.js: the checks it runs before a push are the commands of checks.yml's matrix
 */
describe('verify - the checks of checks.yml', () => {
    it('expect the commands of the workflow, in its order', () => {
        const workflow = readFileSync(join(__dirname, '../../.github/workflows/checks.yml'), 'utf8');
        expect(checksOf(workflow)).toEqual([
            'npm run typecheck',
            'npx vitest run',
            'npx biome check . --diagnostic-level=error',
            'npm run check:typings',
            'npm run check:docs'
        ]);
    });

    it('expect quotes taken off, comments and blank lines skipped, the list ended by the next key', () => {
        const text = [
            'matrix:',
            '    check:',
            '        # the types',
            "        - 'npm run a'",
            '',
            '        - "npm run b"',
            '        - npm run c',
            '    other: x',
            '    - not this'
        ].join('\n');
        expect(checksOf(text)).toEqual(['npm run a', 'npm run b', 'npm run c']);
    });

    it('expect a workflow without the list to throw: verify must not pass with nothing checked', () => {
        expect(() => checksOf('jobs:\n  a: b')).toThrow(/no matrix `check:` list/);
        expect(() => checksOf('matrix:\n  check:\nnext: 1')).toThrow(/is empty/);
        // the job named check is not the list
        expect(() => checksOf('jobs:\n    check:\n        - npm run x')).toThrow(/no matrix `check:` list/);
    });
});
