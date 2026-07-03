import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
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
  const outsideDir = join(tempRoot, 'outside');

  try {
    await mkdir(join(vaultDir, 'Knowledge'), { recursive: true });
    await mkdir(join(vaultDir, 'Projects'), { recursive: true });
    await mkdir(join(vaultDir, 'Sources'), { recursive: true });
    await mkdir(outsideDir, { recursive: true });
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

    const create = await proposeCreate(vaultDir, 'Knowledge/New Note.md', '# New Note\n\nCreated body.\n');
    if (!create.diff.includes('+++ b/Knowledge/New Note.md') || !create.diff.includes('+Created body.')) throw new Error('create diff missing expected body');
    if (await Bun.file(join(vaultDir, 'Knowledge/New Note.md')).exists()) throw new Error('create mutated before apply');
    const appliedCreate = await applyFileToolProposal(vaultDir, create);
    if (!appliedCreate.changedFiles.includes('Knowledge/New Note.md')) throw new Error('create apply did not report created file');
    if (!(await readFile(join(vaultDir, 'Knowledge/New Note.md'), 'utf8')).includes('Created body.')) throw new Error('create did not write note');

    await expectError(409, () => proposeCreate(vaultDir, 'Knowledge/New Note.md', '# Duplicate\n'));
    await expectError(403, () => proposeCreate(vaultDir, 'Sources/New.md', '# Source\n'));
    await expectError(403, () => proposeCreate(vaultDir, '../outside.md', '# Escape\n'));

    const inboxCreate = await proposeCreate(vaultDir, 'Inbox/Loose Note.md', '# Loose Note\n');
    await applyFileToolProposal(vaultDir, inboxCreate);
    if (!(await readFile(join(vaultDir, 'Inbox/Loose Note.md'), 'utf8')).includes('Loose Note')) throw new Error('create did not allow missing Inbox parent under vault root');

    const danglingCreatePath = join(vaultDir, 'Knowledge/Dangling Create.md');
    await symlink(join(outsideDir, 'Missing Create.md'), danglingCreatePath);
    await expectError(409, () => proposeCreate(vaultDir, 'Knowledge/Dangling Create.md', '# Should Not Create\n'));
    await rm(danglingCreatePath, { force: true });

    const staleCreate = await proposeCreate(vaultDir, 'Knowledge/Dangling Apply.md', '# Should Not Apply\n');
    const danglingApplyPath = join(vaultDir, 'Knowledge/Dangling Apply.md');
    await symlink(join(outsideDir, 'Missing Apply.md'), danglingApplyPath);
    await expectError(409, () => applyFileToolProposal(vaultDir, staleCreate));
    await rm(danglingApplyPath, { force: true });

    await writeFile(join(outsideDir, 'Outside.md'), '# Outside\n', 'utf8');
    await symlink(join(outsideDir, 'Outside.md'), join(vaultDir, 'Knowledge/Linked Outside.md'));
    await expectError(403, () => readVaultFile(vaultDir, 'Knowledge/Linked Outside.md'));
    await expectError(403, () => proposeReplace(vaultDir, 'Knowledge/Linked Outside.md', 'Outside', 'Mutated'));

    await symlink(outsideDir, join(vaultDir, 'Knowledge/Escape'));
    await expectError(403, () => proposeCreate(vaultDir, 'Knowledge/Escape/Escaped.md', '# Escaped\n'));

    await writeFile(notePath, '# Test Note\n\nLink this passage.\n', 'utf8');
    const danglingLinkPath = join(vaultDir, 'Knowledge/Dangling Link.md');
    await symlink(join(outsideDir, 'Missing Link.md'), danglingLinkPath);
    await expectError(409, () => proposeCreateAndLink(
      vaultDir,
      'Knowledge/Dangling Link.md',
      '# Should Not Link\n',
      'Knowledge/Test Note.md',
      'Link this passage.',
      '[[Knowledge/Dangling Link|Dangling Link]]',
    ));
    await rm(danglingLinkPath, { force: true });

    const staleComposite = await proposeCreateAndLink(
      vaultDir,
      'Knowledge/Dangling Link Apply.md',
      '# Should Not Link Apply\n',
      'Knowledge/Test Note.md',
      'Link this passage.',
      '[[Knowledge/Dangling Link Apply|Dangling Link Apply]]',
    );
    const danglingLinkApplyPath = join(vaultDir, 'Knowledge/Dangling Link Apply.md');
    await symlink(join(outsideDir, 'Missing Link Apply.md'), danglingLinkApplyPath);
    await expectError(409, () => applyFileToolProposal(vaultDir, staleComposite));
    await rm(danglingLinkApplyPath, { force: true });

    await writeFile(notePath, '# Test Note\n\nExtract this passage.\n', 'utf8');
    const composite = await proposeCreateAndLink(
      vaultDir,
      'Knowledge/Extracted Passage.md',
      '# Extracted Passage\n\nExtract this passage.\n',
      'Knowledge/Test Note.md',
      'Extract this passage.',
      '[[Knowledge/Extracted Passage|Extracted Passage]]',
    );
    if (!composite.diff.includes('+++ b/Knowledge/Extracted Passage.md') || !composite.diff.includes('+[[Knowledge/Extracted Passage|Extracted Passage]]')) {
      throw new Error('create-and-link diff missing create or link');
    }
    const appliedComposite = await applyFileToolProposal(vaultDir, composite);
    if (!appliedComposite.changedFiles.includes('Knowledge/Extracted Passage.md') || !appliedComposite.changedFiles.includes('Knowledge/Test Note.md')) {
      throw new Error('create-and-link apply did not report both files');
    }
    if (!(await readFile(notePath, 'utf8')).includes('[[Knowledge/Extracted Passage|Extracted Passage]]')) throw new Error('create-and-link did not update source note');
    if (!(await readFile(join(vaultDir, 'Knowledge/Extracted Passage.md'), 'utf8')).includes('Extract this passage.')) throw new Error('create-and-link did not create note');

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
