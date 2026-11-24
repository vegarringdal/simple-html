// The grid config dialog shows a column's settings in tabs (General, Display, Header filter, Colours -
// ColumnSection in columnSettings.ts): a setting on a tab not shown is hidden. Required by a check, this
// makes Playwright do what the user does first - before it acts on an element of a hidden tab, it clicks
// that tab. Elements of the tab shown, and everything outside the dialog, are left as they are.
// Usage: require('../sections')()
const path = require('node:path');

module.exports = function showSections() {
    // playwright-core's classes by their files: the package exports none of them
    const core = path.dirname(require.resolve('playwright-core/package.json'));
    const { Locator } = require(path.join(core, 'lib/client/locator'));
    const { Page } = require(path.join(core, 'lib/client/page'));
    if (Locator.prototype.__sections) {
        return;
    }
    Locator.prototype.__sections = true;

    /** clicks the tab of the hidden section the locator's element is in; nothing when it is in none */
    async function showSectionOf(locator) {
        await locator
            .first()
            .evaluate(
                (el) => {
                    const section = el.closest('.column-settings-section[hidden]');
                    const tab = section && document.getElementById(section.getAttribute('aria-labelledby'));
                    if (tab) {
                        tab.click();
                    }
                },
                undefined,
                { timeout: 3000 }
            )
            .catch(() => {});
    }

    const actions = [
        'click',
        'dblclick',
        'tap',
        'fill',
        'check',
        'uncheck',
        'setChecked',
        'hover',
        'focus',
        'press',
        'type',
        'pressSequentially',
        'selectOption',
        'boundingBox',
        'scrollIntoViewIfNeeded'
    ];
    for (const name of actions) {
        const original = Locator.prototype[name];
        if (typeof original !== 'function') {
            continue;
        }
        Locator.prototype[name] = async function (...args) {
            await showSectionOf(this);
            return original.apply(this, args);
        };
    }
    // page.click(selector) and the others with a selector: through a locator of it
    for (const name of [
        'click',
        'dblclick',
        'tap',
        'fill',
        'check',
        'uncheck',
        'hover',
        'focus',
        'press',
        'type',
        'selectOption'
    ]) {
        const original = Page.prototype[name];
        if (typeof original !== 'function') {
            continue;
        }
        Page.prototype[name] = async function (selector, ...args) {
            if (typeof selector === 'string' && selector.includes('column-settings')) {
                await showSectionOf(this.locator(selector));
            }
            return original.call(this, selector, ...args);
        };
    }
};
