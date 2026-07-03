#!/usr/bin/env bun
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  FileToolError,
  applyFileToolProposal,
  findVaultFiles,
  proposeCreate,
  proposeCreateAndLink,
  proposeMove,
  proposeReplace,
  readVaultFile,
  type FileToolProposal,
} from './vault-dashboard-file-tools';

const ROOT = process.cwd();
const DEFAULT_VAULT = process.env.VAULT_DASHBOARD_VAULT || `${process.env.HOME}/Documents/Sunthings_AppStorage_EU_e2e`;

function usage() {
  return [
    'Usage:',
    '  bun scripts/vault-dashboard-harness.ts find <query> [--vault <path>] [--limit <n>]',
    '  bun scripts/vault-dashboard-harness.ts read <path> [--vault <path>]',
    '  bun scripts/vault-dashboard-harness.ts create <path> <content> [--vault <path>]',
    '  bun scripts/vault-dashboard-harness.ts create-and-link <create-path> <content> <target-path> <find> <replace> [--vault <path>]',
    '  bun scripts/vault-dashboard-harness.ts replace <path> <find> <replace> [--vault <path>]',
    '  bun scripts/vault-dashboard-harness.ts move <from> <to> [--vault <path>]',
    '  bun scripts/vault-dashboard-harness.ts apply <proposal-json-file> [--vault <path>]',
  ].join('\n');
}

function option(name: string, fallback?: string) {
  const index = process.argv.indexOf(name);
  return index === -1 ? fallback : process.argv[index + 1];
}

function positional() {
  const args = process.argv.slice(2);
  const result: string[] = [];
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg.startsWith('--')) {
      index += 1;
      continue;
    }
    result.push(arg);
  }
  return result;
}

function print(data: unknown) {
  console.log(JSON.stringify(data, null, 2));
}

function positiveIntegerOption(name: string, fallback: number) {
  const parsed = Number(option(name, String(fallback)));
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

async function main() {
  const [command, ...args] = positional();
  const vaultDir = option('--vault', DEFAULT_VAULT) || DEFAULT_VAULT;
  const limit = positiveIntegerOption('--limit', 25);

  if (!command) throw new FileToolError(400, usage());

  if (command === 'find') {
    const query = args.join(' ');
    print({ results: await findVaultFiles(vaultDir, query, limit) });
    return;
  }

  if (command === 'read') {
    print(await readVaultFile(vaultDir, args[0] || ''));
    return;
  }

  if (command === 'replace') {
    print(await proposeReplace(vaultDir, args[0] || '', args[1] || '', args[2] || ''));
    return;
  }

  if (command === 'create') {
    print(await proposeCreate(vaultDir, args[0] || '', args[1] || ''));
    return;
  }

  if (command === 'create-and-link') {
    print(await proposeCreateAndLink(vaultDir, args[0] || '', args[1] || '', args[2] || '', args[3] || '', args[4] || ''));
    return;
  }

  if (command === 'move') {
    print(await proposeMove(vaultDir, args[0] || '', args[1] || ''));
    return;
  }

  if (command === 'apply') {
    const proposalPath = args[0] ? join(ROOT, args[0]) : '';
    const proposal = JSON.parse(await readFile(proposalPath, 'utf8')) as FileToolProposal;
    print(await applyFileToolProposal(vaultDir, proposal));
    return;
  }

  throw new FileToolError(400, usage());
}

main().catch((error) => {
  if (error instanceof FileToolError) {
    print({ error: error.message, status: error.status });
    process.exit(error.status >= 500 ? 1 : 2);
  }
  print({ error: error instanceof Error ? error.message : String(error), status: 500 });
  process.exit(1);
});
