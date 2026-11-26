import { useEffect, useMemo, useRef, useState } from "react";
import {
  ExternalLink,
  Lock,
  Maximize2,
  Minimize2,
  Monitor,
  RotateCw,
  Smartphone,
  Tablet,
  TerminalSquare,
  Trash2,
  Sparkles,
  Loader2,
} from "lucide-react";
import { buildPreviewHtml, listPreviewPages } from "@/lib/artifact-parser";
import { answerCloudCall, type CloudConnection } from "@/lib/cloud-bridge";
import type { WorkspaceFile } from "@/lib/types";

export interface PreviewCloud extends CloudConnection {
  /** Set when the project uses the owner's own Supabase instead of Cloud Codzer. */
  supabase: { url: string; key: string } | null;
  /** Changes whenever the cloud setup changes, so the app restarts against it. */
  version: number;
}

type Device = "desktop" | "tablet" | "mobile";
interface ConsoleEntry {
  level: "log" | "info" | "warn" | "error";
  text: string;
}

const DEVICES: Record<Exclude<Device, "desktop">, { width: number; height: number }> = {
  tablet: { width: 768, height: 1024 },
  mobile: { width: 390, height: 844 },
};
const SANDBOX = "allow-scripts allow-forms allow-modals allow-popups";

export function PreviewFrame({
  files,
  building,
  cloud,
  onFixErrors,
}: {
  files: Record<string, WorkspaceFile>;
  building: boolean;
  cloud: PreviewCloud | null;
  /** Sends the preview's runtime errors to the AI so it can repair the app. */
  onFixErrors?: (report: string) => void;
}) {
  const cloudRef = useRef(cloud);
  cloudRef.current = cloud;
  const supabaseConfig = cloud?.supabase ? JSON.stringify(cloud.supabase) : "";
  const [device, setDevice] = useState<Device>("desktop");
  const [reloadKey, setReloadKey] = useState(0);
  const [page, setPage] = useState("");
  const [logs, setLogs] = useState<ConsoleEntry[]>([]);
  const [consoleOpen, setConsoleOpen] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [area, setArea] = useState({ width: 0, height: 0 });
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  const pages = useMemo(() => listPreviewPages(files), [files]);
  const activePage = page && files[page] ? page : (pages[0] ?? "");
  const liveHtml = useMemo(
    () =>
      buildPreviewHtml(
        files,
        activePage,
        supabaseConfig
          ? `<script>window.CODZER_SUPABASE=${supabaseConfig.replace(/</g, "\\u003c")}</script>`
          : "",
      ),
    [files, activePage, supabaseConfig],
  );

  // Debounce so typing in the editor does not reload the page on every keystroke.
  const [html, setHtml] = useState(liveHtml);
  useEffect(() => {
    const timer = setTimeout(() => setHtml(liveHtml), 300);
    return () => clearTimeout(timer);
  }, [liveHtml]);

  useEffect(() => {
    setLogs([]);
  }, [html, reloadKey]);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow) return;
      const data: unknown = event.data;
      if (
        !data ||
        typeof data !== "object" ||
        !("source" in data) ||
        data.source !== "whiterchat-preview"
      )
        return;
      if ("cloud" in data) {
        void answerCloudCall(event.source as Window, cloudRef.current, data.cloud);
        return;
      }
      if ("navigate" in data && typeof data.navigate === "string") {
        const target = data.navigate
          .replace(/^\.?\//, "")
          .replace(/[?#].*$/, "")
          .toLowerCase();
        const match = Object.keys(files).find((path) => path.toLowerCase() === target);
        if (match) setPage(match);
        return;
      }
      if ("level" in data && "text" in data && typeof data.text === "string") {
        const level =
          data.level === "error" || data.level === "warn" || data.level === "info"
            ? data.level
            : "log";
        setLogs((previous) => [
          ...previous.slice(-199),
          { level, text: String(data.text).slice(0, 2000) },
        ]);
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [files]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setArea({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(stage);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setFullscreen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [fullscreen]);

  // The new tab hosts the app inside a sandboxed frame so generated code never runs with this site's origin.
  const openInNewTab = () => {
    const tab = window.open("", "_blank");
    if (!tab) return;
    tab.document.title = `${activePage || "Preview"} — Whiterchat`;
    tab.document.body.style.margin = "0";
    const frame = tab.document.createElement("iframe");
    frame.setAttribute("sandbox", SANDBOX);
    frame.style.cssText = "border:0;width:100vw;height:100vh;display:block";
    frame.srcdoc = html;
    tab.document.body.appendChild(frame);
    tab.addEventListener("message", (event: MessageEvent) => {
      const data: unknown = event.data;
      if (event.source !== frame.contentWindow || !data || typeof data !== "object") return;
      if ("cloud" in data) void answerCloudCall(event.source as Window, cloudRef.current, data.cloud);
    });
  };

  const hasFiles = Object.keys(files).length > 0;
  const errorCount = logs.filter((entry) => entry.level === "error").length;
  const frameSize = device === "desktop" ? null : DEVICES[device];
  const scale =
    frameSize && area.width
      ? Math.min(
          1,
          (area.width - 32) / (frameSize.width + 20),
          (area.height - 32) / (frameSize.height + 20),
        )
      : 1;
  const toolButton = (active = false) =>
    `inline-flex size-7 items-center justify-center rounded-md transition-colors ${
      active
        ? "bg-background text-foreground shadow-sm"
        : "text-muted-foreground hover:bg-background/70 hover:text-foreground"
    }`;

  const iframe = (
    <iframe
      ref={iframeRef}
      key={`${reloadKey}-${activePage}-${cloud?.version ?? 0}`}
      title="Live application preview"
      sandbox={SANDBOX}
      srcDoc={html}
      className="size-full border-0 bg-white"
    />
  );

  return (
    <div
      className={
        fullscreen
          ? "fixed inset-0 z-50 flex flex-col bg-background"
          : "flex min-h-0 flex-1 flex-col"
      }
    >
      <div className="flex items-center gap-2 border-b border-border bg-card/80 px-3 py-2 backdrop-blur">
        <div className="hidden items-center gap-1.5 sm:flex" aria-hidden="true">
          <span className="size-2.5 rounded-full bg-destructive/70" />
          <span className="size-2.5 rounded-full bg-warning/80" />
          <span className="size-2.5 rounded-full bg-success/80" />
        </div>
        <button
          type="button"
          className={toolButton()}
          title="Reload preview"
          aria-label="Reload preview"
          onClick={() => setReloadKey((key) => key + 1)}
        >
          <RotateCw className="size-3.5" />
        </button>
        <div className="flex h-8 min-w-0 flex-1 items-center gap-2 rounded-full border border-border bg-background/80 px-3.5 shadow-inner text-xs text-muted-foreground">
          <Lock className="size-3 shrink-0 text-success" />
          <span className="hidden shrink-0 sm:inline">preview</span>
          <span className="hidden sm:inline">/</span>
          {pages.length > 1 ? (
            <select
              aria-label="Preview page"
              value={activePage}
              onChange={(event) => setPage(event.target.value)}
              className="min-w-0 flex-1 truncate bg-transparent font-mono text-foreground outline-none"
            >
              {pages.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          ) : (
            <span className="truncate font-mono text-foreground">{activePage || "index.html"}</span>
          )}
          {building && (
            <span className="ml-auto inline-flex shrink-0 items-center gap-1.5 text-[11px] font-medium text-primary">
              <span className="size-1.5 animate-pulse rounded-full bg-primary" /> building
            </span>
          )}
        </div>
        <div className="flex items-center gap-0.5 rounded-lg bg-muted p-0.5">
          {(
            [
              ["desktop", Monitor],
              ["tablet", Tablet],
              ["mobile", Smartphone],
            ] as const
          ).map(([id, Icon]) => (
            <button
              key={id}
              type="button"
              className={toolButton(device === id)}
              title={`${id} view`}
              aria-label={`${id} view`}
              aria-pressed={device === id}
              onClick={() => setDevice(id)}
            >
              <Icon className="size-3.5" />
            </button>
          ))}
        </div>
        <button
          type="button"
          className={`${toolButton(consoleOpen)} relative`}
          title="Console"
          aria-label="Toggle console"
          aria-pressed={consoleOpen}
          onClick={() => setConsoleOpen((open) => !open)}
        >
          <TerminalSquare className="size-3.5" />
          {errorCount > 0 && (
            <span className="absolute -right-1 -top-1 flex min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-bold leading-4 text-destructive-foreground">
              {errorCount}
            </span>
          )}
        </button>
        <button
          type="button"
          className={toolButton()}
          title="Open in new tab"
          aria-label="Open in new tab"
          onClick={openInNewTab}
        >
          <ExternalLink className="size-3.5" />
        </button>
        <button
          type="button"
          className={toolButton()}
          title={fullscreen ? "Exit full screen" : "Full screen"}
          aria-label={fullscreen ? "Exit full screen" : "Full screen"}
          onClick={() => setFullscreen((value) => !value)}
        >
          {fullscreen ? <Minimize2 className="size-3.5" /> : <Maximize2 className="size-3.5" />}
        </button>
      </div>

      <div className="relative h-0.5 overflow-hidden bg-border">
        {building && <div className="build-sweep absolute inset-y-0 w-1/3 bg-primary" />}
      </div>

      <div
        ref={stageRef}
        className="preview-stage relative flex min-h-0 flex-1 items-center justify-center overflow-hidden p-3 sm:p-5"
      >
        {!hasFiles ? (
          <div className="relative z-10 flex max-w-sm flex-col items-center text-center">
            <div className="preview-orb relative flex size-20 items-center justify-center rounded-3xl">
              <Sparkles className="size-8 text-primary-foreground" />
            </div>
            <h3 className="mt-6 text-lg font-semibold tracking-tight text-foreground">
              {building ? "Building your app…" : "Your app will appear here"}
            </h3>
            <p className="mt-1.5 text-sm text-muted-foreground">
              {building
                ? "Writing files and wiring everything together. The live preview opens as soon as it's ready."
                : "Describe what you want in the chat and watch it come to life, live."}
            </p>
            {building && (
              <div className="mt-6 w-full space-y-2">
                {[72, 100, 56].map((w, i) => (
                  <div key={i} className="preview-skeleton h-3 rounded-full" style={{ width: `${w}%`, animationDelay: `${i * 150}ms` }} />
                ))}
              </div>
            )}
          </div>
        ) : frameSize ? (
          <div
            style={{
              width: (frameSize.width + 20) * scale,
              height: (frameSize.height + 20) * scale,
            }}
          >
            <div
              className="device-bezel relative origin-top-left overflow-hidden rounded-[2.4rem] border-[10px] bg-white"
              style={{
                width: frameSize.width + 20,
                height: frameSize.height + 20,
                transform: `scale(${scale})`,
              }}
            >
              {device === "mobile" && (
                <span aria-hidden className="device-notch absolute left-1/2 top-2 z-10 h-6 w-28 -translate-x-1/2 rounded-full" />
              )}
              {iframe}
            </div>
          </div>
        ) : (
          <div className="preview-window relative size-full overflow-hidden rounded-xl bg-white">
            {iframe}
          </div>
        )}
        {hasFiles && building && (
          <div className="pointer-events-none absolute right-5 top-5 z-10 inline-flex items-center gap-2 rounded-full border border-border bg-background/85 px-3 py-1.5 text-xs font-medium text-foreground shadow-elevated backdrop-blur">
            <Loader2 className="size-3.5 animate-spin text-primary" /> Updating preview
          </div>
        )}
        {frameSize && hasFiles && (
          <span className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full border border-border bg-background/90 px-2.5 py-0.5 font-mono text-[10px] text-muted-foreground backdrop-blur">
            {frameSize.width} × {frameSize.height} · {Math.round(scale * 100)}%
          </span>
        )}
      </div>

      {consoleOpen && (
        <div className="flex h-40 shrink-0 flex-col border-t border-terminal-border bg-terminal text-terminal-foreground">
          <div className="flex items-center justify-between border-b border-terminal-border px-3 py-1">
            <span className="font-mono text-[11px] text-terminal-muted">
              console · {logs.length} message{logs.length === 1 ? "" : "s"}
            </span>
            {onFixErrors && logs.some((e) => e.level === "error") && (
              <button
                type="button"
                disabled={building}
                className="ms-auto me-2 inline-flex items-center gap-1 rounded bg-primary px-2 py-0.5 text-[11px] font-medium text-primary-foreground disabled:opacity-50"
                onClick={() =>
                  onFixErrors(
                    logs
                      .filter((e) => e.level === "error")
                      .slice(-10)
                      .map((e) => e.text)
                      .join("\n"),
                  )
                }
              >
                Fix with AI
              </button>
            )}
            <button
              type="button"
              aria-label="Clear console"
              title="Clear console"
              className="rounded p-1 text-terminal-muted hover:text-terminal-foreground"
              onClick={() => setLogs([])}
            >
              <Trash2 className="size-3" />
            </button>
          </div>
          <div
            className="thin-scroll min-h-0 flex-1 overflow-auto px-3 py-1.5 font-mono text-[11.5px] leading-5"
            role="log"
            dir="ltr"
          >
            {logs.length === 0 ? (
              <p className="text-terminal-muted">No console output yet.</p>
            ) : (
              logs.map((entry, index) => (
                <pre
                  key={index}
                  className={`whitespace-pre-wrap break-words border-b border-terminal-border/60 py-0.5 font-mono ${
                    entry.level === "error"
                      ? "text-terminal-danger"
                      : entry.level === "warn"
                        ? "text-warning"
                        : ""
                  }`}
                >
                  {entry.text}
                </pre>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
