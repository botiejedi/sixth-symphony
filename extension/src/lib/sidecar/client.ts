import { RuleSchema, ExampleSchema, WorkspaceSchema, type Rule, type Example, type Workspace } from '@symphony/shared';
import { z } from 'zod';

export class SidecarUnreachable extends Error {
  // eslint-disable-next-line @typescript-eslint/class-literal-property-style
  readonly cause: unknown;
  constructor(causeErr?: unknown) {
    super('sidecar unreachable');
    this.cause = causeErr;
  }
}

export class SidecarClient {
  constructor(private baseUrl: string, private token?: string) {}

  private async fetchJson<T>(path: string, init: RequestInit, schema: z.ZodType<T>): Promise<T> {
    const headers: Record<string, string> = { 'content-type': 'application/json', ...(init.headers as Record<string, string> | undefined) };
    if (this.token) headers.authorization = `Bearer ${this.token}`;
    const url = `${this.baseUrl}${path}`;
    const attempt = async () => {
      const res = await fetch(url, { ...init, headers });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return schema.parse(await res.json());
    };
    try {
      return await attempt();
    } catch (e) {
      try { return await attempt(); }
      catch (retryErr) { throw new SidecarUnreachable(retryErr); }
    }
  }

  listRules() { return this.fetchJson('/v1/rules', {}, z.array(RuleSchema)); }
  createRule(r: Rule) { return this.fetchJson('/v1/rules', { method: 'POST', body: JSON.stringify(r) }, RuleSchema); }
  incrementRule(domain: string) { return this.fetchJson(`/v1/rules/${encodeURIComponent(domain)}/increment`, { method: 'POST' }, RuleSchema); }

  listWorkspaces() { return this.fetchJson('/v1/workspaces', {}, z.array(WorkspaceSchema)); }
  createWorkspace(w: Workspace) { return this.fetchJson('/v1/workspaces', { method: 'POST', body: JSON.stringify(w) }, WorkspaceSchema); }

  createExample(e: Example) { return this.fetchJson('/v1/examples', { method: 'POST', body: JSON.stringify(e) }, ExampleSchema); }
  listExamplesHybrid(args: { recent: number; domains: string[] }) {
    const qs = new URLSearchParams({ recent: String(args.recent), domains: args.domains.join(',') });
    return this.fetchJson(`/v1/examples?${qs}`, {}, z.array(ExampleSchema));
  }
}
