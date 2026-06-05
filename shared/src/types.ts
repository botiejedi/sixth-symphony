import { z } from 'zod';

export const ActionSchema = z.enum(['move', 'close', 'keep']);
export type Action = z.infer<typeof ActionSchema>;

export const WorkspaceSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  vivaldiWorkspaceId: z.number(),
});
export type Workspace = z.infer<typeof WorkspaceSchema>;

const domainRegex = /^[a-z0-9.-]+\.[a-z]{2,}$/i;

export const RuleSchema = z.object({
  id: z.string().min(1),
  domain: z.string().regex(domainRegex, 'domain must be a bare host like "github.com"'),
  workspaceId: z.string().min(1),
  hitCount: z.number().int().nonnegative(),
  createdAt: z.string().datetime(),
});
export type Rule = z.infer<typeof RuleSchema>;

export const ExampleSchema = z.object({
  id: z.string().min(1),
  domain: z.string().min(1),
  title: z.string(),
  url: z.string().url(),
  modelSuggestedWorkspaceId: z.string().nullable(),
  userChoseWorkspaceId: z.string().nullable(),
  userChoseAction: ActionSchema,
  createdAt: z.string().datetime(),
});
export type Example = z.infer<typeof ExampleSchema>;
