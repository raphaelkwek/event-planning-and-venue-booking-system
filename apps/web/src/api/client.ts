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

/** Sends a request and returns the raw result, refusals included. */
export async function rawRequest(
  path: string,
  options: { method?: string; token?: string | null; body?: unknown } = {}
): Promise<RawResponse> {
  const response = await fetch(path, {
    method: options.method ?? "GET",
    headers: {
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

/** Sends a request, throwing ApiError on any refusal so screens can render it. */
export async function request<T>(
  path: string,
  options: { method?: string; token?: string | null; body?: unknown } = {}
): Promise<T> {
  const { status, body, correlationId } = await rawRequest(path, options);

  if (status >= 400) {
    const envelope = (body as { error?: ApiErrorEnvelope } | null)?.error;
    throw new ApiError(
      status,
      envelope ?? {
        code: "UNKNOWN",
        message: `The server refused this request (${status}).`,
        correlationId,
      }
    );
  }

  return body as T;
}
