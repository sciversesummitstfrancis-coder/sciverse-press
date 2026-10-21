import { z } from "zod";

// ---------- Roles & permissions ----------
export const ROLES = [
  "press",
  "eb",
  "chair",
  "coordinator",
  "admin",
  "organizer",
] as const;
export type Role = (typeof ROLES)[number];

export const PERMISSIONS = {
  "article:submit": ["press", "eb", "chair", "coordinator", "admin", "organizer"],
  "article:review": ["coordinator", "admin"],
  "article:publish": ["coordinator", "admin"],
  "committee:update": ["eb", "chair", "admin"],
  "points:award": ["eb", "chair", "admin"],
  "points:reverse": ["admin"],
  "analytics:view": ["coordinator", "admin", "organizer", "eb", "chair"],
  "admin:users": ["admin"],
  "admin:config": ["admin"],
  "admin:export": ["admin", "coordinator"],
  // Admin-only oversight: edit/archive/delete committees, manage rosters,
  // force committee status, and bulk-manage accounts.
  "admin:committees": ["admin"],
  "admin:accounts": ["admin"],
} as const satisfies Record<string, readonly Role[]>;
export type Permission = keyof typeof PERMISSIONS;

export function can(role: Role, perm: Permission): boolean {
  return (PERMISSIONS[perm] as readonly string[]).includes(role);
}

// ---------- Article workflow ----------
export const ARTICLE_STATUSES = [
  "draft",
  "submitted",
  "under_review",
  "revision_requested",
  "approved",
  "published",
  "rejected",
] as const;
export type ArticleStatus = (typeof ARTICLE_STATUSES)[number];

export const ARTICLE_TRANSITIONS: Record<ArticleStatus, ArticleStatus[]> = {
  draft: ["submitted"],
  submitted: ["under_review", "rejected"],
  under_review: ["revision_requested", "approved", "rejected"],
  revision_requested: ["submitted"],
  approved: ["published"],
  published: [],
  rejected: ["submitted"],
};

export const articleSchema = z.object({
  title: z.string().min(5).max(200),
  subtitle: z.string().max(300).optional().default(""),
  body: z.string().min(50).max(100000),
  committeeId: z.string().uuid().nullable().optional(),
  category: z.string().min(2).max(60),
  tags: z.array(z.string().min(1).max(40)).max(12).default([]),
  embargoUntil: z.string().datetime().nullable().optional(),
});
export type ArticleInput = z.infer<typeof articleSchema>;

export const reviewSchema = z.object({
  action: z.enum(["assign", "request_revision", "approve", "reject", "publish"]),
  comment: z.string().max(5000).default(""),
  assigneeId: z.string().uuid().nullable().optional(),
});
export type ReviewInput = z.infer<typeof reviewSchema>;

// ---------- Committees ----------
export const COMMITTEE_STATUSES = [
  "upcoming",
  "in_session",
  "on_break",
  "completed",
  "delayed",
] as const;
export type CommitteeStatus = (typeof COMMITTEE_STATUSES)[number];

export const committeeSchema = z.object({
  name: z.string().min(2).max(120),
  abbreviation: z.string().min(2).max(12),
  venue: z.string().max(120).default(""),
  agenda: z.string().max(2000).default(""),
});
/** Admin edit of an existing committee — every field optional. */
export const committeeUpdateSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  abbreviation: z.string().min(2).max(12).optional(),
  venue: z.string().max(120).optional(),
  agenda: z.string().max(2000).optional(),
  status: z.enum(COMMITTEE_STATUSES).optional(),
  progressPercent: z.number().int().min(0).max(100).optional(),
  currentAgendaItem: z.string().max(300).optional(),
  archived: z.boolean().optional(),
});
export type CommitteeUpdateInput = z.infer<typeof committeeUpdateSchema>;

/** Admin creates an account for someone else. */
export const adminUserCreateSchema = z.object({
  email: z.string().email().max(200),
  name: z.string().min(1).max(120),
  role: z.enum(ROLES),
  password: z.string().min(8).max(200),
});
export type AdminUserCreateInput = z.infer<typeof adminUserCreateSchema>;

/** Admin edits an account (role / name / optional password reset). */
export const adminUserUpdateSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  role: z.enum(ROLES).optional(),
  password: z.string().min(8).max(200).optional(),
});
export type AdminUserUpdateInput = z.infer<typeof adminUserUpdateSchema>;

