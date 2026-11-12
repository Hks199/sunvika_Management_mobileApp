export type ApiEnvelope<T> = {
  success: boolean;
  message: string;
  data: T;
  errors?: Array<{ message?: string; path?: string } | string>;
  meta?: unknown;
};

export type User = {
  _id?: string;
  id?: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  email?: string;
  role?: { name?: string; code?: string } | string;
  permissions?: string[];
};

export type RecordValue = Record<string, unknown>;

export type ModuleKey =
  | "announcements"
  | "queries"
  | "leads"
  | "visits"
  | "customers"
  | "quotations"
  | "amc"
  | "calling-reports"
  | "calling-lists"
  | "channel-partners"
  | "employees"
  | "geography"
  | "reports"
  | "roles"
  | "audit"
  | "sessions";

export type ScreenKey = "overview" | ModuleKey;
