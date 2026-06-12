import Link from "next/link";

import { requireUser } from "@/lib/supabase/auth";
import { signOut } from "@/app/(auth)/login/actions";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center justify-between border-b border-gray-200 px-6 py-3">
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/dashboard" className="font-semibold">
            Resume Tailor
          </Link>
          <Link href="/dashboard" className="text-gray-500 hover:text-gray-900">
            Applications
          </Link>
        </nav>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-gray-500">{user.email}</span>
          <form action={signOut}>
            <button
              type="submit"
              className="rounded-md border border-gray-300 px-2 py-1 text-gray-700 hover:bg-gray-50"
            >
              Sign out
            </button>
          </form>
        </div>
      </header>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
