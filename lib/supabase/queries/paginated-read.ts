const pageSize = 500
const idBatchSize = 100

type PageResult<Row> = {
  data: Row[] | null
  error: { message: string } | null
}

export async function readAllPages<Row>(
  loadPage: (start: number, end: number) => PromiseLike<PageResult<Row>>
): Promise<{ data: Row[]; error: string | null }> {
  const rows: Row[] = []

  for (let start = 0; ; start += pageSize) {
    const result = await loadPage(start, start + pageSize - 1)
    if (result.error) return { data: [], error: result.error.message }

    const page = result.data ?? []
    rows.push(...page)
    if (page.length < pageSize) return { data: rows, error: null }
  }
}

export async function readByIdBatches<Row>(
  ids: string[],
  loadBatchPage: (
    batch: string[],
    start: number,
    end: number
  ) => PromiseLike<PageResult<Row>>
): Promise<{ data: Row[]; error: string | null }> {
  const rows: Row[] = []

  for (let offset = 0; offset < ids.length; offset += idBatchSize) {
    const batch = ids.slice(offset, offset + idBatchSize)
    const result = await readAllPages((start, end) =>
      loadBatchPage(batch, start, end)
    )
    if (result.error) return { data: [], error: result.error }
    rows.push(...result.data)
  }

  return { data: rows, error: null }
}
