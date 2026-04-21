declare module 'mssql' {
  export type config = {
    server: string
    database: string
    connectionString?: string
    options?: {
      trustedConnection?: boolean
      instanceName?: string
      useUTC?: boolean
    }
  }

  export interface IQueryResult<TRecord> {
    recordset: TRecord[]
  }

  export class Request {
    query<TRecord = Record<string, unknown>>(
      queryText: string,
    ): Promise<IQueryResult<TRecord>>
  }

  export class ConnectionPool {
    request(): Request
  }
}

declare module 'mssql/msnodesqlv8' {
  import type { config, ConnectionPool } from 'mssql'

  export function connect(configuration: config): Promise<ConnectionPool>
}
