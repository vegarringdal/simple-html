# @simple-html/{packages}

### Custom mono repo for :
* [`@simple-html/grid`](https://github.com/simple-html/simple-html/tree/master/packages/grid)
* [`@simple-html/core`](https://github.com/simple-html/simple-html/tree/master/packages/core)
* [`@simple-html/router`](https://github.com/simple-html/simple-html/tree/master/packages/router)


## Production use
I only use it for very simple pages, if you use it make sure to lock down versions. Since breaking changes comes to router/core and grid when needed until version 1.0.0
When I get there I will start using semver. (maybe even at version 0.1.0)



## Development on current packages
* Run `npm install`
* see how to run samples and start coding

Work in progress - not using lerna for mono repo.

Fusebox is in watch mode when running the samples. Any changes to packages/* files triggers rebuild in fusebox. 

`HMR` is enabled during the samples.


## Add new package
* copy folder `./packages/template-package` and give it a new name
* update name in package.json
* update description in package.json
* make a new sample- see how to make a new sample


## To run samples

You need to read development first before trying to run these.

* `npm run core-sample`
* `npm run grid-sample`
* `npm run router-sample`
* `npm run realworld-sample`

## Make new sample
* copy folder `./samples/template-starter` and give it a new name
* add script to `package.json` to start it (look at the others for how)

## To build all packages
* Set new package version in root `package.json`
* Run `npm run build` - this will now build all packages and sync package json version in all. 

## To publish all packages
* Run `pub-now` to publish 
  * Or `pub-test` to run publish with `--dry-run` option


### HMR info

Load before everything

```
import { applyPolyfill, reflowDOM } from 'custom-elements-hmr-polyfill';

// apply polly fill
applyPolyfill();

//reflow app
reflowDOM();
```

