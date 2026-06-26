// Verifies the resume PDF template renders to a valid PDF.
//   npx tsx scripts/verify-pdf.tsx
import { renderToBuffer } from "@react-pdf/renderer";

import { resumeFileName } from "@/lib/pdf/filename";
import { ResumeDocument } from "@/lib/pdf/resume-document";
import { resumeSectionsSchema } from "@/lib/types";

const sample = resumeSectionsSchema.parse({
  contact: {
    name: "Jay Kang",
    email: "jay@example.com",
    phone: "555-123-4567",
    location: "Toronto, ON",
    linkedin: "linkedin.com/in/jaykang",
    website: "",
  },
  summary:
    "Full-stack developer with experience shipping production web apps across the stack.",
  experience: [
    {
      company: "Acme Corp",
      title: "Software Developer",
      location: "Remote",
      startDate: "Jan 2023",
      endDate: "Present",
      bullets: [
        "Built and shipped a billing dashboard used by 600+ internal users.",
        "Reduced API p95 latency 32% by adding query-level caching.",
      ],
    },
    {
      company: "Startup Inc",
      title: "Junior Developer",
      location: "Toronto, ON",
      startDate: "Jun 2021",
      endDate: "Dec 2022",
      bullets: ["Maintained a React frontend and Node backend."],
    },
  ],
  education: [
    {
      school: "University of Toronto",
      degree: "BSc",
      field: "Computer Science",
      startDate: "Sep 2017",
      endDate: "Apr 2021",
      details: "",
    },
  ],
  skills: ["TypeScript", "React", "Node.js", "PostgreSQL", "AWS"],
  projects: [
    {
      name: "Resume Tailor",
      description: "Personal AI resume tailoring app.",
      link: "github.com/jaykang/resume-tailor",
      bullets: ["Next.js + Supabase + Anthropic API."],
    },
  ],
});

async function main() {
  const buffer = await renderToBuffer(<ResumeDocument sections={sample} />);
  const header = buffer.subarray(0, 5).toString("latin1");

  console.log("filename:", resumeFileName(sample.contact.name));
  console.log("bytes:", buffer.length);
  console.log("header:", header);
  if (header !== "%PDF-" || buffer.length < 1000) {
    console.error("FAIL: output is not a valid PDF");
    process.exit(1);
  }
  console.log("OK: valid PDF rendered");
}

main();
