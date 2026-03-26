import { describe, it } from 'node:test';
import assert from 'node:assert';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

describe('CLI smoke tests', () => {
  it('should show version', () => {
    const output = execSync('node dist/index.js --version', { encoding: 'utf-8' });
    assert.match(output.trim(), /0\.1\.0/);
  });

  it('should show help', () => {
    const output = execSync('node dist/index.js --help', { encoding: 'utf-8' });
    assert.ok(output.includes('init'));
    assert.ok(output.includes('doctor'));
    assert.ok(output.includes('list'));
    assert.ok(output.includes('update'));
  });

  it('should list MCPs', () => {
    const output = execSync('node dist/index.js list --mcps', { encoding: 'utf-8' });
    assert.ok(output.includes('mem0'));
    assert.ok(output.includes('context7'));
    assert.ok(output.includes('contextgraph'));
  });

  it('should list providers', () => {
    const output = execSync('node dist/index.js list --providers', { encoding: 'utf-8' });
    assert.ok(output.includes('Copilot'));
    assert.ok(output.includes('Ollama'));
    assert.ok(output.includes('NVIDIA NIM'));
    assert.ok(output.includes('Google AI Studio'));
    assert.ok(output.includes('OpenAI-Compatible'));
  });

  it('should list skills', () => {
    const output = execSync('node dist/index.js list --skills', { encoding: 'utf-8' });
    assert.ok(output.includes('Awesome Copilot'));
    assert.ok(output.includes('Agency Agents'));
  });
});

describe('Registry validation', () => {
  it('mcps.json should be valid', () => {
    const data = JSON.parse(fs.readFileSync('registry/mcps.json', 'utf-8'));
    assert.ok(data.mcps.length >= 13);
    for (const mcp of data.mcps) {
      assert.ok(mcp.id, `MCP missing id`);
      assert.ok(mcp.name, `MCP ${mcp.id} missing name`);
      assert.ok(mcp.install, `MCP ${mcp.id} missing install`);
      assert.ok(mcp.command, `MCP ${mcp.id} missing command`);
      assert.ok(Array.isArray(mcp.requiresEnv), `MCP ${mcp.id} missing requiresEnv`);
    }
  });

  it('providers.json should be valid', () => {
    const data = JSON.parse(fs.readFileSync('registry/providers.json', 'utf-8'));
    assert.ok(data.providers.length >= 5);
    for (const p of data.providers) {
      assert.ok(p.id, `Provider missing id`);
      assert.ok(p.name, `Provider ${p.id} missing name`);
      assert.ok(p.models, `Provider ${p.id} missing models`);
    }
  });

  it('skills.json should be valid', () => {
    const data = JSON.parse(fs.readFileSync('registry/skills.json', 'utf-8'));
    assert.ok(data.sources.length >= 3);
    for (const s of data.sources) {
      assert.ok(s.id, `Skill source missing id`);
      assert.ok(s.repo, `Skill source ${s.id} missing repo`);
      assert.ok(s.license, `Skill source ${s.id} missing license`);
    }
  });

  it('all MCPs with requiresEnv should have setupSteps', () => {
    const data = JSON.parse(fs.readFileSync('registry/mcps.json', 'utf-8'));
    for (const mcp of data.mcps) {
      if (mcp.requiresEnv.length > 0) {
        assert.ok(
          mcp.setupSteps || mcp.envSetup,
          `MCP ${mcp.id} requires env vars but has no setupSteps or envSetup`
        );
      }
    }
  });

  it('all Node MCPs should have npxCommand', () => {
    const data = JSON.parse(fs.readFileSync('registry/mcps.json', 'utf-8'));
    for (const mcp of data.mcps) {
      if (!mcp.python) {
        assert.ok(mcp.npxCommand, `MCP ${mcp.id} missing npxCommand`);
        assert.ok(Array.isArray(mcp.npxCommand), `MCP ${mcp.id} npxCommand should be array`);
      }
    }
  });
});

describe('Templates', () => {
  it('crush orchestrator template should exist', () => {
    assert.ok(fs.existsSync('templates/crush/autonomous.md'));
  });

  it('kiro orchestrator template should exist', () => {
    assert.ok(fs.existsSync('templates/kiro/orchestrator.md'));
  });

  it('inventory template should exist', () => {
    assert.ok(fs.existsSync('templates/inventory.md'));
  });
});
