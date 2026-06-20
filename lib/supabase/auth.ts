import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";

import { createSupabaseServerClient } from "./server";

/**
 * Returns the authenticated user or null. Use in API route handlers, which must
 * return a 401 JSON response rather than redirect.
 */
export async function getOptionalUser(): Promise<User | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/**
 * Returns the authenticated user, or redirects to /login if there is none.
 * Use in Server Components / Server Actions as defense in depth alongside the
 * proxy gate — every server entry point that touches user data calls this.
 */
export async function requireUser(): Promise<User> {
  const user = await getOptionalUser();
  if (!user) {
    redirect("/login");
  }
  return user;
}
