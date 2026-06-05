import { z } from 'zod';
import { ActionSchema, type Workspace, type Example } from '@symphony/shared';
import { buildClassifierPrompt, type ClassifierTabIn } from './prompt.js';

const ResultRow = z.object({
  tabId: z.number().int(),
  action: ActionSchema,
  workspace: z.string().nullable(),
  confidence: z.number().min(0).max(1),
  reason: z.string(),
});
export type ClassifierRow = z.infer<typeof ResultRow>;

export interface LLM {
  call(args: { system: string; user: string; responseSchema: object }): Promise<string>;
}

export async function classifyTabs(
  input: { workspaces: Workspace[]; examples: Example[]; tabs: ClassifierTabIn[] },
  llm: LLM,
): Promise<ClassifierRow[]> {
  const prompt = buildClassifierPrompt(input);
  const tryOnce = async () => {
    const raw = await llm.call(prompt);
    return z.array(ResultRow).parse(JSON.parse(raw));
  };
  try { return await tryOnce(); }
  catch {
    try { return await tryOnce(); }
    catch {
      return input.tabs.map(t => ({ tabId: t.id, action: 'keep' as const, workspace: null, confidence: 0, reason: 'model output unparseable; defaulted to keep' }));
    }
  }
}
