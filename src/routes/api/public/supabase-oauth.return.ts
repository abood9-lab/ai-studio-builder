import { createFileRoute } from "@tanstack/react-router";

// Public landing page for the Supabase sign-in popup: it only hands the one-time code
// back to the window that opened it; the signed-in app exchanges it on the server.
export const Route = createFileRoute("/api/public/supabase-oauth/return")({
  server: {
    handlers: {
      GET: ({ request }) => {
        const url = new URL(request.url);
        const code = url.searchParams.get("code")?.slice(0, 2000) ?? "";
        const state = url.searchParams.get("state")?.slice(0, 200) ?? "";
        const error = url.searchParams.get("error") ? "Supabase sign-in was cancelled" : "";
        const payload = JSON.stringify({ type: "supabaseOAuth", code, state, error }).replace(
          /</g,
          "\\u003c",
        );
        const html = `<!doctype html><html><head><title>Connecting Supabase…</title></head><body style="font-family:system-ui;background:#111;color:#eee;display:grid;place-items:center;height:100vh">Connecting Supabase…<script>var m=${payload};if(window.opener){window.opener.postMessage(m,location.origin)}window.close();</script></body></html>`;
        return new Response(html, {
          headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
        });
      },
    },
  },
});
