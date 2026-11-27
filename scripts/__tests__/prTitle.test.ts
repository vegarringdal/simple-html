import { describe, expect, it } from 'vitest';

// plain node, as the workflow runs it
const { parseTitle } = require('../prTitle.js');

/** scripts/prTitle.js: the title of a pull request to master, a conventional commit (pr.yml) */

describe('prTitle', () => {
    it('expect fix and feat, ! when something breaks, a scope allowed', () => {
        expect(parseTitle('fix: the filter of a date')).toEqual({
            type: 'fix',
            scope: '',
            breaking: false,
            text: 'the filter of a date'
        });
        expect(parseTitle('feat(grid): a find bar')).toMatchObject({ type: 'feat', scope: 'grid', breaking: false });
        expect(parseTitle('feat!: Formatter spelled right')).toMatchObject({ breaking: true });
        expect(parseTitle('fix(datasource)!: no undo of a reset')).toMatchObject({ scope: 'datasource', breaking: true });
    });

    it('expect chore, docs, test, refactor, ci, build, perf and style', () => {
        for (const type of ['chore', 'docs', 'test', 'refactor', 'ci', 'build', 'perf', 'style']) {
            expect(parseTitle(`${type}: something`)).toMatchObject({ type, breaking: false });
        }
    });

    it('expect anything else refused, saying what is allowed', () => {
        for (const title of [
            'A find bar',
            'feature: a find bar',
            'fix:',
            'Fix: upper case',
            '!fix: in front',
            'fix - a dash',
            ''
        ]) {
            expect(parseTitle(title).error).toContain('must start with fix: / feat: (fix!: / feat!: when something breaks)');
        }
        expect(parseTitle('chore!: tidy').error).toBe(
            "the title 'chore!: tidy' is chore!: - only fix!: and feat!: can break something"
        );
    });
});
