import { html } from 'lit-html';
import { customElement, instance, subscribe } from '@simple-html/core';
import { ProfileService } from '../resources/services/profileservice';
import { SharedState } from '../resources/state/sharedstate';
import * as marked from 'marked';

import { unsafeHTML } from 'lit-html/directives/unsafe-html';
import { href } from '@simple-html/router';

@customElement('profile-comp')
export default class extends HTMLElement {
    public username: any;
    public profile: any;
    public curHash: any;
    public curRoute = '';
    public sharedState: SharedState;
    public profileService: ProfileService;

    constructor() {
        super();

        this.profileService = instance(ProfileService);
        this.sharedState = instance(SharedState);
    }

    connectedCallback() {
        subscribe('routeChange', this, this.routechange.bind(this));
    }

    routechange(x: any) {
        this.curRoute = x.options.name;
        this.render();
    }

    public async activate(_x: string, params: any) {
        this.username = params.name;
        this.profile = await this.profileService.get(this.username);
    }

    public isUser() {
        if (this.profile && this.sharedState.currentUser) {
            return this.profile.username === this.sharedState.currentUser.username;
        } else {
            return false;
        }
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

    public onToggleFollowing() {
        if (this.sharedState.isAuthenticated) {
            this.profile.following = !this.profile.following;
            if (this.profile.following) {
                this.profileService.follow(this.profile.username);
            } else {
                this.profileService.unfollow(this.profile.username);
            }
            this.render();
        } else {
            location.hash = 'login';
        }
    }

    public render() {
        return html`
            <div class="profile-page">
                <div class="user-info">
                    <div class="container">
                        <div class="row">
                            <div class="col-xs-12 col-md-10 offset-md-1">
                                <!-- 
                                        -----------------------------------
                                    -->
                                ${this.profile
                                    ? html`
                                          <img
                                              src=${this.profile ? this.profile.image : undefined}
                                              class="user-img"
                                          />
                                      `
                                    : ''}
                                <!-- 
                                        -----------------------------------
                                    -->
                                ${!this.profile
                                    ? html`
                                          <div class="user-img"></div>
                                      `
                                    : ''}

                                <h4>
                                    ${this.profile.username ? this.profile.username : 'loading..'}
                                </h4>
                                <p>
                                    ${unsafeHTML(this.markedhtml(this.profile.bio))}
                                </p>

                                <!-- 
                                        -----------------------------------
                                    -->
                                ${!this.isUser() && this.profile
                                    ? html`
                                          <button
                                              class="btn btn-sm btn-outline-secondary action-btn"
                                              @click=${this.onToggleFollowing}
                                          >
                                              <i class="ion-plus-round"></i>
                                              &nbsp;
                                              ${this.profile.following ? 'Unfollow' : 'Follow'}
                                              ${this.profile.username}
                                          </button>
                                      `
                                    : ''}
                                <!-- 
                                        -----------------------------------
                                    -->
                                ${this.isUser() && this.profile
                                    ? html`
                                          <a
                                              href=${href('Settings')}
                                              class="btn btn-sm btn-outline-secondary action-btn"
                                          >
                                              <i class="ion-gear-a"></i> Edit Profile Settings
                                          </a>
                                      `
                                    : ''}
                            </div>
                        </div>
                    </div>
                </div>

                <div class="container">
                    <div class="row">
                        <div class="col-xs-12 col-md-10 offset-md-1">
                            <div class="articles-toggle">
                                <ul class="nav nav-pills outline-active">
                                    <li class="nav-item">
                                        <a
                                            class="nav-link ${this.curRoute !== 'Favorites'
                                                ? 'active'
                                                : ''}"
                                            href=${href('MyPosts', { name: this.username })}
                                            >My Posts</a
                                        >
                                    </li>
                                    <li class="nav-item">
                                        <a
                                            class="nav-link ${this.curRoute === 'Favorites'
                                                ? 'active'
                                                : ''}"
                                            href=${href('Favorites', { name: this.username })}
                                            >Favorited Posts</a
                                        >
                                    </li>
                                </ul>
                            </div>

                            <free-router name="subProfile"> </free-router>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
}
