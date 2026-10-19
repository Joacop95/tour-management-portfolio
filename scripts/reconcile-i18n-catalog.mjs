import fs from "node:fs"
import ts from "typescript"

function readCatalog(file, variableName) {
  const source = ts.createSourceFile(file, fs.readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true)
  let object
  function visit(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(source) === variableName) {
      object = node.initializer
      while (ts.isAsExpression(object) || ts.isSatisfiesExpression(object)) object = object.expression
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  if (!object || !ts.isObjectLiteralExpression(object)) throw new Error(`Missing ${variableName}`)
  const entries = []
  for (const property of object.properties) {
    if (ts.isSpreadAssignment(property)) continue
    if (!ts.isPropertyAssignment(property) || !ts.isObjectLiteralExpression(property.initializer)) throw new Error(`Unsupported entry in ${file}`)
    const key = property.name.text
    const fields = Object.fromEntries(property.initializer.properties.map((field) => [field.name.text, field.initializer.text]))
    if (!fields.context || !fields.description || !fields.english) throw new Error(`Incomplete ${key}`)
    entries.push({ key, ...fields })
  }
  return entries
}

const entries = [
  ...readCatalog("lib/i18n/generated-ui-catalog.ts", "generatedUiCatalog"),
  ...readCatalog("lib/i18n/ui-catalog.ts", "uiCatalog"),
]
const seen = new Set()
const duplicates = []
for (const { key } of entries) {
  if (!/^[a-z0-9]+([._-][a-z0-9]+)*$/.test(key)) throw new Error(`Invalid database translation key: ${key}`)
  if (seen.has(key)) duplicates.push(key)
  seen.add(key)
}
if (duplicates.length) throw new Error(`Duplicate keys: ${duplicates.join(", ")}`)
const migrationFiles = [
  "supabase/migrations/0041_full_ui_translation_catalog.sql",
  "supabase/migrations/0042_remaining_ui_status_labels.sql",
]
const nextMigration = "supabase/migrations/0043_settings_preview_translation_labels.sql"
if (fs.existsSync(nextMigration)) migrationFiles.push(nextMigration)
const seededKeys = migrationFiles.flatMap((file) =>
  [...fs.readFileSync(file, "utf8").matchAll(/^\s*\('([^']+)',\s*'/gm)].map((match) => match[1])
)
const seeded = new Set(seededKeys)
if (seeded.size !== seededKeys.length) throw new Error("Duplicate UI keys across migrations")
const missing = entries.map((entry) => entry.key).filter((key) => !seeded.has(key))
const extra = seededKeys.filter((key) => !seen.has(key))
if (process.argv.includes("--create-next")) {
  if (fs.existsSync(nextMigration)) throw new Error("Next migration already exists; applied migrations must not be rewritten")
  if (!missing.length) throw new Error("No new UI keys to seed")
  const quote = (value) => `'${value.replaceAll("'", "''")}'`
  const rows = entries.filter((entry) => missing.includes(entry.key)).sort((a, b) => a.key.localeCompare(b.key)).map(({ key, context, description, english }) =>
    `  (${quote(key)}, ${quote(context)}, ${quote(description)}, ${quote(english)})`
  )
  fs.writeFileSync(nextMigration, `-- I18N-2: catalog Settings preview and notification display labels.\ninsert into public.translation_entries (key, context, description, english_source)\nvalues\n${rows.join(",\n")}\non conflict (key) do nothing;\n`)
  process.stdout.write(`Created ${nextMigration} with ${rows.length} English-only keys\n`)
  process.exit(0)
}
if (missing.length || extra.length) throw new Error(`Catalog and migrations differ. Missing: ${missing.join(", ")}; extra: ${extra.join(", ")}`)
process.stdout.write(`${entries.length} unique UI keys verified across ${migrationFiles.map((file) => file.match(/\d{4}/)?.[0]).join("/")}; translation_values untouched\n`)
