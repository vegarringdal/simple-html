# @simple-html

This is the docs for little library wrapper Ive made around `lit-html`. For building web pages you
need 2 main parts called `@simple-html/core` & `@simple-html/router`. There is other parts too, but
they are mostly experimental gui components like datagrid, splitter, dropdown etc.

Main goal is to make it a little easier to use web components with the help of `lit-html`. But also
not try and do to much magic except for what `lit-html` does :joy:

You can read about `lit-html` [here](https://lit-html.polymer-project.org/guide).

I only use [typescript](https://www.typescriptlang.org/) and [tailwindcss](https://tailwindcss.com/)
in my personal projects. So the starter kit we will use, will have this included.

I assume you have [git](https://git-scm.com/), [nodejs 14+](https://nodejs.org/en/) and
[vscode](https://code.visualstudio.com/) installed, and have basic understanding of html/css/js. To
make it easier to read html in string literals you should install extension called
[lit-html](https://marketplace.visualstudio.com/items?itemName=bierner.lit-html) in vscode.

<br>
<br>
<br>
<br>
<br>
<br>
<br>
<br>
<br>
<br>
<br>
<br>
<br>
<br>

# Getting started

Core part of this library is to help with creating the web components, updating and communication
between them. We will start the docs with getting started guide. Usually easier to learn by making
something work.

To make it a little easier to get started Ive created a simple starter kit
[here](https://github.com/simple-html/starter-web). We will go into more details about the starter
kit in the next chapter, but to get started we will now clone it, and start it.

Please open your terminal in a folder where you would like to create the project folder.

When you are ready do the following:

-   Run this in the termnal `git clone https://github.com/simple-html/starter-web`.
    -   This will clone the repoository and create folder `starter-web`.
-   Enter folder by running `cd .\starter-web\` and open vscode with `code .`.
-   Now we will open terminal inside vscode, go to menu `view` and go down to `terminal` (please
    notice shortcut to next time).
-   Now run npm install by typing `npm i` in terminal. Wait until it is finished.
-   Lets start the project by running `npm start dev` and open in browser url
    `http://localhost:4444`

You browser should show a blue box with "hello world" inside it.

YAY :joy:

<br>
<br>
<br>
<br>
<br>
<br>

### Getting started: About the starter kit

---

Using a starter kit is a easy way to get started, but its useful to understand a little how it
works. I assume you know how npm modules & package.json works, so I will not go into any details
about this. The project have 2 commands you can run.

-   `npm start`
    -   This runs app in development mode and launches local web server at localhost port 4444
-   `npm run build`
    -   This generates a production build, when its done you will find the files under `build`
        folder.

Atm please overlook everything in the root folder except `src` folder. This will have will have all
the source to our web page. Under `src` folder you will find 4 files.

-   `index.css`
    -   This loads tailwindcss and basic style for body
-   `index.html`
    -   Simple standard html file, only part worth noticing here is the `$css`,`$bundles` in header
        and `<app-root></app-root>` in body.
        -   `$css` is just here to tell fusebox bundler to inject the css here
        -   `$bundles` is just here to tell fusebox bundler to inject path to javascript here
        -   `<app-root></app-root>` is the root of our web app. All elements we generate will be
            inside here.
-   `index.ts`
    -   This is the first code thats loaded by index.html, you dont need to change this. All it does
        is load index.css file. And load a helper library `custom-elements-hmr-polyfill` to make web
        development more fun when we do edits. And load load our app-root element & resets our
        app-root on saves.
-   `app-root.ts`
    -   This contains our main root element. From this element we will add the rest of the
        application.

<br>
<br>
<br>
<br>
<br>
<br>

### Getting started: Closer look at app-root.ts

---

Now we will have a closer look at the starting point of our application, the `app-root.ts`.

Your `app-root.ts` should look something like this:

```ts
import { html } from 'lit-html';
import { customElement } from '@simple-html/core';

@customElement('app-root')
export default class extends HTMLElement {
    public render() {
        return html`
            <span class="inline-block p-2 m-2 bg-indigo-500 text-white">hello world</span>
        `;
    }
}
```

Here is the same, but Ive added some comments. Look in the links under for more details about the
subject.

```ts
// first 2 lines just import html and customElement functions we need.
import { html } from 'lit-html';
import { customElement } from '@simple-html/core';

// With the customElement function we define our html element, we use this as a decorator, this is why we have a `@` before it.
// Decorators are like a wrapper function that can add/alter how class/functions behaves.
// Simple-html decorator makes a base class and use your class to extend it.
// This way it can catch standard native callbacks before you and act on them
@customElement('app-root')
export default class extends HTMLElement {
    // Every element have a lifecycle, we will get into this later.
    // Render function is always called when element is connected first time, or when you call it manually.
    // Here you will mostly return a template result using lit-html its tagged template "html"
    public render() {
        return html`
            <span class="inline-block p-2 m-2 bg-indigo-500 text-white">hello world</span>
        `;
    }
}
```

-   see here for more info about
    [tagged template](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Template_literals#Tagged_templates)
-   see here for more info about [lit-html](https://lit-html.polymer-project.org/)
-   see here for more info about
    [decorators](https://www.typescriptlang.org/docs/handbook/decorators.html)

<br>
<br>
<br>
<br>
<br>
<br>

### Getting started: Lets make a counter

---

Replace the code you have in `app-root.ts` with the code under and save file. The webpage will now
update with 2 buttons on the page, and our hello world box have been replaced by a bigger box with
the current count Sample shows under how we call a method on the class to update local class
property and call render to update the page. In the render function I have added a few classes to
class attribute in `section, span, button`. This is classes from
[tailwindcss](https://tailwindcss.com/) project. tailwind makes it easier and a lot more fun to
style our html.

```ts
import { html } from 'lit-html';
import { customElement } from '@simple-html/core';

@customElement('app-root')
export default class extends HTMLElement {
    // our counter
    public count = 0;

    // called when we click add button
    public addClick() {
        this.count++;
        this.render();
    }

    // called when we click subract button
    public subtractClick() {
        this.count--;
        this.render();
    }

    // click listeners are added when we use `@click` in lit-html, read more about this in lit-html docs
    public render() {
        return html`
            <section class="flex flex-col">
                <span class="inline-block p-2 m-2 bg-indigo-500 text-white text-center">
                    current count
                    <br />
                    ${this.count}
                </span>
                <button class="p-2 m-2 bg-green-500" @click=${this.addClick}>add</button>
                <button class="p-2 m-2 bg-red-500" @click=${this.subtractClick}>subtract</button>
            </section>
        `;
    }
}
```

<details>
<summary>Do I always need to create class methods?</summary>
 
You could have also used arrow function instead of class method

```ts
 <button
  class="p-2 m-2 bg-red-500"
  @click=${() => {
    this.count++;
    this.render();
  }}>
  subtract
</button>
```

</details>

<br>
<br>
<br>
<br>
<br>
<br>

### Getting started: Auto call render with @property()

---

We will now add @Property decorator, this will call `this.render()` for us when changes happens.
This will save us from calling render manually. You can read more about this decorator in its own
chapter on `@simple-html/core`. [Link to @proerty()](#simple-htmlcore-property)

```ts
import { html } from 'lit-html';
import { customElement, property } from '@simple-html/core';

@customElement('app-root')
export default class extends HTMLElement {
    // our counter
    @property() public count = 0;

    // called when we click add button
    public addClick() {
        this.count++;
    }

    // called when we click subract button
    public subtractClick() {
        this.count--;
    }

    // click listeners are added when we use `@click` in lit-html, read more about this in lit-html docs
    public render() {
        return html`
            <section class="flex flex-col">
                <span class="inline-block p-2 m-2 bg-indigo-500 text-white text-center">
                    current count
                    <br />
                    ${this.count}
                </span>
                <button class="p-2 m-2 bg-green-500" @click=${this.addClick}>add</button>
                <button class="p-2 m-2 bg-red-500" @click=${this.subtractClick}>subtract</button>
            </section>
        `;
    }
}
```

<br>
<br>
<br>
<br>
<br>
<br>

### Getting started: Lets make more components and add @attribute

---

Lets create some more elements and use the `@attribute()` decorator. Normally you would have these
elements/classes in seperate files. But this shows how you can split you app into different parts
easly.

Sample under show how you can use `@attribute()` instead of manually getting value with
`this.getAttribute('xx')`. When you use `@attribute()` it will be automatically observed/added to
`static observedAttributes` in custom elements. You can read more about this decorator in its own
chapter on `@simple-html/core`. [Link to attribute()](#simple-htmlcore-attribute)

```ts
import { html } from 'lit-html';
import { attribute, customElement } from '@simple-html/core';

@customElement('app-root')
export class AppRoot extends HTMLElement {
    connectedCallback() {
        // as you can see this is a normal HTMLElement, so you can use normal js
        // it would be cleaner to add this code to main index.css file
        this.style.display = 'flex';
        this.style.flexDirection = 'column';
    }

    public render() {
        return html`
            <header-section my-attribute="att1" class="bg-indigo-300 block"></header-section>

            <content-section
                my-attribute="att1"
                class="block flex flex-grow bg-indigo-600"
            ></content-section>

            <footer-section my-attribute="att1" class="bg-indigo-400 block"></footer-section>
        `;
    }
}

@customElement('header-section')
export class HeaderSection extends HTMLElement {
    @attribute() myAttribute = 'default-value';

    public render() {
        return html` header:${this.myAttribute} `;
    }
}

@customElement('content-section')
export class ContentSection extends HTMLElement {
    @attribute({ attribute: 'my-attribute' }) someOtherName = 'default-value';

    public render() {
        return html` content:${this.someOtherName} `;
    }
}

@customElement('footer-section')
export class FooterSection extends HTMLElement {
    public render() {
        return html` footer:${this.getAttribute('my-attribute') || 'default-value'} `;
    }
}
```

<br>
<br>
<br>
<br>
<br>
<br>

### Getting started: Lets send events between the components

---

Sometimes you might need to send a message to another part of you application, for this you can use
built in `transmitter` functions. You should only send new sting, numbers or new objects with no
reference to other objects/elements, so you dont prevent garbage collector from cleaning up.

```ts
import { html } from 'lit-html';
import { customElement, property, publish, subscribe, unSubscribe } from '@simple-html/core';

@customElement('app-root')
export class AppRoot extends HTMLElement {
    public render() {
        return html`
            <style>
                app-root {
                    display: flex;
                    flex-direction: column;
                }
            </style>

            <header-section class="bg-indigo-300 block"></header-section>

            <content-section class="block flex flex-grow bg-indigo-600"></content-section>

            <footer-section class="bg-indigo-400 block"></footer-section>
        `;
    }
}

@customElement('header-section')
export class HeaderSection extends HTMLElement {
    @property() count = 0;
    connectedCallback() {
        subscribe('SUPER-CHANNEL', this, (arg: number) => {
            this.count = arg;
        });
    }
    disconnectedCallback() {
        unSubscribe('SUPER-CHANNEL', this);
    }
    public render() {
        return html` header:${this.count} `;
    }
}

@customElement('content-section')
export class ContentSection extends HTMLElement {
    @property() counter = 0;

    btnClick() {
        this.counter++;
        publish('SUPER-CHANNEL', this.counter);
    }

    public render() {
        return html`
            <div>
                <button class="p-2 m-2 bg-green-200" @click=${this.btnClick}>add</button>
                <span>Count:${this.counter}</span>
            </div>
        `;
    }
}

@customElement('footer-section')
export class FooterSection extends HTMLElement {
    @property() counter = 0;
    connectedCallback() {
        subscribe('SUPER-CHANNEL', this, (arg: number) => {
            this.counter = arg;
        });
    }
    disconnectedCallback() {
        unSubscribe('SUPER-CHANNEL', this);
    }
    public render() {
        return html` footer:${this.counter} `;
    }
}
```

<br>
<br>
<br>
<br>
<br>
<br>

### Getting started: Lets play with state

---

Using events is great, but for values its a lot easier to use the built in `State` class. This also
remebers values during HMR event. This makes it a lot more fun to make edits.

State class also support object states, see state class for more info. [Link to State](#simple-htmlcore-state)

```ts
import { html } from 'lit-html';
import { customElement, SimpleState } from '@simple-html/core';

// lets create a state container and give it a default value
// simple state uses only simple values like string or numbers
// you could use objetcs, but better to use ObjectState here.
const myCounter = new SimpleState('SUPER_COUNTER', 0);


@customElement('app-root')
export class AppRoot extends HTMLElement {
    public render() {
        return html`
            <style>
                app-root {
                    display: flex;
                    flex-direction: column;
                }
            </style>

            <header-section class="bg-indigo-300 block"></header-section>

            <content-section class="block flex flex-grow bg-indigo-600"></content-section>

            <footer-section class="bg-indigo-400 block"></footer-section>
        `;
    }
}

@customElement('header-section')
export class HeaderSection extends HTMLElement {
    connectedCallback() {
        myCounter.connectStateChanges(this, this.render);
    }

    public render() {
        const count = myCounter.getValue();
        return html` footer:${count} `;
    }
}

@customElement('content-section')
export class ContentSection extends HTMLElement {
    connectedCallback() {
        myCounter.connectStateChanges(this, this.render);
    }

    public render() {
        const [count, setCount] = myCounter.getState();

        return html`
            <div>
                <button class="p-2 m-2 bg-green-200" @click=${() => setCount(count + 1)}>
                    add
                </button>
                <span>Count:${count}</span>
            </div>
        `;
    }
}

@customElement('footer-section')
export class FooterSection extends HTMLElement {
    connectedCallback() {
        myCounter.connectStateChanges(this, this.render);
    }

    public render() {
        const count = myCounter.getValue();
        return html` footer:${count} `;
    }
}
```

<br>
<br>
<br>
<br>
<br>
<br>

### Getting started: Adding router

---

In this sample we will start to use `@simple-html/router` part of this library. This will help us add routing to our app.

```ts
import { html } from "lit-html";
import { customElement } from "@simple-html/core";
import {
  startRouter,
  connectHashChanges,
  routeMatch,
} from "@simple-html/router";

// start router (events listener etc)
startRouter();


// our main appication
@customElement("app-root")
export class AppRoot extends HTMLElement {
  
  
  connectedCallback() {
    // this connected this elements to hash changes, and will be called on every route changes
    connectHashChanges(this, this.render);
  }

  public render() {
    return html`
      <style>
        app-root {
          display: flex;
          flex-direction: column;
        }
      </style>

      <nav class="bg-indigo-900 block">
        <a class="p-2 m-2 inline-block" href="">home</a> 
        <a class="p-2 m-2 inline-block" href="#page1">page1</a>
        <a class="p-2 m-2 inline-block" href="#page2">page2</a>
      </nav>

     <!--   if route matches we show it -->
     <!--  this way you could have several elements showing depending on route -->
      ${routeMatch("")
        ? html`<router-home
            class="block flex flex-col flex-grow bg-indigo-600 m-2 p-2"
          ></router-home>`
        : ""}

      <!--   if route matches we show it -->
      ${routeMatch("#page1")
        ? html`<router-page1
            class="block flex flex-col flex-grow bg-indigo-600 m-2 p-2"
          ></router-page1>`
        : ""}

      <!--   if route matches we show it -->
      ${routeMatch("#page2")
        ? html`<router-page2
            class="block flex flex-col flex-grow bg-indigo-600 m-2 p-2"
          ></router-page1>`
        : ""}
    `;
  }
}

@customElement("router-home")
export class RouterHome extends HTMLElement {
  public render() {
    return html`home`;
  }
}

@customElement("router-page1")
export class RouterPage1 extends HTMLElement {
  public render() {
    return html`page1`;
  }
}

@customElement("router-page2")
export class RouterPage2 extends HTMLElement {
  public render() {
    return html`page2`;
  }
}
```

<br>
<br>
<br>
<br>
<br>
<br>

### Getting started: Go to url

---

Lets use the `goToUrl()` function to add a simple button to go between pages

```ts
import { html } from "lit-html";
import { customElement } from "@simple-html/core";
import {
  startRouter,
  connectHashChanges,
  routeMatch,
  gotoURL,
} from "@simple-html/router";

// start router (events listener etc)
startRouter();
@customElement("app-root")
export class AppRoot extends HTMLElement {
  connectedCallback() {
    // this connected this elements to hash changes, and will be called on every route changes
    connectHashChanges(this, this.render);
  }

  public render() {
    return html`
      <style>
        app-root {
          display: flex;
          flex-direction: column;
        }
      </style>

      <nav class="bg-indigo-900 block">
        <a class="p-2 m-2 inline-block" href="">home</a>
        <a class="p-2 m-2 inline-block" href="#page1">page1</a>
        <a class="p-2 m-2 inline-block" href="#page2">page2</a>
      </nav>

      <!--   if route matches we show it -->
      <!--  this way you could have several elements showing depending on route -->
      ${routeMatch("")
        ? html`<router-home
            class="block flex flex-col flex-grow bg-indigo-600 m-2 p-2"
          ></router-home>`
        : ""}

      <!--   if route matches we show it -->
      ${routeMatch("#page1")
        ? html`<router-page1
            class="block flex flex-col flex-grow bg-indigo-600 m-2 p-2"
          ></router-page1>`
        : ""}

      <!--   if route matches we show it -->
      ${routeMatch("#page2")
        ? html`<router-page2
            class="block flex flex-col flex-grow bg-indigo-600 m-2 p-2"
          ></router-page1>`
        : ""}
    `;
  }
}

@customElement("router-home")
export class RouterHome extends HTMLElement {
  public render() {
    return html`home`;
  }
}

@customElement("router-page1")
export class RouterPage1 extends HTMLElement {
  public render() {
    return html`page1
      <button class="m-2 p-2 bg-green-300" @click=${() => gotoURL("#page2")}>
        go to page 2
      </button>`;
  }
}

@customElement("router-page2")
export class RouterPage2 extends HTMLElement {
  public render() {
    return html`page2
      <button class="m-2 p-2 bg-green-300" @click=${() => gotoURL("#page1")}>
        go to page 1
      </button>`;
  }
}
```

<br>
<br>
<br>
<br>
<br>
<br>

### Getting started: stop navigation if we havent saved

---

Sometimes you might need to check if user have saved before navigating away.
You can prevent navigation with `connectCanDeactivate()` helper. See page 2

```ts
import { html } from "lit-html";
import { customElement, property } from "@simple-html/core";
import {
  startRouter,
  connectHashChanges,
  routeMatch,
  gotoURL,
  connectCanDeactivate,
} from "@simple-html/router";

// start router (events listener etc)
startRouter();
@customElement("app-root")
export class AppRoot extends HTMLElement {
  connectedCallback() {
    // this connected this elements to hash changes, and will be called on every route changes
    connectHashChanges(this, this.render);
  }

  public render() {
    return html`
      <style>
        app-root {
          display: flex;
          flex-direction: column;
        }
      </style>

      <nav class="bg-indigo-900 block">
        <a class="p-2 m-2 inline-block" href="">home</a>
        <a class="p-2 m-2 inline-block" href="#page1">page1</a>
        <a class="p-2 m-2 inline-block" href="#page2">page2</a>
      </nav>

      <!--   if route matches we show it -->
      <!--  this way you could have several elements showing depending on route -->
      ${routeMatch("")
        ? html`<router-home
            class="block flex flex-col flex-grow bg-indigo-600 m-2 p-2"
          ></router-home>`
        : ""}

      <!--   if route matches we show it -->
      ${routeMatch("#page1")
        ? html`<router-page1
            class="block flex flex-col flex-grow bg-indigo-600 m-2 p-2"
          ></router-page1>`
        : ""}

      <!--   if route matches we show it -->
      ${routeMatch("#page2")
        ? html`<router-page2
            class="block flex flex-col flex-grow bg-indigo-600 m-2 p-2"
          ></router-page2> `
        : ""}
    `;
  }
}

@customElement("router-home")
export class RouterHome extends HTMLElement {
  public render() {
    return html`home`;
  }
}

@customElement("router-page1")
export class RouterPage1 extends HTMLElement {
  public render() {
    return html`page1
      <button class="m-2 p-2 bg-green-300" @click=${() => gotoURL("#page2")}>
        go to page 2
      </button>`;
  }
}

@customElement("router-page2")
export class RouterPage2 extends HTMLElement {
  @property() locked: boolean = true;

  connectedCallback() {
    connectCanDeactivate(this, async () => {
      if (this.locked) {
        alert("page is locked, unlock first");
        return false;
      } else {
        return true;
      }
    });
  }

  public toggleInput(){
    this.locked = this.locked ? false : true
  }

  public render() {
    return html`page2
      <button class="m-2 p-2 bg-green-300" @click=${() => gotoURL("#page1")}>
        go to page 1
      </button>
      <label>Locked:</label>
      <input
        type="checkbox"
        .checked=${this.locked}
        @input=${this.toggleInput}
      />`;
  }
}

```

<br>
<br>
<br>
<br>
<br>
<br>

### Getting started: getting param for url

---

This sample shows how to get params during load of new page.
It also shows how to send over params with `goToURL()` helper.


```ts
import { html } from "lit-html";
import { customElement } from "@simple-html/core";
import {
  startRouter,
  connectHashChanges,
  routeMatch,
  gotoURL,
  getRouteParams,
} from "@simple-html/router";

// start router (events listener etc)
startRouter();
@customElement("app-root")
export class AppRoot extends HTMLElement {
  connectedCallback() {
    // this connected this elements to hash changes, and will be called on every route changes
    connectHashChanges(this, this.render);
  }

  public render() {
    return html`
      <style>
        app-root {
          display: flex;
          flex-direction: column;
        }
      </style>

      <nav class="bg-indigo-900 block">
        <a class="p-2 m-2 inline-block" href="">home</a>
        <a class="p-2 m-2 inline-block" href="#page1">page1</a>
        <a class="p-2 m-2 inline-block" href="#page2">page2</a>
      </nav>

      <!--   if route matches we show it -->
      <!--  this way you could have several elements showing depending on route -->
      ${routeMatch("")
        ? html`<router-home
            class="block flex flex-col flex-grow bg-indigo-600 m-2 p-2"
          ></router-home>`
        : ""}

      <!--   if route matches we show it -->
      ${routeMatch("#page1*")
        ? html`<router-page1
            class="block flex flex-col flex-grow bg-indigo-600 m-2 p-2"
          ></router-page1>`
        : ""}

      <!--   if route matches we show it -->
      ${routeMatch("#page2*")
        ? html`<router-page2
            class="block flex flex-col flex-grow bg-indigo-600 m-2 p-2"
          ></router-page1>`
        : ""}
    `;
  }
}

@customElement("router-home")
export class RouterHome extends HTMLElement {
  public render() {
    return html`home`;
  }
}

@customElement("router-page1")
export class RouterPage1 extends HTMLElement {
  public render() {
    const x = getRouteParams("");

    return html`page1
      <button
        class="m-2 p-2 bg-green-300"
        @click=${() => gotoURL("#page2/:cool", { cool: "super" }, { id: 5 })}
      >
        go to page 2
      </button>
      <pre>
        ${JSON.stringify(x)}
      </pre
      >`;
  }
}

@customElement("router-page2")
export class RouterPage2 extends HTMLElement {
  public render() {
    const x = getRouteParams("");

    return html`page2
      <button class="m-2 p-2 bg-green-300" @click=${() => gotoURL("#page1/:name/", { name: "wow" }, { id: 1 })}>
        go to page 1
      </button>
      <pre>
        ${JSON.stringify(x)}
      </pre
      >`;
  }
}

```

<br>
<br>
<br>
<br>
<br>
<br>

# `@simple-html/core`

Next parts shows all the different functions/decorators in `@simple-html/core`

<br>
<br>
<br>
<br>
<br>
<br>

### @simple-html/core: `@customElement()`

---

`@customElement()` decorator helps you register the custom element/component.

```ts
import { html } from 'lit-html';
import { customElement } from '@simple-html/core';

@customElement('app-root')
export default class extends HTMLElement {
    public render() {
        return html` hello world `;
    }
}
```

To use this you would now add `<app-root></app-root>` to you html

#### `@customElement` adds methods:

This is the built in methods simple-html component/element will have.

```ts
@customElement('app-root')
export default class extends HTMLElement {
    // standard web component callback, you need to call super() here
    constructor(...result: any[]): void {
        //  do somethine
    }

    // standard web component callback
    connectedCallback(...result: any[]): void {
        //  do somethine
    }

    //called when it want to render, you supply it with the lit-html template result here
    render(...result: any[]): TemplateResult | Promise<TemplateResult> {
        //  return ..
    }

    // called when render have updated
    updatedCallback(): void {
        //  do somethine
    }

    // standard web component callback
    disconnectedCallback(...result: any[]): void {
        //  do somethine
    }

    // standard web component callback
    attributeChangedCallback(name: string, oldValue: string, newValue: string): void {
        //  do somethine
    }

    // called when attributes or properties observed is updated
    valuesChangedCallback(
        type: 'property' | 'attribute',
        name: string,
        oldValue: string,
        newValue: string
    ): void {
        //  do somethine
    }

    // standard web component callback
    adoptedCallback(...result: any[]): void {
        //  do somethine
    }

    // helper function to get called back when its about to disconnect,
    // useful if you have another component that needs to do something when you component disconnects
    // you can call it, but overriding it is not possible
    registerDisconnectCallback(call: () => void): void {
        //  do somethine
    }

    // helper function like registerDisconnectCallback, this will only be called once, you need to reregister if you want update again
    // you can call it, but overriding it is not possible
    registerUpdatedCallback(call: () => void): void {
        //  do somethine
    }
}
```

<br>
<br>
<br>
<br>
<br>
<br>

### @simple-html/core: `@attribute()`

---

This decorator function help you listen for attribute changes and set this value to a property. Atm
only two options:

-   `skipRender: boolean` setting this to false will prevent it from auto updateing if value is
    changed
-   `attribute: string` so property and attibute does not need to be the same

```ts
@attribute(options: { skipRender?: boolean })
```

If you dont use decorator you need to use the native implementation `observedAttributes`

```ts
@customElement('app-root')
class Ele extends HTMLElement {
    static get observedAttributes() {
        return ['my-attribute'];
    }

    attributeChangedCallback(name: string, oldValue: string, newValue: string) {
        // do something and call render
    }

    valuesChangedCallback(
        type: 'property' | 'attribute',
        name: string,
        oldValue: string,
        newValue: string
    ) {
        // do something and call render
    }

    render() {
        return 'magic';
    }
}
```

If you use decorator same code can be written like this. Its splits camelcase `myAttribute` as
`my-attribute`.

```ts
@customElement('app-root')
class Ele extends HTMLElement {
    @attibute() myAttribute = 'my local default value';

    attributeChangedCallback(name: string, oldValue: string, newValue: string) {
        // do something
        console.log(arguments);
    }

    valuesChangedCallback(
        type: 'property' | 'attribute',
        name: string,
        oldValue: string,
        newValue: string
    ) {
        // do something
        console.log(arguments);
    }

    render() {
        return 'magic';
    }
}
```

<br>
<br>
<br>
<br>
<br>
<br>

### @simple-html/core: `@property()`

---

This decorator function makes it easy to update/listen for changes to property set locally or
externaly

```ts
@property(options: { skipRender: boolean })
```

```ts
@customElement('app-root')
class Ele extends HTMLElement {
    @property() myProp = 'X';

    valuesChangedCallback(
        type: 'property' | 'attribute',
        name: string,
        oldValue: string,
        newValue: string
    ) {
        // do something
        console.log(arguments);
    }

    render() {
        return this.myProp;
    }
}
```

<br>
<br>
<br>
<br>
<br>
<br>

### @simple-html/core: `disconnectedCallback()`

---

This is a utility function that can be used if you need to be notified if disconnectedCallback
happens on a element.

```ts
disconnectedCallback(ctx: HTMLElement, call: () => void):void
```

<br>
<br>
<br>
<br>
<br>
<br>

### @simple-html/core: `requestRender()`

---

Ask a element to update

```ts
requestRender(ctx: HTMLElement):void
```

<br>
<br>
<br>
<br>
<br>
<br>

### @simple-html/core: `updatedCallback()`

---

This is a utility function that can be used if you need to be notified if update happens on a
element. You will need to reregister if you are called..

```ts
updatedCallback(ctx: HTMLElement, call: () => void)
```

<br>
<br>
<br>
<br>
<br>
<br>

### @simple-html/core: `State`

---

State class helps you preserve state during the application. This could be between moving between
pages using the router or HMR event during developement

Simple sample:

### Object state

```ts
// create Object state
import { ObjectState } from '@simple-html/core';
export type state = { firstName: string; lastName: string };
export const formState = new ObjectState<state>('FORM_STATE', {} as state);
```

```ts
// use Object state
const [get, set] = formState.getState();
html`<input .value=${get.firstName} @input=${(e) => set({ firstName: e.target.value })} />`;
```

### Simple state

```ts
// create simple state
import { SimpleState } from '@simple-html/core';
export type state = 'DEFAULT' | 'VIEW1' | 'VIEW2' | 'VIEW3' | 'VIEW4';
export const viewState = new SimpleState<state>('FORM_STATE', 'DEFAULT');
```

```ts
// use Object state
const [currentView, setView] = viewState.getState();
html`<button @click=${(e) => setView('VIEW1')}>${currentView}</button>`;
```

### Reset state

```ts
// there is also a reset option
// this will use first default value unless you give it something new
viewState.reset();
formState.reset();
```

### Connect for updates

```ts
// connect for auto render on changes
import { viewState, formState } from './myState.ts';

// connect in custom element
@customElement('app-root')
class Ele extends HTMLElement {
    connectedCallback() {
        viewState.connectStateChanges(this, this.render);
        formState.connectStateChanges(this, this.render);
    }

    render() {
        // something awsome...
    }
}
```

<br>
<br>
<br>
<br>
<br>
<br>

### @simple-html/core: Transmitter Functions

---

Transmitter functions is a easy way to subscribe and publish events to other parts of you
application. Simple-html uses this internally in router, state etc if you are planning to subscribe,
then connectedCallback will be a good place, and disconnectedCallback for unsubscribe.

#### Transmitter function: `publish()`

Microtask by using Promise.resolve.then(()=>work)

```ts
publish(channel: string, ...args: any[]): void
```

#### Transmitter function: `publishSync()`

Sync

```ts
publishSync(channel: string, ...args: any[]): void
```

#### Transmitter function: `publishNext()`

Next event loop by using SetTimeout 0

```ts
publishNext(channel: string, ...args: any[]): void
```

#### Transmitter function: `unSubscribe()`

Unsubscribes channel

```ts
unSubscribe(channel: string, ctx: any): void
```

#### Transmitter function: `subscribe()`

Subscribe channel

```ts
subscribe(channel: string, ctx: HTMLElement| {} , func: (...args: any[]) => void): void
```

<br>
<br>
<br>
<br>
<br>
<br>
<br>
<br>
<br>
<br>
<br>
<br>
<br>
<br>

# `@simple-html/router`

Router part of simple-html helps you listen and navigate hash events

<br>
<br>
<br>
<br>
<br>
<br>

### @simple-html/router: `startRouter()`

---

To start/enable router

```ts
startRouter():void
```

<br>
<br>
<br>
<br>
<br>
<br>

### @simple-html/router: `connectHashChanges()`

---

To be used in connectedCallback

```ts
const connectHashChanges(context: HTMLElement, callback: () => void)
```

<br>
<br>
<br>
<br>
<br>
<br>

### @simple-html/router: `routeMatch()`

---

```ts
const routeMatch: (hash?: string, locationhash?: string) => boolean;
```

<br>
<br>
<br>
<br>
<br>
<br>

### @simple-html/router: `routeMatchAsync()`

---

```ts
const routeMatchAsync: (
    hash: string,
    importStatement: () => Promise<any>,
    htmlTemplate: TemplateResult
) => '' | ((part: any) => void);
```

Sample:

```ts
render(){
    html`
     ${routeMatchAsync(
        '#settings'
        () => import('./settings'),
        html` <settings-route></settings-route> `
      )}
    `
}

```

<br>
<br>
<br>
<br>
<br>
<br>

### @simple-html/router: `getRouteParams()`

---

```ts
const getRouteParams: (hash: string, locationhash?: string) => any;
```

<br>
<br>
<br>
<br>
<br>
<br>

### @simple-html/router: `connectCanDeactivate()`

```ts
connectedCallback() {
        connectCanDeactivate(this, async () => {
            if (this.locked) {
                alert('page is locked, unlock first');
                return false;
            } else {
                return true;
            }
        });
    }
```

---

Todo..

<br>
<br>
<br>
<br>
<br>
<br>

<br>
<br>
<br>
<br>
<br>
<br>
<br>
<br>
<br>
<br>
<br>
<br>
<br>
<br>

# HMR in apps

---

Just load before eventything. Check with bundler how to treshake it away, depends how it works.
Starter does this already on production builds

```ts
import { applyPolyfill, ReflowStrategy } from 'custom-elements-hmr-polyfill';
applyPolyfill(ReflowStrategy.NONE);

import('./app-root').then(() => {
    // rebuild app
    if (document.body) {
        document.body.innerHTML = '<app-root></app-root>';
    } else {
        // add a dom loaded event if you dont have it in index.html
    }
});
```

<br>
<br>
<br>
<br>
<br>
<br>
<br>
<br>
<br>
<br>
<br>
<br>
<br>
<br>

# TODO on for the docs

These will be next phase 2 and future.., some is just experimental. Focus is to make core and router
3.0 docs ready for final version.

Phase 2

-   @simple-html/grid
-   @simple-html/datasource

Phase future

-   @simple-html/splitter
-   @simple-html/date
-   @simple-html/dropdown

<br>
<br>
<br>
<br>
<br>
<br>
<br>
<br>
<br>
<br>
<br>
<br>
<br>
<br>

# About the monorepo

This is the current packages:

-   [`@simple-html/core`](https://github.com/simple-html/simple-html/tree/master/packages/core)
-   [`@simple-html/router`](https://github.com/simple-html/simple-html/tree/master/packages/router)
-   [`@simple-html/grid`](https://github.com/simple-html/simple-html/tree/master/packages/grid)
    (experimental only atm, will make docs when more ready)
-   [`@simple-html/datasource`](https://github.com/simple-html/simple-html/tree/master/packages/datasource)
    (experimental only atm, will make docs when more ready)
-   [`@simple-html/date`](https://github.com/simple-html/simple-html/tree/master/packages/date)
    (just for fun atm)
-   [`@simple-html/splitter`](https://github.com/simple-html/simple-html/tree/master/packages/splitter)
    (just for fun atm)
-   [`@simple-html/splitter`](https://github.com/simple-html/simple-html/tree/master/packages/dropdown)
    (just for fun atm)

<br>
<br>
<br>
<br>
<br>
<br>

### Why not use some other framework and where is the docs

---

I really did not want to use time on frameworks, just wanted to have fun. I wanted to learn web
components and liked how lit-html worked. After a while I started making helper function to make it
simple to use in apps, so ended up creating this to learn more.

<br>
<br>
<br>
<br>
<br>
<br>

### Development on current packages

---

-   Run `npm install`
-   see how to run samples and start coding

Work in progress - not using lerna for mono repo.

Fusebox is in watch mode when running the samples. Any changes to packages/\* files triggers rebuild
in fusebox.

`HMR` is enabled during the samples.

<br>
<br>
<br>
<br>
<br>
<br>

### Add new package

---

-   copy folder `./packages/template-package` and give it a new name
-   update name in package.json
-   update description in package.json
-   make a new sample- see how to make a new sample
-   copy sample template and use same name

<br>
<br>
<br>
<br>
<br>
<br>

### To run samples

---

You need to read development first before trying to run these.

-   `npm start core`
-   `npm start grid`
-   `npm start router`

<br>
<br>
<br>
<br>
<br>
<br>

### Make new sample

---

-   copy folder `./samples/template-starter` and give it a new name
-   add script to `package.json` to start it (look at the others for how)

<br>
<br>
<br>
<br>
<br>
<br>

### To build all packages

---

-   Set new package version in root `package.json`
-   Run `npm run build:all` - this will now build all packages and sync package json version in all.

<br>
<br>
<br>
<br>
<br>
<br>

## To publish all packages

---

-   Run `pubblish:all` to publish
    -   Or `publish:test` to run publish with `--dry-run` option

<br>
<br>
<br>
<br>
<br>
<br>

### HMR info

---

Load before everything

```ts
import { applyPolyfill, ReflowStrategy } from 'custom-elements-hmr-polyfill';
applyPolyfill(ReflowStrategy.NONE);

import('./app-root').then(() => {
    // rebuild app
    if (document.body) {
        document.body.innerHTML = '<app-root></app-root>';
    } else {
        // add a dom loaded event if you dont have it in index.html
    }
});
```

> To make state container save it self trigger this on hmr event: Important since fusebox flushes
> the core during development of the core...

`window.dispatchEvent(new CustomEvent('IMPLE_HTML_SAVE_STATE'));`

<br>
<br>
<br>
<br>
<br>
<br>

### I need EdgeHTML/IE browser to work in 2020++

---

Use something else... :joy:
