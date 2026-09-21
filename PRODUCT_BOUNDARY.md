# Cosmiq product boundary

This source tree builds **Cosmiq**. Graceward is a separate product and must not be implemented as a Cosmiq rename or runtime theme.

Cosmiq owns its own:

- bundle ID and URL scheme;
- StoreKit products and RevenueCat entitlement;
- onboarding, navigation, feature vocabulary, and visual identity;
- public domains, legal documents, support copy, and release history.

The chosen Cosmiq experience intentionally retains guided day planning, quests and campaigns, Companion chat and evolution, XP progression, and onboarding guide selection. These systems are one connected follow-through loop, not Graceward features or optional runtime personas. Retired horoscope, zodiac-placement, guild, task, and epic URL vocabulary exists only as a redirect or deep-link compatibility layer; it must not return as primary navigation or release identity.

`npm run product:verify` checks the release-critical identity files. `npm run build` runs that check automatically. Graceward changes should be developed and released from its own source tree and native target, with separately provisioned App Store and backend configuration.
