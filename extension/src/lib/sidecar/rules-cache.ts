import { type Rule, RuleSchema } from '@symphony/shared';
import { z } from 'zod';

const KEY = '6th-symphony:rules';
const TIME_KEY = '6th-symphony:rules:refreshedAt';

export class RulesCache {
  constructor(private storage: typeof chrome.storage.local) {}

  async read(): Promise<Rule[]> {
    const got = await this.storage.get([KEY]);
    const raw = got[KEY];
    if (!raw) return [];
    const parsed = z.array(RuleSchema).safeParse(raw);
    return parsed.success ? parsed.data : [];
  }

  async write(rules: Rule[]): Promise<void> {
    await this.storage.set({ [KEY]: rules, [TIME_KEY]: new Date().toISOString() });
  }

  async refreshedAt(): Promise<Date | null> {
    const got = await this.storage.get([TIME_KEY]);
    const raw = got[TIME_KEY];
    return typeof raw === 'string' ? new Date(raw) : null;
  }
}
