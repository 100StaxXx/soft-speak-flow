# Pathfinder refresh

- Scoped quest-editor styling across all four steps, the clarification panel, ritual controls, and portal menus. Shared planner/chat surfaces keep their existing appearance.
- Compact labeled progress, dark neutral surfaces, quieter borders, readable fields, dynamic-viewport sizing, and pinned actions replace the mint/glossy nested framing.
- Deadline calculations use calendar days. Tomorrow remains selectable late in the day; shortcuts respect a supplied minimum date; invalid persisted dates are ignored.
- Campaign name is always editable at the top of review. The personal “why” is optional.
- Failed campaign saves retain the plan, present an inline retry message, and do not dispatch a success event. A synchronous latch prevents duplicate saves; dismissal is blocked while saving.
- Ritual edit/remove actions are visible and labeled on touch devices. Removed the nonfunctional drag-handle affordance. Blank ritual names cannot be saved.
- Existing personalized schedule generation, adjustments, milestones, ritual scheduling, draft resume and capacity limits remain in place. No AI provider/model, authentication, trial, database or billing changes.

Visual checks used the real components with isolated synthetic planning data at 390×844, 320×667 and 1024×800. The temporary preview was removed. This verifies layout/interaction, not live AI generation or device-specific voice input.
