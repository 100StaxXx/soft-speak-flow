# Shared production companion pipeline

Recovered from the live `opbfpbbqvuksuvmtmssd` project on September 19, 2026 Pacific (September 20 UTC), during the repair of commit `fe2040b1c`.

Root entry points for `generate-companion-evolution` (live v71), `process-companion-evolution-job` (v57), and `generate-companion-stat-analysis` (v40) re-export these implementations. Their existing tests exercise these entry points. This preserves cinema preparation/promotion, bounded waiting for custom video, and the stats product boundary rather than deploying stale pre-cinema code.

The backend's dependency closure is deliberately isolated from browser UI configuration: the shared live backend serves Graceward and Cosmiq and has different presentation labels and product branches. Do not copy its catalog/progression labels over the Cosmiq UI. No database configuration, credentials, user records, or generated media are stored here.

Changes to this pipeline must be tested for both product modes. Do not blanket-push local migrations or Supabase configuration. Use a reviewed, explicit release scope and compare live versions immediately before deployment. The preserved animation worker is reference material, not a replacement entry point.
