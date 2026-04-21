export const sqlServerConfig = {
  connectionString: '',
  server: '',
  database: '',
  tableOrView: '',
  driver: 'ODBC Driver 18 for SQL Server',
  connectTimeoutSeconds: 60,
  encrypt: false,
  trustServerCertificate: true,
  applicationIntent: 'ReadWrite',
  multiSubnetFailover: false,
} as const
