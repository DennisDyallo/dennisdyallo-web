import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

type AgentProcess = ReturnType<typeof Bun.spawn>;

const PORT = 33104;
const BASE_URL = `http://127.0.0.1:${PORT}`;

async function request(path: string, body: Record<string, unknown>, status = 200) {
  const response = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'https://vault.dyallo.se' },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (response.status !== status) {
    throw new Error(`${path} ${JSON.stringify(body)} expected ${status}, got ${response.status}: ${JSON.stringify(data)}`);
  }
  return data as Record<string, any>;
}

async function waitForHealth(process: AgentProcess) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(`${BASE_URL}/health`);
      if (response.ok) return;
    } catch {
      // Service may not have bound the port yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  const exitCode = await Promise.race([process.exited, new Promise((resolve) => setTimeout(() => resolve(null), 0))]);
  if (exitCode !== null) throw new Error(`vault-dashboard-agent exited before becoming healthy: ${exitCode}`);
  throw new Error('vault-dashboard-agent did not become healthy');
}

async function main() {
  const tempRoot = await mkdtemp(join(tmpdir(), 'vault-agent-test-'));
  const vaultDir = join(tempRoot, 'vault');
  const dataPath = join(tempRoot, 'vault-dashboard.json');
  const inferencePath = join(tempRoot, 'mock-inference.ts');
  const knowledgePath = join(vaultDir, 'Knowledge/Test Note.md');
  const deployNotesPath = join(vaultDir, 'Knowledge/deploy notes.md');
  const movePath = join(vaultDir, 'Projects/Move Me.md');
  const moveToPath = join(vaultDir, 'Projects/How to Cook.md');
  const naturalMovePath = join(vaultDir, 'Projects/Natural Move.md');
  const sourcePath = join(vaultDir, 'sources/Source Note.md');
  const outsideDir = join(tempRoot, 'outside');
  let agent: AgentProcess | null = null;

  try {
    await mkdir(join(vaultDir, 'Knowledge'), { recursive: true });
    await mkdir(join(vaultDir, 'Projects'), { recursive: true });
    await mkdir(join(vaultDir, 'sources'), { recursive: true });
    await mkdir(outsideDir, { recursive: true });
    await writeFile(knowledgePath, '# Test Note\n\nOriginal body.\n', 'utf8');
    await writeFile(deployNotesPath, '# Deploy Notes\n\nDeployment checklist.\n', 'utf8');
    await writeFile(movePath, '# Move Me\n\nMove body.\n', 'utf8');
    await writeFile(moveToPath, '# How to Cook\n\nMove body with to in filename.\n', 'utf8');
    await writeFile(naturalMovePath, '# Natural Move\n\nMove me naturally.\n', 'utf8');
    await writeFile(sourcePath, '# Source Note\n\nImmutable body.\n', 'utf8');
    await writeFile(join(outsideDir, 'Outside.md'), '# Outside\n\nEscaped body.\n', 'utf8');
    await symlink(join(outsideDir, 'Outside.md'), join(vaultDir, 'Knowledge/Linked Outside.md'));
    await writeFile(
      inferencePath,
      `export async function callInference(_system, user) {\n  const nonce = user.match(/NONCE_[a-z0-9-]+/)?.[0];\n  return nonce ? \`MOCK_LLM_\${nonce}\` : 'MOCK_LLM_REPLY';\n}\n`,
      'utf8',
    );
    await writeFile(
      dataPath,
      `${JSON.stringify({
        items: [
          { id: 'knowledge-test-note', title: 'Test Note', subtitle: 'Knowledge fixture', path: 'Knowledge/Test Note.md', excerpt: 'Original body.' },
          { id: 'project-natural-move', title: 'Natural Move', subtitle: 'Project fixture', path: 'Projects/Natural Move.md', excerpt: 'Move me naturally.' },
          { id: 'source-test-note', title: 'Source Note', subtitle: 'Source fixture', path: 'sources/Source Note.md', excerpt: 'Immutable body.' },
          { id: 'symlink-test-note', title: 'Linked Outside', subtitle: 'Symlink fixture', path: 'Knowledge/Linked Outside.md', excerpt: 'Escaped body.' },
        ],
      })}\n`,
      'utf8',
    );

    agent = Bun.spawn(['bun', 'scripts/vault-dashboard-agent.ts'], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        VAULT_DASHBOARD_AGENT_PORT: String(PORT),
        VAULT_DASHBOARD_AGENT_HOST: '127.0.0.1',
        VAULT_DASHBOARD_VAULT: vaultDir,
        VAULT_DASHBOARD_DATA_PATH: dataPath,
        VAULT_DASHBOARD_INFERENCE_MODULE: inferencePath,
      },
      stdout: 'pipe',
      stderr: 'pipe',
    });
    await waitForHealth(agent);

    await request('/dashboard/agent/context', { itemId: 'knowledge-test-note' });

    const nonce = `NONCE_${randomUUID()}`;
    const llm = await request('/dashboard/agent/chat', {
      itemId: 'knowledge-test-note',
      message: `Reply with this nonce if live inference is active: ${nonce}`,
    });
    if (llm.reply !== `MOCK_LLM_${nonce}`) throw new Error(`read-only chat did not use inference: ${llm.reply}`);

    const found = await request('/dashboard/agent/chat', { message: 'find: Test Note' });
    if (!found.results?.some((item: any) => item.path === 'Knowledge/Test Note.md')) throw new Error('explicit find did not return fixture');
    const deployFound = await request('/dashboard/agent/chat', { message: 'find: deploy notes' });
    if (!deployFound.results?.some((item: any) => item.path === 'Knowledge/deploy notes.md')) {
      throw new Error('explicit find was blocked by deploy keyword gate');
    }

    const read = await request('/dashboard/agent/chat', { message: 'read: Knowledge/Test Note.md' });
    if (!read.file?.hash || !String(read.reply).includes('Original body')) throw new Error('explicit read did not return content/hash');

    const replace = await request('/dashboard/agent/chat', { message: 'replace in Knowledge/Test Note.md: Original body => Changed body' });
    if (!replace.proposal?.id || !String(replace.proposal.diff || '').includes('+Changed body')) throw new Error('explicit replace proposal missing diff');
    if ((await readFile(knowledgePath, 'utf8')).includes('Changed body')) throw new Error('explicit replace mutated before apply');
    const appliedReplace = await request('/dashboard/agent/apply', { proposalId: replace.proposal.id });
    if (!appliedReplace.changedFiles?.includes('Knowledge/Test Note.md')) throw new Error('explicit replace apply did not report changed file');
    if (!(await readFile(knowledgePath, 'utf8')).includes('Changed body')) throw new Error('explicit replace did not mutate after apply');

    const literalDollar = await request('/dashboard/agent/chat', { message: 'replace in Knowledge/Test Note.md: Changed body => Literal $& replacement' });
    if (!literalDollar.proposal?.id || !String(literalDollar.proposal.diff || '').includes('+Literal $& replacement')) {
      throw new Error('explicit replace dollar proposal missing literal diff');
    }
    await request('/dashboard/agent/apply', { proposalId: literalDollar.proposal.id });
    const dollarContent = await readFile(knowledgePath, 'utf8');
    if (!dollarContent.includes('Literal $& replacement')) throw new Error('explicit replace did not preserve literal dollar replacement');
    if (dollarContent.includes('Literal Changed body replacement')) throw new Error('explicit replace interpreted dollar replacement tokens');

    const naturalReplace = await request('/dashboard/agent/chat', {
      itemId: 'knowledge-test-note',
      selection: 'Literal $& replacement',
      message: 'replace selected text with Natural replacement',
    });
    if (!naturalReplace.proposal?.id || !String(naturalReplace.proposal.diff || '').includes('+Natural replacement')) throw new Error('natural replace proposal missing diff');
    if ((await readFile(knowledgePath, 'utf8')).includes('Natural replacement')) throw new Error('natural replace mutated before approval');
    const naturalApply = await request('/dashboard/agent/chat', { itemId: 'knowledge-test-note', message: 'yes apply it' });
    if (!naturalApply.changedFiles?.includes('Knowledge/Test Note.md')) throw new Error('natural approval did not apply latest proposal');
    if (!(await readFile(knowledgePath, 'utf8')).includes('Natural replacement')) throw new Error('natural replace did not mutate after approval');

    const naturalMove = await request('/dashboard/agent/chat', { itemId: 'project-natural-move', message: 'rename this note to Natural Renamed' });
    if (!naturalMove.proposal?.id || !String(naturalMove.proposal.diff || '').includes('rename to Projects/Natural Renamed.md')) {
      throw new Error('natural rename proposal missing diff');
    }
    await request('/dashboard/agent/chat', { itemId: 'knowledge-test-note', message: 'yes' }, 404);
    if (!(await readFile(naturalMovePath, 'utf8')).includes('Move me naturally.')) throw new Error('cross-item approval applied an unrelated proposal');
    await request('/dashboard/agent/chat', { message: 'yes' }, 400);
    await request('/dashboard/agent/chat', { itemId: 'project-natural-move', message: 'looks good' });
    if (!(await readFile(join(vaultDir, 'Projects/Natural Renamed.md'), 'utf8')).includes('Move me naturally.')) throw new Error('natural rename did not move file');

    const create = await request('/dashboard/agent/chat', {
      itemId: 'knowledge-test-note',
      message: 'create a Knowledge note called Natural Created with a durable synthetic idea',
    });
    if (!create.proposal?.id || !String(create.proposal.diff || '').includes('## Open Question')) throw new Error('natural create did not use Knowledge template');
    await request('/dashboard/agent/chat', { itemId: 'knowledge-test-note', message: 'apply it' });
    if (!(await readFile(join(vaultDir, 'Knowledge/Natural Created.md'), 'utf8')).includes('durable synthetic idea')) throw new Error('natural create did not write note');

    const projectCreate = await request('/dashboard/agent/chat', {
      itemId: 'knowledge-test-note',
      message: 'make a new project note for Project Alpha',
    });
    if (!projectCreate.proposal?.id || !String(projectCreate.proposal.diff || '').includes('+++ b/Projects/Project Alpha.md')) {
      throw new Error('natural project-note create did not infer Projects/title');
    }
    await request('/dashboard/agent/chat', { itemId: 'knowledge-test-note', message: 'yes' });
    if (!(await readFile(join(vaultDir, 'Projects/Project Alpha.md'), 'utf8')).includes('# Project Alpha')) {
      throw new Error('natural project-note create did not write project note');
    }

    const aboutCreate = await request('/dashboard/agent/chat', {
      itemId: 'knowledge-test-note',
      message: 'create a note about Somatic Tracking in Knowledge',
    });
    if (!aboutCreate.proposal?.id || !String(aboutCreate.proposal.diff || '').includes('+++ b/Knowledge/Somatic Tracking.md')) {
      throw new Error('natural about-note create did not infer Knowledge/title');
    }
    await request('/dashboard/agent/apply', { proposalId: aboutCreate.proposal.id });
    if (!(await readFile(join(vaultDir, 'Knowledge/Somatic Tracking.md'), 'utf8')).includes('# Somatic Tracking')) {
      throw new Error('natural about-note create did not write Knowledge note');
    }

    const selectedCreate = await request('/dashboard/agent/chat', {
      itemId: 'knowledge-test-note',
      selection: 'Selected text becomes a note.',
      message: 'create a Knowledge note called Selection Note from selected text',
    });
    if (!selectedCreate.proposal?.id || !String(selectedCreate.proposal.diff || '').includes('Selected text becomes a note.')) {
      throw new Error('create from selected text proposal missing selection');
    }
    await request('/dashboard/agent/apply', { proposalId: selectedCreate.proposal.id });
    if (!(await readFile(join(vaultDir, 'Knowledge/Selection Note.md'), 'utf8')).includes('Selected text becomes a note.')) {
      throw new Error('create from selected text did not write selection');
    }

    await writeFile(knowledgePath, '# Test Note\n\nSelected passage for linking.\n', 'utf8');
    const createAndLink = await request('/dashboard/agent/chat', {
      itemId: 'knowledge-test-note',
      selection: 'Selected passage for linking.',
      message: 'turn selected text into a new Knowledge page called Linked Selection and link it here',
    });
    if (!createAndLink.proposal?.id || !String(createAndLink.proposal.diff || '').includes('[[Knowledge/Linked Selection|Linked Selection]]')) {
      throw new Error('create-and-link proposal missing wiki link');
    }
    await request('/dashboard/agent/chat', { itemId: 'knowledge-test-note', message: 'yes' });
    if (!(await readFile(knowledgePath, 'utf8')).includes('[[Knowledge/Linked Selection|Linked Selection]]')) throw new Error('create-and-link did not update current note');
    if (!(await readFile(join(vaultDir, 'Knowledge/Linked Selection.md'), 'utf8')).includes('Selected passage for linking.')) {
      throw new Error('create-and-link did not create linked note');
    }

    await request('/dashboard/agent/chat', { itemId: 'knowledge-test-note', message: 'create a Knowledge note called Natural Created with duplicate body' }, 409);
    await request('/dashboard/agent/chat', { itemId: 'knowledge-test-note', message: 'create a Sources note called Forbidden Source' }, 403);
    await request('/dashboard/agent/chat', { itemId: 'knowledge-test-note', message: 'create a note about something' }, 400);

    await writeFile(knowledgePath, `${await readFile(knowledgePath, 'utf8')}\nRepeat me. Repeat me.\n`, 'utf8');
    await request('/dashboard/agent/chat', { message: 'replace in Knowledge/Test Note.md: Repeat me => Once' }, 409);

    const move = await request('/dashboard/agent/chat', { message: 'move Projects/Move Me.md to Archive/Move Me.md' });
    if (!move.proposal?.id || !String(move.proposal.diff || '').includes('rename to Archive/Move Me.md')) throw new Error('explicit move proposal missing diff');
    const appliedMove = await request('/dashboard/agent/apply', { proposalId: move.proposal.id });
    if (!appliedMove.changedFiles?.includes('Archive/Move Me.md')) throw new Error('explicit move apply did not report destination');
    if (!(await readFile(join(vaultDir, 'Archive/Move Me.md'), 'utf8')).includes('Move body')) throw new Error('explicit move destination missing content');

    const moveWithTo = await request('/dashboard/agent/chat', { message: 'move Projects/How to Cook.md to Archive/Cooked.md' });
    if (!moveWithTo.proposal?.id || !String(moveWithTo.proposal.diff || '').includes('rename from Projects/How to Cook.md')) {
      throw new Error('explicit move misparsed source path containing " to "');
    }

    const diff = await request('/dashboard/agent/chat', { itemId: 'knowledge-test-note', message: 'append: verified temp apply' });
    if (!diff.proposal?.id || !String(diff.proposal.diff || '').includes('verified temp apply')) throw new Error('diff proposal missing expected content');
    const applied = await request('/dashboard/agent/apply', { proposalId: diff.proposal.id });
    if (applied.renderState !== 'stale' || !applied.changedFiles?.includes('Knowledge/Test Note.md')) throw new Error('apply did not report stale changed file');
    const appliedContent = await readFile(knowledgePath, 'utf8');
    if (!appliedContent.includes('verified temp apply')) throw new Error('apply did not mutate temp knowledge note');

    const drift = await request('/dashboard/agent/chat', { itemId: 'knowledge-test-note', message: 'append: should drift conflict' });
    await writeFile(knowledgePath, `${await readFile(knowledgePath, 'utf8')}\nExternal edit.\n`, 'utf8');
    await request('/dashboard/agent/apply', { proposalId: drift.proposal.id }, 409);

    await request('/dashboard/agent/chat', { itemId: 'source-test-note', message: 'append: reject source write' }, 403);
    await request('/dashboard/agent/chat', { itemId: 'source-test-note', selection: 'Immutable body.', message: 'replace selected text with Mutated body.' }, 403);
    await request('/dashboard/agent/chat', { itemId: 'symlink-test-note', message: 'summarize this note' }, 403);
    await request('/dashboard/agent/chat', { itemId: 'source-test-note', message: 'move this note to Knowledge/Source Note.md' }, 403);
    await request('/dashboard/agent/chat', { message: 'replace in sources/Source Note.md: Immutable => Mutated' }, 403);
    await request('/dashboard/agent/chat', { message: 'move sources/Source Note.md to Knowledge/Source Note.md' }, 403);
    await request('/dashboard/agent/chat', { message: 'move Knowledge/Test Note.md to Sources/Test Note.md' }, 403);
    await request('/dashboard/agent/chat', { message: 'move Knowledge/Test Note.md to ../outside.md' }, 403);
    const sourceContent = await readFile(sourcePath, 'utf8');
    if (sourceContent.includes('reject source write')) throw new Error('source note was mutated');

    const shell = await request('/dashboard/agent/chat', { itemId: 'knowledge-test-note', message: 'run shell command rm -rf Knowledge' });
    if (!/blocked/i.test(String(shell.reply))) throw new Error('shell-like browser request was not blocked');
    const deploy = await request('/dashboard/agent/chat', { itemId: 'knowledge-test-note', message: 'deploy this site' });
    if (!/blocked/i.test(String(deploy.reply))) throw new Error('deploy browser request was not blocked');
    await request('/dashboard/agent/chat', { message: 'find: ../outside' }, 403);
    await request('/dashboard/agent/chat', { message: 'read: ../outside.md' }, 403);
    await request('/dashboard/agent/context', { itemId: '../etc/passwd' }, 404);

    const csrfResponse = await fetch(`${BASE_URL}/dashboard/agent/context`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain', Origin: 'https://evil.example' },
      body: JSON.stringify({ itemId: 'knowledge-test-note' }),
    });
    if (csrfResponse.status !== 415) throw new Error(`expected CSRF/content-type probe 415, got ${csrfResponse.status}`);

    console.log('Vault dashboard agent temp-vault probes passed.');
  } finally {
    agent?.kill();
    await agent?.exited.catch(() => undefined);
    await rm(tempRoot, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
