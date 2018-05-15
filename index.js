'use strict';

var DAY = 24 * 60 * 60 * 1000;
//var MIN = 60 * 1000;
var ACME = require('acme-v2/compat').ACME;

var Greenlock = module.exports;
Greenlock.Greenlock = Greenlock;
Greenlock.LE = Greenlock;
// in-process cache, shared between all instances
var ipc = {};

function _log(debug) {
  if (debug) {
    var args = Array.prototype.slice.call(arguments);
    args.shift();
    args.unshift("[gl/index.js]");
    console.log.apply(console, args);
  }
}

Greenlock.defaults = {
  productionServerUrl: 'https://acme-v01.api.letsencrypt.org/directory'
, stagingServerUrl: 'https://acme-staging.api.letsencrypt.org/directory'

, rsaKeySize: ACME.rsaKeySize || 2048
, challengeType: ACME.challengeType || 'http-01'
, challengeTypes: ACME.challengeTypes || [ 'http-01', 'dns-01' ]

, acmeChallengePrefix: ACME.acmeChallengePrefix
};

// backwards compat
Object.keys(Greenlock.defaults).forEach(function (key) {
  Greenlock[key] = Greenlock.defaults[key];
});

// show all possible options
var u; // undefined
Greenlock._undefined = {
  acme: u
, store: u
, challenge: u
, challenges: u
, sni: u
, tlsOptions: u

, register: u
, check: u

, renewWithin: u // le-auto-sni and core
//, renewBy: u // le-auto-sni
, acmeChallengePrefix: u
, rsaKeySize: u
, challengeType: u
, server: u
, version: u
, agreeToTerms: u
, _ipc: u
, duplicate: u
, _acmeUrls: u
};
Greenlock._undefine = function (gl) {
  Object.keys(Greenlock._undefined).forEach(function (key) {
    if (!(key in gl)) {
      gl[key] = u;
    }
  });

  return gl;
};
Greenlock.create = function (gl) {
  var PromiseA = require('bluebird');

  gl.store = gl.store || require('le-store-certbot').create({ debug: gl.debug });
  gl.core = require('./lib/core');
  var log = gl.log || _log;

  if (!gl.challenges) {
    gl.challenges = {};
  }
  if (!gl.challenges['http-01']) {
    gl.challenges['http-01'] = require('le-challenge-fs').create({ debug: gl.debug });
  }
  if (!gl.challenges['dns-01']) {
    try {
      gl.challenges['dns-01'] = require('le-challenge-ddns').create({ debug: gl.debug });
    } catch(e) {
      try {
        gl.challenges['dns-01'] = require('le-challenge-dns').create({ debug: gl.debug });
      } catch(e) {
        // not yet implemented
      }
    }
  }

  gl = Greenlock._undefine(gl);
  gl.acmeChallengePrefix = Greenlock.acmeChallengePrefix;
  gl.rsaKeySize = gl.rsaKeySize || Greenlock.rsaKeySize;
  gl.challengeType = gl.challengeType || Greenlock.challengeType;
  gl._ipc = ipc;
  gl._communityPackage = gl._communityPackage || 'greenlock.js';
  gl.agreeToTerms = gl.agreeToTerms || function (args, agreeCb) {
    agreeCb(new Error("'agreeToTerms' was not supplied to Greenlock and 'agreeTos' was not supplied to Greenlock.register"));
  };

  if (!gl.renewWithin) { gl.renewWithin = 14 * DAY; }
  // renewBy has a default in le-sni-auto



  ///////////////////////////
  // BEGIN VERSION MADNESS //
  ///////////////////////////

  if (!gl.version) {
    //console.warn("Please specify version: 'v01' (Let's Encrypt v1) or 'draft-11' (Let's Encrypt v2 / ACME draft 11)");
    console.warn("");
    console.warn("");
    console.warn("");
    console.warn("====================================================================");
    console.warn("==                     greenlock.js (v2.2.0+)                     ==");
    console.warn("====================================================================");
    console.warn("");
    console.warn("Please specify 'version' option:");
    console.warn("");
    console.warn("        'draft-11' for Let's Encrypt v2 and ACME draft 11");
    console.warn("        ('v02' is an alias of 'draft-11'");
    console.warn("");
    console.warn("or");
    console.warn("");
    console.warn("        'v01' for Let's Encrypt v1 (deprecated)");
    console.warn("");
    console.warn("====================================================================");
    console.warn("==      this will be required from version v2.3 forward           ==");
    console.warn("====================================================================");
    console.warn("");
    console.warn("");
    console.warn("");
  } else if ('v02' === gl.version) {
    gl.version = 'draft-11';
  } else if ('v01' !== gl.version && 'draft-11' !== gl.version) {
    throw new Error("Unrecognized version '" + gl.version + "'");
  }

  if (!gl.server) {
    throw new Error("opts.server must specify an ACME directory URL, such as 'https://acme-staging-v02.api.letsencrypt.org/directory'");
  }
  if ('staging' === gl.server) {
    gl.server = 'https://acme-staging.api.letsencrypt.org/directory';
    gl.version = 'v01';
    console.warn("");
    console.warn("");
    console.warn("=== WARNING ===");
    console.warn("");
    console.warn("Due to versioning issues the 'staging' option is deprecated. Please specify the full url and version.");
    console.warn("");
    console.warn("\t--acme-url '" + gl.server + "' \\");
    console.warn("\t--acme-version '" + gl.version + "' \\");
    console.warn("");
    console.warn("");
  }
  else if ('production' === gl.server) {
    gl.server = 'https://acme-v01.api.letsencrypt.org/directory';
    gl.version = 'v01';
    console.warn("");
    console.warn("");
    console.warn("=== WARNING ===");
    console.warn("");
    console.warn("Due to versioning issues the 'production' option is deprecated. Please specify the full url and version.");
    console.warn("");
    console.warn("\t--acme-url '" + gl.server + "' \\");
    console.warn("\t--acme-version '" + gl.version + "' \\");
    console.warn("");
    console.warn("");
  }

  function loadLeV01() {
    console.warn("");
    console.warn("=== WARNING ===");
    console.warn("");
    console.warn("Let's Encrypt v1 is deprecated. Please update to Let's Encrypt v2 (ACME draft 11)");
    console.warn("");
    try {
      return require('le-acme-core').ACME;
    } catch(e) {
      console.error(e);
      console.info("");
      console.info("");
      console.info("If you require v01 API support (which is deprecated), you must install it:");
      console.info("");
      console.info("\tnpm install le-acme-core");
      console.info("");
      console.info("");
      process.exit(e.code || 13);
    }
  }

  if (-1 !== [
      'https://acme-v02.api.letsencrypt.org/directory'
    , 'https://acme-staging-v02.api.letsencrypt.org/directory' ].indexOf(gl.server)
  ) {
    if ('draft-11' !== gl.version) {
      console.warn("Detected Let's Encrypt v02 URL. Changing version to draft-11.");
      gl.version = 'draft-11';
    }
  } else if (-1 !== [
      'https://acme-v01.api.letsencrypt.org/directory'
    , 'https://acme-staging.api.letsencrypt.org/directory' ].indexOf(gl.server)
    || 'v01' === gl.version
  ) {
    if ('v01' !== gl.version) {
      console.warn("Detected Let's Encrypt v01 URL (deprecated). Changing version to v01.");
      gl.version = 'v01';
    }
  }
  if ('v01' === gl.version) {
    ACME = loadLeV01();
  }
  /////////////////////////
  // END VERSION MADNESS //
  /////////////////////////



  gl.acme = gl.acme || ACME.create({ debug: gl.debug });
  if (gl.acme.create) {
    gl.acme = gl.acme.create(gl);
  }
  gl.acme = PromiseA.promisifyAll(gl.acme);
  gl._acmeOpts = gl.acme.getOptions();
  Object.keys(gl._acmeOpts).forEach(function (key) {
    if (!(key in gl)) {
      gl[key] = gl._acmeOpts[key];
    }
  });

  if (gl.store.create) {
    gl.store = gl.store.create(gl);
  }
  gl.store = PromiseA.promisifyAll(gl.store);
  gl.store.accounts = PromiseA.promisifyAll(gl.store.accounts);
  gl.store.certificates = PromiseA.promisifyAll(gl.store.certificates);
  gl._storeOpts = gl.store.getOptions();
  Object.keys(gl._storeOpts).forEach(function (key) {
    if (!(key in gl)) {
      gl[key] = gl._storeOpts[key];
    }
  });


  //
  // Backwards compat for <= v2.1.7
  //
  if (gl.challenge) {
    console.warn("Deprecated use of gl.challenge. Use gl.challenges['" + Greenlock.challengeType + "'] instead.");
    gl.challenges[gl.challengeType] = gl.challenge;
  }

  Greenlock.challengeTypes.forEach(function (challengeType) {
    var challenger = gl.challenges[challengeType];

    if (!challenger) {
      return;
    }

    if (challenger.create) {
      challenger = gl.challenges[challengeType] = challenger.create(gl);
    }
    challenger = gl.challenges[challengeType] = PromiseA.promisifyAll(challenger);
    gl['_challengeOpts_' + challengeType] = challenger.getOptions();
    Object.keys(gl['_challengeOpts_' + challengeType]).forEach(function (key) {
      if (!(key in gl)) {
        gl[key] = gl['_challengeOpts_' + challengeType][key];
      }
    });

    // TODO wrap these here and now with tplCopy?
    if (!challenger.set || 5 !== challenger.set.length) {
      throw new Error("gl.challenges[" + challengeType + "].set receives the wrong number of arguments."
        + " You must define setChallenge as function (opts, domain, token, keyAuthorization, cb) { }");
    }
    if (challenger.get && 4 !== challenger.get.length) {
      throw new Error("gl.challenges[" + challengeType + "].get receives the wrong number of arguments."
        + " You must define getChallenge as function (opts, domain, token, cb) { }");
    }
    if (!challenger.remove || 4 !== challenger.remove.length) {
      throw new Error("gl.challenges[" + challengeType + "].remove receives the wrong number of arguments."
        + " You must define removeChallenge as function (opts, domain, token, cb) { }");
    }

/*
    if (!gl._challengeWarn && (!challenger.loopback || 4 !== challenger.loopback.length)) {
      gl._challengeWarn = true;
      console.warn("gl.challenges[" + challengeType + "].loopback should be defined as function (opts, domain, token, cb) { ... } and should prove (by external means) that the ACME server challenge '" + challengeType + "' will succeed");
    }
    else if (!gl._challengeWarn && (!challenger.test || 5 !== challenger.test.length)) {
      gl._challengeWarn = true;
      console.warn("gl.challenges[" + challengeType + "].test should be defined as function (opts, domain, token, keyAuthorization, cb) { ... } and should prove (by external means) that the ACME server challenge '" + challengeType + "' will succeed");
    }
*/
  });

  gl.sni = gl.sni || null;
  gl.tlsOptions = gl.tlsOptions || gl.httpsOptions || {};
  if (!gl.tlsOptions.SNICallback) {
    if (!gl.getCertificatesAsync && !gl.getCertificates) {
      if (Array.isArray(gl.approveDomains)) {
        gl.approvedDomains = gl.approveDomains;
        gl.approveDomains = null;
      }
      if (!gl.approveDomains) {
        gl.approvedDomains = gl.approvedDomains || [];
        gl.approveDomains = function (lexOpts, certs, cb) {
          if (!gl.email) {
            throw new Error("le-sni-auto is not properly configured. Missing email");
          }
          if (!gl.agreeTos) {
            throw new Error("le-sni-auto is not properly configured. Missing agreeTos");
          }
          if (!gl.approvedDomains.length) {
            throw new Error("le-sni-auto is not properly configured. Missing approveDomains(domain, certs, callback)");
          }
          if (lexOpts.domains.every(function (domain) {
            return -1 !== gl.approvedDomains.indexOf(domain);
          })) {
            lexOpts.domains = gl.approvedDomains.slice(0);
            lexOpts.email = gl.email;
            lexOpts.agreeTos = gl.agreeTos;
            lexOpts.communityMember = lexOpts.communityMember;
            return cb(null, { options: lexOpts, certs: certs });
          }
          log(gl.debug, 'unapproved domain', lexOpts.domains, gl.approvedDomains);
          cb(new Error("unapproved domain"));
        };
      }

      gl.getCertificates = function (domain, certs, cb) {
        // certs come from current in-memory cache, not lookup
        log(gl.debug, 'gl.getCertificates called for', domain, 'with certs for', certs && certs.altnames || 'NONE');
        var opts = { domain: domain, domains: certs && certs.altnames || [ domain ] };

        try {
          gl.approveDomains(opts, certs, function (_err, results) {
            if (_err) {
              log(gl.debug, 'gl.approveDomains called with error', _err);
              cb(_err);
              return;
            }

            log(gl.debug, 'gl.approveDomains called with certs for', results.certs && results.certs.altnames || 'NONE', 'and options:');
            log(gl.debug, results.options);

            var promise;

            if (results.certs) {
              log(gl.debug, 'gl renewing');
              promise = gl.core.certificates.renewAsync(results.options, results.certs);
            }
            else {
              log(gl.debug, 'gl getting from disk or registering new');
              promise = gl.core.certificates.getAsync(results.options);
            }

            return promise.then(function (certs) { cb(null, certs); }, function (e) {
              if (gl.debug) { console.debug("Error"); console.debug(e); }
              cb(e);
            });
          });
        } catch(e) {
          console.error("[ERROR] Something went wrong in approveDomains:");
          console.error(e);
          console.error("BUT WAIT! Good news: It's probably your fault, so you can probably fix it.");
        }
      };
    }
    gl.sni = gl.sni || require('le-sni-auto');
    if (gl.sni.create) {
      gl.sni = gl.sni.create(gl);
    }
    gl.tlsOptions.SNICallback = function (domain, cb) {
      try {
        gl.sni.sniCallback(domain, cb);
      } catch(e) {
        console.error("[ERROR] Something went wrong in the SNICallback:");
        console.error(e);
        cb(e);
      }
    };
  }

  // We want to move to using tlsOptions instead of httpsOptions, but we also need to make
  // sure anything that uses this object will still work if looking for httpsOptions.
  gl.httpsOptions = gl.tlsOptions;

  if (gl.core.create) {
    gl.core = gl.core.create(gl);
  }

  gl.renew = function (args, certs) {
    return gl.core.certificates.renewAsync(args, certs);
  };

  gl.register = function (args) {
    return gl.core.certificates.getAsync(args);
  };

  gl.check = function (args) {
    // TODO must return email, domains, tos, pems
    return gl.core.certificates.checkAsync(args);
  };

  gl.middleware = gl.middleware || require('./lib/middleware');
  if (gl.middleware.create) {
    gl.middleware = gl.middleware.create(gl);
  }

  return gl;
};
