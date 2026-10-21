import { useState } from "react";
import { Button } from "@/components/ui/button";

const pauses = [
  { title: "Arrive", copy: "Settle into a comfortable position. Notice where you are supported. There is nothing to accomplish in this moment.", prayer: "God, I am here." },
  { title: "Bring what’s here", copy: "Name one thing on your mind. You can hold it quietly or bring it to God in your own words.", prayer: "God, meet me in this ordinary moment." },
  { title: "Choose gently", copy: "Think of one small act of care for yourself or another person. Let the next step be small enough for today.", prayer: "God, help me take one loving step. Amen." },
];
export function GracewardQuietPause() {
  const [step, setStep] = useState(0);
  return <section className="space-y-4" aria-label="A quiet pause"><p className="text-xs uppercase tracking-wider text-primary">A quiet pause · {step + 1} of 3</p><h3 className="font-serif text-3xl" aria-live="polite">{pauses[step].title}</h3><p className="text-sm leading-7">{pauses[step].copy}</p><p className="rounded-2xl bg-primary/5 p-5 font-serif text-xl">{pauses[step].prayer}</p><div className="flex gap-2"><Button variant="outline" disabled={!step} className="min-h-11" onClick={() => setStep(step - 1)}>Back</Button><Button className="min-h-11" onClick={() => setStep(step === 2 ? 0 : step + 1)}>{step === 2 ? "Begin another pause" : "Continue when ready"}</Button></div></section>;
}
