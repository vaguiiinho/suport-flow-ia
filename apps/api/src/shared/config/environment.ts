export function readPort(rawValue: string | undefined, fallback: number): number {
  if (rawValue === undefined || rawValue.trim() === "") {
    return fallback;
  }

  const port = Number(rawValue);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("PORT must be an integer between 1 and 65535");
  }

  return port;
}

export function readCorsOrigins(rawValue: string | undefined): string[] {
  const origins = (rawValue ?? "http://localhost:3000")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (origins.length === 0) {
    throw new Error("WEB_ORIGIN must contain at least one origin");
  }

  return origins;
}
