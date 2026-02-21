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
    "revision": "d613232812230465fa942c7d4edf6385"
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
    "url": "assets/vendor-FfY6MM0Z.js",
    "revision": null
  }, {
    "url": "assets/useFirstTimeModal-Dpj86Jep.js",
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
    "url": "assets/redirectUrl-BW4uFyq_.js",
    "revision": null
  }, {
    "url": "assets/nativeNavigation-DLS7qEr9.js",
    "revision": null
  }, {
    "url": "assets/index-wJIi6JZw.css",
    "revision": null
  }, {
    "url": "assets/index-sX_cJ3I4.js",
    "revision": null
  }, {
    "url": "assets/habitLimits-NNrGyrB4.js",
    "revision": null
  }, {
    "url": "assets/gameUtils-G90wW1BE.js",
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
    "url": "assets/date-vendor-Bk4KiHsJ.js",
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
    "url": "assets/authRedirect-CIQu5qTp.js",
    "revision": null
  }, {
    "url": "assets/atlas-sage-CL7hL_Ez.js",
    "revision": null
  }, {
    "url": "assets/atlas-sage-C-Vf6gdz.png",
    "revision": null
  }, {
    "url": "assets/alert-C_DpXmPl.js",
    "revision": null
  }, {
    "url": "assets/WidgetDataWeb-12a7qG7b.js",
    "revision": null
  }, {
    "url": "assets/Welcome-BniXWGnV.js",
    "revision": null
  }, {
    "url": "assets/TestScroll-77Rr5Lqb.js",
    "revision": null
  }, {
    "url": "assets/TestDayPlanner-D66FsT_o.js",
    "revision": null
  }, {
    "url": "assets/TermsOfService-w_f3-aY3.js",
    "revision": null
  }, {
    "url": "assets/TapSequenceGame-Co8xL4xG.js",
    "revision": null
  }, {
    "url": "assets/StaticBackgroundImage-CU98gu1x.js",
    "revision": null
  }, {
    "url": "assets/StarfallDodgeGame-CLnaBcWv.js",
    "revision": null
  }, {
    "url": "assets/SoulSerpentGame-D3Kq0Ubq.js",
    "revision": null
  }, {
    "url": "assets/SharedEpics-DGIzq_OP.js",
    "revision": null
  }, {
    "url": "assets/Search-DMX1P1zp.js",
    "revision": null
  }, {
    "url": "assets/ResetPassword-BvgYC8R-.js",
    "revision": null
  }, {
    "url": "assets/Reflection-CXvFG5cM.js",
    "revision": null
  }, {
    "url": "assets/Recaps-PXy4zS3O.js",
    "revision": null
  }, {
    "url": "assets/QuoteCard-B2SFR4YG.js",
    "revision": null
  }, {
    "url": "assets/Profile-4P-wRwvt.js",
    "revision": null
  }, {
    "url": "assets/PrivacyPolicy-7Iie3xLI.js",
    "revision": null
  }, {
    "url": "assets/Preview-CYnBbUiB.js",
    "revision": null
  }, {
    "url": "assets/PremiumSuccess-B6FIak20.js",
    "revision": null
  }, {
    "url": "assets/Premium-1drsp01V.js",
    "revision": null
  }, {
    "url": "assets/PepTalks-CCWX7rYy.js",
    "revision": null
  }, {
    "url": "assets/PepTalkDetail-1TNhOqLa.js",
    "revision": null
  }, {
    "url": "assets/PepTalkCard-LLtaUNgr.js",
    "revision": null
  }, {
    "url": "assets/Partners-BLBukkD5.js",
    "revision": null
  }, {
    "url": "assets/OrbMatchGame-BV1zt-J7.js",
    "revision": null
  }, {
    "url": "assets/Onboarding-k1NpOsP0.js",
    "revision": null
  }, {
    "url": "assets/NotFound-BP23OId0.js",
    "revision": null
  }, {
    "url": "assets/NativeCalendarWeb-BdBzToYJ.js",
    "revision": null
  }, {
    "url": "assets/MentorSelection-BCmT8-Uf.js",
    "revision": null
  }, {
    "url": "assets/MentorGrid-BGn289sO.js",
    "revision": null
  }, {
    "url": "assets/MentorChat-DjU0Nqr4.js",
    "revision": null
  }, {
    "url": "assets/Library-BRbm9ycn.js",
    "revision": null
  }, {
    "url": "assets/JoinEpic-W34clMf2.js",
    "revision": null
  }, {
    "url": "assets/InfluencerDashboard-OzmIh1a9.js",
    "revision": null
  }, {
    "url": "assets/IAPTest-M3iPyTWM.js",
    "revision": null
  }, {
    "url": "assets/Home-L-5X-wse.js",
    "revision": null
  }, {
    "url": "assets/HelpCenter-BVG7X1Yt.js",
    "revision": null
  }, {
    "url": "assets/GalacticMatchGame-sEezCMVN.js",
    "revision": null
  }, {
    "url": "assets/Epics-BgO2tYO9.js",
    "revision": null
  }, {
    "url": "assets/EnergyBeamGame-BmV2dlUs.js",
    "revision": null
  }, {
    "url": "assets/EclipseTimingGame-DV4_nD0g.js",
    "revision": null
  }, {
    "url": "assets/Creator-b5L_840A.js",
    "revision": null
  }, {
    "url": "assets/Contacts-CH3JNG76.js",
    "revision": null
  }, {
    "url": "assets/CompanionStoryJournal-CbCcUkaX.js",
    "revision": null
  }, {
    "url": "assets/CompanionPostcards-CszyoJhe.js",
    "revision": null
  }, {
    "url": "assets/CompanionPersonalization-nKWkjw34.js",
    "revision": null
  }, {
    "url": "assets/Challenges-BRgf_Emy.js",
    "revision": null
  }, {
    "url": "assets/Auth-CQfbnNNe.js",
    "revision": null
  }, {
    "url": "assets/AstralFrequencyGame-8lhy12jN.js",
    "revision": null
  }, {
    "url": "assets/Admin-BnhXWjHL.js",
    "revision": null
  }, {
    "url": "assets/AccountDeletionHelp-Xj1B0htH.js",
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
