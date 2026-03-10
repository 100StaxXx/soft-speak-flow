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
    "revision": "f847e6bcb3b062c0bbca5c3f771ed3a9"
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
    "url": "assets/vendor-CrXQnHL9.js",
    "revision": null
  }, {
    "url": "assets/useMaxAspectRect-Cz_XyjEL.js",
    "revision": null
  }, {
    "url": "assets/useFirstTimeModal-Dpd4t_GY.js",
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
    "url": "assets/redirectUrl-D2xhE5yI.js",
    "revision": null
  }, {
    "url": "assets/nativeNavigation-D_l-9aJ6.js",
    "revision": null
  }, {
    "url": "assets/index-W6jwXPTJ.js",
    "revision": null
  }, {
    "url": "assets/index-Csv2tzJX.css",
    "revision": null
  }, {
    "url": "assets/gameUtils-DPczs1Ku.js",
    "revision": null
  }, {
    "url": "assets/gameLifecycle-DCcgis9g.js",
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
    "url": "assets/date-vendor-DexVHnQI.js",
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
    "url": "assets/clipboard-BF0gtW6R.js",
    "revision": null
  }, {
    "url": "assets/carmen-sage-Cli-2dqJ.png",
    "revision": null
  }, {
    "url": "assets/carmen-sage-CZySZiFo.js",
    "revision": null
  }, {
    "url": "assets/authRedirect-kundLsJB.js",
    "revision": null
  }, {
    "url": "assets/atlas-sage-CL7hL_Ez.js",
    "revision": null
  }, {
    "url": "assets/atlas-sage-C-Vf6gdz.png",
    "revision": null
  }, {
    "url": "assets/alert-BqbHsc9A.js",
    "revision": null
  }, {
    "url": "assets/WidgetDataWeb-DinWjqLG.js",
    "revision": null
  }, {
    "url": "assets/Welcome-CZnDUyhv.js",
    "revision": null
  }, {
    "url": "assets/TestScroll-pX3yXkBT.js",
    "revision": null
  }, {
    "url": "assets/TestDayPlanner-eIqCkjLC.js",
    "revision": null
  }, {
    "url": "assets/TermsOfService-BAib0mgY.js",
    "revision": null
  }, {
    "url": "assets/TapSequenceGame-D6EDCnZT.js",
    "revision": null
  }, {
    "url": "assets/SupportReport-BhyeA0OP.js",
    "revision": null
  }, {
    "url": "assets/StaticBackgroundImage-CkUyj47r.js",
    "revision": null
  }, {
    "url": "assets/StarfallDodgeGame-BBL2VCEI.js",
    "revision": null
  }, {
    "url": "assets/SoulSerpentGame-ZgHzV6GL.js",
    "revision": null
  }, {
    "url": "assets/SharedEpics-Bfp8iXkc.js",
    "revision": null
  }, {
    "url": "assets/Search-DKFH56OS.js",
    "revision": null
  }, {
    "url": "assets/ResetPassword-DqaiyCKX.js",
    "revision": null
  }, {
    "url": "assets/Reflection-jxP2gsbV.js",
    "revision": null
  }, {
    "url": "assets/Recaps-UIOmY-a7.js",
    "revision": null
  }, {
    "url": "assets/QuoteCard-R5dC2EL5.js",
    "revision": null
  }, {
    "url": "assets/PromoCodeRedeem-H_HFGblT.js",
    "revision": null
  }, {
    "url": "assets/Profile-CVEhcY_B.js",
    "revision": null
  }, {
    "url": "assets/PrivacyPolicy-BBiSfqzC.js",
    "revision": null
  }, {
    "url": "assets/Preview-y9XZtGCc.js",
    "revision": null
  }, {
    "url": "assets/PremiumSuccess-BML-hhwN.js",
    "revision": null
  }, {
    "url": "assets/Premium-DT4DKu_Q.js",
    "revision": null
  }, {
    "url": "assets/PepTalks-CEvhTUEs.js",
    "revision": null
  }, {
    "url": "assets/PepTalkDetail-Dq_St_uX.js",
    "revision": null
  }, {
    "url": "assets/PepTalkCard-DzUcacEF.js",
    "revision": null
  }, {
    "url": "assets/Partners-DU28wNip.js",
    "revision": null
  }, {
    "url": "assets/OrbMatchGame-DYE6WzqL.js",
    "revision": null
  }, {
    "url": "assets/Onboarding-CFBKKqag.js",
    "revision": null
  }, {
    "url": "assets/NotFound-C-hggjAI.js",
    "revision": null
  }, {
    "url": "assets/NativeCalendarWeb-DeK_ZkaD.js",
    "revision": null
  }, {
    "url": "assets/MentorSelection-Cq03nhoP.js",
    "revision": null
  }, {
    "url": "assets/MentorGrid-C-oMpuhd.js",
    "revision": null
  }, {
    "url": "assets/MentorChat-DnBulvn-.js",
    "revision": null
  }, {
    "url": "assets/Library-SZMn6fHz.js",
    "revision": null
  }, {
    "url": "assets/JoinEpic-Bflcnevx.js",
    "revision": null
  }, {
    "url": "assets/InfluencerDashboard-FkGK1LWx.js",
    "revision": null
  }, {
    "url": "assets/IAPTest-C6vUWTib.js",
    "revision": null
  }, {
    "url": "assets/Home-Cqsmo72x.js",
    "revision": null
  }, {
    "url": "assets/HelpCenter-DMmbIp_-.js",
    "revision": null
  }, {
    "url": "assets/GalacticMatchGame-C3GgBPOQ.js",
    "revision": null
  }, {
    "url": "assets/Epics-Dum-hE0U.js",
    "revision": null
  }, {
    "url": "assets/EnergyBeamGame-BMDCbvjD.js",
    "revision": null
  }, {
    "url": "assets/EclipseTimingGame-CVRvcQiV.js",
    "revision": null
  }, {
    "url": "assets/Creator-CZf-JGcE.js",
    "revision": null
  }, {
    "url": "assets/Contacts-dAWGkpb_.js",
    "revision": null
  }, {
    "url": "assets/CompanionStoryJournal-DiM24uds.js",
    "revision": null
  }, {
    "url": "assets/CompanionPostcards-BY4SDnW8.js",
    "revision": null
  }, {
    "url": "assets/CompanionPersonalization-DPFuz-zI.js",
    "revision": null
  }, {
    "url": "assets/Challenges-Doa73l2O.js",
    "revision": null
  }, {
    "url": "assets/CalendarOAuthCallback-DXEOLvcU.js",
    "revision": null
  }, {
    "url": "assets/Auth-CM8U1YiM.js",
    "revision": null
  }, {
    "url": "assets/AstralFrequencyGame-DLeYbqnU.js",
    "revision": null
  }, {
    "url": "assets/Admin-WcEx_e7N.js",
    "revision": null
  }, {
    "url": "assets/AccountDeletionHelp-MBb3uhGx.js",
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
