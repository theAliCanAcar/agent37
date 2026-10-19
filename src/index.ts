/**
 * agent37: thin client over the Agent 37 Cloud API.
 *
 * Agent 37 already provides persistent isolated sandboxes, per-instance URLs,
 * files/memory, scheduled runs, shell access, logs, and metrics.
 * This package only wraps the HTTP surface — it recreates none of that infra.
 *
 * Instance creation goes through POST /v1/instances; each instance gets its
 * own isolated environment and URL.
 */

export type CreateInstanceOptions = {
  /** Free-form instruction given to the sandbox agent on boot. */
  prompt?: string;
  /** Image/template hint, e.g. "base", "browser". */
  template?: string;
  /** Arbitrary labels for later lookup. */
  metadata?: Record<string, unknown>;
};

export type Agent37Instance = {
  id: string;
  status: string;
  url?: string;

  message(input: string): Promise<unknown>;
  files: {
    list(): Promise<unknown[]>;
    read(path: string): Promise<string>;
    write(path: string, content: string): Promise<void>;
  };
  shell(command: string): Promise<unknown>;
};

export type Agent37Client = {
  create(options: CreateInstanceOptions): Promise<Agent37Instance>;
  get(id: string): Promise<Agent37Instance>;
  list(): Promise<Agent37Instance[]>;
  destroy(id: string): Promise<void>;
};

export type Agent37Config = {
  apiKey?: string;
  baseUrl?: string;
  /** Injected fetch for tests. Defaults to global fetch. */
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
};

const DEFAULT_BASE_URL = "https://api.agent37.cloud";

export function createAgent37(config: Agent37Config = {}): Agent37Client {
  const apiKey = config.apiKey ?? process.env.AGENT37_API_KEY ?? "";
  const baseUrl = (config.baseUrl ?? process.env.AGENT37_BASE_URL ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
  const doFetch = config.fetchImpl ?? globalThis.fetch.bind(globalThis);

  async function request<T>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<T> {
    const res = await doFetch(`${baseUrl}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      ...(config.timeoutMs ? { signal: AbortSignal.timeout(config.timeoutMs) } : {}),
    });
    const text = await res.text();
    let parsed: unknown = null;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      parsed = text;
    }
    if (!res.ok) {
      throw new Error(`Agent 37 ${method} ${path} -> HTTP ${res.status}: ${text.slice(0, 300)}`);
    }
    return parsed as T;
  }

  function wrap(raw: Record<string, unknown>): Agent37Instance {
    const id = String(raw.id ?? "");
    return {
      id,
      status: String(raw.status ?? "unknown"),
      ...(raw.url ? { url: String(raw.url) } : {}),
      async message(input: string) {
        return request("POST", `/v1/instances/${id}/messages`, { input });
      },
      files: {
        async list() {
          const res = await request<{ files?: unknown[] }>("GET", `/v1/instances/${id}/files`);
          return res.files ?? (res as unknown as unknown[]);
        },
        async read(path: string) {
          const res = await request<{ content?: string }>(
            "GET",
            `/v1/instances/${id}/files?path=${encodeURIComponent(path)}`
          );
          return res.content ?? String(res);
        },
        async write(path: string, content: string) {
          await request("POST", `/v1/instances/${id}/files`, { path, content });
        },
      },
      async shell(command: string) {
        return request("POST", `/v1/instances/${id}/shell`, { command });
      },
    };
  }

  return {
    async create(options: CreateInstanceOptions) {
      const raw = await request<Record<string, unknown>>("POST", "/v1/instances", options);
      return wrap(raw);
    },
    async get(id: string) {
      const raw = await request<Record<string, unknown>>("GET", `/v1/instances/${id}`);
      return wrap(raw);
    },
    async list() {
      const res = await request<{ instances?: Array<Record<string, unknown>> }>("GET", "/v1/instances");
      const rows = res.instances ?? (Array.isArray(res) ? (res as Array<Record<string, unknown>>) : []);
      return rows.map(wrap);
    },
    async destroy(id: string) {
      await request("DELETE", `/v1/instances/${id}`);
    },
  };
}