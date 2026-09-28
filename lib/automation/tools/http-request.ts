import { lookup } from "node:dns/promises";
import net from "node:net";

export type HttpRequestMethod =
  | "GET"
  | "POST"
  | "PUT"
  | "PATCH"
  | "DELETE";

export type HttpRequestInput = {
  url: string;
  method?: HttpRequestMethod;
  headers?: Record<string, string>;
  query?: Record<string, string | number | boolean>;
  body?: unknown;
  timeout_ms?: number;
  max_response_bytes?: number;
  max_redirects?: number;
};

export type HttpRequestOutput = {
  url: string;
  final_url: string;
  method: HttpRequestMethod;
  status: number;
  status_text: string;
  headers: Record<string, string>;
  content_type: string;
  body: unknown;
  raw_body?: string;
  response_bytes: number;
  redirected: boolean;
};

const DEFAULT_TIMEOUT_MS = 30_000;
const MAX_TIMEOUT_MS = 60_000;

const DEFAULT_MAX_RESPONSE_BYTES =
  2 * 1024 * 1024;

const MAX_RESPONSE_BYTES =
  10 * 1024 * 1024;

const DEFAULT_MAX_REDIRECTS = 3;
const MAX_REDIRECTS = 5;

const MAX_HEADERS = 50;
const MAX_HEADER_NAME_LENGTH = 200;
const MAX_HEADER_VALUE_LENGTH = 4000;

const MAX_QUERY_PARAMETERS = 50;
const MAX_URL_LENGTH = 8000;

const MAX_REQUEST_BODY_BYTES =
  2 * 1024 * 1024;

const ALLOWED_METHODS: HttpRequestMethod[] = [
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
];

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "localhost.localdomain",
  "ip6-localhost",
  "ip6-loopback",
  "broadcasthost",
  "0.0.0.0",
]);

const BLOCKED_HEADER_NAMES = new Set([
  "host",
  "content-length",
  "connection",
  "transfer-encoding",
  "upgrade",
]);

function normalizeString(
  value: unknown
): string {
  return typeof value === "string"
    ? value.trim()
    : "";
}

function clampNumber(
  value: unknown,
  fallback: number,
  minimum: number,
  maximum: number
): number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value)
  ) {
    return fallback;
  }

  return Math.min(
    Math.max(
      Math.floor(value),
      minimum
    ),
    maximum
  );
}

function normalizeMethod(
  value: unknown
): HttpRequestMethod {
  const method =
    normalizeString(value).toUpperCase();

  if (
    ALLOWED_METHODS.includes(
      method as HttpRequestMethod
    )
  ) {
    return method as HttpRequestMethod;
  }

  return "GET";
}

function isPrivateIPv4(
  ip: string
): boolean {
  const parts = ip
    .split(".")
    .map(Number);

  if (
    parts.length !== 4 ||
    parts.some(
      (part) =>
        !Number.isInteger(part) ||
        part < 0 ||
        part > 255
    )
  ) {
    return false;
  }

  const [a, b] = parts;

  if (a === 10) {
    return true;
  }

  if (
    a === 172 &&
    b >= 16 &&
    b <= 31
  ) {
    return true;
  }

  if (a === 192 && b === 168) {
    return true;
  }

  if (a === 127) {
    return true;
  }

  if (a === 169 && b === 254) {
    return true;
  }

  if (a === 0) {
    return true;
  }

  return false;
}

function normalizeIPv6(
  ip: string
): string {
  return ip
    .toLowerCase()
    .replace(/^\[/, "")
    .replace(/\]$/, "")
    .split("%")[0];
}

function isPrivateIPv6(
  ip: string
): boolean {
  const normalized =
    normalizeIPv6(ip);

  if (
    normalized === "::" ||
    normalized === "::1"
  ) {
    return true;
  }

  if (
    normalized.startsWith("fc") ||
    normalized.startsWith("fd")
  ) {
    return true;
  }

  if (
    normalized.startsWith("fe8") ||
    normalized.startsWith("fe9") ||
    normalized.startsWith("fea") ||
    normalized.startsWith("feb")
  ) {
    return true;
  }

  if (
    normalized.startsWith("::ffff:")
  ) {
    const mapped =
      normalized.slice(7);

    if (
      net.isIP(mapped) === 4 &&
      isPrivateIPv4(mapped)
    ) {
      return true;
    }
  }

  return false;
}

