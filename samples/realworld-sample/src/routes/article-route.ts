import { html } from 'lit-html';
import '../components/comment-section';
import { customElement, instance } from '@simple-html/core';
import { ArticleService } from 'src/resources/services/articleservice';
import { CommentService } from 'src/resources/services/commentservice';
import { UserService } from 'src/resources/services/userservice';
import { SharedState } from 'src/resources/state/sharedstate';
import { ProfileService } from 'src/resources/services/profileservice';
import { unsafeHTML } from 'lit-html/directives/unsafe-html.js';
import * as marked from 'marked';
import { href } from '@simple-html/router';

function format(date: Date) {
    return new Date(date).toLocaleDateString('en', {
        month: 'long',
        day: '2-digit',
        year: 'numeric'
    });
}

@customElement('article-comp')
export default class extends HTMLElement {
    public article: any;
    public comments: any = [];
    public myComment: any;
    public routeConfig: any;
    public slug: any;

    public articleService: ArticleService;
    public commentService: CommentService;
    public userService: UserService;
    public sharedState: SharedState;
    public profileService: ProfileService;

    constructor() {
        super();
        this.articleService = instance(ArticleService);
        this.commentService = instance(CommentService);
        this.userService = instance(UserService);
        this.sharedState = instance(SharedState);
        this.profileService = instance(ProfileService);
    }

    public async activate(_route: string, params: any, _routeConfig: any) {
        this.slug = params.slug;
        this.article = await this.articleService.get(this.slug);
        this.comments = (await this.commentService.getList(this.slug)) || [];
    }

    public onToggleFavorited() {
        if (this.sharedState.isAuthenticated) {
            this.article.favorited = !this.article.favorited;
            if (this.article.favorited) {
                this.article.favoritesCount++;
                this.articleService.favorite(this.article.slug);
            } else {
                this.article.favoritesCount--;
                this.articleService.unfavorite(this.article.slug);
            }
            this.render();
        } else {
            location.hash = 'login';
        }
    }

    public onToggleFollowing() {
        if (this.sharedState.isAuthenticated) {
            this.article.author.following = !this.article.author.following;
            if (this.article.author.following) {
                this.profileService.follow(this.article.author.username);
            } else {
                this.profileService.unfollow(this.article.author.username);
            }
            this.render();
        } else {
            location.hash = 'login';
        }
    }

    public async postComment() {
        const comment = await this.commentService.add(this.slug, this.myComment);
        this.comments.push(comment);
        this.myComment = '';
        this.render();
    }

    get canModify() {
        return (
            this.sharedState.currentUser &&
            this.article.author.username === this.sharedState.currentUser.username
        );
    }

    public async deleteArticle() {
        await this.articleService.destroy(this.article.slug);
        location.hash = 'home';
        this.render();
    }

    public async deleteComment(commentId: any) {
        await this.commentService.destroy(commentId, this.slug);
        this.comments = await this.commentService.getList(this.slug);
        this.render();
    }

    public markedhtml(value: any) {
        let markup: string;
        if (value) {
            const renderer = new marked.Renderer();
            markup = marked(value, { renderer: renderer });
        } else {
            markup = '';
        }

        return markup;
    }

    public render() {
        console.log('loaded');
        return html`
            <div class="article-page">
                <div class="banner">
                    <div class="container">
                        <h1>${this.article.title}</h1>
                        <!--   just to stop repeating myself -->
                        ${articleMeta.call(this)}
                    </div>
                </div>

                <div class="container page">
                    <div class="row article-content">
                        <div class="col-md-12">
                            ${unsafeHTML(this.markedhtml(this.article.body))}
                        </div>
                    </div>

                    <hr />

                    <div class="article-actions">
                        <!--   just to stop repeating myself -->
                        ${articleMeta.call(this)}
                    </div>

                    <div class="row">
                        <div class="col-xs-12 col-md-8 offset-md-2">
                            ${this.sharedState.isAuthenticated
                                ? html`
                                      <form class="card comment-form">
                                          <div class="card-block">
                                              <textarea
                                                  class="form-control"
                                                  placeholder="Write a comment..."
                                                  rows="3"
                                                  .value=${this.myComment ? this.myComment : ''}
                                                  @input=${(e: any) =>
                                                      (this.myComment = e.target.value)}
                                              ></textarea>
                                          </div>
                                          <div class="card-footer">
                                              <img
                                                  src="${this.sharedState.currentUser.image
                                                      ? this.sharedState.currentUser.image
                                                      : ''}"
                                                  class="comment-author-img"
                                              />

                                              <!-- PS! do not use button in forms, need to improve override default -->
                                              <input type ="button" class="btn btn-sm btn-primary"
                                              @click=${this.postComment}" value="Post Comment">
                                          </div>
                                      </form>
                                  `
                                : ''}

                            <!-- Loop all comments -->
                            ${this.comments.map((comment: any) => {
                                return html`
                                    <comment-section
                                        .comment=${comment}
                                        .deleteCb=${(id: any) => {
                                            this.deleteComment(id);
                                        }}
                                    >
                                    </comment-section>
                                `;
                            })}
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
}

// same part repeated...
function articleMeta() {
    return html`
        <div class="article-meta">
            <a href=${href('Profile', { name: this.article.author.username })}>
                <img src.bind="${this.article.author.image ? this.article.author.image : ''}" />
            </a>
            <div class="info">
                <a href=${href('Profile', { name: this.article.author.username })} class="author"
                    >${this.article.author.username}</a
                >
                <span class="date">${format(this.article.createdAt)}</span>
            </div>
            ${this.canModify
                ? html`
                      <span>
                          <a
                              class="btn btn-outline-secondary btn-sm"
                              href=${href('EditorSlug', { slug: this.article.slug })}
                          >
                              <i class="ion-edit"></i>&nbsp;Edit Article
                          </a>
                          &nbsp;&nbsp;
                          <button
                              class="btn btn-outline-danger btn-sm"
                              @click=${this.deleteArticle}
                          >
                              <i class="ion-trash-a"></i>&nbsp;Delete Article
                          </button>
                      </span>
                  `
                : ''}
            ${!this.canModify
                ? html`
                      <span>
                          <button
                              class="btn btn-sm btn-outline-secondary"
                              @click=${this.onToggleFollowing}
                          >
                              <i class="ion-plus-round"></i>
                              &nbsp; ${this.article.author.following ? 'Unfollow' : 'Follow'}
                              ${this.article.author.username}
                          </button>
                          &nbsp;&nbsp;
                          <button
                              class="btn btn-sm ${this.article.favorited
                                  ? 'btn-primary'
                                  : 'btn-outline-primary'}"
                              @click=${this.onToggleFavorited}
                          >
                              <i class="ion-heart"></i>
                              &nbsp; ${this.article.favorited ? 'Unfavorite' : 'Favorite'} Post
                              <span class="counter">(${this.article.favoritesCount})</span>
                          </button>
                      </span>
                  `
                : ''}
        </div>
    `;
}
