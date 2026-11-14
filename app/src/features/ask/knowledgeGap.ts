// "Add this question for review" (FR-AS-04): a knowledge_gap record. Knowledge changes only after specialist review.
import type { KnowledgeGap } from '../../data/contract'

// TODO(question: knowledge_gap has no subject_id, so contract D-1 doesn't say which realm it belongs to.
// Using `sim` because the demo runs in simulation mode; confirm with the team before research mode.)
const REALM = 'sim'

/** Removes things that could identify a person before a question leaves the crew member's device. */
export function redactQuestion(q: string): string {
  return q
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '[email]')
    .replace(/\+?\d[\d\s()-]{7,}\d/g, '[number]')
    .trim()
    .slice(0, 500)
}

export function makeKnowledgeGap(question: string, retrievedSourceIds: string[] = [], now = new Date()): KnowledgeGap {
  return {
    knowledge_gap_id: `${REALM}:knowledge_gap:${crypto.randomUUID()}`,
    schema_version: '1.0',
    data_origin: 'application_generated',
    created_at_utc: now.toISOString(),
    question_redacted: redactQuestion(question),
    status: 'open',
    retrieved_source_ids: retrievedSourceIds,
    reviewer_role: 'medical',
    resolution_source_id: null,
  }
}
