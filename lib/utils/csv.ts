export type CsvValue = string | number | null | undefined

export type ParsedCsv = {
  rows: string[][]
  error: string | null
}

export function escapeCsvValue(value: CsvValue) {
  const stringValue = value === null || value === undefined ? "" : String(value)

  if (
    stringValue.includes(",") ||
    stringValue.includes('"') ||
    stringValue.includes("\n") ||
    stringValue.includes("\r")
  ) {
    return `"${stringValue.replaceAll('"', '""')}"`
  }

  return stringValue
}

export function createCsv(rows: Array<Record<string, CsvValue>>) {
  if (rows.length === 0) return ""
  const headers = Object.keys(rows[0])

  return [
    headers.map(escapeCsvValue).join(","),
    ...rows.map((row) =>
      headers.map((header) => escapeCsvValue(row[header])).join(",")
    ),
  ].join("\n")
}

export function parseCsv(csv: string): ParsedCsv {
  const rows: string[][] = []
  let row: string[] = []
  let value = ""
  let quoted = false

  for (let index = 0; index < csv.length; index += 1) {
    const character = csv[index]
    const nextCharacter = csv[index + 1]

    if (character === '"') {
      if (quoted && nextCharacter === '"') {
        value += '"'
        index += 1
      } else {
        quoted = !quoted
      }
      continue
    }

    if (character === "," && !quoted) {
      row.push(value)
      value = ""
      continue
    }

    if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && nextCharacter === "\n") index += 1
      row.push(value)
      rows.push(row)
      row = []
      value = ""
      continue
    }

    value += character
  }

  if (quoted) return { rows: [], error: "CSV contains an unclosed quoted value." }
  if (value || row.length) {
    row.push(value)
    rows.push(row)
  }
  if (rows[0]?.[0]) rows[0][0] = rows[0][0].replace(/^\uFEFF/, "")

  return { rows, error: null }
}

export function downloadCsv(
  filename: string,
  rows: Array<Record<string, CsvValue>>,
  options?: { includeBom?: boolean }
) {
  const csv = createCsv(rows)
  if (!csv) return false

  const blob = new Blob([options?.includeBom ? "\uFEFF" : "", csv], {
    type: "text/csv;charset=utf-8",
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
  return true
}
