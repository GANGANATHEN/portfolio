import type { CommandMetadata } from "./types";
import { extractVisitorMetadata, type ClientTelemetryPayload } from "../metadata";

interface RequestWithHeaders {
  headers: {
    get(name: string): string | null;
  };
}

/**
 * Safely parses client metadata from request headers and optional client telemetry.
 * Non-invasive, transparently capturing location, device, and network telemetry for admin moderation only.
 */
export function parseClientMetadata(
  req: RequestWithHeaders,
  clientPayload?: ClientTelemetryPayload,
): CommandMetadata {
  const meta = extractVisitorMetadata(req, clientPayload);
  return {
    ...meta,
    submittedAt: meta.collectedAt,
  };
}
