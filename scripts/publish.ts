#!/usr/bin/env bun
/**
 * Publish script — sync non-draft posts from vault to site
 *
 * Usage:
 *   bun run publish          # sync, commit, and push
 *   bun run publish --dry-run # show what would be done without executing
 */

import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, basename } from 'node:path';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

const VAULT_POSTS_PATH =
  '/Users/Dennis.Dyall/Documents/Sunthings_AppStorage_EU_e2e/Projects/Dyallo Blog/posts';
const SITE_POSTS_PATH = join(import.meta.dir, '../src/content/blog');

const isDryRun = process.argv.includes('--dry-run');

interface Frontmatter {
  draft?: boolean;
  slug?: string;
  [key: string]: any;
}

function parseFrontmatter(content: string): Frontmatter | null {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return null;

  const yaml = match[1];
  const obj: Frontmatter = {};

  for (const line of yaml.split('\n')) {
    const [key, ...valueParts] = line.split(':');
    if (!key) continue;
    const value = valueParts.join(':').trim();
    if (key === 'draft') {
      obj.draft = value === 'true';
    } else if (key === 'slug') {
      obj.slug = value.replace(/['"]/g, '');
    }
  }

  return obj;
}

async function main() {
  console.log(isDryRun ? '🔍 DRY RUN MODE\n' : '🚀 Publishing posts\n');

  // Read vault posts
  const vaultFiles = await readdir(VAULT_POSTS_PATH);
  const mdFiles = vaultFiles.filter((f) => f.endsWith('.md'));

  const nonDraftPosts: string[] = [];

  for (const file of mdFiles) {
    const content = await readFile(join(VAULT_POSTS_PATH, file), 'utf-8');
    const frontmatter = parseFrontmatter(content);

    if (!frontmatter) {
      console.log(`⚠️  ${file}: no frontmatter, skipping`);
      continue;
    }

    if (frontmatter.draft) {
      console.log(`📝 ${file}: draft=true, skipping`);
      continue;
    }

    if (!frontmatter.slug) {
      console.log(`⚠️  ${file}: no slug, skipping`);
      continue;
    }

    nonDraftPosts.push(file);

    if (isDryRun) {
      console.log(`✓  ${file} → ${frontmatter.slug}.md (would copy)`);
    } else {
      const destPath = join(SITE_POSTS_PATH, file);
      await writeFile(destPath, content, 'utf-8');
      console.log(`✓  ${file} → copied`);
    }
  }

  if (nonDraftPosts.length === 0) {
    console.log('\n⚠️  No non-draft posts found to publish.');
    return;
  }

  const slugs = nonDraftPosts.map((f) => basename(f, '.md')).join(', ');

  if (isDryRun) {
    console.log(`\n[DRY RUN] Would commit and push:`);
    console.log(`  git add src/content/blog`);
    console.log(`  git commit -m "publish: ${slugs}"`);
    console.log(`  git push`);
  } else {
    console.log('\n📦 Committing...');
    await execAsync('git add src/content/blog', { cwd: join(import.meta.dir, '..') });
    await execAsync(`git commit -m "publish: ${slugs}"`, { cwd: join(import.meta.dir, '..') });

    console.log('🚀 Pushing...');
    await execAsync('git push', { cwd: join(import.meta.dir, '..') });

    console.log('\n✅ Published successfully!');
  }
}

main().catch((err) => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
