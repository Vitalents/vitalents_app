/** Call the app's rule evaluator for the synthetic S1 bundle on stdin. */
import { readFileSync } from 'node:fs'
import { createServer } from 'vite'

const bundle = JSON.parse(readFileSync(0, 'utf8'))
const rules = JSON.parse(readFileSync(new URL('../../content/rules.json', import.meta.url), 'utf8')).rules
const server = await createServer({ configFile: false, server: { middlewareMode: true, watch: null } })
try {
  const { computeFacts, evaluateRules } = await server.ssrLoadModule('/src/engine/rules.ts')
  const facts = computeFacts(bundle, process.argv[2])
  process.stdout.write(JSON.stringify([facts, evaluateRules(facts, rules)]))
} finally {
  await server.close()
}
