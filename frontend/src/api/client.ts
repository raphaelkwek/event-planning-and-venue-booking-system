/**
 * Every refusal from either service arrives in the envelope from
 * implementation.md §5. The UI renders the server's own message rather than
 * inventing one, and binds `fields[]` to the fields that caused it (B2).
 */
export interface ApiErrorField {
  field: string;
  message: string;
}

export interface ApiErrorEnvelope {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  fields?: ApiErrorField[];
  correlationId: string | null;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly envelope: ApiErrorEnvelope
  ) {
    super(envelope.message);
    this.name = "ApiError";
  }

  fieldMessage(field: string): string | undefined {
    return this.envelope.fields?.find((entry) => entry.field === field)?.message;
  }
}

export interface RawResponse {
  status: number;
  body: unknown;
  correlationId: string | null;
}

/**
 * ADR-0016: a path such as /identity/api/v1/... goes to the API origin the build
 * names (VITE_API_BASE_URL, for Vercel); with none it stays relative. An absolute
 * URL is left alone.
 */
export function apiUrl(path: string, base: string = __API_BASE_URL__): string {
  return path.startsWith("/") ? `${base}${path}` : path;
}

/** Sends a request and returns the raw result, refusals included. */
export async function rawRequest(
  path: string,
  options: { method?: string; token?: string | null; body?: unknown; headers?: Record<string, string> } = {}
): Promise<RawResponse> {
  const response = await fetch(apiUrl(path), {
    method: options.method ?? "GET",
    headers: {
      ...options.headers,
      ...(options.body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
    },
    ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
  });

  const text = await response.text();
  let body: unknown = null;
  if (text.length > 0) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }

  return {
    status: response.status,
    body,
    correlationId: response.headers.get("x-correlation-id"),
  };
}

/**
 * A refusal that did not come from a service, so has no envelope: the API
 * gateway's own 401 and 429 (EN-12) are `{"message": "..."}`, in Kong's words,
 * so the screen says its own: sign in again, or wait.
 */
function gatewayRefusal(status: number, correlationId: string | null): ApiErrorEnvelope {
  if (status === 429) return { code: "RATE_LIMITED", message: "Too many requests. Wait a few seconds and try again.", correlationId };
  if (status === 401) return { code: "UNAUTHENTICATED", message: "Sign in again to continue.", correlationId };
  return { code: "UNKNOWN", message: `The server refused this request (${status}).`, correlationId };
}

/** Sends a request, throwing ApiError on any refusal so screens can render it. */
export async function request<T>(
  path: string,
  options: { method?: string; token?: string | null; body?: unknown; headers?: Record<string, string> } = {}
): Promise<T> {
  const { status, body, correlationId } = await rawRequest(path, options);

  if (status >= 400) {
    const envelope = (body as { error?: ApiErrorEnvelope } | null)?.error;
    throw new ApiError(
      status,
      envelope ?? gatewayRefusal(status, correlationId)
    );
  }

  return body as T;
}
