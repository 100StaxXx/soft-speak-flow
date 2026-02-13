/**
 * Copyright 2018 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *     http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// If the loader is already loaded, just stop.
if (!self.define) {
  let registry = {};

  // Used for `eval` and `importScripts` where we can't get script URL by other means.
  // In both cases, it's safe to use a global var because those functions are synchronous.
  let nextDefineUri;

  const singleRequire = (uri, parentUri) => {
    uri = new URL(uri + ".js", parentUri).href;
    return registry[uri] || (
      
        new Promise(resolve => {
          if ("document" in self) {
            const script = document.createElement("script");
            script.src = uri;
            script.onload = resolve;
            document.head.appendChild(script);
          } else {
            nextDefineUri = uri;
            importScripts(uri);
            resolve();
          }
        })
      
      .then(() => {
        let promise = registry[uri];
        if (!promise) {
          throw new Error(`Module ${uri} didn’t register its module`);
        }
        return promise;
      })
    );
  };

  self.define = (depsNames, factory) => {
    const uri = nextDefineUri || ("document" in self ? document.currentScript.src : "") || location.href;
    if (registry[uri]) {
      // Module is already loading or loaded.
      return;
    }
    let exports = {};
    const require = depUri => singleRequire(depUri, uri);
    const specialDeps = {
      module: { uri },
      exports,
      require
    };
    registry[uri] = Promise.all(depsNames.map(
      depName => specialDeps[depName] || require(depName)
    )).then(deps => {
      factory(...deps);
      return exports;
    });
  };
}
define(['./workbox-2203335d'], (function (workbox) { 'use strict';

  self.skipWaiting();
  workbox.clientsClaim();

  /**
   * The precacheAndRoute() method efficiently caches and responds to
   * requests for URLs in the manifest.
   * See https://goo.gl/S9QRab
   */
  workbox.precacheAndRoute([{
    "url": "sw-config.js",
    "revision": "d63ac2f77538d26fbd2771ba4012e19d"
  }, {
    "url": "splash.png",
    "revision": "072c44dc2ab519d7457d5482661cd12b"
  }, {
    "url": "registerSW.js",
    "revision": "1872c500de691dce40960bb85481de07"
  }, {
    "url": "placeholder.svg",
    "revision": "35707bd9960ba5281c72af927b79291f"
  }, {
    "url": "placeholder-egg.svg",
    "revision": "b1de8abc2c5dd4d2af1ff64611589750"
  }, {
    "url": "placeholder-companion.svg",
    "revision": "cdc9c8b8e8ee722b8d8e1125bc0751e8"
  }, {
    "url": "index.html",
    "revision": "c9d983251b7e6a61c9d860fe4c03f98d"
  }, {
    "url": "icon-512.svg",
    "revision": "8afc6c93daaf8b6d10008d8dbfe29b88"
  }, {
    "url": "icon-192.svg",
    "revision": "4e9e4fbcd1c56607077b661b494005fb"
  }, {
    "url": "favicon.png",
    "revision": "65214105c7f37839126d568f491b3454"
  }, {
    "url": "favicon.ico",
    "revision": "566e64364d6957715dc11845f4800700"
  }, {
    "url": "assets/vendor-CkzXtEGd.js",
    "revision": null
  }, {
    "url": "assets/three-vendor-qI8GXUTd.js",
    "revision": null
  }, {
    "url": "assets/stryker-sage-Cj6uft5M.png",
    "revision": null
  }, {
    "url": "assets/stryker-sage-B3PlAZKv.js",
    "revision": null
  }, {
    "url": "assets/solace-sage-Cnpumk4j.png",
    "revision": null
  }, {
    "url": "assets/solace-sage-CJdBfLhM.js",
    "revision": null
  }, {
    "url": "assets/sienna-sage-CzXeQm7L.png",
    "revision": null
  }, {
    "url": "assets/sienna-sage-CppN60cS.js",
    "revision": null
  }, {
    "url": "assets/reign-sage-D4nrVOuM.js",
    "revision": null
  }, {
    "url": "assets/reign-sage-BMXLfbvn.png",
    "revision": null
  }, {
    "url": "assets/redirectUrl-BJoiu_Ib.js",
    "revision": null
  }, {
    "url": "assets/nativeNavigation-o1P4gnIN.js",
    "revision": null
  }, {
    "url": "assets/index-CY2aWTNY.css",
    "revision": null
  }, {
    "url": "assets/index-B9iotTKE.js",
    "revision": null
  }, {
    "url": "assets/habitLimits-NNrGyrB4.js",
    "revision": null
  }, {
    "url": "assets/gameUtils-BnwM_CJ4.js",
    "revision": null
  }, {
    "url": "assets/faction-void-DRHp89tK.png",
    "revision": null
  }, {
    "url": "assets/faction-stellar-CdtFZ0wq.png",
    "revision": null
  }, {
    "url": "assets/faction-starfall-DRC6ijyK.png",
    "revision": null
  }, {
    "url": "assets/date-vendor-CuPqBTxb.js",
    "revision": null
  }, {
    "url": "assets/darius-sage-_fXpdXxS.png",
    "revision": null
  }, {
    "url": "assets/darius-sage-2XcD16mi.js",
    "revision": null
  }, {
    "url": "assets/cosmic-welcome@2x-WXuhwVqu.png",
    "revision": null
  }, {
    "url": "assets/cosmic-welcome-DzqVjGwe.png",
    "revision": null
  }, {
    "url": "assets/cosmic-signin@2x-Crgm5DTJ.png",
    "revision": null
  }, {
    "url": "assets/cosmic-signin-DC4rKAoe.png",
    "revision": null
  }, {
    "url": "assets/cosmic-path-2@2x-B-2TcGFA.png",
    "revision": null
  }, {
    "url": "assets/cosmic-path-2-DmGy2SmH.png",
    "revision": null
  }, {
    "url": "assets/cosmic-path-1@2x-D18JrjlC.png",
    "revision": null
  }, {
    "url": "assets/cosmic-path-1-C0KxDLve.png",
    "revision": null
  }, {
    "url": "assets/cosmic-galaxy-portal@2x-CEJZJjVa.png",
    "revision": null
  }, {
    "url": "assets/cosmic-galaxy-portal-BwQM7UKU.png",
    "revision": null
  }, {
    "url": "assets/carmen-sage-Cli-2dqJ.png",
    "revision": null
  }, {
    "url": "assets/carmen-sage-CZySZiFo.js",
    "revision": null
  }, {
    "url": "assets/authRedirect-B8iaSKfJ.js",
    "revision": null
  }, {
    "url": "assets/atlas-sage-CL7hL_Ez.js",
    "revision": null
  }, {
    "url": "assets/atlas-sage-C-Vf6gdz.png",
    "revision": null
  }, {
    "url": "assets/alert-R1BpSyQT.js",
    "revision": null
  }, {
    "url": "assets/WidgetDataWeb-BsckqRvB.js",
    "revision": null
  }, {
    "url": "assets/Welcome-DVxYsJjb.js",
    "revision": null
  }, {
    "url": "assets/TestScroll-DfE7XiQI.js",
    "revision": null
  }, {
    "url": "assets/TestDayPlanner-CGblyc6y.js",
    "revision": null
  }, {
    "url": "assets/TermsOfService-nErCBvbC.js",
    "revision": null
  }, {
    "url": "assets/TapSequenceGame-Bxu43lFI.js",
    "revision": null
  }, {
    "url": "assets/StaticBackgroundImage-DD6vqQ2B.js",
    "revision": null
  }, {
    "url": "assets/StarfallDodgeGame-BvuTVzja.js",
    "revision": null
  }, {
    "url": "assets/SoulSerpentGame-Bv_3BKdx.js",
    "revision": null
  }, {
    "url": "assets/SharedEpics-DCIlo2I7.js",
    "revision": null
  }, {
    "url": "assets/Search-vTBUcsaF.js",
    "revision": null
  }, {
    "url": "assets/ResetPassword-1N_7ewFG.js",
    "revision": null
  }, {
    "url": "assets/Reflection-CYhyADiF.js",
    "revision": null
  }, {
    "url": "assets/Recaps-CLjXd4XY.js",
    "revision": null
  }, {
    "url": "assets/QuoteCard-BsC5qDHx.js",
    "revision": null
  }, {
    "url": "assets/Profile-B3PmfHVv.js",
    "revision": null
  }, {
    "url": "assets/PrivacyPolicy-DkQ26ws9.js",
    "revision": null
  }, {
    "url": "assets/Preview-Ct3qOW5S.js",
    "revision": null
  }, {
    "url": "assets/PremiumSuccess-57mU5DHH.js",
    "revision": null
  }, {
    "url": "assets/Premium-CLpuReoF.js",
    "revision": null
  }, {
    "url": "assets/PepTalks-DMSNuMzT.js",
    "revision": null
  }, {
    "url": "assets/PepTalkDetail-Vb98Qm1l.js",
    "revision": null
  }, {
    "url": "assets/PepTalkCard-CWn3ofEo.js",
    "revision": null
  }, {
    "url": "assets/Partners-DFP6CCCj.js",
    "revision": null
  }, {
    "url": "assets/OrbMatchGame-C3ujbT9L.js",
    "revision": null
  }, {
    "url": "assets/Onboarding-CA5tMveF.js",
    "revision": null
  }, {
    "url": "assets/NotFound-nKscVqfZ.js",
    "revision": null
  }, {
    "url": "assets/MentorSelection-A8n2nTYQ.js",
    "revision": null
  }, {
    "url": "assets/MentorGrid-7iufA8ZM.js",
    "revision": null
  }, {
    "url": "assets/MentorChat-ClApHp8m.js",
    "revision": null
  }, {
    "url": "assets/Library-84deM8vK.js",
    "revision": null
  }, {
    "url": "assets/JoinEpic-NPe_L50w.js",
    "revision": null
  }, {
    "url": "assets/InfluencerDashboard-BBBGagV7.js",
    "revision": null
  }, {
    "url": "assets/IAPTest-i-cZNf5g.js",
    "revision": null
  }, {
    "url": "assets/Home-BNlMfIQl.js",
    "revision": null
  }, {
    "url": "assets/HelpCenter-BAomb4_W.js",
    "revision": null
  }, {
    "url": "assets/GalacticMatchGame-CBrJsOdG.js",
    "revision": null
  }, {
    "url": "assets/Epics-D7My4cDq.js",
    "revision": null
  }, {
    "url": "assets/EnergyBeamGame-CLTOGMKR.js",
    "revision": null
  }, {
    "url": "assets/EclipseTimingGame-CdXXG3Da.js",
    "revision": null
  }, {
    "url": "assets/Creator-BmFDzVrk.js",
    "revision": null
  }, {
    "url": "assets/Contacts-D6nBx4RQ.js",
    "revision": null
  }, {
    "url": "assets/CompanionStoryJournal-D-2D_7jp.js",
    "revision": null
  }, {
    "url": "assets/CompanionPostcards-DcyMqcgw.js",
    "revision": null
  }, {
    "url": "assets/CompanionPersonalization-DpRcD7Qb.js",
    "revision": null
  }, {
    "url": "assets/Community-B_Atx4Bk.js",
    "revision": null
  }, {
    "url": "assets/Challenges-BClUL62t.js",
    "revision": null
  }, {
    "url": "assets/Auth-BkkEql_A.js",
    "revision": null
  }, {
    "url": "assets/AstralFrequencyGame-Dc9Ov7No.js",
    "revision": null
  }, {
    "url": "assets/Admin-B3gKfO7-.js",
    "revision": null
  }, {
    "url": "assets/AccountDeletionHelp-CDTD3WCN.js",
    "revision": null
  }, {
    "url": "favicon.ico",
    "revision": "566e64364d6957715dc11845f4800700"
  }, {
    "url": "icon-192.svg",
    "revision": "4e9e4fbcd1c56607077b661b494005fb"
  }, {
    "url": "icon-512.svg",
    "revision": "8afc6c93daaf8b6d10008d8dbfe29b88"
  }, {
    "url": "manifest.webmanifest",
    "revision": "a84210bf6b7489d4cb23a2097690e3f2"
  }], {});
  workbox.cleanupOutdatedCaches();
  workbox.registerRoute(new workbox.NavigationRoute(workbox.createHandlerBoundToURL("index.html")));
  workbox.registerRoute(/^https:\/\/fonts\.googleapis\.com\/.*/i, new workbox.CacheFirst({
    "cacheName": "google-fonts-cache",
    plugins: [new workbox.ExpirationPlugin({
      maxEntries: 10,
      maxAgeSeconds: 31536000
    }), new workbox.CacheableResponsePlugin({
      statuses: [0, 200]
    })]
  }), 'GET');
  workbox.registerRoute(/^https:\/\/.*\.supabase\.co\/.*/i, new workbox.NetworkOnly(), 'GET');

}));
