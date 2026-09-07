import type { NextConfig } from "next";

// Baseline hardening headers. No CSP here: this app renders no user-supplied
// HTML and loads no third-party scripts, so the main CSP benefit (blocking
// injected inline scripts) isn't worth the risk of blind-authoring a policy
// that can't be verified against a running app yet (no live DB to log in).
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  images: {
    // Settings.logoUrl (printed invoices) and OCR bill images both live on
    // Vercel Blob under this pattern — see lib/services/ocr.ts's
    // isTrustedBlobUrl for the same domain suffix used as a security check.
    remotePatterns: [{ protocol: "https", hostname: "*.public.blob.vercel-storage.com" }],
  },
};

export default nextConfig;
