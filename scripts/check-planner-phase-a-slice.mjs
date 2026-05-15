import { spawn } from "node:child_process";

const patterns = [
  "src/services/companionChatThreads",
  "src/hooks/useCompanionAssistant",
  "src/hooks/useCompanionPlanner",
  "src/components/journeys/JourneysCompanionPlannerModal",
];

const child = spawn(
  process.platform === "win32" ? "npx.cmd" : "npx",
  ["tsc", "-p", "tsconfig.app.json", "--noEmit", "--pretty", "false"],
  {
    stdio: ["ignore", "pipe", "pipe"],
  },
);

let output = "";

child.stdout.on("data", (chunk) => {
  output += chunk.toString();
});

child.stderr.on("data", (chunk) => {
  output += chunk.toString();
});

child.on("close", (code) => {
  const lines = output
    .split(/\r?\n/)
    .filter((line) => patterns.some((pattern) => line.includes(pattern)));

  if (lines.length > 0) {
    console.error(lines.join("\n"));
    process.exit(1);
  }

  if (code === 0) {
    console.log("Planner Phase A slice typecheck passed.");
  } else {
    console.log(
      "Planner Phase A slice has no matching type errors; unrelated repo-wide TypeScript errors remain outside this slice.",
    );
  }
  process.exit(0);
});
