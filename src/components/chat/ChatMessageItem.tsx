import { queueTerminalCommands } from "@/lib/terminal-queue";
import { memo, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Brain,
  Check,
  ChevronRight,
  FilePlus2,
  Sparkles,
  Terminal,
  ClipboardList,
  Copy,
  Download,
  FileCode2,
  Hammer,
  KeyRound,
  Loader2,
  PanelRightOpen,
  Play,
} from "lucide-react";
import { toast } from "sonner";
import { parseArtifactsFromText } from "@/lib/artifact-parser";
import {
  extractSecretRequests,
  extractThinking,
  visibleAssistantText,
  type SecretRequest,
} from "@/lib/workspace-protocol";
import { downloadFile } from "@/lib/workspace-tools";
import { Button } from "@/components/ui/button";
import type { ChatMessage } from "@/lib/types";

interface ChatMessageItemProps {
  message: ChatMessage;
  /** True while this message is still being generated. */
  active: boolean;
  busy: boolean;
  livePath: string;
  savedSecrets: string[];
  onOpenWorkbench: () => void;
  onBuildPlan: () => void;
  onOpenSecrets: (requests: SecretRequest[]) => void;
}

const copy = (text: string) => {
  void navigator.clipboard
    .writeText(text)
    .then(() => toast.success("Copied"))
    .catch(() => toast.error("Clipboard unavailable"));
};

