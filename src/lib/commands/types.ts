import type { VisitorMetadata } from "../metadata";

export type CommandMetadata = Partial<VisitorMetadata> & {
  ip?: string;
  userAgent?: string;
  deviceType?: "desktop" | "tablet" | "mobile";
  osFamily?: string;
  osVersion?: string;
  browserFamily?: string;
  browserVersion?: string;
  browserEngine?: string;
  screenResolution?: string;
  viewportDimensions?: string;
  deviceLanguage?: string;
  timezone?: string;
  country?: string;
  region?: string;
  city?: string;
  approxLatitude?: number | null;
  approxLongitude?: number | null;
  locationSource?: "ip_derived_approximate" | "unavailable";
  locationUnavailableReason?: string;
  submittedAt?: string;
};

export interface CommandRecord {
  id: string;
  title?: string;
  command: string;
  description?: string;
  category?: string;
  author_name: string;
  is_hidden: boolean;
  is_deleted: boolean;
  created_at: string;
  updated_at?: string;
  metadata?: CommandMetadata;
}

export interface PublicCommand {
  id: string;
  title?: string;
  command: string;
  description?: string;
  category?: string;
  author_name: string;
  created_at: string;
}

export interface AdminCommand extends CommandRecord {
  metadata?: CommandMetadata;
}

export interface CommandStats {
  total: number;
  visible: number;
  hidden: number;
  deleted: number;
}
