import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  FileToolError,
  applyFileToolProposal,
  findVaultFiles,
  proposeMove,
  proposeReplace,
  readVaultFile,
} from './vault-dashboard-file-tools';

async function expectError(status: number, run: () => Promise<unknown>) {
  try {
    await run();
  } catch (error) {
    if (error instanceof FileToolError && error.status === status) return;
    throw error;
  }
  throw new Error(`expected FileToolError ${status}`);
}

async function main() {
  const tempRoot = await mkdtemp(join(tmpdir(), 'vault-harness-test-'));
  const vaultDir = join(tempRoot, 'vault');
  const notePath = join(vaultDir, 'Knowledge/Test Note.md');
  const moveSourcePath = join(vaultDir, 'Projects/Move Me.md');
  const sourcePath = join(vaultDir, 'Sources/Raw.md');

  try {
    await mkdir(join(vaultDir, 'Knowledge'), { recursive: true });
    await mkdir(join(vaultDir, 'Projects'), { recursive: true });
    await mkdir(join(vaultDir, 'Sources'), { recursive: true });
    await writeFile(notePath, '# Test Note\n\nOriginal body.\n', 'utf8');
    await writeFile(moveSourcePath, '# Move Me\n\nMove body.\n', 'utf8');
    await writeFile(sourcePath, '# Raw\n\nImmutable.\n', 'utf8');

    const found = await findVaultFiles(vaultDir, 'test note');
    if (!found.some((item) => item.path === 'Knowledge/Test Note.md')) throw new Error('find did not return test note');

    const read = await readVaultFile(vaultDir, 'Knowledge/Test Note.md');
    if (!read.content.includes('Original body') || !read.hash) throw new Error('read did not return content/hash');

    const replace = await proposeReplace(vaultDir, 'Knowledge/Test Note.md', 'Original body', 'Changed body');
    if (!replace.diff.includes('-Original body') || !replace.diff.includes('+Changed body')) throw new Error('replace diff missing expected lines');
    if ((await readFile(notePath, 'utf8')).includes('Changed body')) throw new Error('replace mutated before apply');

    const appliedReplace = await applyFileToolProposal(vaultDir, replace);
    if (appliedReplace.renderState !== 'stale') throw new Error('replace apply did not report stale render');
    if (!(await readFile(notePath, 'utf8')).includes('Changed body')) throw new Error('replace did not mutate after apply');

    const literalDollar = await proposeReplace(vaultDir, 'Knowledge/Test Note.md', 'Changed body', 'Literal $& replacement');
    await applyFileToolProposal(vaultDir, literalDollar);
    const dollarContent = await readFile(notePath, 'utf8');
    if (!dollarContent.includes('Literal $& replacement')) throw new Error('replace did not preserve literal dollar replacement');
    if (dollarContent.includes('Literal Changed body replacement')) throw new Error('replace interpreted dollar replacement tokens');

    await writeFile(notePath, '# Test Note\n\nRepeat me. Repeat me.\n', 'utf8');
    await expectError(409, () => proposeReplace(vaultDir, 'Knowledge/Test Note.md', 'Repeat me', 'Once'));

    await writeFile(notePath, '# Test Note\n\nLiteral $& replacement.\n', 'utf8');
    const drift = await proposeReplace(vaultDir, 'Knowledge/Test Note.md', 'Literal $& replacement', 'Drift body');
    await writeFile(notePath, `${await readFile(notePath, 'utf8')}External edit.\n`, 'utf8');
    await expectError(409, () => applyFileToolProposal(vaultDir, drift));

    const move = await proposeMove(vaultDir, 'Projects/Move Me.md', 'Archive/Move Me.md');
    if (!move.diff.includes('rename from Projects/Move Me.md')) throw new Error('move diff missing rename');
    if (!(await readFile(moveSourcePath, 'utf8')).includes('Move body')) throw new Error('move mutated before apply');
    const appliedMove = await applyFileToolProposal(vaultDir, move);
    if (!appliedMove.changedFiles.includes('Archive/Move Me.md')) throw new Error('move apply did not report destination');
    if (!(await readFile(join(vaultDir, 'Archive/Move Me.md'), 'utf8')).includes('Move body')) throw new Error('move destination missing content');

    await expectError(403, () => proposeReplace(vaultDir, 'Sources/Raw.md', 'Immutable', 'Mutated'));
    await expectError(403, () => proposeMove(vaultDir, 'Sources/Raw.md', 'Knowledge/Raw.md'));
    await expectError(403, () => proposeMove(vaultDir, 'Knowledge/Test Note.md', 'Sources/Test Note.md'));
    await expectError(403, () => proposeMove(vaultDir, 'Knowledge/Test Note.md', '../outside.md'));
    await expectError(403, () => findVaultFiles(vaultDir, '../outside'));
    await expectError(403, () => readVaultFile(vaultDir, '../outside.md'));

    console.log('Vault dashboard file-tool harness temp-vault probes passed.');
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
