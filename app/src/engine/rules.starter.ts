// The rules now live in content/rules.json (drafts until a medical owner approves each one).
// Kept as an alias so existing tests and callers keep working.
import { RULES } from '../content/content'
import type { Rule } from './rules'

export const STARTER_RULES: Rule[] = RULES
