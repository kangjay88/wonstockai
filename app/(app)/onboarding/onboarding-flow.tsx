"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import type {
  EducationEntry,
  ExperienceEntry,
  ParsedResume,
  ProjectEntry,
} from "@/lib/types";

import { persistCareerMemory } from "./actions";

type Step = "upload" | "confirm";

export function OnboardingFlow() {
  const [step, setStep] = useState<Step>("upload");
  const [draft, setDraft] = useState<ParsedResume | null>(null);

  if (step === "confirm" && draft) {
    return (
      <ConfirmStep
        draft={draft}
        onChange={setDraft}
        onBack={() => setStep("upload")}
      />
    );
  }

  return (
    <UploadStep
      onParsed={(parsed) => {
        setDraft(parsed);
        setStep("confirm");
      }}
    />
  );
}

// ---------------------------------------------------------------------------
// Step 1 — upload + parse
// ---------------------------------------------------------------------------

function UploadStep({ onParsed }: { onParsed: (p: ParsedResume) => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleParse() {
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/ai/parse-resume", {
        method: "POST",
        body,
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong parsing the resume.");
        return;
      }
      onParsed(data as ParsedResume);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-300 px-6 py-10 text-center hover:border-gray-400">
        <span className="text-sm font-medium">
          {file ? file.name : "Choose a PDF resume"}
        </span>
        <span className="text-xs text-gray-500">PDF, up to 6 MB</span>
        <input
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={(e) => {
            setFile(e.target.files?.[0] ?? null);
            setError(null);
          }}
        />
      </label>

      {error ? (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}

      <button
        type="button"
        onClick={handleParse}
        disabled={!file || loading}
        className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {loading ? "Reading resume…" : "Parse resume"}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 2 — editable confirmation
// ---------------------------------------------------------------------------

function ConfirmStep({
  draft,
  onChange,
  onBack,
}: {
  draft: ParsedResume;
  onChange: (p: ParsedResume) => void;
  onBack: () => void;
}) {
  const router = useRouter();
  const [saving, startSaving] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const { sections } = draft;

  function update(mutate: (next: ParsedResume) => void) {
    const next = structuredClone(draft);
    mutate(next);
    onChange(next);
  }

  function handleSave() {
    setError(null);
    startSaving(async () => {
      const result = await persistCareerMemory(draft);
      if (result.ok) {
        router.push("/dashboard");
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <div className="space-y-8">
      <p className="text-sm text-gray-600">
        Here&apos;s your career memory, assembled. Fix anything the parser got
        wrong, then save.
      </p>

      {/* Contact */}
      <Section title="Contact">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field
            label="Name"
            value={sections.contact.name}
            onChange={(v) => update((n) => (n.sections.contact.name = v))}
          />
          <Field
            label="Email"
            value={sections.contact.email}
            onChange={(v) => update((n) => (n.sections.contact.email = v))}
          />
          <Field
            label="Phone"
            value={sections.contact.phone}
            onChange={(v) => update((n) => (n.sections.contact.phone = v))}
          />
          <Field
            label="Location"
            value={sections.contact.location}
            onChange={(v) => update((n) => (n.sections.contact.location = v))}
          />
          <Field
            label="LinkedIn"
            value={sections.contact.linkedin}
            onChange={(v) => update((n) => (n.sections.contact.linkedin = v))}
          />
          <Field
            label="Website"
            value={sections.contact.website}
            onChange={(v) => update((n) => (n.sections.contact.website = v))}
          />
        </div>
      </Section>

      {/* Summary */}
      <Section title="Summary">
        <TextArea
          value={sections.summary}
          rows={3}
          onChange={(v) => update((n) => (n.sections.summary = v))}
        />
      </Section>

      {/* Target roles */}
      <Section
        title="Suggested target roles"
        hint="Roles we'll consider when tailoring. Remove any that don't fit."
      >
        <ChipList
          items={draft.target_roles}
          placeholder="Add a target role"
          onChange={(items) => update((n) => (n.target_roles = items))}
        />
      </Section>

      {/* Skills */}
      <Section title="Skills">
        <ChipList
          items={sections.skills}
          placeholder="Add a skill"
          onChange={(items) => update((n) => (n.sections.skills = items))}
        />
      </Section>

      {/* Experience */}
      <Section title="Experience">
        <div className="space-y-4">
          {sections.experience.map((role, i) => (
            <ExperienceCard
              key={i}
              role={role}
              onChange={(r) =>
                update((n) => (n.sections.experience[i] = r))
              }
              onRemove={() =>
                update((n) => n.sections.experience.splice(i, 1))
              }
            />
          ))}
          <AddButton
            label="Add role"
            onClick={() =>
              update((n) =>
                n.sections.experience.push({
                  company: "",
                  title: "",
                  location: "",
                  startDate: "",
                  endDate: "",
                  bullets: [],
                })
              )
            }
          />
        </div>
      </Section>

      {/* Education */}
      <Section title="Education">
        <div className="space-y-4">
          {sections.education.map((edu, i) => (
            <EducationCard
              key={i}
              edu={edu}
              onChange={(e) => update((n) => (n.sections.education[i] = e))}
              onRemove={() =>
                update((n) => n.sections.education.splice(i, 1))
              }
            />
          ))}
          <AddButton
            label="Add education"
            onClick={() =>
              update((n) =>
                n.sections.education.push({
                  school: "",
                  degree: "",
                  field: "",
                  startDate: "",
                  endDate: "",
                  details: "",
                })
              )
            }
          />
        </div>
      </Section>

      {/* Projects */}
      <Section title="Projects">
        <div className="space-y-4">
          {sections.projects.map((proj, i) => (
            <ProjectCard
              key={i}
              project={proj}
              onChange={(p) => update((n) => (n.sections.projects[i] = p))}
              onRemove={() => update((n) => n.sections.projects.splice(i, 1))}
            />
          ))}
          <AddButton
            label="Add project"
            onClick={() =>
              update((n) =>
                n.sections.projects.push({
                  name: "",
                  description: "",
                  link: "",
                  bullets: [],
                })
              )
            }
          />
        </div>
      </Section>

      {error ? (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}

      <div className="flex items-center gap-3 border-t border-gray-200 pt-4">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save career memory"}
        </button>
        <button
          type="button"
          onClick={onBack}
          disabled={saving}
          className="text-sm text-gray-500 hover:text-gray-900"
        >
          Upload a different file
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-editors
// ---------------------------------------------------------------------------

function ExperienceCard({
  role,
  onChange,
  onRemove,
}: {
  role: ExperienceEntry;
  onChange: (r: ExperienceEntry) => void;
  onRemove: () => void;
}) {
  const set = <K extends keyof ExperienceEntry>(
    key: K,
    value: ExperienceEntry[K]
  ) => onChange({ ...role, [key]: value });

  return (
    <div className="space-y-3 rounded-md border border-gray-200 p-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field
          label="Title"
          value={role.title}
          onChange={(v) => set("title", v)}
        />
        <Field
          label="Company"
          value={role.company}
          onChange={(v) => set("company", v)}
        />
        <Field
          label="Location"
          value={role.location}
          onChange={(v) => set("location", v)}
        />
        <div className="grid grid-cols-2 gap-3">
          <Field
            label="Start (MMM YYYY)"
            value={role.startDate}
            onChange={(v) => set("startDate", v)}
          />
          <Field
            label="End (or Present)"
            value={role.endDate}
            onChange={(v) => set("endDate", v)}
          />
        </div>
      </div>
      <BulletsEditor
        bullets={role.bullets}
        onChange={(b) => set("bullets", b)}
      />
      <RemoveButton onClick={onRemove} label="Remove role" />
    </div>
  );
}

function EducationCard({
  edu,
  onChange,
  onRemove,
}: {
  edu: EducationEntry;
  onChange: (e: EducationEntry) => void;
  onRemove: () => void;
}) {
  const set = <K extends keyof EducationEntry>(
    key: K,
    value: EducationEntry[K]
  ) => onChange({ ...edu, [key]: value });

  return (
    <div className="space-y-3 rounded-md border border-gray-200 p-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field
          label="School"
          value={edu.school}
          onChange={(v) => set("school", v)}
        />
        <Field
          label="Degree"
          value={edu.degree}
          onChange={(v) => set("degree", v)}
        />
        <Field
          label="Field"
          value={edu.field}
          onChange={(v) => set("field", v)}
        />
        <div className="grid grid-cols-2 gap-3">
          <Field
            label="Start"
            value={edu.startDate}
            onChange={(v) => set("startDate", v)}
          />
          <Field
            label="End"
            value={edu.endDate}
            onChange={(v) => set("endDate", v)}
          />
        </div>
      </div>
      <Field
        label="Details"
        value={edu.details}
        onChange={(v) => set("details", v)}
      />
      <RemoveButton onClick={onRemove} label="Remove education" />
    </div>
  );
}

function ProjectCard({
  project,
  onChange,
  onRemove,
}: {
  project: ProjectEntry;
  onChange: (p: ProjectEntry) => void;
  onRemove: () => void;
}) {
  const set = <K extends keyof ProjectEntry>(
    key: K,
    value: ProjectEntry[K]
  ) => onChange({ ...project, [key]: value });

  return (
    <div className="space-y-3 rounded-md border border-gray-200 p-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field
          label="Name"
          value={project.name}
          onChange={(v) => set("name", v)}
        />
        <Field
          label="Link"
          value={project.link}
          onChange={(v) => set("link", v)}
        />
      </div>
      <Field
        label="Description"
        value={project.description}
        onChange={(v) => set("description", v)}
      />
      <BulletsEditor
        bullets={project.bullets}
        onChange={(b) => set("bullets", b)}
      />
      <RemoveButton onClick={onRemove} label="Remove project" />
    </div>
  );
}

/** Bullets edited as one-per-line; blank lines dropped on change. */
function BulletsEditor({
  bullets,
  onChange,
}: {
  bullets: string[];
  onChange: (b: string[]) => void;
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-gray-600">
        Bullets (one per line)
      </label>
      <textarea
        value={bullets.join("\n")}
        rows={Math.max(3, bullets.length)}
        onChange={(e) =>
          onChange(
            e.target.value
              .split("\n")
              .map((line) => line.replace(/^[-•*]\s*/, ""))
          )
        }
        onBlur={(e) =>
          onChange(
            e.target.value
              .split("\n")
              .map((line) => line.replace(/^[-•*]\s*/, "").trim())
              .filter(Boolean)
          )
        }
        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900"
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-700">
          {title}
        </h2>
        {hint ? <p className="text-xs text-gray-500">{hint}</p> : null}
      </div>
      {children}
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-medium text-gray-600">{label}</span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900"
      />
    </label>
  );
}

function TextArea({
  value,
  rows,
  onChange,
}: {
  value: string;
  rows: number;
  onChange: (v: string) => void;
}) {
  return (
    <textarea
      value={value}
      rows={rows}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900"
    />
  );
}

function ChipList({
  items,
  placeholder,
  onChange,
}: {
  items: string[];
  placeholder: string;
  onChange: (items: string[]) => void;
}) {
  const [input, setInput] = useState("");

  function add() {
    const value = input.trim();
    if (!value || items.includes(value)) {
      setInput("");
      return;
    }
    onChange([...items, value]);
    setInput("");
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {items.map((item, i) => (
          <span
            key={`${item}-${i}`}
            className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 text-sm"
          >
            {item}
            <button
              type="button"
              aria-label={`Remove ${item}`}
              onClick={() => onChange(items.filter((_, idx) => idx !== i))}
              className="text-gray-400 hover:text-gray-700"
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <input
        type="text"
        value={input}
        placeholder={placeholder}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            add();
          }
        }}
        onBlur={add}
        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900"
      />
    </div>
  );
}

function AddButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-md border border-dashed border-gray-300 px-3 py-2 text-sm text-gray-600 hover:border-gray-400 hover:text-gray-900"
    >
      + {label}
    </button>
  );
}

function RemoveButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-xs text-red-500 hover:text-red-700"
    >
      {label}
    </button>
  );
}
