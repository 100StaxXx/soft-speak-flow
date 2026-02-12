/**
 * CORS Configuration for Edge Functions
 * 
 * This module provides secure CORS handling for Supabase Edge Functions.
 * 
 * SECURITY NOTES:
 * - Never use "*" for Access-Control-Allow-Origin in production
 * - Always validate the Origin header against an allowlist
 * - Use environment variables for domain configuration
 * 
 * Usage:
 *   import { corsHeaders, handleCors, validateOrigin } from '../_shared/cors.ts';
 *   
 *   // In your function:
 *   if (req.method === "OPTIONS") {
 *     return handleCors(req);
 *   }
 *   
 *   // For responses:
 *   return new Response(JSON.stringify(data), {
 *     headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
 *   });
 */

// Allowed origins - loaded from environment or defaults
// In production, set ALLOWED_ORIGINS env var to comma-separated list
const getAllowedOrigins = (): string[] => {
  const envOrigins = Deno.env.get("ALLOWED_ORIGINS");
  
  if (envOrigins) {
    return envOrigins.split(",").map(o => o.trim());
  }
  
  // Default allowed origins
  // Add your production domains here
  return [
    // Production domains
    "https://cosmiq.app",
    "https://www.cosmiq.app",
    "https://app.cosmiq.app",
    "https://cosmiq.quest",
    "https://www.cosmiq.quest",
    "https://app.cosmiq.quest", // Native app redirect base
    // Capacitor apps (iOS/Android)
    "capacitor://localhost",
    "http://localhost",
    // Development
    "http://localhost:5173",
    "http://localhost:3000",
    "http://127.0.0.1:5173",
  ];
};

/**
 * Check if an origin is allowed
 */
export function isOriginAllowed(origin: string | null): boolean {
  if (!origin) return false;
  
  const allowedOrigins = getAllowedOrigins();
  
  // Check exact match
  if (allowedOrigins.includes(origin)) {
    return true;
  }
  
  // Check for localhost variations (development only)
  const isLocalhost = origin.includes('localhost') || origin.includes('127.0.0.1');
  const isDevelopment = Deno.env.get("ENVIRONMENT") !== "production";
  
  if (isLocalhost && isDevelopment) {
    return true;
  }
  
  return false;
}

/**
 * Get CORS headers for a specific request
 * Returns origin-specific headers if origin is valid, otherwise restrictive headers
 */
export function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin");
  
  // If origin is allowed, reflect it back
  if (origin && isOriginAllowed(origin)) {
    return {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Max-Age": "86400", // Cache preflight for 24 hours
    };
  }
  
  // For requests without origin (like server-to-server), allow with no origin
  // This is needed for Apple webhooks which don't send Origin header
  if (!origin) {
    return {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    };
  }
  
  // Origin not allowed - return restrictive headers
  return {
    "Access-Control-Allow-Origin": "null",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };
}

/**
 * Handle CORS preflight (OPTIONS) requests
 */
export function handleCors(req: Request): Response {
  return new Response("ok", { 
    headers: getCorsHeaders(req),
    status: 200,
  });
}

// NOTE: Legacy corsHeaders export has been removed for security.
// All edge functions should use getCorsHeaders(req) for proper origin validation.
// See getCorsHeaders() function above for the secure implementation.

/**
 * Create a JSON response with proper CORS headers
 */
export function jsonResponse(
  req: Request,
  data: unknown,
  status: number = 200
): Response {
  return new Response(JSON.stringify(data), {
    headers: { 
      ...getCorsHeaders(req), 
      "Content-Type": "application/json" 
    },
    status,
  });
}

/**
 * Create an error response with proper CORS headers
 */
export function errorResponse(
  req: Request,
  message: string,
  status: number = 500
): Response {
  return new Response(JSON.stringify({ error: message }), {
    headers: { 
      ...getCorsHeaders(req), 
      "Content-Type": "application/json" 
    },
    status,
  });
}
