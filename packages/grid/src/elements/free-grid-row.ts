import { customElement } from '@simple-html/core';
import { GridInterface } from '../gridInterface';
import { FreeGrid } from '../';
import { html } from 'lit-html';

@customElement('free-grid-row')
export default class extends HTMLElement {
    classList: any = 'free-grid-row';
    connector: GridInterface;
    row: {i:number};
    ref: FreeGrid;
    currentHeight: number;

    connectedCallback() {
        const config = this.connector.config;
        this.style.display = 'block'
        this.style.height = config.__rowHeight +'px'
        this.currentHeight = this.row.i * config.__rowHeight
        this.style.transform = `translate3d(0px, ${this.currentHeight}px, 0px)`
        this.ref.addEventListener('scrolled', this)
    }

    handleEvent(e: any){

        if(e.type==='scrolled'){
            this.render()
        }
    }

    disconnectedCallback(){
        this.ref.removeEventListener('scrolled', this)
    }

    
    render() {
        const config = this.connector.config;
        
        // check if height is changed
        if(this.currentHeight !== this.row.i * config.__rowHeight){
            this.currentHeight = this.row.i * config.__rowHeight
            this.style.transform = `translate3d(0px, ${this.row.i * config.__rowHeight}px, 0px)`
        }

        return html`${config.groups.map((group)=>{
            return html`
                <free-grid-group-row .connector=${this.connector} .rowNo=${this.row.i} .ref=${this.ref} .group=${group}>

                </free-grid-group-row>`
        })}`;
    }
}
