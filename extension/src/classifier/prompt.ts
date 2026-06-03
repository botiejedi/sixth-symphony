import type { Workspace, Example } from '@symphony/shared';

export interface ClassifierTabIn {
  id: number;
  title?: string;
  url?: string;
}

export interface BuiltPrompt {
  system: string;
  user: string;
  responseSchema: object;
}

export function buildClassifierPrompt(args: {
  workspaces: Workspace[];
  examples: Example[];
  tabs: ClassifierTabIn[];
}): BuiltPrompt {
  const workspaceList = args.workspaces
    .map(w => `- ${w.id} ("${w.label}")`)
    .join('\n');

  const examplesBlock = args.examples.length
    ? `\n\nPast corrections (the user previously overrode the model — match their taste):\n${
        args.examples
          .map(e => `- ${e.url} → action=${e.userChoseAction}, workspace=${e.userChoseWorkspaceId ?? 'null'} (model had suggested ${e.modelSuggestedWorkspaceId ?? 'null'})`)
          .join('\n')
      }`
    : '';

  const system = [
    'You sort browser tabs into Vivaldi workspaces or mark them as junk to close.',
    'Available workspaces:',
    workspaceList,
    'Available actions: "move" (to a workspace), "close" (junk), "keep" (leave where it is).',
    'For each tab return tabId, action, workspace (workspace id or null), confidence 0..1, and a one-line reason.',
    'Be conservative with "close": only suggest it for tabs that are clearly trash.',
    examplesBlock,
  ].join('\n');

  const user = [
    'Classify these tabs. Respond as JSON matching the provided schema:',
    JSON.stringify(args.tabs, null, 2),
  ].join('\n');

  const responseSchema = {
    type: 'array',
    items: {
      type: 'object',
      required: ['tabId', 'action', 'confidence', 'reason'],
      properties: {
        tabId: { type: 'integer' },
        action: { type: 'string', enum: ['move', 'close', 'keep'] },
        workspace: { type: ['string', 'null'] },
        confidence: { type: 'number', minimum: 0, maximum: 1 },
        reason: { type: 'string' },
      },
    },
  };

  return { system, user, responseSchema };
}
