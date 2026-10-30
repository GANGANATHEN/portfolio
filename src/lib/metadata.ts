/**
 * Unified Visitor & Telemetry Metadata Parser
 * Collects safe, non-invasive HTTP header and device telemetry for admin moderation only.
 * Complies with strict privacy standards (no canvas fingerprinting, no secret GPS, no fabricated data).
 */

export interface VisitorMetadata {
  ip: string;
  userAgent: string;
  deviceType: "desktop" | "tablet" | "mobile";
  osFamily: string;
  osVersion?: string;
  browserFamily: string;
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
  locationSource: "ip_derived_approximate" | "unavailable";
  locationUnavailableReason?: string;
  collectedAt: string;
  firstVisitAt?: string;
  lastActivityAt?: string;
}

export interface ClientTelemetryPayload {
  screenResolution?: string;
  viewportDimensions?: string;
  deviceLanguage?: string;
  timezone?: string;
}

interface RequestHeadersSource {
  headers: {
    get(name: string): string | null;
  };
}

/**
 * Parses user agent string into structured browser, engine, and OS properties.
 */
export function parseUserAgent(ua: string) {
  const cleanUa = ua || "";
  const lower = cleanUa.toLowerCase();

  // 1. Device Category
  let deviceType: "desktop" | "tablet" | "mobile" = "desktop";
  if (/(ipad|tablet|(android(?!.*mobile))|(windows(?!.*phone)(.*touch))|kindle|playbook|silk)/i.test(lower)) {
    deviceType = "tablet";
  } else if (/(mobi|ipod|iphone|android.*mobile|blackberry|phone|iemobile|opera mini)/i.test(lower)) {
    deviceType = "mobile";
  }

  // 2. Browser Family & Version
  let browserFamily = "Other";
  let browserVersion: string | undefined;
  let browserEngine: string | undefined = "Unknown";

  const edgeMatch = cleanUa.match(/Edg(?:e|A|iOS)?\/([0-9.]+)/i);
  const operaMatch = cleanUa.match(/(?:OPR|Opera)\/([0-9.]+)/i);
  const chromeMatch = cleanUa.match(/(?:Chrome|CriOS)\/([0-9.]+)/i);
  const firefoxMatch = cleanUa.match(/(?:Firefox|FxiOS)\/([0-9.]+)/i);
  const safariMatch = cleanUa.match(/Version\/([0-9.]+).*Safari/i);

  if (edgeMatch) {
    browserFamily = "Edge";
    browserVersion = edgeMatch[1];
    browserEngine = "Blink";
  } else if (operaMatch) {
    browserFamily = "Opera";
    browserVersion = operaMatch[1];
    browserEngine = "Blink";
  } else if (chromeMatch) {
    browserFamily = "Chrome";
    browserVersion = chromeMatch[1];
    browserEngine = "Blink";
  } else if (firefoxMatch) {
    browserFamily = "Firefox";
    browserVersion = firefoxMatch[1];
    browserEngine = "Gecko";
  } else if (safariMatch) {
    browserFamily = "Safari";
    browserVersion = safariMatch[1];
    browserEngine = "WebKit";
  } else if (/trident|msie/i.test(cleanUa)) {
    browserFamily = "Internet Explorer";
    browserEngine = "Trident";
  }

  // 3. Operating System Family & Version
  let osFamily = "Unknown";
  let osVersion: string | undefined;

  const iosMatch = cleanUa.match(/(?:iPhone|iPad|iPod).*?OS\s+([0-9_]+)/i);
  const macMatch = cleanUa.match(/Mac\s+OS\s+X\s+([0-9_]+)/i);
  const winMatch = cleanUa.match(/Windows\s+NT\s+([0-9.]+)/i);
  const androidMatch = cleanUa.match(/Android\s+([0-9.]+)/i);

  if (iosMatch) {
    osFamily = "iOS";
    osVersion = iosMatch[1].replace(/_/g, ".");
  } else if (macMatch) {
    osFamily = "macOS";
    osVersion = macMatch[1].replace(/_/g, ".");
  } else if (winMatch) {
    osFamily = "Windows";
    const ver = winMatch[1];
    if (ver === "10.0") osVersion = "10/11";
    else if (ver === "6.3") osVersion = "8.1";
    else if (ver === "6.2") osVersion = "8";
    else if (ver === "6.1") osVersion = "7";
    else osVersion = ver;
  } else if (androidMatch) {
    osFamily = "Android";
    osVersion = androidMatch[1];
  } else if (/cros/i.test(cleanUa)) {
    osFamily = "Chrome OS";
  } else if (/linux/i.test(cleanUa)) {
    osFamily = "Linux";
  }

  return {
    deviceType,
    browserFamily,
    browserVersion,
    browserEngine,
    osFamily,
    osVersion,
  };
}

