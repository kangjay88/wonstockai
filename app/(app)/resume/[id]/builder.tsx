"use client";

import dynamic from "next/dynamic";
import { useEffect, useState, useTransition } from "react";

import { ResumeSectionsEditor } from "@/components/resume-editor";
import { resumeFileName } from "@/lib/pdf/filename";
import type { ResumeSections } from "@/lib/types";

import { saveResume } from "./actions";

// PDFViewer is browser-only — never render it on the server.
const PdfPreview = dynamic(() => import("./pdf-preview"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-sm text-gray-400">
      Loading preview…
    </div>
  ),
});

const PREVIEW_DEBOUNCE_MS = 400;

export function ResumeBuilder({
  id,
  name,
  initialSections,
}: {
  id: string;
  name: string;
  initialSections: ResumeSections;
}) {
  const [sections, setSections] = useState(initialSections);
  const [previewSections, setPreviewSections] = useState(initialSections);
  const [saving, startSaving] = useTransition();
  const [status, setStatus] = useState<string | null>(null);

  // Track the last-saved snapshot to drive the dirty indicator.
  const [savedSnapshot, setSavedSnapshot] = useState(() =>
    JSON.stringify(initialSections)
  );
  const dirty = JSON.stringify(sections) !== savedSnapshot;

  // Debounce preview re-renders so typing stays smooth.
  useEffect(() => {
    const t = setTimeout(() => setPreviewSections(sections), PREVIEW_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [sections]);

  function handleSave() {
    setStatus(null);
    const snapshot = sections;
    startSaving(async () => {
      const result = await saveResume(id, snapshot);
      if (result.ok) {
        setSavedSnapshot(JSON.stringify(snapshot));
        setStatus("Saved");
      } else {
        setStatus(result.error);
      }
    });
  }

  async function handleDownload() {
    // Import react-pdf only in the browser, on demand — keeps it out of SSR.
    const [{ pdf }, { ResumeDocument }] = await Promise.all([
      import("@react-pdf/renderer"),
      import("@/lib/pdf/resume-document"),
    ]);
    const blob = await pdf(<ResumeDocument sections={sections} />).toBlob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = resumeFileName(sections.contact.name);
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b border-gray-200 px-2 pb-3">
        <div>
          <h1 className="text-base font-semibold">{name}</h1>
          <p className="text-xs text-gray-500">
            {dirty ? "Unsaved changes" : status ?? "All changes saved"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleDownload}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium hover:bg-gray-50"
          >
            Download PDF
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !dirty}
            className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>

      {/* Two-pane: editor / live preview */}
      <div className="grid flex-1 grid-cols-1 gap-6 overflow-hidden pt-4 lg:grid-cols-2">
        <div className="overflow-y-auto pr-2">
          <ResumeSectionsEditor sections={sections} onChange={setSections} />
        </div>
        <div className="hidden h-full overflow-hidden rounded-md border border-gray-200 bg-gray-100 lg:block">
          <PdfPreview sections={previewSections} />
        </div>
      </div>
    </div>
  );
}
