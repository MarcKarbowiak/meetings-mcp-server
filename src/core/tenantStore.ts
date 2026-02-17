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

function toErrnoCode(error: unknown): string | undefined {
  if (error && typeof error === 'object' && 'code' in error) {
    const code = (error as { code?: unknown }).code;
    return typeof code === 'string' ? code : undefined;
  }
  return undefined;
}

export class TenantStore {
  constructor(private readonly tenantRootDir: string) {}

  async listTenants(): Promise<string[]> {
    const entries = await readdir(this.tenantRootDir, { withFileTypes: true });
    return entries.filter(e => e.isDirectory()).map(e => e.name).sort();
  }

  async readGuidance(tenantId: string): Promise<TenantGuidance> {
    const p = join(this.tenantRootDir, tenantId, 'guidance.md');
    let guidanceMarkdown: string;
    try {
      guidanceMarkdown = await readFile(p, 'utf8');
    } catch (error) {
      if (toErrnoCode(error) === 'ENOENT') {
        throw new Error(`Tenant guidance not found for tenantId "${tenantId}"`);
      }
      throw error;
    }
    return { tenantId, guidanceMarkdown };
  }

  async readSignals(tenantId: string): Promise<TenantSignals> {
    const p = join(this.tenantRootDir, tenantId, 'signals.json');
    let raw: string;
    try {
      raw = await readFile(p, 'utf8');
    } catch (error) {
      if (toErrnoCode(error) === 'ENOENT') {
        throw new Error(`Tenant signals not found for tenantId "${tenantId}"`);
      }
      throw error;
    }

    try {
      return { tenantId, signalsJson: JSON.parse(raw) };
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new Error(`Tenant signals JSON is invalid for tenantId "${tenantId}": ${reason}`);
    }
  }
}
