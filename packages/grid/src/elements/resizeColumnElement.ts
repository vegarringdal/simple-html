import { html } from 'lit-html';
import { GridGroupConfig } from '../types';
import { SimpleHtmlGrid } from '../';

export function resizeColumnElement(ref: SimpleHtmlGrid, group: GridGroupConfig) {
    let originX: number = null;
    const originalColumnWidth = group.width;

    const mouseMove = (e: MouseEvent) => {
        e.preventDefault();
        if (originX) {
            const movment = Math.abs(originX - e.screenX);
            if (movment % 2 === 0) {
                const movementX = originX - e.screenX;
                const newColumnWidth = originalColumnWidth - movementX;
                group.width = newColumnWidth > 10 ? newColumnWidth : 10;

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
        document.addEventListener('mousemove', mouseMove);
        document.addEventListener('mouseup', mouseUp);
    };

    return html` <div class="simple-html-grid-draggable-handler" @mousedown=${mouseDown}></div> `;
}
