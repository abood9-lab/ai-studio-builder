import { useEffect, useMemo, useState } from "react";
import { Check, ChevronDown, Search, Sparkles, KeyRound, Zap, Brain, Code2, Gift, Layers } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { ModelCategory, ModelsApiResponse, ProviderId } from "@/lib/types";

interface ModelSelectorProps {
  provider: ProviderId;
  model: string;
  onSelect: (provider: ProviderId, model: string) => void;
}

const CATEGORIES: Array<{ id: "all" | ModelCategory; label: string; icon: typeof Zap }> = [
  { id: "all", label: "All", icon: Layers },
  { id: "free", label: "Free", icon: Gift },
  { id: "coding", label: "Coding", icon: Code2 },
  { id: "reasoning", label: "Reasoning", icon: Brain },
  { id: "fast", label: "Fast", icon: Zap },
];

const PROVIDER_META: Record<ProviderId, { short: string; tagline: string }> = {
  lovable: { short: "AI", tagline: "Built-in, no key needed" },
  openrouter: { short: "OR", tagline: "Hundreds of models, one key" },
  groq: { short: "GQ", tagline: "Ultra-fast inference" },
  gemini: { short: "GM", tagline: "Google Gemini family" },
};

export function ModelSelector({ provider, model, onSelect }: ModelSelectorProps) {
  const [open, setOpen] = useState(false);
  const [catalog, setCatalog] = useState<ModelsApiResponse | null>(null);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<"all" | ModelCategory>("all");
  const [activeProvider, setActiveProvider] = useState<ProviderId | "all">("all");

  useEffect(() => {
    fetch("/api/models")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: ModelsApiResponse | null) => {
        if (data) setCatalog(data);
      })
      .catch(() => {});
  }, []);

  const providers = catalog?.providers ?? [];
  const current = providers.find((p) => p.id === provider)?.models.find((m) => m.id === model);
  const label = current?.name ?? model.split("/").pop() ?? "Choose model";

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return providers
      .filter((p) => activeProvider === "all" || p.id === activeProvider)
      .flatMap((p) => p.models.map((m) => ({ ...m, providerName: p.name, configured: p.configured })))
      .filter(
        (m) =>
          (category === "all" || m.categories.includes(category)) &&
          (!q || m.name.toLowerCase().includes(q) || m.id.toLowerCase().includes(q) || m.providerName.toLowerCase().includes(q)),
      );
  }, [providers, activeProvider, category, query]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group inline-flex items-center gap-2 rounded-full border border-border bg-background/70 py-1 pl-1 pr-2.5 text-xs font-medium text-foreground transition-all hover:border-primary/50 hover:bg-accent"
      >
        <span className="send-orb flex size-6 items-center justify-center rounded-full text-[9px] font-bold text-primary-foreground">
          {PROVIDER_META[provider]?.short ?? "AI"}
        </span>
        <span className="max-w-[140px] truncate">{label}</span>
        <ChevronDown className="size-3 text-muted-foreground transition-transform group-hover:translate-y-0.5" />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl gap-0 overflow-hidden p-0 sm:rounded-2xl">
          <DialogHeader className="hero-aurora border-b border-border px-6 pb-4 pt-6 text-left">
            <DialogTitle className="text-xl tracking-tight">Choose your AI</DialogTitle>
            <DialogDescription>Pick a provider, then the model that fits your task.</DialogDescription>
            <div className="relative mt-4">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search models or providers…"
                className="h-11 w-full rounded-xl border border-input bg-background pl-10 pr-3 text-sm focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/15"
              />
            </div>
          </DialogHeader>

          <div className="grid h-[min(60vh,520px)] grid-cols-1 sm:grid-cols-[220px_1fr]">
            <aside className="thin-scroll hidden space-y-1 overflow-y-auto border-r border-border bg-secondary/40 p-3 sm:block">
              <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Providers</p>
              {[{ id: "all" as const, name: "All providers", configured: true }, ...providers].map((p) => {
                const meta = p.id === "all" ? { short: "∗", tagline: "Everything available" } : PROVIDER_META[p.id];
                const active = activeProvider === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setActiveProvider(p.id)}
                    className={`flex w-full items-center gap-2.5 rounded-xl p-2 text-left transition-all ${active ? "bg-card shadow-sm ring-1 ring-primary/40" : "hover:bg-card/70"}`}
                  >
                    <span className={`flex size-8 shrink-0 items-center justify-center rounded-lg text-[10px] font-bold ${active ? "send-orb text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                      {meta.short}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-semibold text-foreground">{p.name}</span>
                      <span className="block truncate text-[10px] text-muted-foreground">{meta.tagline}</span>
                    </span>
                    {p.id !== "all" && !p.configured && <KeyRound className="size-3 text-muted-foreground" />}
                  </button>
                );
              })}
            </aside>

            <section className="flex min-h-0 flex-col">
              <div className="flex gap-1.5 overflow-x-auto border-b border-border px-4 py-2.5">
                {CATEGORIES.map(({ id, label: l, icon: Icon }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setCategory(id)}
                    className={`inline-flex shrink-0 items-center gap-1 rounded-full px-3 py-1 text-xs font-medium transition-colors ${category === id ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"}`}
                  >
                    <Icon className="size-3" /> {l}
                  </button>
                ))}
              </div>
              <div className="thin-scroll grid flex-1 content-start gap-2 overflow-y-auto p-4 md:grid-cols-2">
                {!catalog && <p className="col-span-full py-10 text-center text-sm text-muted-foreground">Loading models…</p>}
                {catalog && filtered.length === 0 && (
                  <p className="col-span-full py-10 text-center text-sm text-muted-foreground">No models match your search.</p>
                )}
                {filtered.map((m) => {
                  const selected = m.provider === provider && m.id === model;
                  return (
                    <button
                      key={`${m.provider}-${m.id}`}
                      type="button"
                      onClick={() => {
                        onSelect(m.provider, m.id);
                        setOpen(false);
                      }}
                      className={`group relative flex flex-col rounded-xl border p-3 text-left transition-all hover:-translate-y-0.5 hover:shadow-md ${selected ? "border-primary bg-accent/60 ring-2 ring-primary/25" : "border-border bg-card hover:border-primary/40"}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-sm font-semibold text-foreground">{m.name}</span>
                        {selected && (
                          <span className="send-orb flex size-5 items-center justify-center rounded-full text-primary-foreground">
                            <Check className="size-3" />
                          </span>
                        )}
                      </div>
                      <span className="mt-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">{m.providerName}</span>
                      <p className="mt-1.5 line-clamp-2 text-xs text-muted-foreground">{m.description}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        {m.categories.map((c) => (
                          <span key={c} className="rounded-md bg-secondary px-1.5 py-0.5 text-[10px] capitalize text-muted-foreground">{c}</span>
                        ))}
                        {m.pricing && <span className="ml-auto text-[10px] text-muted-foreground">{m.pricing}</span>}
                      </div>
                      {!m.configured && (
                        <span className="mt-2 inline-flex items-center gap-1 text-[10px] text-primary">
                          <Sparkles className="size-3" /> Uses built-in AI until a key is added
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </section>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
