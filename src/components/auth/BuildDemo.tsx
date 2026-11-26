import { useEffect, useState } from "react";
import { ArrowUp, Sparkles } from "lucide-react";

const PROMPTS = [
  "Build a coffee shop site with a menu and online orders",
  "Make a fitness tracker dashboard with charts",
  "Create a portfolio for a photographer with a gallery",
];

// Animated demo: someone types a prompt, then the AI builds the site live. Loops forever.
export function BuildDemo() {
  const [round, setRound] = useState(0);
  const [typed, setTyped] = useState(0);
  const [step, setStep] = useState(0); // 0 typing, 1..5 building blocks, 6 done
  const prompt = PROMPTS[round % PROMPTS.length] ?? "";

  useEffect(() => {
    if (typed < prompt.length) {
      const t = setTimeout(() => setTyped((n) => n + 1), 45);
      return () => clearTimeout(t);
    }
    if (step < 6) {
      const t = setTimeout(() => setStep((s) => s + 1), step === 0 ? 600 : 550);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => {
      setRound((r) => r + 1);
      setTyped(0);
      setStep(0);
    }, 2600);
    return () => clearTimeout(t);
  }, [typed, step, prompt.length]);

  const show = (n: number) =>
    `transition-all duration-500 ${step >= n ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"}`;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-card shadow-elevated">
      <div className="flex items-center gap-1.5 border-b border-border px-3 py-2">
        <span className="size-2.5 rounded-full bg-terminal-danger" />
        <span className="size-2.5 rounded-full bg-warning" />
        <span className="size-2.5 rounded-full bg-terminal-accent" />
        <span className="ml-2 truncate text-[11px] text-muted-foreground">
          {step > 0 ? "preview — live" : "whiterchat — new app"}
        </span>
        {step > 0 && step < 6 && (
          <span className="ml-auto inline-flex items-center gap-1 text-[11px] text-primary">
            <Sparkles className="size-3 animate-pulse" /> building…
          </span>
        )}
      </div>

      <div className="h-64 space-y-2.5 bg-background/60 p-4">
        <div className={`h-6 rounded-md bg-muted ${show(1)}`} />
        <div className={`rounded-lg bg-linear-to-br from-primary/30 to-primary/5 p-4 ${show(2)}`}>
          <div className="h-3 w-2/3 rounded bg-foreground/60" />
          <div className="mt-2 h-2 w-1/2 rounded bg-foreground/25" />
          <div className="mt-3 h-6 w-24 rounded-md bg-primary" />
        </div>
        <div className={`grid grid-cols-3 gap-2 ${show(3)}`}>
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-16 rounded-md border border-border bg-card" />
          ))}
        </div>
        <div className={`h-10 rounded-md bg-muted/70 ${show(4)}`} />
        <div className={`h-4 w-1/3 rounded bg-muted ${show(5)}`} />
      </div>

      <div className="border-t border-border p-3">
        <div className="flex items-end gap-2 rounded-xl border border-primary/40 bg-background px-3 py-2 shadow-[0_0_0_3px_var(--brand-accent-soft)]">
          <p className="min-h-10 flex-1 text-sm text-foreground">
            {prompt.slice(0, typed)}
            {step === 0 && <span className="live-caret" />}
          </p>
          <span
            className={`inline-flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-transform ${typed >= prompt.length && step === 0 ? "scale-110" : ""}`}
          >
            <ArrowUp className="size-4" />
          </span>
        </div>
      </div>
    </div>
  );
}
