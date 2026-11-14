// Suggested questions (questions only; answers always come from the onboard library).
import type { DomainId } from '../../content/content'

export const GENERAL_SUGGESTIONS = [
  'Why do we measure sleep on a long mission?',
  'What does a Decode result below my reference mean?',
  'Why is pulse alone not enough to judge heart health?',
  'How does light affect the sleep cycle in space?',
]

export const DOMAIN_SUGGESTIONS: Record<DomainId, string[]> = {
  cognition: [
    'What does a Decode result below my reference mean?',
    'Why are my self-rating and Decode shown side by side?',
    'Why does cognition matter on a long mission?',
  ],
  sleep: [
    'Why do we measure sleep on a long mission?',
    'How does light affect the sleep cycle in space?',
    'What is a rest opportunity?',
  ],
  heart: [
    'Why is pulse alone not enough to judge heart health?',
    'How does spaceflight change the heart and circulation?',
    'Why does my pulse reading say limited quality?',
  ],
  symptoms: [
    'Why is skin temperature not core body temperature?',
    'When should a symptom go to the medical team?',
    'How does spaceflight affect the immune system?',
  ],
  nutrition: ['Why does nutrition matter on a long mission?', 'What does NASA say about food on long missions?', 'Why does a food log not prove a deficiency?'],
  movement: ['Why is daily exercise part of the mission plan?', 'Does completing exercise show bone health?', 'What are the bone changes in spaceflight?'],
  radiation: ['What are the hazards of space radiation?', 'Why does solar activity not give a personal dose?', 'How is radiation exposure logged?'],
}
