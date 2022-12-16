import { getElementByClassName } from './getElementByClassName';
import { Grid } from './grid';
import { horizontalScrollHandler } from './horizontalScrollHandler';
import { verticalScrollHandler } from './verticalScrollHandler';

export function addScrollEventListeners(ctx: Grid) {
    const scroller = getElementByClassName(ctx.element, 'simple-html-grid-body-scroller');

    // helper
    function setScrollTop(element: HTMLElement, top: number) {
        element.scrollTop = top;
    }

    // helper
    function setScrollLeft(element: HTMLElement, left: number) {
        element.scrollLeft = left;
    }

    /**
     * right scrollbar
     */
    scroller.addEventListener(
        'scroll',
        (event) => {
            const x = event.currentTarget as HTMLElement;

            setScrollTop(getElementByClassName(ctx.element, 'simple-html-grid-middle-scroller'), x.scrollTop);
            setScrollTop(getElementByClassName(ctx.element, 'simple-html-grid-body-view-group'), x.scrollTop);
            setScrollTop(getElementByClassName(ctx.element, 'simple-html-grid-body-view-selector'), x.scrollTop);
            setScrollTop(getElementByClassName(ctx.element, 'simple-html-grid-body-view-pinned-left'), x.scrollTop);
            setScrollTop(getElementByClassName(ctx.element, 'simple-html-grid-body-view-pinned-middle'), x.scrollTop);
            setScrollTop(getElementByClassName(ctx.element, 'simple-html-grid-body-view-pinned-right'), x.scrollTop);

            // get scrolltop
            const el = event.target as HTMLElement;
            const scrollTop = el.scrollTop;
            verticalScrollHandler(ctx, scrollTop);
        },
        { passive: false }
    );

    /**
     * middle scrollbar
     */
    const middle = getElementByClassName(ctx.element, 'simple-html-grid-middle-scroller');
    middle.addEventListener(
        'scroll',
        (event) => {
            const el = event.currentTarget as HTMLElement;

            setScrollLeft(getElementByClassName(ctx.element, 'simple-html-grid-body-view-pinned-middle'), el.scrollLeft);
            setScrollLeft(getElementByClassName(ctx.element, 'simple-html-grid-header-view-pinned-middle'), el.scrollLeft);
            const scrollLeft = el.scrollLeft;
            if (ctx.lastScrollLeft !== el.scrollLeft) {
                horizontalScrollHandler(ctx, scrollLeft);
            }

            setScrollTop(getElementByClassName(ctx.element, 'simple-html-grid-body-scroller'), el.scrollTop);
        },
        { passive: false }
    );

    /**
     *wheel event, only way to get it unless we disable pointer events
     */
    ctx.element.addEventListener(
        'wheel',
        (event) => {
            if (event.shiftKey && event.ctrlKey) {
                event.preventDefault();
                const el = getElementByClassName(ctx.element, 'simple-html-grid-middle-scroller');
                const movement = el.scrollLeft - (event as any).wheelDeltaY;
                console.log(movement);
                setScrollLeft(getElementByClassName(ctx.element, ' simple-html-grid-middle-scroller'), movement);
            } else {
                const el = getElementByClassName(ctx.element, 'simple-html-grid-body-scroller');
                ctx.focusElement.focus();
                const movement = el.scrollTop - (event as any).wheelDeltaY;
                setScrollTop(getElementByClassName(ctx.element, 'simple-html-grid-body-scroller'), movement);
            }
        },
        { passive: false }
    );

    let lastY = 0;
    let lastX = 0;
    ctx.element.addEventListener(
        'touchstart',
        (event) => {
            lastY = event.touches[0].clientY;
            lastX = event.touches[0].clientX;
        },
        { passive: false }
    );

    /**
     *wheel event, only way to get it unless we disable pointer events
     */
    ctx.element.addEventListener(
        'touchmove',
        (event) => {
            const x = getElementByClassName(ctx.element, 'simple-html-grid-body-view-pinned-middle');
            ctx.focusElement.focus();

            const currentY = event.touches[0].clientY;
            const deltaY = currentY - lastY;
            lastY = currentY;
            const movementY = x.scrollTop - deltaY;
            setScrollTop(getElementByClassName(ctx.element, 'simple-html-grid-body-scroller'), movementY);

            const currentX = event.touches[0].clientX;
            const deltaX = currentX - lastX;
            lastX = currentX;
            const movementX = x.scrollLeft - deltaX;
            setScrollLeft(getElementByClassName(ctx.element, ' simple-html-grid-middle-scroller'), movementX);

            /* 
                an idea...
                
                if(!event.target?.classList.contains('simple-html-grid-panel') && !event.target?.classList.contains('simple-html-grid-footer')){
                    let currentY = event.touches[0].clientY;             
                    const deltaY = currentY - lastY;
                    lastY = currentY;
                    const movementY = x.scrollTop - deltaY * 5;
                    setScrollTop(getElementByClassName(ctx.element, 'simple-html-grid-body-scroller'), movementY);
                } else{
                    const currentX = event.touches[0].clientX;
                    const deltaX = currentX - lastX;
                    lastX = currentX;
                    const movementX = x.scrollLeft - deltaX*5;
                    setScrollLeft(getElementByClassName(ctx.element, ' simple-html-grid-middle-scroller'), movementX)
                } */
        },
        { passive: false }
    );
}
