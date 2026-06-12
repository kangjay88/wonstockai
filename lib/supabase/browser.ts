import { createBrowserClient } from "@supabase/ssr";

import type { Database } from "./types";

/**
 * Supabase client for use in Client Components. Safe to call repeatedly;
 * `createBrowserClient` memoizes a single instance per browser context.
 */
export function createSupabaseBrowserClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
