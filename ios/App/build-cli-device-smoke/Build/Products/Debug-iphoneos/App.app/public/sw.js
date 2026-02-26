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
    "revision": "fde9b924aea2e1c42031e82644ddaeb7"
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
    "url": "assets/useMaxAspectRect-BoDFlwNt.js",
    "revision": null
  }, {
    "url": "assets/useFirstTimeModal-CJe3iQV7.js",
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
    "url": "assets/index-vNUnYBjj.js",
    "revision": null
  }, {
    "url": "assets/index-BKSsHUuc.css",
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
    "url": "assets/authRedirect-CNOm6dF3.js",
    "revision": null
  }, {
    "url": "assets/atlas-sage-CL7hL_Ez.js",
    "revision": null
  }, {
    "url": "assets/atlas-sage-C-Vf6gdz.png",
    "revision": null
  }, {
    "url": "assets/alert-CSmvq9VB.js",
    "revision": null
  }, {
    "url": "assets/WidgetDataWeb-8xljeQLN.js",
    "revision": null
  }, {
    "url": "assets/Welcome-ao5GqiCW.js",
    "revision": null
  }, {
    "url": "assets/TestScroll-DfMeuAn2.js",
    "revision": null
  }, {
    "url": "assets/TestDayPlanner-o7wCqj5Y.js",
    "revision": null
  }, {
    "url": "assets/TermsOfService-C-QMkV-s.js",
    "revision": null
  }, {
    "url": "assets/TapSequenceGame-Y_mi02ZY.js",
    "revision": null
  }, {
    "url": "assets/SupportReport-DF6AIZ2o.js",
    "revision": null
  }, {
    "url": "assets/StaticBackgroundImage-DYm4uelU.js",
    "revision": null
  }, {
    "url": "assets/StarfallDodgeGame-ssuF2kJe.js",
    "revision": null
  }, {
    "url": "assets/SoulSerpentGame-80vRXiPh.js",
    "revision": null
  }, {
    "url": "assets/SharedEpics-tC-ZIcqD.js",
    "revision": null
  }, {
    "url": "assets/Search-B1sWCGDb.js",
    "revision": null
  }, {
    "url": "assets/ResetPassword-DwQ8jTyx.js",
    "revision": null
  }, {
    "url": "assets/Reflection-UCSAjkj9.js",
    "revision": null
  }, {
    "url": "assets/Recaps-DBRIU8br.js",
    "revision": null
  }, {
    "url": "assets/QuoteCard-Cm3HBnaL.js",
    "revision": null
  }, {
    "url": "assets/PromoCodeRedeem-Pw6hMTxk.js",
    "revision": null
  }, {
    "url": "assets/Profile-C_Hsi-pK.js",
    "revision": null
  }, {
    "url": "assets/PrivacyPolicy-wKBegAdL.js",
    "revision": null
  }, {
    "url": "assets/Preview-U93ZkXyR.js",
    "revision": null
  }, {
    "url": "assets/PremiumSuccess-DAlAis3E.js",
    "revision": null
  }, {
    "url": "assets/Premium-CF5-6AqT.js",
    "revision": null
  }, {
    "url": "assets/PepTalks-CNZFjcAs.js",
    "revision": null
  }, {
    "url": "assets/PepTalkDetail-C2NlybG_.js",
    "revision": null
  }, {
    "url": "assets/PepTalkCard-Bf2ZIl8x.js",
    "revision": null
  }, {
    "url": "assets/Partners-DBc-P0Ar.js",
    "revision": null
  }, {
    "url": "assets/OrbMatchGame-5RJgDfJp.js",
    "revision": null
  }, {
    "url": "assets/Onboarding-DovSRxEd.js",
    "revision": null
  }, {
    "url": "assets/NotFound-DuyunY91.js",
    "revision": null
  }, {
    "url": "assets/NativeCalendarWeb-Cz8pElqg.js",
    "revision": null
  }, {
    "url": "assets/MentorSelection-DVZkmn5N.js",
    "revision": null
  }, {
    "url": "assets/MentorGrid-DSyXDvnP.js",
    "revision": null
  }, {
    "url": "assets/MentorChat-4J7eyygm.js",
    "revision": null
  }, {
    "url": "assets/Library-BjID8b-5.js",
    "revision": null
  }, {
    "url": "assets/JoinEpic-S6OTtz2E.js",
    "revision": null
  }, {
    "url": "assets/InfluencerDashboard-RKD2R17e.js",
    "revision": null
  }, {
    "url": "assets/IAPTest-CIiYsZFB.js",
    "revision": null
  }, {
    "url": "assets/Home-C8MlTeIW.js",
    "revision": null
  }, {
    "url": "assets/HelpCenter-5zRnk6B8.js",
    "revision": null
  }, {
    "url": "assets/GalacticMatchGame-CX74TnbQ.js",
    "revision": null
  }, {
    "url": "assets/Epics-C9QLI4HE.js",
    "revision": null
  }, {
    "url": "assets/EnergyBeamGame-DOxMRCf9.js",
    "revision": null
  }, {
    "url": "assets/EclipseTimingGame-D4la_ig9.js",
    "revision": null
  }, {
    "url": "assets/Creator-CF03iclo.js",
    "revision": null
  }, {
    "url": "assets/Contacts-DmlfAl8q.js",
    "revision": null
  }, {
    "url": "assets/CompanionStoryJournal-CYdEackS.js",
    "revision": null
  }, {
    "url": "assets/CompanionPostcards-DSPFFCea.js",
    "revision": null
  }, {
    "url": "assets/CompanionPersonalization-ib8qH5vS.js",
    "revision": null
  }, {
    "url": "assets/Challenges-Bd-ZKO6N.js",
    "revision": null
  }, {
    "url": "assets/CalendarOAuthCallback-B3iqrPzA.js",
    "revision": null
  }, {
    "url": "assets/Auth-DO_x6Z6p.js",
    "revision": null
  }, {
    "url": "assets/AstralFrequencyGame-CRA64nE1.js",
    "revision": null
  }, {
    "url": "assets/Admin-cFATfUA6.js",
    "revision": null
  }, {
    "url": "assets/AccountDeletionHelp-BaOsrkpW.js",
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
