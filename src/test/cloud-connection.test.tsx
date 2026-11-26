import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const account = {
  configured: true,
  connected: true,
  redirectUri: "",
  organizations: [
    { slug: "org-a", name: "Org A" },
    { slug: "org-b", name: "Org B" },
  ],
  projects: [
    {
      ref: "aaaaaaaaaaaaaaaaaaaa",
      name: "Alpha",
      organization_slug: "org-a",
      region: "eu",
      status: "ACTIVE_HEALTHY",
    },
    {
      ref: "bbbbbbbbbbbbbbbbbbbb",
      name: "Beta",
      organization_slug: "org-b",
      region: "us",
      status: "ACTIVE_HEALTHY",
    },
  ],
};
vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }));
vi.mock("@/lib/supabase-oauth.functions", () => ({
  getSupabaseAccount: vi.fn(async () => account),
  startSupabaseOAuth: vi.fn(),
  completeSupabaseOAuth: vi.fn(),
  disconnectSupabaseAccount: vi.fn(),
}));

import { SupabaseConnect } from "@/components/SupabaseConnect";

describe("Connect Supabase by choosing an organization", () => {
  it("links the project picked in the chosen organization", async () => {
    const onLink = vi.fn().mockResolvedValue(null);
    render(<SupabaseConnect ensureProject={async () => "p1"} connectedRef="" onLink={onLink} />);
    fireEvent.change(await screen.findByLabelText("Organization"), { target: { value: "org-b" } });
    expect(screen.queryByRole("option", { name: /Alpha/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Use this project" }));
    await waitFor(() => expect(onLink).toHaveBeenCalledWith("bbbbbbbbbbbbbbbbbbbb"));
  });
});