function ChatMessageItemBase({
  message,
  active,
  busy,
  livePath,
  savedSecrets,
  onOpenWorkbench,
  onBuildPlan,
  onOpenSecrets,
}: ChatMessageItemProps) {
  const parsed = useMemo(() => {
    if (message.role === "user") return null;
    const visible = visibleAssistantText(message.content);
    const { cleanMarkdown, artifacts } = parseArtifactsFromText(visible);
    // Hide a half-streamed opening tag such as "<boltArti".
    const text = cleanMarkdown.replace(
      /<\/?(?:bolt\w*|secretR\w*|cloudS\w*|thi\w*)?[^>]*$/,
      (tail) => (tail.startsWith("<") && !tail.includes(">") ? "" : tail),
    );
    return {
      text,
      artifacts,
      thinking: extractThinking(message.content),
      secrets: active ? [] : extractSecretRequests(message.content),
    };
  }, [message.content, message.role, active]);

  if (!parsed) {
    return (
      <div className="flex justify-end">
        <p
          dir="auto"
          className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-sm leading-relaxed text-primary-foreground shadow-sm"
        >
          {message.content}
        </p>
      </div>
    );
  }

  const isPlan = message.kind === "plan";
  const missingSecrets = parsed.secrets.filter((secret) => !savedSecrets.includes(secret.name));
  const thinking = active && !parsed.text && parsed.artifacts.length === 0 && !parsed.thinking;
  const reasoning = parsed.thinking;
  const reasoningLive = active && reasoning && !reasoning.done;
  const totalFiles = parsed.artifacts.reduce((n, a) => n + a.files.length, 0);
  const totalCommands = parsed.artifacts.reduce((n, a) => n + a.commands.length, 0);
  const phase = !active
    ? "done"
    : parsed.artifacts.length
      ? "code"
      : reasoningLive || !parsed.text
        ? "think"
        : "write";

  const body = parsed.text ? (
    <div dir="auto" className="markdown-body">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{parsed.text}</ReactMarkdown>
    </div>
  ) : null;

  if (isPlan) {
    return (
      <article className="overflow-hidden rounded-2xl border border-border bg-card shadow-elevated">
        <header className="flex items-center justify-between gap-3 border-b border-border bg-brand-accent-soft px-5 py-3">
          <div className="flex items-center gap-3">
            <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <ClipboardList className="size-4.5" />
            </span>
            <div>
              <h3 className="text-sm font-semibold leading-tight">Implementation plan</h3>
              <p className="text-xs text-muted-foreground">
                {active ? "Writing your plan…" : "Review it, then build when you are ready"}
              </p>
            </div>
          </div>
          {active && <Loader2 className="size-4 animate-spin text-primary" />}
        </header>
        <div className="px-5 py-5">
          {body ?? (
            <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" /> Thinking through your answers…
            </span>
          )}
        </div>
        {!active && parsed.text && (
          <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-border bg-secondary/40 px-5 py-3">
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" onClick={() => copy(parsed.text)}>
                <Copy /> Copy
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => downloadFile("plan.md", parsed.text, "text/markdown")}
              >
                <Download /> Download
              </Button>
            </div>
            <Button size="sm" disabled={busy} onClick={onBuildPlan}>
              <Hammer /> Build this plan
            </Button>
          </footer>
        )}
      </article>
    );
  }

  return (
    <div className="group space-y-3">
      {thinking && (
        <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin text-primary" /> Reading your request…
        </span>
      )}

      {(reasoning || parsed.artifacts.length > 0) && (
        <ol className="flex flex-wrap items-center gap-1.5 text-[11px] font-medium">
          {(
            [
              ["think", "Thinking", Brain],
              ["code", "Writing code", FileCode2],
              ["done", "Ready", Sparkles],
            ] as const
          ).map(([key, label, Icon], i) => {
            const order = ["think", "write", "code", "done"];
            const current = order.indexOf(phase);
            const mine = order.indexOf(key);
            const state =
              mine < current
                ? "past"
                : mine === current || (key === "think" && phase === "write")
                  ? "now"
                  : "next";
            return (
              <li key={key} className="flex items-center gap-1.5">
                {i > 0 && <span className="h-px w-4 bg-border" />}
                <span
                  className={
                    "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 transition-colors " +
                    (state === "now"
                      ? "border-primary/40 bg-brand-accent-soft text-primary"
                      : state === "past"
                        ? "border-border bg-card text-foreground"
                        : "border-dashed border-border text-muted-foreground")
                  }
                >
                  {state === "now" && active ? (
                    <Loader2 className="size-3 animate-spin" />
                  ) : state === "past" || (state === "now" && !active) ? (
                    <Check className="size-3 text-success" />
                  ) : (
                    <Icon className="size-3" />
                  )}
                  {label}
                </span>
              </li>
            );
          })}
        </ol>
      )}

      {reasoning && (
        <details
          open={reasoningLive ? true : undefined}
          className="group/think overflow-hidden rounded-xl border border-border bg-card/60"
        >
          <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-2.5 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground">
            <ChevronRight className="size-3.5 transition-transform group-open/think:rotate-90" />
            <Brain className={"size-3.5 text-primary " + (reasoningLive ? "animate-pulse" : "")} />
            {reasoningLive ? "Thinking…" : "Thought process"}
          </summary>
          <div
            dir="auto"
            className="whitespace-pre-wrap border-l-2 border-primary/30 mx-4 mb-3 pl-3 text-xs leading-relaxed text-muted-foreground"
          >
            {reasoning.text || "…"}
          </div>
        </details>
      )}

      {body}

      {parsed.artifacts.map((artifact) => (
        <div
          key={artifact.id}
          className="overflow-hidden rounded-xl border border-border bg-card shadow-sm"
        >
          <button
            type="button"
            onClick={onOpenWorkbench}
            className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-secondary/60"
          >
            <span className="flex min-w-0 items-center gap-3">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand-accent-soft text-primary">
                {active ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <FileCode2 className="size-4" />
                )}
              </span>
              <span className="min-w-0">
                <span dir="auto" className="block truncate text-sm font-semibold">
                  {artifact.title}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {active
                    ? `Writing code live… ${artifact.files.length} file${artifact.files.length === 1 ? "" : "s"} so far`
                    : `${artifact.files.length} file${artifact.files.length === 1 ? "" : "s"}${artifact.commands.length ? ` · ${artifact.commands.length} command${artifact.commands.length === 1 ? "" : "s"}` : ""} · open in workbench`}
                </span>
              </span>
            </span>
            <PanelRightOpen className="size-4 shrink-0 text-muted-foreground" />
          </button>
          {(artifact.files.length > 0 || artifact.commands.length > 0) && (
            <ul className="relative space-y-0.5 border-t border-border bg-secondary/30 px-4 py-3 text-xs">
              {artifact.files.map((file, index) => {
                const writing = active && file.path === livePath;
                return (
                  <li key={`${file.path}-${index}`} className="flex items-center gap-2.5 py-1">
                    <span
                      className={
                        "flex size-5 shrink-0 items-center justify-center rounded-md " +
                        (writing
                          ? "bg-primary text-primary-foreground"
                          : "bg-card text-success border border-border")
                      }
                    >
                      {writing ? (
                        <Loader2 className="size-3 animate-spin" />
                      ) : (
                        <Check className="size-3" />
                      )}
                    </span>
                    <span className="text-muted-foreground">{writing ? "Writing" : "Created"}</span>
                    <span
                      className={
                        "truncate font-mono " + (writing ? "text-foreground" : "text-foreground/80")
                      }
                    >
                      {file.path}
                    </span>
                    <span className="ml-auto shrink-0 rounded bg-card px-1.5 py-0.5 font-mono text-[10px] text-success">
                      +{file.content.split("\n").length}
                    </span>
                  </li>
                );
              })}
              {artifact.commands.map((command, index) => (
                <li key={`cmd-${index}`} className="py-1">
                  <div className="mb-1 flex items-center gap-2.5 text-muted-foreground">
                    <span className="flex size-5 items-center justify-center rounded-md border border-border bg-card">
                      <Terminal className="size-3" />
                    </span>
                    Command
                    {!active && (
                      <button
                        type="button"
                        onClick={() => queueTerminalCommands(command.split("\n"))}
                        className="ml-auto inline-flex items-center gap-1 rounded-md border border-border bg-card px-2 py-0.5 text-[11px] font-medium text-foreground transition-colors hover:border-primary hover:text-primary"
                      >
                        <Play className="size-3" /> Run in terminal
                      </button>
                    )}
                  </div>
                  <pre className="overflow-x-auto rounded-lg bg-foreground px-3 py-2 font-mono text-[11px] text-background">
                    <span className="opacity-50">$ </span>
                    {command}
                  </pre>
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}

      {!active && (totalFiles > 0 || totalCommands > 0) && (
        <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <FilePlus2 className="size-3" /> {totalFiles} file{totalFiles === 1 ? "" : "s"} changed
          {totalCommands ? ` · ${totalCommands} command${totalCommands === 1 ? "" : "s"}` : ""}
        </p>
      )}

      {parsed.secrets.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/30 bg-brand-accent-soft px-4 py-3">
          <span className="flex min-w-0 items-center gap-3">
            <KeyRound className="size-4 shrink-0 text-primary" />
            <span className="min-w-0 text-xs">
              <span className="block font-semibold text-foreground">
                {missingSecrets.length ? "API keys needed" : "API keys saved"}
              </span>
              <span className="block truncate font-mono text-muted-foreground">
                {parsed.secrets.map((secret) => secret.name).join(", ")}
              </span>
            </span>
          </span>
          <Button
            size="sm"
            variant={missingSecrets.length ? "default" : "outline"}
            onClick={() => onOpenSecrets(parsed.secrets)}
          >
            {missingSecrets.length ? "Add keys" : "Manage"}
          </Button>
        </div>
      )}

      {!active && message.content && (
        <div className="flex opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-muted-foreground"
            onClick={() => copy(parsed.text || message.content)}
          >
            <Copy /> Copy
          </Button>
        </div>
      )}
    </div>
  );
}

export const ChatMessageItem = memo(ChatMessageItemBase);
