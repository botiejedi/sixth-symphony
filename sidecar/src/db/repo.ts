import { eq, desc, sql } from 'drizzle-orm';
import type { DB } from './client.js';
import { workspaces, rules, examples } from './schema.js';
import type { Workspace, Rule, Example } from '@symphony/shared';

// Workspaces -----------------------------------------------------------------
export function createWorkspace(db: DB, w: Workspace): void {
  db.insert(workspaces).values(w).run();
}
export function listWorkspaces(db: DB): Workspace[] {
  return db.select().from(workspaces).all();
}
export function getWorkspace(db: DB, id: string): Workspace | null {
  const row = db.select().from(workspaces).where(eq(workspaces.id, id)).get();
  return row ?? null;
}
export function updateWorkspace(db: DB, id: string, patch: Partial<Omit<Workspace, 'id'>>): void {
  db.update(workspaces).set(patch).where(eq(workspaces.id, id)).run();
}
export function deleteWorkspace(db: DB, id: string): void {
  db.delete(workspaces).where(eq(workspaces.id, id)).run();
}

// Rules ----------------------------------------------------------------------
export function createRule(db: DB, r: Rule): void {
  db.insert(rules).values(r).run();
}
export function listRules(db: DB): Rule[] {
  return db.select().from(rules).all();
}
export function getRule(db: DB, id: string): Rule | null {
  const row = db.select().from(rules).where(eq(rules.id, id)).get();
  return row ?? null;
}
export function getRuleByDomain(db: DB, domain: string): Rule | null {
  const row = db.select().from(rules).where(eq(rules.domain, domain)).get();
  return row ?? null;
}
export function updateRule(db: DB, id: string, patch: Partial<Omit<Rule, 'id'>>): void {
  db.update(rules).set(patch).where(eq(rules.id, id)).run();
}
export function deleteRule(db: DB, id: string): void {
  db.delete(rules).where(eq(rules.id, id)).run();
}
export function incrementRuleHitCount(db: DB, domain: string): void {
  db.update(rules).set({ hitCount: sql`${rules.hitCount} + 1` }).where(eq(rules.domain, domain)).run();
}

// Examples -------------------------------------------------------------------
export function createExample(db: DB, e: Example): void {
  db.insert(examples).values(e).run();
}
export function listExamples(db: DB): Example[] {
  return db.select().from(examples).all();
}
export function getExample(db: DB, id: string): Example | null {
  const row = db.select().from(examples).where(eq(examples.id, id)).get();
  return row ?? null;
}
export function deleteExample(db: DB, id: string): void {
  db.delete(examples).where(eq(examples.id, id)).run();
}
export function listRecentExamples(db: DB, n: number): Example[] {
  return db.select().from(examples).orderBy(desc(examples.createdAt)).limit(n).all();
}
export function listExamplesByDomain(db: DB, domain: string, n: number): Example[] {
  return db.select().from(examples).where(eq(examples.domain, domain)).orderBy(desc(examples.createdAt)).limit(n).all();
}
