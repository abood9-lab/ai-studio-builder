import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface SupabaseOrg {
  slug: string;
  name: string;
}
export interface SupabaseProject {
  ref: string;
  name: string;
  organization_slug: string;
  region: string;
  status: string;
}
export interface SupabaseAccount {
  configured: boolean;
  connected: boolean;
  redirectUri: string;
  organizations: SupabaseOrg[];
  projects: SupabaseProject[];
}

function redirectUri() {
  const request = getRequest();
  const url = new URL(request.url);
  const host = url.hostname === "localhost" ? request.headers.get("x-forwarded-host") : null;
  return new URL(
    "/api/public/supabase-oauth/return",
    host ? `https://${host}` : url.origin,
  ).toString();
}

export const getSupabaseAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SupabaseAccount> => {
    const s = await import("@/lib/supabase-oauth.server");
    const base = {
      configured: s.oauthConfigured(),
      redirectUri: redirectUri(),
      organizations: [],
      projects: [],
    };
    if (!base.configured) return { ...base, connected: false };
    const organizations = await s.management<SupabaseOrg[]>(context.userId, "/v1/organizations");
    if (!organizations) return { ...base, connected: false };
    const projects = (await s.management<SupabaseProject[]>(context.userId, "/v1/projects")) ?? [];
    return {
      ...base,
      connected: true,
      organizations: organizations.map(({ slug, name }) => ({ slug, name })),
      projects: projects.map(({ ref, name, organization_slug, region, status }) => ({
        ref,
        name,
        organization_slug,
        region,
        status,
      })),
    };
  });

export const startSupabaseOAuth = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ projectId: z.string().min(1).max(150) }))
  .handler(async ({ data, context }) => {
    const { data: project } = await context.supabase
      .from("projects")
      .select("id")
      .eq("id", data.projectId)
      .eq("owner_id", context.userId)
      .maybeSingle();
    if (!project) throw new Error("Project not found");
    const { startOAuth } = await import("@/lib/supabase-oauth.server");
    return { authorizationUrl: await startOAuth(context.userId, project.id, redirectUri()) };
  });

export const completeSupabaseOAuth = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({ code: z.string().min(1).max(2000), state: z.string().min(1).max(200) }),
  )
  .handler(async ({ data, context }) => {
    const { completeOAuth } = await import("@/lib/supabase-oauth.server");
    await completeOAuth(context.userId, data.code, data.state);
    return { ok: true };
  });

export const disconnectSupabaseAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { disconnectOAuth } = await import("@/lib/supabase-oauth.server");
    await disconnectOAuth(context.userId);
    return { ok: true };
  });
