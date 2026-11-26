import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowRight,
  ArrowUp,
  Code2,
  Cpu,
  Eye,
  Hammer,
  KeyRound,
  ListChecks,
  Sparkles,
  TerminalSquare,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import type { ExecutionMode, ProviderId } from "@/lib/types";
import { BrandLogo } from "@/components/BrandLogo";
import { ModelSelector } from "@/components/ModelSelector";
import { AuthModal } from "@/components/AuthModal";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Whiterchat — Where Ideas Begin" },
      {
        name: "description",
        content:
          "Describe an app and watch the code get written live, with an instant preview, guided planning and a real cloud terminal.",
      },
      { property: "og:title", content: "Whiterchat — Where Ideas Begin" },
      {
        property: "og:description",
        content:
          "Describe an app and watch the code get written live, with an instant preview, guided planning and a real cloud terminal.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const FEATURES = [
  {
    icon: Code2,
    title: "Live code",
    text: "Watch each file being typed in real time, and follow along as the app takes shape.",
  },
  {
    icon: ListChecks,
    title: "Guided planning",
    text: "Plan mode asks a few focused questions first, then hands you a clear, structured plan to approve.",
  },
  {
    icon: Eye,
    title: "Instant preview",
    text: "A browser-style preview with phone, tablet and desktop views, a console and full screen.",
  },
  {
    icon: TerminalSquare,
    title: "Cloud terminal",
    text: "Run real commands in a private Linux sandbox attached to your project.",
  },
  {
    icon: KeyRound,
    title: "Safe API keys",
    text: "When a project needs a private key you are asked in a secure window. Keys are encrypted and never shown to the AI.",
  },
  {
    icon: Cpu,
    title: "Your choice of model",
    text: "Use the built-in model or switch to OpenRouter, Groq or Gemini whenever you like.",
  },
];

const IDEAS = [
  "SaaS landing page",
  "Restaurant booking site",
  "Personal portfolio",
  "Task manager dashboard",
];

const MODELS = ["GPT", "Claude", "Gemini", "Llama", "DeepSeek", "Mistral", "Qwen", "Groq", "OpenRouter"];

const STATS = [
  ["< 60s", "From prompt to preview"],
  ["100+", "AI models to choose from"],
  ["3", "Device previews"],
  ["24/7", "Cloud terminal"],
] as const;

const STEPS = [
  ["Describe", "Write what you want in plain words, in any language."],
  ["Review", "Answer a few questions, read the plan, and approve it."],
  ["Ship", "Watch it get built, test it in the preview, and download the code."],
] as const;

