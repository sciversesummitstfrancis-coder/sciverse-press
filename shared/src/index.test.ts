import { describe, it, expect } from "vitest";
import { can, ARTICLE_TRANSITIONS, articleSchema } from "../src/index.js";

describe("rbac matrix", () => {
  it("press cannot review; coordinator can; server hides nothing client-side", () => {
    expect(can("press", "article:review")).toBe(false);
    expect(can("coordinator", "article:review")).toBe(true);
    expect(can("eb", "points:award")).toBe(true);
    expect(can("press", "points:award")).toBe(false);
    expect(can("admin", "admin:users")).toBe(true);
  });
});

describe("article transitions", () => {
  it("published is terminal; draft only submits", () => {
    expect(ARTICLE_TRANSITIONS.published).toEqual([]);
    expect(ARTICLE_TRANSITIONS.draft).toEqual(["submitted"]);
  });
  it("rejects short bodies", () => {
    const r = articleSchema.safeParse({ title: "Valid Title Here", body: "short", category: "News" });
    expect(r.success).toBe(false);
  });
});
