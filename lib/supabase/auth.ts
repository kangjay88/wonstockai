import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";

import { createSupabaseServerClient } from "./server";

/**
 * Returns the authenticated user, or redirects to /login if there is none.
 * Use in Server Components / Route Handlers as defense in depth alongside the
 * proxy gate — every server entry point that touches user data calls this.
 */
export async function requireUser(): Promise<User> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return user;
}