function Index() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [prompt, setPrompt] = useState("");
  const [provider, setProvider] = useState<ProviderId>("lovable");
  const [model, setModel] = useState("openai/gpt-6.1-terra");
  const [mode, setMode] = useState<ExecutionMode>("build");
  const [authModalOpen, setAuthModalOpen] = useState(false);

  useEffect(() => {
    if (!loading && user) {
      const raw = sessionStorage.getItem("pending_prompt");
      if (raw) {
        sessionStorage.removeItem("pending_prompt");
        try {
          const parsed = JSON.parse(raw) as {
            prompt: string;
            provider?: ProviderId;
            model?: string;
            mode?: ExecutionMode;
          };
          void navigate({
            to: "/chat",
            search: {
              prompt: parsed.prompt,
              provider: parsed.provider ?? "lovable",
              model: parsed.model ?? "openai/gpt-6.1-terra",
              mode: parsed.mode ?? "build",
            },
            replace: true,
          });
          return;
        } catch {
          // ignore invalid pending prompt
        }
      }
    }
  }, [loading, user, navigate]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = prompt.trim();
    if (!text) return;

    if (!user) {
      sessionStorage.setItem(
        "pending_prompt",
        JSON.stringify({ prompt: text, provider, model, mode }),
      );
      setAuthModalOpen(true);
      return;
    }

    void navigate({
      to: "/chat",
      search: { prompt: text, provider, model, mode },
    });
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border/70 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3">
          <Link to="/">
            <BrandLogo />
          </Link>
          <nav className="hidden items-center gap-8 text-sm text-muted-foreground md:flex">
            <a href="#product" className="transition-colors hover:text-foreground">
              Product
            </a>
            <a href="#features" className="transition-colors hover:text-foreground">
              Features
            </a>
            <a href="#how" className="transition-colors hover:text-foreground">
              How it works
            </a>
          </nav>
          <div className="flex items-center gap-2">
            {user ? (
              <Link
                to="/chat"
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-glow transition-colors hover:bg-primary/90"
              >
                Open workspace <ArrowRight className="size-3.5" />
              </Link>
            ) : (
              <>
                <Link
                  to="/auth"
                  search={{ mode: "signin" }}
                  className="px-3 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground"
                >
                  Sign in
                </Link>
                <Link
                  to="/auth"
                  search={{ mode: "signup" }}
                  className="rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-glow transition-colors hover:bg-primary/90"
                >
                  Get started
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <section className="app-backdrop relative overflow-hidden px-5 pb-16 pt-20 sm:pt-28">
        <div aria-hidden className="hero-aurora pointer-events-none absolute inset-0" />
        <div className="reveal-up relative mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card/80 px-3 py-1 text-xs text-muted-foreground backdrop-blur">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-60" />
              <span className="relative inline-flex size-2 rounded-full bg-success" />
            </span>
            AI app builder · Live preview · Cloud terminal
          </span>
          <h1 className="mt-6 text-5xl font-bold leading-[1.02] tracking-tighter sm:text-7xl">
            Say it. <span className="text-gradient">See it built.</span>
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            Describe your app in any language and watch every line appear — with an instant preview
            and a real terminal beside it.
          </p>

          <form
            onSubmit={handleSubmit}
            className="prompt-shell mx-auto mt-10 max-w-2xl rounded-3xl p-3 text-left"
          >
            <textarea
              rows={3}
              dir="auto"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  handleSubmit(e);
                }
              }}
              placeholder={
                mode === "plan"
                  ? "Describe your idea — you will get a few questions, then a plan"
                  : "Ask Whiterchat to build a landing page for…"
              }
              className="min-h-24 w-full resize-none bg-transparent px-3 py-2 text-base leading-relaxed text-foreground placeholder:text-muted-foreground/80 focus:outline-none"
            />
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 px-1 pt-2.5">
              <div
                role="radiogroup"
                aria-label="Mode"
                className="flex items-center rounded-full bg-muted p-0.5"
              >
                {(
                  [
                    ["build", "Build", Hammer],
                    ["plan", "Plan", ListChecks],
                  ] as const
                ).map(([id, label, Icon]) => (
                  <button
                    key={id}
                    type="button"
                    role="radio"
                    aria-checked={mode === id}
                    onClick={() => setMode(id)}
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-all ${
                      mode === id
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Icon className={`size-3.5 ${mode === id ? "text-primary" : ""}`} /> {label}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <ModelSelector
                  provider={provider}
                  model={model}
                  onSelect={(p, m) => {
                    setProvider(p);
                    setModel(m);
                  }}
                />
                <button
                  type="submit"
                  aria-label="Start building"
                  disabled={!prompt.trim()}
                  className="send-orb inline-flex size-9 items-center justify-center rounded-full text-primary-foreground transition-transform hover:scale-105 disabled:opacity-40 disabled:shadow-none"
                >
                  <ArrowUp className="size-4" />
                </button>
              </div>
            </div>
          </form>

          <div className="mx-auto mt-5 flex max-w-2xl flex-wrap justify-center gap-2">
            {IDEAS.map((idea) => (
              <button key={idea} type="button" onClick={() => setPrompt(idea)} className="prompt-chip">
                <Sparkles className="size-3 text-primary" /> {idea}
              </button>
            ))}
          </div>
        </div>

        <div id="product" className="reveal-up relative mx-auto mt-20 max-w-5xl scroll-mt-24" style={{ animationDelay: "200ms" }}>
          <div aria-hidden className="hero-glow-ring absolute -inset-10 rounded-full" />
          <div className="relative overflow-hidden rounded-3xl border border-border bg-card p-2 shadow-elevated">
            <video
              src="/videos/build-demo.mp4"
              poster="/videos/build-demo.jpg"
              autoPlay
              muted
              loop
              playsInline
              aria-label="Demo: a prompt is sent, the AI writes the code and the site appears in the live preview"
              className="block aspect-[1280/760] w-full rounded-2xl bg-card object-cover"
            />
          </div>
        </div>
      </section>

      <section aria-label="Supported AI" className="border-y border-border bg-card/40 py-8">
        <p className="text-center text-[11px] font-semibold uppercase tracking-[0.25em] text-muted-foreground">
          Powered by the best models
        </p>
        <div className="marquee mt-5 overflow-hidden">
          <div className="marquee-track flex w-max gap-12 pr-12">
            {[...MODELS, ...MODELS].map((m, i) => (
              <span key={i} className="whitespace-nowrap text-lg font-semibold text-muted-foreground/70">
                {m}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="px-5 py-20">
        <div className="mx-auto grid max-w-5xl grid-cols-2 gap-8 text-center md:grid-cols-4">
          {STATS.map(([n, l]) => (
            <div key={l}>
              <p className="stat-number text-4xl font-bold tracking-tighter sm:text-5xl">{n}</p>
              <p className="mt-1 text-xs text-muted-foreground">{l}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="features" className="scroll-mt-20 px-5 pb-24">
        <div className="mx-auto max-w-6xl">
          <p className="font-mono text-xs text-primary">// features</p>
          <h2 className="mt-3 max-w-2xl text-4xl font-bold tracking-tight sm:text-5xl">
            Everything between the idea and <span className="text-gradient">the running app.</span>
          </h2>
          <div className="mt-12 grid auto-rows-[minmax(200px,auto)] gap-4 md:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, text }, i) => (
              <article
                key={title}
                onMouseMove={(e) => {
                  const r = e.currentTarget.getBoundingClientRect();
                  e.currentTarget.style.setProperty("--mx", `${e.clientX - r.left}px`);
                }}
                className={`bento-card flex flex-col p-7 ${i === 0 || i === 3 || i === 5 ? "md:col-span-2" : ""}`}
              >
                <span className="send-orb relative flex size-11 items-center justify-center rounded-2xl text-primary-foreground">
                  <Icon className="size-5" />
                </span>
                <h3 className="relative mt-auto pt-8 text-xl font-semibold tracking-tight">{title}</h3>
                <p className="relative mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">{text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="how" className="scroll-mt-20 border-t border-border px-5 py-24">
        <div className="mx-auto max-w-6xl">
          <p className="font-mono text-xs text-primary">// how it works</p>
          <h2 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">From words to a live app in three steps.</h2>
          <div className="relative mt-14 grid gap-6 md:grid-cols-3">
            <div aria-hidden className="absolute left-0 right-0 top-6 hidden h-px bg-linear-to-r from-transparent via-primary/50 to-transparent md:block" />
            {STEPS.map(([title, text], index) => (
              <div key={title} className="relative">
                <span className="send-orb relative flex size-12 items-center justify-center rounded-full font-mono text-sm font-bold text-primary-foreground">
                  0{index + 1}
                </span>
                <h3 className="mt-5 text-xl font-semibold tracking-tight">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-5 pb-24">
        <div className="hero-aurora relative mx-auto max-w-5xl overflow-hidden rounded-[2rem] border border-border bg-card px-6 py-16 text-center shadow-elevated">
          <h2 className="text-4xl font-bold tracking-tight sm:text-6xl">
            Your next app is <span className="text-gradient">one prompt away.</span>
          </h2>
          <p className="mx-auto mt-4 max-w-md text-muted-foreground">Start free. No setup, no credit card.</p>
          <button
            type="button"
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            className="send-orb mt-8 inline-flex items-center gap-2 rounded-full px-7 py-3 text-sm font-semibold text-primary-foreground transition-transform hover:scale-105"
          >
            Start building <ArrowRight className="size-4" />
          </button>
        </div>
      </section>

      <footer className="border-t border-border px-5 py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 sm:flex-row">
          <BrandLogo showSub />
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} Whiterchat. All rights reserved.
          </p>
        </div>
      </footer>

      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        onSuccess={() => {
          setAuthModalOpen(false);
          void navigate({ to: "/chat", search: { prompt: prompt.trim(), provider, model, mode } });
        }}
      />
    </div>
  );
}
