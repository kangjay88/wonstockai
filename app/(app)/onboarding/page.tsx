import { requireUser } from "@/lib/supabase/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { OnboardingFlow } from "./onboarding-flow";

export default async function OnboardingPage() {
  const user = await requireUser();
  const supabase = await createSupabaseServerClient();

  const { data: memory } = await supabase
    .from("career_memory")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold">Career memory</h1>
        <p className="text-sm text-gray-500">
          Upload your resume PDF. We&apos;ll read it into a structured profile
          you can review and edit, then use it to tailor future applications.
        </p>
      </div>

      {memory ? (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          You already have career memory saved. Uploading a new resume will
          replace it.
        </p>
      ) : null}

      <OnboardingFlow />
    </div>
  );
}