function isBlockedIP(
  ip: string
): boolean {
  const version = net.isIP(ip);

  if (version === 4) {
    return isPrivateIPv4(ip);
  }

  if (version === 6) {
    return isPrivateIPv6(ip);
  }

  return true;
}

async function validateHostname(
  hostname: string
): Promise<void> {
  const normalized =
    hostname
      .toLowerCase()
      .replace(/\.$/, "");

  if (
    !normalized ||
    BLOCKED_HOSTNAMES.has(normalized)
  ) {
    throw new Error(
      "Requests to localhost or loopback hosts are not allowed."
    );
  }

  if (
    normalized === "metadata.google.internal" ||
    normalized.endsWith(
      ".metadata.google.internal"
    )
  ) {
    throw new Error(
      "Requests to cloud metadata hosts are not allowed."
    );
  }

  const ipVersion =
    net.isIP(normalized);

  if (ipVersion) {
    if (isBlockedIP(normalized)) {
      throw new Error(
        "Requests to private or internal IP addresses are not allowed."
      );
    }

    return;
  }

  const addresses =
    await lookup(normalized, {
      all: true,
      verbatim: true,
    });

  if (
    !addresses ||
    addresses.length === 0
  ) {
    throw new Error(
      "Unable to resolve request hostname."
    );
  }

  for (
    const address of addresses
  ) {
    if (
      isBlockedIP(address.address)
    ) {
      throw new Error(
        "Requests to private or internal network addresses are not allowed."
      );
    }
  }
}

function validateHeaders(
  value: unknown
): Record<string, string> {
  if (
    value === undefined ||
    value === null
  ) {
    return {};
  }

  if (
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    throw new Error(
      "HTTP headers must be an object."
    );
  }

  const source =
    value as Record<
      string,
      unknown
    >;

  const entries =
    Object.entries(source);

  if (
    entries.length >
    MAX_HEADERS
  ) {
    throw new Error(
      `A maximum of ${MAX_HEADERS} headers is allowed.`
    );
  }

  const headers: Record<
    string,
    string
  > = {};

  for (
    const [name, rawValue] of entries
  ) {
    const normalizedName =
      name.trim();

    if (
      !normalizedName ||
      normalizedName.length >
        MAX_HEADER_NAME_LENGTH
    ) {
      throw new Error(
        "Invalid HTTP header name."
      );
    }

    if (
      BLOCKED_HEADER_NAMES.has(
        normalizedName.toLowerCase()
      )
    ) {
      throw new Error(
        `The "${normalizedName}" header cannot be set manually.`
      );
    }

    if (
      !/^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/.test(
        normalizedName
      )
    ) {
      throw new Error(
        `Invalid HTTP header name: ${normalizedName}`
      );
    }

    if (
      typeof rawValue !==
      "string"
    ) {
      throw new Error(
        `HTTP header "${normalizedName}" must have a string value.`
      );
    }

    if (
      rawValue.length >
      MAX_HEADER_VALUE_LENGTH
    ) {
      throw new Error(
        `HTTP header "${normalizedName}" is too long.`
      );
    }

    headers[normalizedName] =
      rawValue;
  }

  return headers;
}

function buildUrl(
  rawUrl: string,
  query: HttpRequestInput["query"]
): URL {
  if (
    rawUrl.length === 0
  ) {
    throw new Error(
      "HTTP request URL is required."
    );
  }

  if (
    rawUrl.length >
    MAX_URL_LENGTH
  ) {
    throw new Error(
      "HTTP request URL is too long."
    );
  }

  let url: URL;

  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error(
      "Invalid HTTP request URL."
    );
  }

  if (
    url.protocol !== "http:" &&
    url.protocol !== "https:"
  ) {
    throw new Error(
      "Only HTTP and HTTPS URLs are allowed."
    );
  }

  if (
    url.username ||
    url.password
  ) {
    throw new Error(
      "URLs containing embedded credentials are not allowed."
    );
  }

  if (
    query !== undefined &&
    query !== null
  ) {
    if (
      typeof query !== "object" ||
      Array.isArray(query)
    ) {
      throw new Error(
        "HTTP query parameters must be an object."
      );
    }

    const entries =
      Object.entries(query);

    if (
      entries.length >
      MAX_QUERY_PARAMETERS
    ) {
      throw new Error(
        `A maximum of ${MAX_QUERY_PARAMETERS} query parameters is allowed.`
      );
    }

    for (
      const [key, value] of entries
    ) {
      if (
        typeof value !==
          "string" &&
        typeof value !==
          "number" &&
        typeof value !==
          "boolean"
      ) {
        throw new Error(
          `Query parameter "${key}" must be a string, number, or boolean.`
        );
      }

      url.searchParams.set(
        key,
        String(value)
      );
    }
  }

  return url;
}

