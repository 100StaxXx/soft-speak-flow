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
    "url": "new-splash.png",
    "revision": "4b36a0bd32f754944f4bef4f6cb2ccb5"
  }, {
    "url": "index.html",
    "revision": "a0b190dd45b604fc121266fd0fdf7f70"
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
    "url": "assets/vendor-DK8VKJIv.js",
    "revision": null
  }, {
    "url": "assets/useFirstTimeModal-C7JTu5JG.js",
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
    "url": "assets/redirectUrl-BrdfvnoF.js",
    "revision": null
  }, {
    "url": "assets/nativeNavigation-Cw_epy89.js",
    "revision": null
  }, {
    "url": "assets/index-BOIHqLoh.css",
    "revision": null
  }, {
    "url": "assets/index-BJ43zXLh.js",
    "revision": null
  }, {
    "url": "assets/gameUtils-CBfv9FnM.js",
    "revision": null
  }, {
    "url": "assets/gameLifecycle-CMc-cG6H.js",
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
    "url": "assets/date-vendor-BRrA_NVo.js",
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
    "url": "assets/clipboard-3OJHfwXT.js",
    "revision": null
  }, {
    "url": "assets/carmen-sage-Cli-2dqJ.png",
    "revision": null
  }, {
    "url": "assets/carmen-sage-CZySZiFo.js",
    "revision": null
  }, {
    "url": "assets/authRedirect-Dbj_MdnV.js",
    "revision": null
  }, {
    "url": "assets/atlas-sage-CL7hL_Ez.js",
    "revision": null
  }, {
    "url": "assets/atlas-sage-C-Vf6gdz.png",
    "revision": null
  }, {
    "url": "assets/alert-s7B8UUrn.js",
    "revision": null
  }, {
    "url": "assets/WidgetDataWeb-8xljeQLN.js",
    "revision": null
  }, {
    "url": "assets/Welcome-TqnFy2UJ.js",
    "revision": null
  }, {
    "url": "assets/TestScroll-BOb9laOs.js",
    "revision": null
  }, {
    "url": "assets/TestDayPlanner-CJrXwoNO.js",
    "revision": null
  }, {
    "url": "assets/TermsOfService-O2MEIlpz.js",
    "revision": null
  }, {
    "url": "assets/TapSequenceGame-CKXIgYVS.js",
    "revision": null
  }, {
    "url": "assets/StaticBackgroundImage-DYm4uelU.js",
    "revision": null
  }, {
    "url": "assets/StarfallDodgeGame-DzOOEmmQ.js",
    "revision": null
  }, {
    "url": "assets/SoulSerpentGame-BCsnvNOc.js",
    "revision": null
  }, {
    "url": "assets/SharedEpics-DBuUKg1x.js",
    "revision": null
  }, {
    "url": "assets/Search-BlfamXxx.js",
    "revision": null
  }, {
    "url": "assets/ResetPassword-C-MHA_sP.js",
    "revision": null
  }, {
    "url": "assets/Reflection-DYpPQT-R.js",
    "revision": null
  }, {
    "url": "assets/Recaps-CIBxxkH_.js",
    "revision": null
  }, {
    "url": "assets/QuoteCard-DPgfSVR0.js",
    "revision": null
  }, {
    "url": "assets/PromoCodeRedeem-BTnQLC46.js",
    "revision": null
  }, {
    "url": "assets/Profile-rE7C46vn.js",
    "revision": null
  }, {
    "url": "assets/PrivacyPolicy-DRmlHyof.js",
    "revision": null
  }, {
    "url": "assets/Preview-CNtK0bvU.js",
    "revision": null
  }, {
    "url": "assets/PremiumSuccess-DngprlOc.js",
    "revision": null
  }, {
    "url": "assets/Premium-C7ceXC-l.js",
    "revision": null
  }, {
    "url": "assets/PepTalks-oYtv036A.js",
    "revision": null
  }, {
    "url": "assets/PepTalkDetail-8jEu_-oX.js",
    "revision": null
  }, {
    "url": "assets/PepTalkCard-CExGJuq0.js",
    "revision": null
  }, {
    "url": "assets/Partners-Crnd23Ho.js",
    "revision": null
  }, {
    "url": "assets/OrbMatchGame-f-zPsYiu.js",
    "revision": null
  }, {
    "url": "assets/Onboarding-Dsg40KaN.js",
    "revision": null
  }, {
    "url": "assets/NotFound-Cm_bIE-k.js",
    "revision": null
  }, {
    "url": "assets/NativeCalendarWeb-Cz8pElqg.js",
    "revision": null
  }, {
    "url": "assets/MentorSelection-yfWr4ktS.js",
    "revision": null
  }, {
    "url": "assets/MentorGrid-CB6htyzs.js",
    "revision": null
  }, {
    "url": "assets/MentorChat-CaRUTv-0.js",
    "revision": null
  }, {
    "url": "assets/Library-C6tGm8en.js",
    "revision": null
  }, {
    "url": "assets/JoinEpic-COB5O55D.js",
    "revision": null
  }, {
    "url": "assets/InfluencerDashboard-B3QNNXgw.js",
    "revision": null
  }, {
    "url": "assets/IAPTest-DTbQS8Oc.js",
    "revision": null
  }, {
    "url": "assets/Home-JH99QF2b.js",
    "revision": null
  }, {
    "url": "assets/HelpCenter-Dij7d2tX.js",
    "revision": null
  }, {
    "url": "assets/GalacticMatchGame-DWewY0B_.js",
    "revision": null
  }, {
    "url": "assets/Epics-BX5huj0F.js",
    "revision": null
  }, {
    "url": "assets/EnergyBeamGame-Bs1uSfbX.js",
    "revision": null
  }, {
    "url": "assets/EclipseTimingGame-C3p8Hj1D.js",
    "revision": null
  }, {
    "url": "assets/Creator-DiqAeLSD.js",
    "revision": null
  }, {
    "url": "assets/Contacts-C-JSyKjE.js",
    "revision": null
  }, {
    "url": "assets/CompanionStoryJournal-D7fHJoVF.js",
    "revision": null
  }, {
    "url": "assets/CompanionPostcards-bmsW_1Ex.js",
    "revision": null
  }, {
    "url": "assets/CompanionPersonalization-CbGvWst1.js",
    "revision": null
  }, {
    "url": "assets/Challenges-B6AlnPLU.js",
    "revision": null
  }, {
    "url": "assets/CalendarOAuthCallback-Ds9Ktcii.js",
    "revision": null
  }, {
    "url": "assets/Auth-BQHJxpHh.js",
    "revision": null
  }, {
    "url": "assets/AstralFrequencyGame-BH5iMPH9.js",
    "revision": null
  }, {
    "url": "assets/Admin-uF6PEwhd.js",
    "revision": null
  }, {
    "url": "assets/AccountDeletionHelp-izI2Xf6N.js",
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
