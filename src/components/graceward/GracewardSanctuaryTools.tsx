import { Link } from "react-router-dom";
import { ArrowRight, Leaf, Timer } from "lucide-react";

export function GracewardSanctuaryTools() {
  return <section aria-labelledby="sanctuary-tools-title" className="rounded-[22px] border border-input bg-card/90 p-4 sm:p-5">
    <h2 id="sanctuary-tools-title" className="font-serif text-xl">Make a little space</h2>
    <p className="mt-1 text-sm leading-6 text-muted-foreground">Pause with God or set aside a few focused minutes.</p>
    <div className="mt-4 grid grid-cols-2 gap-3">
      <Link to="/mentor/quiet-pause" className="flex min-h-24 min-w-0 flex-col gap-2 rounded-2xl border border-primary/15 bg-primary/5 p-3 text-sm font-medium"><Leaf aria-hidden="true" className="h-5 w-5 text-primary"/><span>Quiet pause</span><ArrowRight aria-hidden="true" className="h-4 w-4 text-primary"/></Link>
      <Link to="/mentor/focus" className="flex min-h-24 min-w-0 flex-col gap-2 rounded-2xl border border-primary/15 bg-primary/5 p-3 text-sm font-medium"><Timer aria-hidden="true" className="h-5 w-5 text-primary"/><span>Focus time</span><ArrowRight aria-hidden="true" className="h-4 w-4 text-primary"/></Link>
    </div>
  </section>;
}
