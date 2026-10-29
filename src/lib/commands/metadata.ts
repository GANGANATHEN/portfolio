import type { CommandMetadata } from "./types";

interface RequestWithHeaders {
  headers: {
    get(name: string): string | null;
  };
}

/**
 * Safely parses client metadata from request headers without invasive fingerprinting.
 * Collects only standard HTTP request information needed for moderation.
 */
export function parseClientMetadata(req: RequestWithHeaders): CommandMetadata {
  const userAgent = req.headers.get("user-agent") || "";
  const forwardedFor = req.headers.get("x-forwarded-for");
  const realIp = req.headers.get("x-real-ip");

  // Determine IP safely (first non-internal IP or first address in forwarded-for chain)
  let ip = "127.0.0.1";
  if (forwardedFor) {
    const parts = forwardedFor.split(",").map((s) => s.trim());
    if (parts.length > 0 && parts[0]) {
      ip = parts[0];
    }
  } else if (realIp) {
    ip = realIp.trim();
  }

  // Anonymize/normalize localhost or simple IP
  if (ip === "::1" || ip === "0.0.0.0") {
    ip = "127.0.0.1";
  }

  // Safe device category deduction
  let deviceType: "desktop" | "tablet" | "mobile" = "desktop";
  const ua = userAgent.toLowerCase();
  if (/(ipad|tablet|(android(?!.*mobile))|(windows(?!.*phone)(.*touch))|kindle|playbook|silk)/i.test(ua)) {
    deviceType = "tablet";
  } else if (/(mobi|ipod|iphone|android.*mobile|blackberry|phone|iemobile|opera mini)/i.test(ua)) {
    deviceType = "mobile";
  }

  // Safe OS family deduction
  let osFamily = "Unknown";
  if (/iphone|ipad|ipod/i.test(userAgent)) {
    osFamily = "iOS";
  } else if (/macintosh|mac os x/i.test(userAgent)) {
    osFamily = "macOS";
  } else if (/windows nt/i.test(userAgent)) {
    osFamily = "Windows";
  } else if (/android/i.test(userAgent)) {
    osFamily = "Android";
  } else if (/linux/i.test(userAgent)) {
    osFamily = "Linux";
  } else if (/cros/i.test(userAgent)) {
    osFamily = "Chrome OS";
  }

  // Safe browser family deduction
  let browserFamily = "Other";
  if (/edg\//i.test(userAgent)) {
    browserFamily = "Edge";
  } else if (/opr\/|opera/i.test(userAgent)) {
    browserFamily = "Opera";
  } else if (/chrome|crios/i.test(userAgent) && !/edg/i.test(userAgent)) {
    browserFamily = "Chrome";
  } else if (/firefox|fxios/i.test(userAgent)) {
    browserFamily = "Firefox";
  } else if (/safari/i.test(userAgent) && !/chrome|crios|android/i.test(userAgent)) {
    browserFamily = "Safari";
  }

  return {
    ip,
    userAgent: userAgent.slice(0, 500),
    deviceType,
    osFamily,
    browserFamily,
    submittedAt: new Date().toISOString(),
  };
}
