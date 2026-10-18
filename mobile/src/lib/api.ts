import Constants from 'expo-constants';

import { t } from './i18n';

// EXPO_PUBLIC_API_URL wins; otherwise reuse the dev machine's LAN IP that Expo Go connected to.
function resolveBaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, '');
  const hostUri = Constants.expoConfig?.hostUri; // e.g. "192.168.1.20:8081"
  const host = hostUri ? hostUri.split(':')[0] : 'localhost';
  return `http://${host}:8000`;
}

export const API_URL = resolveBaseUrl();

export type ErrorDetail = {
  code: string;
  message: string;
  fields?: { field: string; message: string }[];
  allowed?: string[];
};

export class ApiError extends Error {
  constructor(public status: number, public detail: ErrorDetail) {
    super(detail.message);
  }
}

// Called when a request sent with a token gets 401, e.g. after the free API host wiped its database and the
// account no longer exists. AuthProvider registers it to sign the user out.
let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(handler: (() => void) | null) {
  onUnauthorized = handler;
}

export async function api<T>(
  path: string,
  opts: { method?: string; body?: unknown; token?: string | null } = {},
): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;

  let res: Response;
  try {
    res = await fetch(API_URL + path, {
      method: opts.method ?? 'GET',
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
  } catch {
    throw new ApiError(0, { code: 'network', message: t.networkError });
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    if (res.status === 401 && opts.token) onUnauthorized?.();
    const detail = data?.detail;
    if (detail && typeof detail === 'object' && 'code' in detail) throw new ApiError(res.status, detail);
    throw new ApiError(res.status, { code: 'http_' + res.status, message: t.genericError });
  }
  return data as T;
}

export function errorText(e: unknown): string {
  if (e instanceof ApiError) {
    const fields = e.detail.fields?.map((f) => f.message).filter(Boolean) ?? [];
    return fields.length ? `${e.detail.message} ${fields.join(' ')}` : e.detail.message;
  }
  return t.genericError;
}

// ---- Types returned by the backend ----

export type User = { id: number; email: string; role: 'reporter' | 'reviewer' };

export type PublicReport = {
  public_id: string;
  category: string;
  status: string;
  lat: number;
  lon: number;
  observed_date: string;
  updated_date: string;
  source_type: string;
  is_simulated: boolean;
  verification: string;
};

export type OwnReport = {
  public_id: string;
  category: string;
  description: string;
  lat: number;
  lon: number;
  location_source: 'pin' | 'gps';
  observed_at: string;
  created_at: string;
  updated_at: string;
  status: string;
  is_simulated: boolean;
  verification: string;
  public_visibility: 'public' | 'held';
  rejection_reason: string | null;
};

export type ReviewReport = OwnReport & {
  gps_accuracy_m: number | null;
  allowed_next: string[];
  source_type: string;
  reporter_ref: string;
  assistant: AssistantSummary | null;
};

export type AuditEntry = {
  id: number;
  report_id: string;
  reviewer_email: string;
  action: string;
  from_status: string | null;
  to_status: string | null;
  reason: string | null;
  related_report_id: string | null;
  notes: string | null;
  created_at: string;
};

// ---- Review assistant (suggestions only; reviewers decide) ----

export type ImportanceLevel = 'high' | 'medium' | 'low';
export type DuplicateLevel = 'probable' | 'possible';

export type AssistantSummary = {
  importance_score: number;
  importance_level: ImportanceLevel;
  flags: string[];
  duplicate_level: DuplicateLevel | null;
  checked_at: string;
};

export type Evidence = { text: string; start: number; end: number; kind?: string };
export type AssistantFlag = { code: string; label: string; evidence: Evidence[]; detail: string | null };
export type Factor = { code: string; points: number; detail: unknown };
export type Importance = { score: number; level: ImportanceLevel; factors: Factor[] };

export type DuplicateCandidate = {
  public_id: string;
  score: number;
  level: DuplicateLevel;
  distance_m: number;
  text_similarity: number;
  same_category: boolean;
  reasons: string[];
  decision: string | null;
  report: {
    public_id: string;
    category: string;
    description: string;
    status: string;
    observed_at: string;
    created_at: string;
    is_simulated: boolean;
  };
};

export type AssistantRun = {
  id: number;
  triggered_by: string;
  assistant_version: string;
  created_at: string;
  importance: Importance;
  flags: AssistantFlag[];
  duplicates: DuplicateCandidate[];
  confirmed_links: { public_id: string; role: 'original' | 'duplicate' }[];
};

export type AssistantAnalysis = { latest: AssistantRun | null; checks: number; current_version: string };

export type ReviewerDecision = {
  kind: string;
  to_status?: string | null;
  reason?: string | null;
  related_report_id?: string | null;
  created_at?: string;
};

export type HistoryRow = {
  id: number;
  report_id: string;
  created_at: string;
  triggered_by: string;
  assistant_version: string;
  importance: Importance;
  flags: { code: string; label: string }[];
  duplicates: { public_id: string; level: DuplicateLevel; score: number }[];
  decision: ReviewerDecision;
};
