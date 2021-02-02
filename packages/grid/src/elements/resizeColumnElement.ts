import { GridGroupConfig } from '../types';
import { SimpleHtmlGrid } from '../';

export function resizeColumnElement(ref: SimpleHtmlGrid, getGroup: () => GridGroupConfig) {
    let originX: number = null;
    let originalColumnWidth = getGroup().width;

    const mouseMove = (e: MouseEvent) => {
        e.preventDefault();
        if (originX) {
            const movment = Math.abs(originX - e.screenX);
            if (movment % 2 === 0) {
                const movementX = originX - e.screenX;
                const newColumnWidth = originalColumnWidth - movementX;
                getGroup().width = newColumnWidth > 10 ? newColumnWidth : 10;

                // fix config before trigger
                let totalWidth = 0;
                ref.interface.config.groups.reduce((agg, element) => {
                    element.__left = agg;
                    totalWidth = totalWidth + element.width;
                    return element.__left + element.width;
                }, 0);
                ref.interface.config.__rowWidth = totalWidth;

                requestAnimationFrame(() => {
                    ref.triggerEvent('column-resize');
                });
            }
        }
    };

    const mouseUp = () => {
        document.removeEventListener('mousemove', mouseMove);
        document.removeEventListener('mouseup', mouseUp);
    };

    const mouseDown = (e: MouseEvent) => {
        originX = e.screenX;
        originalColumnWidth = getGroup().width;
        document.addEventListener('mousemove', mouseMove);
        document.addEventListener('mouseup', mouseUp);
    };

    const el = document.createElement('div');
    el.classList.add('simple-html-grid-draggable-handler');
    el.onmousedown = mouseDown;
    return el;
}
