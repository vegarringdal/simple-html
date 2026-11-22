/**
 * Hiding the sidebar - the user: "able to remove side menu might be useful, hamburger menu":
 * - a ☰ button in the sidebar's header hides it, a ☰ button in the top left corner of the page shows it
 *   again (`body.sidebar-hidden`)
 * - a wide screen: the sidebar is beside the page; hidden, the page has the whole width. The choice is
 *   remembered (localStorage, `simple-html-demo-sidebar`)
 * - a narrow screen ({@link NARROW}, a phone): the sidebar starts hidden and opens over the page; a page
 *   picked in it, a click beside it or Esc closes it again
 */

/** a phone, or a narrow window: the sidebar opens over the page */
export const NARROW = '(max-width: 760px)';

const STORAGE_KEY = 'simple-html-demo-sidebar';

/** the stored choice of a wide screen: true when the sidebar was hidden */
function storedHidden(): boolean {
    try {
        return localStorage.getItem(STORAGE_KEY) === 'hidden';
    } catch {
        // storage blocked (a private window): shown
        return false;
    }
}

function storeHidden(hidden: boolean) {
    try {
        localStorage.setItem(STORAGE_KEY, hidden ? 'hidden' : 'shown');
    } catch {
        // storage blocked: not remembered, the page works the same
    }
}

/**
 * Adds the two ☰ buttons and their rules
 * @param app the site's element, the sidebar and the page in it
 * @param sidebar the sidebar
 * @param header the sidebar's header: the hide button goes in it
 */
export function addSidebarToggle(app: HTMLElement, sidebar: HTMLElement, header: HTMLElement) {
    sidebar.id ||= 'sidebar';
    const narrowQuery = window.matchMedia?.(NARROW);
    const isNarrow = () => narrowQuery?.matches === true;

    const button = (className: string, label: string) => {
        const element = document.createElement('button');
        element.type = 'button';
        element.className = className;
        element.textContent = '☰';
        element.title = label;
        element.setAttribute('aria-label', label);
        element.setAttribute('aria-controls', sidebar.id);
        return element;
    };
    const hideButton = button('sidebar-toggle', 'Hide the menu');
    const showButton = button('sidebar-open', 'Show the menu');
    header.appendChild(hideButton);
    app.appendChild(showButton);

    const isHidden = () => document.body.classList.contains('sidebar-hidden');
    const setHidden = (hidden: boolean, remember: boolean) => {
        document.body.classList.toggle('sidebar-hidden', hidden);
        hideButton.setAttribute('aria-expanded', String(!hidden));
        showButton.setAttribute('aria-expanded', String(!hidden));
        if (remember && !isNarrow()) {
            storeHidden(hidden);
        }
    };

    hideButton.addEventListener('click', () => {
        setHidden(true, true);
        showButton.focus();
    });
    showButton.addEventListener('click', () => {
        setHidden(false, true);
        hideButton.focus();
    });

    // a narrow screen: the sidebar is over the page - a page picked, a click beside it or Esc closes it
    sidebar.addEventListener('click', (event) => {
        if (isNarrow() && event.target instanceof Element && event.target.closest('a.nav-item')) {
            setHidden(true, false);
        }
    });
    app.addEventListener('click', (event) => {
        const target = event.target as Node;
        if (isNarrow() && !isHidden() && !sidebar.contains(target) && !showButton.contains(target)) {
            setHidden(true, false);
        }
    });
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && isNarrow() && !isHidden() && sidebar.contains(document.activeElement)) {
            setHidden(true, false);
            showButton.focus();
        }
    });

    // narrow: hidden to start with; wide: as it was left
    const start = () => setHidden(isNarrow() || storedHidden(), false);
    start();
    // a phone turned, a window made narrower or wider
    narrowQuery?.addEventListener?.('change', start);
}
