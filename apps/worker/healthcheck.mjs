const url = process.env.HEALTHCHECK_URL ?? "http://127.0.0.1:3002/health";

const response = await fetch(url, { signal: AbortSignal.timeout(5000) });

if (!response.ok) {
  throw new Error(`Worker health check returned ${response.status}`);
}