/**
 * Extracts unified visitor metadata from incoming server headers and optional client telemetry.
 */
export function extractVisitorMetadata(
  req: RequestHeadersSource,
  clientPayload?: ClientTelemetryPayload,
  existingFirstVisit?: string,
): VisitorMetadata {
  const now = new Date().toISOString();
  const userAgent = req.headers.get("user-agent") || "";
  const forwardedFor = req.headers.get("x-forwarded-for");
  const realIp = req.headers.get("x-real-ip");
  const cfIp = req.headers.get("cf-connecting-ip");

  // Determine IP safely
  let ip = "127.0.0.1";
  if (forwardedFor) {
    const parts = forwardedFor.split(",").map((s) => s.trim());
    if (parts.length > 0 && parts[0]) {
      ip = parts[0];
    }
  } else if (realIp) {
    ip = realIp.trim();
  } else if (cfIp) {
    ip = cfIp.trim();
  }

  if (ip === "::1" || ip === "0.0.0.0") {
    ip = "127.0.0.1";
  }

  const uaParsed = parseUserAgent(userAgent);

  // Vercel Edge / Cloud Geolocation Headers
  const vercelCountry = req.headers.get("x-vercel-ip-country");
  const vercelRegion = req.headers.get("x-vercel-ip-country-region");
  const vercelCity = req.headers.get("x-vercel-ip-city");
  const vercelLat = req.headers.get("x-vercel-ip-latitude");
  const vercelLon = req.headers.get("x-vercel-ip-longitude");
  const vercelTz = req.headers.get("x-vercel-ip-timezone");

  let city: string | undefined;
  if (vercelCity) {
    try {
      city = decodeURIComponent(vercelCity);
    } catch {
      city = vercelCity;
    }
  }

  const country = vercelCountry || undefined;
  const region = vercelRegion || undefined;
  const approxLatitude = vercelLat ? parseFloat(vercelLat) : null;
  const approxLongitude = vercelLon ? parseFloat(vercelLon) : null;

  const hasGeo = Boolean(country || city || region || approxLatitude !== null);
  const locationSource: "ip_derived_approximate" | "unavailable" = hasGeo
    ? "ip_derived_approximate"
    : "unavailable";

  const locationUnavailableReason = !hasGeo
    ? ip === "127.0.0.1"
      ? "Local loopback development connection (no geolocation headers available)"
      : "Host environment did not supply edge IP-geolocation headers"
    : undefined;

  // Timezone resolution: prefer host-verified edge timezone, fallback to client timezone
  const timezone = vercelTz || clientPayload?.timezone || undefined;

  return {
    ip,
    userAgent: userAgent.slice(0, 500),
    deviceType: uaParsed.deviceType,
    osFamily: uaParsed.osFamily,
    osVersion: uaParsed.osVersion,
    browserFamily: uaParsed.browserFamily,
    browserVersion: uaParsed.browserVersion,
    browserEngine: uaParsed.browserEngine,
    screenResolution: clientPayload?.screenResolution || undefined,
    viewportDimensions: clientPayload?.viewportDimensions || undefined,
    deviceLanguage: clientPayload?.deviceLanguage || req.headers.get("accept-language")?.split(",")[0]?.trim() || undefined,
    timezone,
    country,
    region,
    city,
    approxLatitude,
    approxLongitude,
    locationSource,
    locationUnavailableReason,
    collectedAt: now,
    firstVisitAt: existingFirstVisit || now,
    lastActivityAt: now,
  };
}
