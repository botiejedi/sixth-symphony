import { buildPlan, type Plan } from './orchestrator.js';
import { SidecarClient } from '../lib/sidecar/client.js';
import { RulesCache } from '../lib/sidecar/rules-cache.js';
import type { LLM } from '../classifier/classify.js';
import { getLLMConfig } from '@/lib/chrome/storage';
import { OpenAICompatibleProvider } from '@/lib/llm/openai-compatible';

const SIDECAR_URL = 'http://127.0.0.1:8765';

const llm: LLM = {
  async call({ system, user }) {
    const config = await getLLMConfig();
    if (!config) throw new Error('LLM not configured');
    const provider = new OpenAICompatibleProvider(config);
    const res = await provider.complete({
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    });
    return res.content;
  },
};

export function buildPlanFromBackground(): Promise<Plan> {
  return buildPlan({
    getTabs: () => chrome.tabs.query({ currentWindow: true }),
    sidecar: new SidecarClient(SIDECAR_URL),
    rulesCache: new RulesCache(chrome.storage.local),
    llm,
  });
}