/** Bulk-create accounts from a pasted list. */
export const adminUserBulkSchema = z.object({
  rows: z.array(
    z.object({
      email: z.string().email().max(200),
      name: z.string().min(1).max(120),
      role: z.enum(ROLES),
      password: z.string().min(8).max(200),
    }),
  ).min(1).max(200),
});
export type AdminUserBulkInput = z.infer<typeof adminUserBulkSchema>;
export const sessionSchema = z.object({
  title: z.string().min(2).max(200),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  venue: z.string().max(120).default(""),
});
export const progressSchema = z.object({
  status: z.enum(COMMITTEE_STATUSES),
  agendaItem: z.string().max(300).default(""),
  progressPercent: z.number().int().min(0).max(100),
  note: z.string().max(2000).default(""),
});

// ---------- Points ----------
export const POINT_CATEGORIES = [
  "substance",
  "diplomacy",
  "procedure",
  "documentation",
  "leadership",
  "conduct",
] as const;
export type PointCategory = (typeof POINT_CATEGORIES)[number];

export const awardSchema = z.object({
  delegateId: z.string().uuid(),
  category: z.enum(POINT_CATEGORIES),
  value: z.number().int().min(-50).max(100),
  reason: z.string().min(5).max(1000),
});
export type AwardInput = z.infer<typeof awardSchema>;

// ---------- Auth ----------
export const loginSchema = z.object({
  email: z.string().email().max(160),
  password: z.string().min(8).max(200),
});
export const registerSchema = loginSchema.extend({
  name: z.string().min(2).max(120),
  role: z.enum(ROLES).default("press"),
});

// ---------- Shared API client (fetch-based, usable in browser/node/RN) ----------
export interface ApiOptions {
  baseUrl: string;
  getToken?: () => string | null | Promise<string | null>;
}

export function createApiClient(opts: ApiOptions) {
  async function headers(extra: Record<string, string> = {}) {
    const t = await opts.getToken?.();
    return {
      "Content-Type": "application/json",
      ...(t ? { Authorization: `Bearer ${t}` } : {}),
      ...extra,
    };
  }
  async function req<T>(path: string, init: RequestInit = {}): Promise<T> {
    const res = await fetch(opts.baseUrl + path, {
      ...init,
      headers: await headers(init.headers as Record<string, string>),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`${res.status} ${res.statusText}: ${body.slice(0, 300)}`);
    }
    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  }
  return {
    get: <T>(p: string) => req<T>(p),
    post: <T>(p: string, b: unknown) =>
      req<T>(p, { method: "POST", body: JSON.stringify(b) }),
    patch: <T>(p: string, b: unknown) =>
      req<T>(p, { method: "PATCH", body: JSON.stringify(b) }),
    del: <T>(p: string) => req<T>(p, { method: "DELETE" }),
  };
}

// ---------- Design tokens (single source of truth, reused by web + mobile) ----------
export const tokens = {
  color: {
    bg: "#07080d",
    bgSoft: "#0d1017",
    ink: "#f4f6fb",
    muted: "#9aa3b2",
    accent: "#22d3ee",
    accent2: "#a78bfa",
    success: "#34d399",
    warning: "#fbbf24",
    danger: "#f87171",
    glassBorder: "rgba(255,255,255,0.14)",
  },
  radius: { sm: 10, md: 16, lg: 24, xl: 32 },
  font: {
    display: '"Space Grotesk", system-ui, sans-serif',
    body: '"Inter", system-ui, sans-serif',
  },
} as const;

// ---------- Types mirrored from DB ----------
export interface UserPublic {
  id: string;
  email: string;
  name: string;
  role: Role;
}
export interface Committee {
  id: string;
  name: string;
  abbreviation: string;
  venue: string;
  agenda: string;
  status: CommitteeStatus;
  progressPercent: number;
  currentAgendaItem: string;
  updatedAt: string;
}
export interface DelegateRow {
  id: string;
  name: string;
  publicId: string;
  committeeId: string;
  committeeName?: string;
  country: string;
  totalPoints: number;
  rankInCommittee: number;
  overallRank?: number;
}
export interface ArticleListItem {
  id: string;
  title: string;
  status: ArticleStatus;
  category: string;
  committeeName: string | null;
  authorName: string;
  wordCount: number;
  updatedAt: string;
  version: number;
}
