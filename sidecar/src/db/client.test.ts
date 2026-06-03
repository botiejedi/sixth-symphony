import { describe, it, expect } from 'vitest';
import { openDb, runMigrations } from './client.js';
import { workspaces, rules, examples } from './schema.js';

describe('openDb', () => {
  it('opens a DB and applies migrations', () => {
    const { db, close } = openDb(':memory:');
    runMigrations(db);
    expect(db.select().from(workspaces).all()).toEqual([]);
    expect(db.select().from(rules).all()).toEqual([]);
    expect(db.select().from(examples).all()).toEqual([]);
    close();
  });
});
