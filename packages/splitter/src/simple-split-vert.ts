import { customElement, State } from '@simple-html/core';

export type state = {
    active: boolean;
    mainHeight: number;
    nextElementHeight: number;
    previousElementHeight: number;
    x: number;
    y: number;
};
@customElement('simple-split-vert')
export default class extends HTMLElement {
    show: boolean;
    refEle: HTMLElement;
    stateName: string;
    state: State<state>;
    previousElement: HTMLElement;
    nextElement: HTMLElement;

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
        this.style.flexDirection = 'column';

        if (!this.stateName) {
            throw 'name attribute needs to be set ".name=${"somename"}';
        }

        const [state] = this.formState();

        let first = true;

        for (let i = 0; i < this.children.length; i++) {
            const node = this.children[i];

            if (node && node.tagName === 'simple-split-part'.toUpperCase()) {
                (node as HTMLElement).style.height = (node as HTMLElement).style.height
                    ? (node as HTMLElement).style.height
                    : '50%';
                (node as HTMLElement).style.width = '100%';

                // reset state if any

                if (state.previousElementHeight !== undefined && first) {
                    first = false;
                    const procent = (state.previousElementHeight * 100) / state.mainHeight;
                    (node as HTMLElement).style.height = procent + '%';
                } else {
                    if (state.nextElementHeight !== undefined && !first) {
                        const procent = (state.nextElementHeight * 100) / state.mainHeight;
                        (node as HTMLElement).style.height = procent + '%';
                    }
                }
            }

            if (node && node.tagName === 'simple-split-handle'.toUpperCase()) {
                (node as HTMLElement).style.width = '100%';
                (node as HTMLElement).style.height = '5px';
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
        //e.stopPropagation(); will break if I have these adn many splitters
        //e.preventDefault(); will break if I have these adn many splitters
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
        state.mainHeight = e.target.parentNode?.clientHeight;
        this.nextElement = e.target.nextElementSibling;
        state.nextElementHeight = e.target.nextElementSibling.clientHeight;
        this.previousElement = e.target.previousElementSibling;
        state.previousElementHeight = e.target.previousElementSibling.clientHeight;
        state.x = e.screenX;
        state.y = e.screenY;
        setState(state);
    }

    mouseup() {
        const [state, setState] = this.formState();
        state.active = false;
        state.previousElementHeight = this.previousElement.clientHeight;
        state.nextElementHeight = this.nextElement.clientHeight;
        setState(state);
    }

    mousemove(e: MouseEvent) {
        const [state, setState] = this.formState();
        if (state.active) {
            const change = Math.abs(state.y - e.screenY);
            if (state.y < e.screenY) {
                const procent = ((state.previousElementHeight + change) * 100) / state.mainHeight;

                this.previousElement.style.height = procent + '%';
                this.nextElement.style.height = 100 - procent + '%';
            } else {
                const procent = ((state.previousElementHeight - change) * 100) / state.mainHeight;

                this.previousElement.style.height = procent + '%';
                this.nextElement.style.height = 100 - procent + '%';
            }
            setState(state);
        }
    }
}
