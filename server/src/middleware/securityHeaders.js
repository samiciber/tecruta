import helmet from 'helmet'

// Express serves JSON, not the SPA. The document policy lives in vercel.json.
export function apiSecurityHeaders() {
  return helmet({
    xFrameOptions: { action: 'deny' },
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        defaultSrc: ["'none'"],
        baseUri: ["'none'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
        formAction: ["'none'"],
      },
    },
    // Public catalog responses must remain consumable from the separate SPA.
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    strictTransportSecurity: process.env.NODE_ENV === 'production'
      ? { maxAge: 31536000, includeSubDomains: false }
      : false,
  })
}
