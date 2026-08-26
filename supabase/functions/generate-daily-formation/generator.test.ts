import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  formationSimilarity,
  parseGeneratedPractice,
  validateGeneratedPractice,
  type GeneratedFormationPractice,
} from "./generator.ts";

const mindPractice: GeneratedFormationPractice = {
  title: "Compare Two Explanations",
  action: "Read two short explanations of one concept and write the important difference between them.",
  benefit: "Practices evaluating sources and building clearer knowledge.",
  minutes: 7,
  focus: "knowledge",
  scriptureReference: null,
};

Deno.test("accepts a concise knowledge-based Mind practice", () => {
  assertEquals(validateGeneratedPractice(mindPractice, "Mind"), { valid: true });
});

Deno.test("rejects cross-pillar and unsafe generated practices", () => {
  assertEquals(validateGeneratedPractice({
    ...mindPractice,
    action: "Pray to God and read one Bible verse about learning with an open heart.",
  }, "Mind"), { valid: false, reason: "mind_not_knowledge_based" });

  assertEquals(validateGeneratedPractice({
    title: "Push Through Pain",
    action: "Complete maximum reps and push through pain to prove you can finish the exercise.",
    benefit: "Practices exercise through extreme effort and physical discomfort.",
    minutes: 5,
    focus: "exercise",
    scriptureReference: null,
  }, "Body"), { valid: false, reason: "body_not_safe_physical_practice" });
});

Deno.test("requires Soul scripture tasks to use the approved reference in the action", () => {
  const soulPractice: GeneratedFormationPractice = {
    title: "Read For Steady Trust",
    action: "Read Psalm 23:1-3 in a trusted Bible and write one truth about God's care.",
    benefit: "Practices receiving Scripture as a foundation for faithful trust.",
    minutes: 6,
    focus: "scripture",
    scriptureReference: "Psalm 23:1-3",
  };
  assertEquals(validateGeneratedPractice(soulPractice, "Soul"), { valid: true });
  assertEquals(validateGeneratedPractice(soulPractice, "Soul", [], "Psalm 23:1-3"), { valid: true });
  assertEquals(validateGeneratedPractice({
    ...soulPractice,
    scriptureReference: "Psalm 999:1",
  }, "Soul"), { valid: false, reason: "unapproved_scripture_reference" });
  assertEquals(
    validateGeneratedPractice(soulPractice, "Soul", [], "Micah 6:8"),
    { valid: false, reason: "scripture_reference_not_daily_thread" },
  );
  assertEquals(
    validateGeneratedPractice({
      title: "Pray With Gratitude",
      action: "Pray to God with gratitude for one ordinary gift you received today.",
      benefit: "Practices faithful attention and honest prayer before God.",
      minutes: 4,
      focus: "faith",
      scriptureReference: null,
    }, "Soul", [], "Micah 6:8"),
    { valid: false, reason: "daily_scripture_focus_required" },
  );
});

Deno.test("detects near-duplicate tasks and parses schema output", () => {
  const parsed = parseGeneratedPractice(JSON.stringify(mindPractice));
  assertEquals(parsed, mindPractice);
  const similarity = formationSimilarity(
    "Compare two explanations and write their important difference",
    "Read two explanations then write the most important difference",
  );
  assertEquals(similarity >= 0.4, true);
  assertEquals(validateGeneratedPractice(mindPractice, "Mind", [{
    title: "Compare Explanations",
    action: "Read two short explanations of one concept and write the important difference between them.",
  }]), { valid: false, reason: "too_similar_to_recent_practice" });
});
