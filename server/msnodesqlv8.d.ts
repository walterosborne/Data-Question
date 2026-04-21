declare module 'msnodesqlv8' {
  export type SqlQueryRow = Record<string, unknown>

  export interface SqlClient {
    query<TRecord extends SqlQueryRow = SqlQueryRow>(
      connectionString: string,
      queryText: string,
      callback: (error: Error | null, rows: TRecord[]) => void,
    ): void
  }
}
