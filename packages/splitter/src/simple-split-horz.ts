import { customElement, State } from '@simple-html/core';

export type state = {
    active: boolean;
    mainWidth: number;
    nextElementWidth: number;
    previousElementWidth: number;
    x: number;
    y: number;
};

@customElement('simple-split-horz')
export default class extends HTMLElement {
    show: boolean;
    refEle: HTMLElement;
    stateName: string;
    state: State<state>;
    nextElement: HTMLElement;
    previousElement: HTMLElement;

    formState() {
        return this.state.getState();
    }

    connectedCallback() {
        if (!this.stateName) {
            throw 'name attribute needs to be set ".name=${"somename"}';
        }

        this.state = new State<state>(
            '@SIMPLE-HTML/SPLITTER',
            { active: false } as state,
            false,
            this.stateName
        );
        this.style.width = '100%';
        this.style.height = '100%';
        this.style.display = 'flex';

        const [state] = this.formState();

        let first = true;

        for (let i = 0; i < this.children.length; i++) {
            const node = this.children[i];

            if (node && node.tagName === 'simple-split-part'.toUpperCase()) {
                (node as HTMLElement).style.width = (node as HTMLElement).style.width
                    ? (node as HTMLElement).style.width
                    : '50%';
                (node as HTMLElement).style.height = '100%';

                // reset state if any
                if (state.previousElementWidth !== undefined && first) {
                    first = false;
                    const procent = (state.previousElementWidth * 100) / state.mainWidth;
                    (node as HTMLElement).style.width = procent + '%';
                } else {
                    if (state.nextElementWidth !== undefined && !first) {
                        const procent = (state.nextElementWidth * 100) / state.mainWidth;
                        (node as HTMLElement).style.width = procent + '%';
                    }
                }
            }

            if (node && node.tagName === 'simple-split-handle'.toUpperCase()) {
                (node as HTMLElement).style.height = '100%';
                (node as HTMLElement).style.width = '5px';
                (node as HTMLElement).style.cursor = 'grab';
                this.refEle = node as HTMLElement;
            }
        }

        if (!this.refEle) {
            throw 'simple-split-handle missing';
        }

        this.refEle.addEventListener('mousedown', this);

        this.addEventListener('mousemove', this);
    }

    disconnectedCallback() {
        this.refEle.removeEventListener('mousedown', this);
        this.removeEventListener('mouseup', this);
        this.removeEventListener('mousemove', this);
        this.nextElement = null;
        this.previousElement = null;
        this.refEle = null;
    }

    handleEvent(e: MouseEvent) {
        e.preventDefault();
        if (e.type === 'mousedown') {
            this.addEventListener('mouseup', this);
            this.mousedown(e);
        }

        if (e.type === 'mousemove') {
            this.mousemove(e);
        }

        if (e.type === 'mouseup') {
            this.removeEventListener('mouseup', this);
            this.mouseup();
        }
    }

    mousedown(e: any) {
        const [_state, setState] = this.formState();
        const state: state = _state as any;
        state.active = true;
        state.mainWidth = e.target.parentNode?.clientWidth;
        this.nextElement = e.target.nextElementSibling;
        state.nextElementWidth = e.target.nextElementSibling.clientWidth;
        this.previousElement = e.target.previousElementSibling;
        state.previousElementWidth = e.target.previousElementSibling.clientWidth;
        state.x = e.screenX;
        state.y = e.screenY;
        setState(state);
    }

    mouseup() {
        const [state, setState] = this.formState();
        state.active = false;
        state.previousElementWidth = this.previousElement.clientWidth;
        state.nextElementWidth = this.nextElement.clientWidth;
        setState(state);
    }

    mousemove(e: MouseEvent) {
        const [state, setState] = this.formState();
        if (state.active) {
            const change = Math.abs(state.x - e.screenX);
            if (state.x < e.screenX) {
                const procent = ((state.previousElementWidth + change) * 100) / state.mainWidth;

                this.previousElement.style.width = procent + '%';
                this.nextElement.style.width = 100 - procent + '%';
            } else {
                const procent = ((state.previousElementWidth - change) * 100) / state.mainWidth;

                this.previousElement.style.width = procent + '%';
                this.nextElement.style.width = 100 - procent + '%';
            }
            setState(state);
        }
    }
}
