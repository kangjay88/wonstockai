"use client";

import { useMemo, useState } from "react";

import { ScorePanel } from "@/app/(app)/resume/[id]/score-panel";
import { scoreResume } from "@/lib/scoring";
import type { JdExtraction, ResumeSections, ReviewResult } from "@/lib/types";

export function ApplicationScore({
  applicationId,
  sections,
  jd,
}: {
  applicationId: string;
  sections: ResumeSections;
  jd: JdExtraction | null;
}) {
  const [rubric, setRubric] = useState<ReviewResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const report = useMemo(
    () => scoreResume(sections, jd, { rubric }),
    [sections, jd, rubric]
  );

  async function runReview() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ applicationId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "AI review failed.");
        return;
      }
      setRubric(data as ReviewResult);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <ScorePanel report={report} />

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={runReview}
          disabled={loading}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
        >
          {loading
            ? "Reviewing…"
            : rubric
              ? "Re-run AI review"
              : "Run AI impact review"}
        </button>
        {rubric ? (
          <span className="text-xs text-green-700">
            AI rubric applied (C2/C3 + semantic coverage)
          </span>
        ) : (
          <span className="text-xs text-gray-400">
            Adds per-bullet outcome scoring (~3–5¢)
          </span>
        )}
      </div>

      {error ? (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