function serializeBody(
  body: unknown
): {
  body?: string;
  contentType?: string;
} {
  if (
    body === undefined ||
    body === null
  ) {
    return {};
  }

  if (
    typeof body === "string"
  ) {
    return {
      body,
      contentType:
        "text/plain; charset=utf-8",
    };
  }

  let serialized: string;

  try {
    serialized =
      JSON.stringify(body);
  } catch {
    throw new Error(
      "HTTP request body could not be serialized as JSON."
    );
  }

  if (
    typeof serialized !==
    "string"
  ) {
    throw new Error(
      "HTTP request body could not be serialized."
    );
  }

  const size =
    Buffer.byteLength(
      serialized,
      "utf8"
    );

  if (
    size >
    MAX_REQUEST_BODY_BYTES
  ) {
    throw new Error(
      "HTTP request body is too large."
    );
  }

  return {
    body: serialized,
    contentType:
      "application/json; charset=utf-8",
  };
}

async function readResponseBody(
  response: Response,
  maxBytes: number
): Promise<{
  text: string;
  bytes: number;
}> {
  if (!response.body) {
    return {
      text: "",
      bytes: 0,
    };
  }

  const reader =
    response.body.getReader();

  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } =
        await reader.read();

      if (done) {
        break;
      }

      if (!value) {
        continue;
      }

      totalBytes +=
        value.byteLength;

      if (
        totalBytes >
        maxBytes
      ) {
        await reader.cancel();

        throw new Error(
          "HTTP response exceeded the configured size limit."
        );
      }

      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const combined =
    new Uint8Array(
      totalBytes
    );

  let offset = 0;

  for (
    const chunk of chunks
  ) {
    combined.set(
      chunk,
      offset
    );

    offset +=
      chunk.byteLength;
  }

  const text =
    new TextDecoder(
      "utf-8",
      {
        fatal: false,
      }
    ).decode(combined);

  return {
    text,
    bytes: totalBytes,
  };
}

function parseResponseBody(
  text: string,
  contentType: string
): unknown {
  if (!text) {
    return null;
  }

  const normalized =
    contentType.toLowerCase();

  const looksLikeJson =
    normalized.includes(
      "application/json"
    ) ||
    normalized.includes(
      "+json"
    );

  if (looksLikeJson) {
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }

  return text;
}

function getResponseHeaders(
  response: Response
): Record<string, string> {
  const headers: Record<
    string,
    string
  > = {};

  response.headers.forEach(
    (value, key) => {
      headers[key] = value;
    }
  );

  return headers;
}

function getContentType(
  response: Response
): string {
  return (
    response.headers.get(
      "content-type"
    ) || ""
  );
}

