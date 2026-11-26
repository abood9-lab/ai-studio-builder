import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { decryptProjectSecret, encryptProjectSecret } from "@/lib/project-secrets.server";

const API = "https://api.supabase.com";
const b64url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
const random = () => b64url(crypto.getRandomValues(new Uint8Array(32)));
const sha = async (text: string) =>
  b64url(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text))));

function credentials() {
  const id = process.env["SBOAUTH_CLIENT_ID"];
  const secret = process.env["SBOAUTH_CLIENT_SECRET"];
  if (!id || !secret) throw new Error("Supabase sign-in is not set up yet");
  return { id, secret };
}
export const oauthConfigured = () =>
  Boolean(process.env["SBOAUTH_CLIENT_ID"] && process.env["SBOAUTH_CLIENT_SECRET"]);

export async function startOAuth(userId: string, projectId: string, redirectUri: string) {
  const { id } = credentials();
  const state = random();
  const verifier = random();
  await supabaseAdmin
    .from("supabase_oauth_states")
    .delete()
    .lt("expires_at", new Date().toISOString());
  const { error } = await supabaseAdmin.from("supabase_oauth_states").insert({
    state_hash: await sha(state),
    user_id: userId,
    project_id: projectId,
    code_verifier_ciphertext: await encryptProjectSecret(verifier, `oauth:${userId}`),
    redirect_uri: redirectUri,
    expires_at: new Date(Date.now() + 10 * 60000).toISOString(),
  });
  if (error) throw new Error("Could not start the Supabase sign-in");
  const url = new URL(`${API}/v1/oauth/authorize`);
  url.search = new URLSearchParams({
    client_id: id,
    redirect_uri: redirectUri,
    response_type: "code",
    state,
    code_challenge: await sha(verifier),
    code_challenge_method: "S256",
  }).toString();
  return url.toString();
}

type Tokens = { access_token: string; refresh_token: string; expires_in: number };
async function tokenRequest(body: Record<string, string>): Promise<Tokens> {
  const { id, secret } = credentials();
  const res = await fetch(`${API}/v1/oauth/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
      Authorization: `Basic ${btoa(`${id}:${secret}`)}`,
    },
    body: new URLSearchParams(body),
  });
  if (!res.ok) {
    console.error("Supabase token error", res.status, await res.text());
    throw new Error("Supabase did not accept the sign-in. Try again.");
  }
  return (await res.json()) as Tokens;
}

async function saveTokens(userId: string, t: Tokens) {
  const scope = `oauth:${userId}`;
  const { error } = await supabaseAdmin.from("supabase_oauth_connections").upsert({
    user_id: userId,
    access_token_ciphertext: await encryptProjectSecret(t.access_token, scope),
    refresh_token_ciphertext: await encryptProjectSecret(t.refresh_token, scope),
    expires_at: new Date(Date.now() + (t.expires_in - 60) * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error("Could not save the Supabase connection");
}

export async function completeOAuth(userId: string, code: string, state: string) {
  const hash = await sha(state);
  const { data: row } = await supabaseAdmin
    .from("supabase_oauth_states")
    .select("*")
    .eq("state_hash", hash)
    .eq("user_id", userId)
    .maybeSingle();
  await supabaseAdmin.from("supabase_oauth_states").delete().eq("state_hash", hash);
  if (!row || new Date(row.expires_at) < new Date())
    throw new Error("This sign-in expired. Press Connect Supabase again.");
  const verifier = await decryptProjectSecret(row.code_verifier_ciphertext, `oauth:${userId}`);
  await saveTokens(
    userId,
    await tokenRequest({
      grant_type: "authorization_code",
      code,
      redirect_uri: row.redirect_uri,
      code_verifier: verifier,
    }),
  );
}

async function accessToken(userId: string) {
  const { data } = await supabaseAdmin
    .from("supabase_oauth_connections")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) return null;
  const scope = `oauth:${userId}`;
  if (new Date(data.expires_at) > new Date())
    return decryptProjectSecret(data.access_token_ciphertext, scope);
  try {
    const t = await tokenRequest({
      grant_type: "refresh_token",
      refresh_token: await decryptProjectSecret(data.refresh_token_ciphertext, scope),
    });
    await saveTokens(userId, t);
    return t.access_token;
  } catch {
    await disconnectOAuth(userId);
    return null;
  }
}

export async function management<T>(userId: string, path: string): Promise<T | null> {
  const token = await accessToken(userId);
  if (!token) return null;
  const res = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  if (res.status === 401) {
    await disconnectOAuth(userId);
    return null;
  }
  if (!res.ok) throw new Error(`Supabase request failed (${res.status})`);
  return (await res.json()) as T;
}

export async function disconnectOAuth(userId: string) {
  await supabaseAdmin.from("supabase_oauth_connections").delete().eq("user_id", userId);
}
