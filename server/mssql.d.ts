declare module 'mssql' {
  export type config = {
    user?: string
    password?: string
    domain?: string
    server: string
    database: string
    port?: number
    connectionString?: string
    authentication?: {
      type: 'default' | 'ntlm'
      options: {
        userName: string
        password: string
        domain: string
      }
    }
    options?: {
      instanceName?: string
      useUTC?: boolean
      encrypt?: boolean
      trustServerCertificate?: boolean
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

  export function connect(configuration: config | string): Promise<ConnectionPool>
}
