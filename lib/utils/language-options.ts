export function normalizeLanguageOptions(languages: Array<string | null | undefined>) {
  return Array.from(
    new Set(
      languages
        .map((language) => language?.trim())
        .filter((language): language is string => Boolean(language))
    )
  ).sort()
}

export function normalizeSpokenLanguages(
  languages: Array<string | null | undefined> | null | undefined,
  preferredLanguage?: string | null
) {
  return Array.from(
    new Set(
      [preferredLanguage, ...(languages ?? [])]
        .map((language) => language?.trim().toUpperCase())
        .filter((language): language is string => Boolean(language))
    )
  )
}
