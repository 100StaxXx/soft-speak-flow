export interface CompanionJudgedRenderOutput {
  imageDataUrl: string;
  revisedPrompt: string | null;
  size?: string | null;
}

export interface CompanionJudgedRenderAttempt<TScores> {
  imageDataUrl: string;
  revisedPrompt: string | null;
  scores: TScores | null;
  retryCount: number;
  size: string | null;
  passed: boolean;
  judgeUnavailable: boolean;
}

interface RunCompanionJudgedRenderArgs<
  TScores extends { notes?: string | null },
> {
  basePrompt: string;
  attempts: number;
  maxAttempts?: number;
  render: (
    prompt: string,
    attempt: number,
  ) => Promise<CompanionJudgedRenderOutput>;
  judge: (
    rendered: CompanionJudgedRenderOutput,
    attempt: number,
  ) => Promise<TScores | null>;
  scoresPass: (scores: TScores | null) => boolean;
  rankScores: (scores: TScores | null) => number;
  appendCritique?: (
    basePrompt: string,
    notes: string | null | undefined,
    attempt: number,
  ) => string;
  onGenerationDurationMs?: (durationMs: number) => void;
  onJudgeDurationMs?: (durationMs: number) => void;
}

const normalizeAttemptCount = (value: number): number =>
  Number.isFinite(value) ? Math.max(1, Math.floor(value)) : 1;

export async function runCompanionJudgedRender<
  TScores extends { notes?: string | null },
>({
  basePrompt,
  attempts,
  maxAttempts,
  render,
  judge,
  scoresPass,
  rankScores,
  appendCritique = (prompt) => prompt,
  onGenerationDurationMs,
  onJudgeDurationMs,
}: RunCompanionJudgedRenderArgs<TScores>): Promise<
  CompanionJudgedRenderAttempt<TScores>
> {
  let promptForAttempt = basePrompt;
  const initialAttempts = normalizeAttemptCount(attempts);
  const attemptCeiling = Math.max(
    initialAttempts,
    normalizeAttemptCount(maxAttempts ?? initialAttempts),
  );
  let allowedAttempts = initialAttempts;
  let bestAttempt: CompanionJudgedRenderAttempt<TScores> | null = null;

  for (let attempt = 0; attempt < allowedAttempts; attempt += 1) {
    const generationStartedAt = Date.now();
    const rendered = await render(promptForAttempt, attempt);
    onGenerationDurationMs?.(Date.now() - generationStartedAt);

    const judgeStartedAt = Date.now();
    const scores = await judge(rendered, attempt);
    onJudgeDurationMs?.(Date.now() - judgeStartedAt);

    const attemptResult: CompanionJudgedRenderAttempt<TScores> = {
      imageDataUrl: rendered.imageDataUrl,
      revisedPrompt: rendered.revisedPrompt,
      scores,
      retryCount: attempt,
      size: typeof rendered.size === "string" ? rendered.size : null,
      passed: scoresPass(scores),
      judgeUnavailable: !scores,
    };

    if (!bestAttempt || rankScores(scores) >= rankScores(bestAttempt.scores)) {
      bestAttempt = attemptResult;
    }

    if (attemptResult.passed) {
      return attemptResult;
    }

    if (attemptResult.judgeUnavailable && allowedAttempts < attemptCeiling) {
      allowedAttempts += 1;
    }

    promptForAttempt = appendCritique(basePrompt, scores?.notes, attempt);
  }

  if (!bestAttempt) {
    throw new Error("No companion image attempt succeeded");
  }

  return bestAttempt;
}
