import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

export type TenantGuidance = {
  tenantId: string;
  guidanceMarkdown: string;
};

export type TenantSignals = {
  tenantId: string;
  signalsJson: unknown;
};

export class TenantStore {
  constructor(private readonly tenantRootDir: string) {}

  async listTenants(): Promise<string[]> {
    const entries = await readdir(this.tenantRootDir, { withFileTypes: true });
    return entries.filter(e => e.isDirectory()).map(e => e.name).sort();
  }

  async readGuidance(tenantId: string): Promise<TenantGuidance> {
    const p = join(this.tenantRootDir, tenantId, 'guidance.md');
    const guidanceMarkdown = await readFile(p, 'utf8');
    return { tenantId, guidanceMarkdown };
  }

  async readSignals(tenantId: string): Promise<TenantSignals> {
    const p = join(this.tenantRootDir, tenantId, 'signals.json');
    const raw = await readFile(p, 'utf8');
    return { tenantId, signalsJson: JSON.parse(raw) };
  }
}
