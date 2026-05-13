// Legacy compatibility shim - auth() now delegates to getSession()
// All API routes should import getSession directly from @/lib/session
import { getSession } from "@/lib/session";

export async function auth() {
  return getSession();
}

// Stub handlers for the old NextAuth route (no longer functional)
export const handlers = {
  GET: async () => new Response("Not found", { status: 404 }),
  POST: async () => new Response("Not found", { status: 404 }),
};
