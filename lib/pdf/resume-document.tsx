import {
  Document,
  Link,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";

import type { ResumeSections } from "@/lib/types";

/**
 * Single source of truth for resume layout. Used both for the live preview pane
 * (rendered via <PDFViewer>) and the downloaded PDF, so what you see is exactly
 * what exports.
 *
 * Uses the built-in Helvetica family — standard, ATS-parseable, no font files
 * to register or ship. Single column, no tables/images (satisfies A5/A6/A8).
 */

const COLORS = {
  text: "#111111",
  muted: "#555555",
  rule: "#cccccc",
};

const styles = StyleSheet.create({
  page: {
    paddingTop: 36,
    paddingBottom: 36,
    paddingHorizontal: 44,
    fontFamily: "Helvetica",
    fontSize: 10.5,
    lineHeight: 1.35,
    color: COLORS.text,
  },
  name: {
    fontSize: 20,
    fontFamily: "Helvetica-Bold",
    marginBottom: 3,
  },
  contactLine: {
    fontSize: 9.5,
    color: COLORS.muted,
    marginBottom: 2,
  },
  sectionTitle: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginTop: 14,
    marginBottom: 4,
    paddingBottom: 2,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.rule,
  },
  summary: {
    marginBottom: 2,
  },
  entry: {
    marginBottom: 8,
  },
  entryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
  },
  entryTitle: {
    fontFamily: "Helvetica-Bold",
  },
  entrySub: {
    color: COLORS.muted,
    fontSize: 10,
  },
  entryDates: {
    color: COLORS.muted,
    fontSize: 9.5,
  },
  bulletRow: {
    flexDirection: "row",
    marginTop: 2,
    paddingRight: 4,
  },
  bulletMark: {
    width: 10,
  },
  bulletText: {
    flex: 1,
  },
  skills: {
    lineHeight: 1.4,
  },
});

function formatDateRange(start: string, end: string): string {
  const s = start.trim();
  const e = end.trim();
  if (s && e) return `${s} – ${e}`;
  return s || e || "";
}

function contactLine(c: ResumeSections["contact"]): string {
  return [c.email, c.phone, c.location].filter(Boolean).join("  ·  ");
}

function linkLine(c: ResumeSections["contact"]): string[] {
  return [c.linkedin, c.website].filter(Boolean);
}

function Bullets({ items }: { items: string[] }) {
  return (
    <>
      {items
        .map((b) => b.trim())
        .filter(Boolean)
        .map((b, i) => (
          <View key={i} style={styles.bulletRow}>
            <Text style={styles.bulletMark}>{"•"}</Text>
            <Text style={styles.bulletText}>{b}</Text>
          </View>
        ))}
    </>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

export function ResumeDocument({ sections }: { sections: ResumeSections }) {
  const { contact, summary, experience, education, skills, projects } = sections;
  const links = linkLine(contact);

  const hasExperience = experience.some((e) => e.company || e.title);
  const hasEducation = education.some((e) => e.school || e.degree);
  const hasProjects = projects.some((p) => p.name);
  const skillList = skills.filter(Boolean);

  return (
    <Document
      title={`${contact.name || "Resume"}`}
      author={contact.name || undefined}
    >
      <Page size="LETTER" style={styles.page}>
        {/* Header */}
        <View>
          <Text style={styles.name}>{contact.name || "Your Name"}</Text>
          {contactLine(contact) ? (
            <Text style={styles.contactLine}>{contactLine(contact)}</Text>
          ) : null}
          {links.length ? (
            <Text style={styles.contactLine}>
              {links.map((l, i) => (
                <Text key={i}>
                  {i > 0 ? "  ·  " : ""}
                  <Link src={l.startsWith("http") ? l : `https://${l}`}>
                    {l}
                  </Link>
                </Text>
              ))}
            </Text>
          ) : null}
        </View>

        {summary.trim() ? (
          <Section title="Summary">
            <Text style={styles.summary}>{summary.trim()}</Text>
          </Section>
        ) : null}

        {hasExperience ? (
          <Section title="Experience">
            {experience.map((role, i) => (
              <View key={i} style={styles.entry} wrap={false}>
                <View style={styles.entryHeader}>
                  <Text style={styles.entryTitle}>
                    {role.title}
                    {role.title && role.company ? ", " : ""}
                    <Text style={styles.entrySub}>{role.company}</Text>
                  </Text>
                  <Text style={styles.entryDates}>
                    {formatDateRange(role.startDate, role.endDate)}
                  </Text>
                </View>
                {role.location ? (
                  <Text style={styles.entrySub}>{role.location}</Text>
                ) : null}
                <Bullets items={role.bullets} />
              </View>
            ))}
          </Section>
        ) : null}

        {hasProjects ? (
          <Section title="Projects">
            {projects.map((proj, i) => (
              <View key={i} style={styles.entry} wrap={false}>
                <View style={styles.entryHeader}>
                  <Text style={styles.entryTitle}>
                    {proj.link ? (
                      <Link src={proj.link.startsWith("http") ? proj.link : `https://${proj.link}`}>
                        {proj.name}
                      </Link>
                    ) : (
                      proj.name
                    )}
                  </Text>
                </View>
                {proj.description ? (
                  <Text style={styles.summary}>{proj.description}</Text>
                ) : null}
                <Bullets items={proj.bullets} />
              </View>
            ))}
          </Section>
        ) : null}

        {hasEducation ? (
          <Section title="Education">
            {education.map((edu, i) => (
              <View key={i} style={styles.entry} wrap={false}>
                <View style={styles.entryHeader}>
                  <Text style={styles.entryTitle}>
                    {edu.school}
                  </Text>
                  <Text style={styles.entryDates}>
                    {formatDateRange(edu.startDate, edu.endDate)}
                  </Text>
                </View>
                {edu.degree || edu.field ? (
                  <Text style={styles.entrySub}>
                    {[edu.degree, edu.field].filter(Boolean).join(", ")}
                  </Text>
                ) : null}
                {edu.details ? (
                  <Text style={styles.summary}>{edu.details}</Text>
                ) : null}
              </View>
            ))}
          </Section>
        ) : null}

        {skillList.length ? (
          <Section title="Skills">
            <Text style={styles.skills}>{skillList.join("  ·  ")}</Text>
          </Section>
        ) : null}
      </Page>
    </Document>
  );
}


