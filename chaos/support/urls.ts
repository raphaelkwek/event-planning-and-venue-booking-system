/** The same connection string with another port: the way a service is pointed at Toxiproxy instead of Postgres. */
export function withPort(databaseUrl: string, port: number): string {
  const url = new URL(databaseUrl);
  url.port = String(port);
  return url.toString();
}

export function portOf(databaseUrl: string): number {
  return Number(new URL(databaseUrl).port || 5432);
}
