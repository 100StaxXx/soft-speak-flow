import { usePostOnboardingMentorGuidance } from "@/hooks/usePostOnboardingMentorGuidance";
import { MentorAvatar } from "@/components/MentorAvatar";

export const MentorGuidanceCard = () => {
  const {
    isActive,
    progressText,
    dialogueText,
    dialogueSupportText,
    speakerName,
    speakerPrimaryColor,
    speakerSlug,
    speakerAvatarUrl,
  } = usePostOnboardingMentorGuidance();

  if (!isActive || !dialogueText) {
    return null;
  }

  return (
    <section
      data-tutorial="mentor-dialogue-panel"
      className="pointer-events-none fixed left-0 right-0 bottom-0 z-[105] px-3 pb-[calc(env(safe-area-inset-bottom,0px)+10px)]"
      aria-live="polite"
    >
      <div className="mx-auto max-w-4xl rounded-2xl border border-white/20 bg-black/65 shadow-[0_18px_40px_rgba(0,0,0,0.45)] backdrop-blur-md">
        <div className="flex items-end gap-3 p-3 sm:p-4">
          <div className="shrink-0">
            <MentorAvatar
              mentorSlug={(speakerSlug || "").toLowerCase()}
              mentorName={speakerName}
              primaryColor={speakerPrimaryColor || "#f59e0b"}
              avatarUrl={speakerAvatarUrl}
              size="sm"
              className="h-20 w-20 sm:h-24 sm:w-24"
              showBorder={true}
              showGlow={false}
            />
          </div>

          <div className="min-w-0 flex-1">
            <p className="text-[10px] uppercase tracking-[0.16em] text-amber-200/90">{progressText}</p>
            <p className="mt-1 inline-flex rounded-md bg-black/45 px-2 py-0.5 text-xs font-semibold text-amber-100">
              {speakerName}
            </p>
            <p className="mt-2 text-base leading-relaxed text-white sm:text-lg">{dialogueText}</p>
            {dialogueSupportText ? (
              <p className="mt-1 text-sm leading-relaxed text-white/80">{dialogueSupportText}</p>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
};
