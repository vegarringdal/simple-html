import { html } from 'lit-html';
import { IColumns } from '../interfaces';
import { GridInterface } from '../gridInterface';

export function resizeColumnElement(connector: GridInterface, col: IColumns) {
    let originX: number = null;
    const originalColumnWidth = col.width;

    const mouseMove = (e: MouseEvent) => {
        e.preventDefault();
        if (originX) {
            const movment = Math.abs(originX - e.screenX);
            if (movment % 2 === 0) {
                const movementX = originX - e.screenX;
                const newColumnWidth = originalColumnWidth - movementX;
                col.width = newColumnWidth > 10 ? newColumnWidth : 10;
                requestAnimationFrame(() => {
                    connector.reRender();
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

    return html`
        <div class="free-grid-draggable-handler" @mousedown=${mouseDown}></div>
    `;
}
