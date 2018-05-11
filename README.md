
# greenlock

Forked from [coolaj86/greenlock.js](https://git.coolaj86.com/coolaj86/greenlock.js)

Automatic [Let's Encrypt](https://letsencrypt.org) (ACME) HTTPS / TLS / SSL Certificates for node.js

Free SSL with [90-day](https://letsencrypt.org/2015/11/09/why-90-days.html) HTTPS / TLS Certificates

Forked from [Daplie/node-greenlock](https://git.daplie.com/Daplie/node-greenlock).

## Install

`greenlock` requires at least two plugins:
one for managing certificate storage and the other for handling ACME challenges.

The default storage plugin is [`le-store-certbot`](https://git.daplie.com/Daplie/le-store-certbot)
and the default challenge is [`le-challenge-fs`](https://git.daplie.com/Daplie/le-challenge-fs).

```bash
npm install --save greenlock@2.x

npm install --save le-store-certbot@2.x   # default plugin for accounts, certificates, and keypairs
npm install --save le-challenge-fs@2.x    # default plugin for http-01 challenge
npm install --save le-challenge-sni@2.x   # default plugin for tls-sni-01 and tls-sni-02 challenge
npm install --save le-acme-core@2.x       # default plugin for ACME spec
npm install --save le-sni-auto@2.x        # default plugin for SNICallback
```

**Important**: Use node v4.5+ or v6.x, node <= v4.4 has a [known bug](https://github.com/nodejs/node/issues/8053) in the `Buffer` implementation.

## Usage

The configuration consists of 3 components:

* Storage Backend (search npm for projects starting with 'le-store-')
* ACME Challenge Handlers (search npm for projects starting with 'le-challenge-')
* Letsencryt Config (this is all you)

```javascript
'use strict';

var LE = require('greenlock');
var le;


// Storage Backend
var leStore = require('le-store-certbot').create({
  configDir: '~/acme/etc'                                 // or /etc/letsencrypt or wherever
, debug: false
});


// ACME Challenge Handlers
var leHttpChallenge = require('le-challenge-fs').create({
  webrootPath: '~/acme/var/'                              // or template string such as
, debug: false                                            // '/srv/www/:hostname/.well-known/acme-challenge'
});
var leSniChallenge = require('le-challenge-sni').create({
, debug: false
});


function leAgree(opts, agreeCb) {
  // opts = { email, domains, tosUrl }
  agreeCb(null, opts.tosUrl);
}

le = LE.create({
  server: LE.stagingServerUrl                             // or LE.productionServerUrl
, store: leStore                                          // handles saving of config, accounts, and certificates
, challenges: {
    'http-01': leHttpChallenge                            // handles /.well-known/acme-challege keys and tokens
  , 'tls-sni-01': leSniChallenge                          // handles generating a certificate with the correct name
  , 'tls-sni-02': leSniChallenge
  }
, challengeType: 'http-01'                                // default to this challenge type
, agreeToTerms: leAgree                                   // hook to allow user to view and accept LE TOS
//, sni: require('le-sni-auto').create({})                // handles sni callback
, debug: false
//, log: function (debug) {console.log.apply(console, args);} // handles debug outputs
});


// If using express you should use the middleware
// app.use('/', le.middleware());
//
// Otherwise you should see the test file for usage of this:
// le.challenges['http-01'].get(opts.domain, key, val, done)



// Check in-memory cache of certificates for the named domain
le.check({ domains: [ 'example.com' ] }).then(function (results) {
  if (results) {
    // we already have certificates
    return;
  }


  // Register Certificate manually
  le.register({

    domains: ['example.com']                                // CHANGE TO YOUR DOMAIN (list for SANS)
  , email: 'user@email.com'                                 // CHANGE TO YOUR EMAIL
  , agreeTos: ''                                            // set to tosUrl string (or true) to pre-approve (and skip agreeToTerms)
  , rsaKeySize: 2048                                        // 2048 or higher
  , challengeType: 'http-01'                                // http-01, tls-sni-01, or dns-01

  }).then(function (results) {

    console.log('success');

  }, function (err) {

    // Note: you must either use le.middleware() with express,
    // manually use le.challenges['http-01'].get(opts, domain, key, val, done)
    // or have a webserver running and responding
    // to /.well-known/acme-challenge at `webrootPath`
    console.error('[Error]: node-greenlock/examples/standalone');
    console.error(err.stack);

  });

});
```

Here's what `results` looks like:

```javascript
{ privkey: ''     // PEM encoded private key
, cert: ''        // PEM encoded cert
, chain: ''       // PEM encoded intermediate cert
, issuedAt: 0     // notBefore date (in ms) parsed from cert
, expiresAt: 0    // notAfter date (in ms) parsed from cert
, subject: ''     // example.com
, altnames: []    // example.com,www.example.com
}
```

## API

The full end-user API is exposed in the example above and includes all relevant options.

```
le.register(opts)
le.check(opts)
```

### Helper Functions

We do expose a few helper functions:

* LE.validDomain(hostname) // returns '' or the hostname string if it's a valid ascii or punycode domain name

TODO fetch domain tld list

### Template Strings

The following variables will be tempalted in any strings passed to the options object:

* `~/` replaced with `os.homedir()` i.e. `/Users/aj`
* `:hostname` replaced with the first domain in the list i.e. `example.com`

## Developer API

If you are developing an `le-store-*` or `le-challenge-*` plugin you need to be aware of
additional internal API expectations.

**IMPORTANT**:

Use `v2.0.0` as your initial version - NOT v0.1.0 and NOT v1.0.0 and NOT v3.0.0.
This is to indicate that your module is compatible with v2.x of node-greenlock.

Since the public API for your module is defined by node-greenlock the major version
should be kept in sync.

### store implementation

See <https://git.daplie.com/Daplie/le-store-SPEC>

* getOptions()
* accounts.
  * checkKeypair(opts, cb)
  * check(opts, cb)
  * setKeypair(opts, keypair, cb)
  * set(opts, reg, cb)
* certificates.
  * checkKeypair(opts, cb)
  * check(opts, cb)
  * setKeypair(opts, keypair, cb)
  * set(opts, reg, cb)

### challenge implementation

See https://git.daplie.com/Daplie/le-challenge-fs

* `.set(opts, domain, key, value, cb);`         // opts will be saved with domain/key
* `.get(opts, domain, key, cb);`                // opts will be retrieved by domain/key
* `.remove(opts, domain, key, cb);`             // opts will be retrieved by domain/key

