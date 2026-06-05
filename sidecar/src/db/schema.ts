import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const workspaces = sqliteTable('workspaces', {
  id: text('id').primaryKey(),
  label: text('label').notNull(),
  vivaldiWorkspaceId: integer('vivaldi_workspace_id').notNull(),
});

export const rules = sqliteTable('rules', {
  id: text('id').primaryKey(),
  domain: text('domain').notNull().unique(),
  workspaceId: text('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  hitCount: integer('hit_count').notNull().default(0),
  createdAt: text('created_at').notNull(),
});

export const examples = sqliteTable('examples', {
  id: text('id').primaryKey(),
  domain: text('domain').notNull(),
  title: text('title').notNull(),
  url: text('url').notNull(),
  modelSuggestedWorkspaceId: text('model_suggested_workspace_id'),
  userChoseWorkspaceId: text('user_chose_workspace_id'),
  userChoseAction: text('user_chose_action').notNull(),
  createdAt: text('created_at').notNull(),
});
