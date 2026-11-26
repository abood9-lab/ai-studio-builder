import { useCallback, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Building2, Check, Database, Loader2, LogOut, Plug, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  completeSupabaseOAuth,
  disconnectSupabaseAccount,
  getSupabaseAccount,
  startSupabaseOAuth,
  type SupabaseAccount,
} from "@/lib/supabase-oauth.functions";

interface Props {
  ensureProject: () => Promise<string>;
  connectedRef: string;
  onLink: (projectRef: string) => Promise<unknown>;
}

function waitForPopup(popup: Window) {
  return new Promise<{ code: string; state: string }>((resolve, reject) => {
    const timer = window.setInterval(() => {
      if (popup.closed) done(new Error("The Supabase window was closed"));
    }, 500);
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.source !== popup) return;
      const data = event.data as { type?: string; code?: string; state?: string; error?: string };
      if (data?.type !== "supabaseOAuth") return;
      if (data.error || !data.code || !data.state) done(new Error(data.error || "Sign-in failed"));
      else done(null, { code: data.code, state: data.state });
    };
    function done(error: Error | null, value?: { code: string; state: string }) {
      window.clearInterval(timer);
      window.removeEventListener("message", onMessage);
      if (error) reject(error);
      else resolve(value!);
    }
    window.addEventListener("message", onMessage);
  });
}

export function SupabaseConnect({ ensureProject, connectedRef, onLink }: Props) {
  const getAccount = useServerFn(getSupabaseAccount);
  const start = useServerFn(startSupabaseOAuth);
  const complete = useServerFn(completeSupabaseOAuth);
  const disconnect = useServerFn(disconnectSupabaseAccount);
  const [account, setAccount] = useState<SupabaseAccount | null>(null);
  const [busy, setBusy] = useState(false);
  const [org, setOrg] = useState("");
  const [ref, setRef] = useState("");

  const load = useCallback(async () => {
    try {
      const next = await getAccount();
      setAccount(next);
      return next;
    } catch {
      setAccount({
        configured: false,
        connected: false,
        redirectUri: "",
        organizations: [],
        projects: [],
      });
      return null;
    }
  }, [getAccount]);
  useEffect(() => void load(), [load]);

  const orgs = account?.organizations ?? [];
  const activeOrg = org || orgs[0]?.slug || "";
  const projects = useMemo(
    () => (account?.projects ?? []).filter((p) => p.organization_slug === activeOrg),
    [account, activeOrg],
  );
  const activeRef =
    ref || (projects.some((p) => p.ref === connectedRef) ? connectedRef : projects[0]?.ref) || "";

  const signIn = async () => {
    const popup = window.open("", "supabase-oauth", "width=620,height=760");
    if (!popup) {
      toast.error("Allow pop-ups to connect Supabase");
      return;
    }
    setBusy(true);
    try {
      const projectId = await ensureProject();
      const { authorizationUrl } = await start({ data: { projectId } });
      const result = waitForPopup(popup);
      popup.location.href = authorizationUrl;
      await complete({ data: await result });
      await load();
      toast.success("Supabase account connected — choose an organization");
    } catch (error) {
      popup.close();
      toast.error(error instanceof Error ? error.message : "Could not connect Supabase");
    } finally {
      setBusy(false);
    }
  };

  const link = async () => {
    if (!activeRef) return;
    setBusy(true);
    try {
      await onLink(activeRef);
    } finally {
      setBusy(false);
    }
  };

  if (!account)
    return (
      <div className="flex justify-center py-6">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );

  if (!account.connected)
    return (
      <div className="text-center">
        <Button
          size="lg"
          className="w-full"
          disabled={busy || !account.configured}
          onClick={() => void signIn()}
        >
          {busy ? <Loader2 className="animate-spin" /> : <Plug />}
          {busy ? "Waiting for Supabase…" : "Connect Supabase"}
        </Button>
        {account.configured ? (
          <p className="mt-3 flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
            <ShieldCheck className="size-3.5 text-success" /> Sign in to Supabase, then pick your
            organization
          </p>
        ) : (
          <p className="mt-3 text-[11px] text-muted-foreground">
            Supabase sign-in isn't set up for this workspace yet.
          </p>
        )}
      </div>
    );

  const select =
    "h-9 w-full rounded-lg border border-border bg-background px-2.5 text-xs outline-hidden focus:border-primary";
  return (
    <div className="space-y-3 text-left">
      <label className="block text-[11px] font-medium text-muted-foreground">
        <span className="mb-1 flex items-center gap-1.5">
          <Building2 className="size-3.5" /> Organization
        </span>
        <select
          aria-label="Organization"
          className={select}
          value={activeOrg}
          onChange={(e) => {
            setOrg(e.target.value);
            setRef("");
          }}
        >
          {orgs.map((o) => (
            <option key={o.slug} value={o.slug}>
              {o.name}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-[11px] font-medium text-muted-foreground">
        <span className="mb-1 flex items-center gap-1.5">
          <Database className="size-3.5" /> Project
        </span>
        <select
          aria-label="Project"
          className={select}
          value={activeRef}
          onChange={(e) => setRef(e.target.value)}
          disabled={!projects.length}
        >
          {projects.length === 0 && <option value="">No projects in this organization</option>}
          {projects.map((p) => (
            <option key={p.ref} value={p.ref}>
              {p.name} · {p.region}
            </option>
          ))}
        </select>
      </label>
      <Button className="w-full" disabled={busy || !activeRef} onClick={() => void link()}>
        {busy ? (
          <Loader2 className="animate-spin" />
        ) : activeRef === connectedRef ? (
          <Check />
        ) : (
          <Plug />
        )}
        {activeRef && activeRef === connectedRef ? "Connected to this project" : "Use this project"}
      </Button>
      <button
        type="button"
        className="mx-auto flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground"
        onClick={async () => {
          await disconnect();
          await load();
        }}
      >
        <LogOut className="size-3" /> Sign out of Supabase
      </button>
    </div>
  );
}