async function executeRequest(
  url: URL,
  method: HttpRequestMethod,
  headers: Record<string, string>,
  body: string | undefined,
  timeoutMs: number,
  maxResponseBytes: number,
  maxRedirects: number,
  redirectCount: number
): Promise<{
  response: Response;
  finalUrl: URL;
}> {
  const controller =
    new AbortController();

  const timeout =
    setTimeout(() => {
      controller.abort();
    }, timeoutMs);

  try {
    const response =
      await fetch(
        url,
        {
          method,
          headers,
          body:
            method === "GET" ||
            method === "DELETE"
              ? undefined
              : body,
          signal:
            controller.signal,
          cache: "no-store",
          redirect: "manual",
        }
      );

    if (
      response.status >= 300 &&
      response.status < 400
    ) {
      const location =
        response.headers.get(
          "location"
        );

      if (!location) {
        return {
          response,
          finalUrl: url,
        };
      }

      if (
        redirectCount >=
        maxRedirects
      ) {
        throw new Error(
          "HTTP request exceeded the maximum redirect limit."
        );
      }

      const redirectUrl =
        new URL(
          location,
          url
        );

      if (
        redirectUrl.protocol !==
          "http:" &&
        redirectUrl.protocol !==
          "https:"
      ) {
        throw new Error(
          "HTTP redirect points to an unsupported protocol."
        );
      }

      await validateHostname(
        redirectUrl.hostname
      );

      const redirectResponse =
        await executeRequest(
          redirectUrl,
          method,
          headers,
          body,
          timeoutMs,
          maxResponseBytes,
          maxRedirects,
          redirectCount + 1
        );

      return redirectResponse;
    }

    return {
      response,
      finalUrl: url,
    };
  } catch (error) {
    if (
      error instanceof DOMException &&
      error.name === "AbortError"
    ) {
      throw new Error(
        "HTTP request timed out."
      );
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export async function executeHttpRequest(
  input: HttpRequestInput
): Promise<{
  success: boolean;
  output?: HttpRequestOutput;
  error?: string;
  errorCode?: string;
}> {
  try {
    if (
      !input ||
      typeof input !== "object"
    ) {
      return {
        success: false,
        error:
          "HTTP request input is required.",
        errorCode:
          "HTTP_INPUT_REQUIRED",
      };
    }

    const rawUrl =
      normalizeString(input.url);

    if (!rawUrl) {
      return {
        success: false,
        error:
          "HTTP request URL is required.",
        errorCode:
          "HTTP_URL_REQUIRED",
      };
    }

    const method =
      normalizeMethod(input.method);

    const url =
      buildUrl(
        rawUrl,
        input.query
      );

    await validateHostname(
      url.hostname
    );

    const headers =
      validateHeaders(
        input.headers
      );

    const serializedBody =
      serializeBody(input.body);

    if (
      serializedBody.contentType &&
      !Object.keys(headers).some(
        (name) =>
          name.toLowerCase() ===
          "content-type"
      )
    ) {
      headers["Content-Type"] =
        serializedBody.contentType;
    }

    const timeoutMs =
      clampNumber(
        input.timeout_ms,
        DEFAULT_TIMEOUT_MS,
        1000,
        MAX_TIMEOUT_MS
      );

    const maxResponseBytes =
      clampNumber(
        input.max_response_bytes,
        DEFAULT_MAX_RESPONSE_BYTES,
        1024,
        MAX_RESPONSE_BYTES
      );

    const maxRedirects =
      clampNumber(
        input.max_redirects,
        DEFAULT_MAX_REDIRECTS,
        0,
        MAX_REDIRECTS
      );

    const {
      response,
      finalUrl,
    } =
      await executeRequest(
        url,
        method,
        headers,
        serializedBody.body,
        timeoutMs,
        maxResponseBytes,
        maxRedirects,
        0
      );

    const responseContent =
      await readResponseBody(
        response,
        maxResponseBytes
      );

    const contentType =
      getContentType(response);

    const parsedBody =
      parseResponseBody(
        responseContent.text,
        contentType
      );

    const responseHeaders =
      getResponseHeaders(response);

    if (!response.ok) {
      return {
        success: false,
        output: {
          url: url.toString(),
          final_url:
            finalUrl.toString(),
          method,
          status:
            response.status,
          status_text:
            response.statusText,
          headers:
            responseHeaders,
          content_type:
            contentType,
          body:
            parsedBody,
          raw_body:
            responseContent.text,
          response_bytes:
            responseContent.bytes,
          redirected:
            finalUrl.toString() !==
            url.toString(),
        },
        error:
          `HTTP request failed with status ${response.status} ${response.statusText}.`,
        errorCode:
          `HTTP_${response.status}`,
      };
    }

    return {
      success: true,
      output: {
        url: url.toString(),
        final_url:
          finalUrl.toString(),
        method,
        status:
          response.status,
        status_text:
          response.statusText,
        headers:
          responseHeaders,
        content_type:
          contentType,
        body:
          parsedBody,
        raw_body:
          responseContent.text,
        response_bytes:
          responseContent.bytes,
        redirected:
          finalUrl.toString() !==
          url.toString(),
      },
    };
  } catch (error) {
    console.error(
      "HTTP request tool error:",
      error
    );

    const message =
      error instanceof Error
        ? error.message
        : "Unable to complete HTTP request.";

    let errorCode =
      "HTTP_REQUEST_FAILED";

    if (
      message.includes(
        "private or internal"
      ) ||
      message.includes(
        "localhost"
      ) ||
      message.includes(
        "metadata host"
      )
    ) {
      errorCode =
        "HTTP_SSRF_BLOCKED";
    } else if (
      message.includes(
        "timed out"
      )
    ) {
      errorCode =
        "HTTP_TIMEOUT";
    } else if (
      message.includes(
        "response exceeded"
      )
    ) {
      errorCode =
        "HTTP_RESPONSE_TOO_LARGE";
    }

    return {
      success: false,
      error: message,
      errorCode,
    };
  }
}