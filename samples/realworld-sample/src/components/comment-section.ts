import { html } from 'lit-html';
import { customElement, instance } from '@simple-html/core';
import { SharedState } from 'src/resources/state/sharedstate';
import { href } from '@simple-html/router';
function format(date: Date) {
    return new Date(date).toLocaleDateString('en', {
        month: 'long',
        day: '2-digit',
        year: 'numeric'
    });
}

@customElement('comment-section')
export default class extends HTMLElement {
    public comment: any;
    public sharedState: any;
    public deleteCb: Function;

    get canModify() {
        return (
            this.sharedState.currentUser &&
            this.comment.author.username === this.sharedState.currentUser.username
        );
    }

    constructor() {
        super();
        this.sharedState = instance(SharedState);
    }

    public render() {
        return html`
            <div class="card">
                <div class="card-block">
                    <p class="card-text">${this.comment.body}</p>
                </div>

                <div class="card-footer">
                    <a
                        href=${href('Profile', { name: this.comment.author.username })}
                        class="comment-author"
                    >
                        <img src=${this.comment.author.image} class="comment-author-img" />
                    </a>

                    &nbsp;

                    <a
                        href=${href('Profile', { name: this.comment.author.username })}
                        class="comment-author"
                        >${this.comment.author.username}</a
                    >
                    <span class="date-posted">${format(this.comment.createdAt)}</span>

                    ${this.canModify
                        ? html`
                              <span class="mod-options">
                                  <i
                                      class="ion-trash-a"
                                      @click=${() => {
                                          this.deleteCb(this.comment.id);
                                      }}
                                  ></i>
                              </span>
                          `
                        : ''}
                </div>
            </div>
        `;
    }
}
