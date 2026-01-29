# Refly Skill Symlink Architecture Design

## Overview

Migrate Refly skills to integrate with Claude Code's skill discovery system using symlinks. This enables Claude Code to automatically discover and invoke Refly skills while maintaining CLI-based execution.

## Current State

```
~/.claude/skills/refly/
├── SKILL.md                    # Base skill entry
├── registry.json               # Routing registry
├── references/                 # CLI documentation
│   ├── workflow.md
│   ├── node.md
│   ├── file.md
│   └── skill.md
└── domain-skills/              # Domain skills (deprecated)
    └── <skill-name>/
        └── skill.md
```

**Problems:**
- Domain skills nested inside base skill directory
- Claude Code doesn't auto-discover domain skills
- No symlink-based organization

## Target Architecture

```
~/.claude/skills/                           # Claude Code skill discovery
├── refly → ~/.refly/skill/base/            # Base skill (symlink)
├── image-gen → ~/.refly/skill/image-gen/   # Domain skill (symlink)
└── my-skill → ~/.refly/skill/my-skill/     # Domain skill (symlink)

~/.refly/skill/                             # Actual skill storage
├── base/
│   ├── SKILL.md                            # Base skill entry
│   └── references/
│       ├── workflow.md
│       ├── node.md
│       ├── file.md
│       └── skill.md
├── image-gen/
│   └── SKILL.md                            # Contains workflowId
└── my-skill/
    └── SKILL.md                            # Contains workflowId
```

## SKILL.md Format

### Base Skill (`~/.refly/skill/base/SKILL.md`)

```markdown
---
name: refly
description: Base skill for Refly ecosystem. Routes user intent to domain skills.
triggers:
  - refly
  - skill
  - workflow
---

# Refly

## Rules

1. **CLI only** - Use `refly <command>`, never call API directly.
2. **Trust JSON** - Only trust CLI JSON output.
...

## References

- `references/workflow.md` - Workflow commands
- `references/node.md` - Node commands
- `references/file.md` - File commands
- `references/skill.md` - Skill commands
```

### Domain Skill (`~/.refly/skill/<name>/SKILL.md`)

```markdown
---
name: image-gen
displayName: Image Generator
description: Generate images using AI models
workflowId: wf-xxx
installationId: si-xxx
triggers:
  - generate image
  - create picture
---

# Image Generator

Generate images using AI models.

## Usage

This skill is executed via Refly CLI:

```bash
refly skill run <installationId> --input '{"prompt": "..."}'
```

## Parameters

- `prompt` (required): Description of the image to generate
- `style` (optional): Art style (realistic, cartoon, etc.)
```

## CLI Commands

### `refly init`

Initialize Refly skill system:

1. Create `~/.refly/skill/base/` directory
2. Copy base skill files (SKILL.md, references/)
3. Create symlink: `~/.claude/skills/refly` → `~/.refly/skill/base/`

```bash
refly init
# Output:
# ✓ Created ~/.refly/skill/base/
# ✓ Initialized base skill files
# ✓ Created symlink ~/.claude/skills/refly
```

### `refly skill install <skillId>`

Install a skill from registry:

1. Fetch skill metadata from API
2. Create `~/.refly/skill/<name>/SKILL.md`
3. Create symlink: `~/.claude/skills/<name>` → `~/.refly/skill/<name>/`

```bash
refly skill install sp-xxx
# Output:
# ✓ Installed skill 'image-gen' to ~/.refly/skill/image-gen/
# ✓ Created symlink ~/.claude/skills/image-gen
# ✓ Installation ID: si-xxx
```

### `refly skill create`

Create a new skill:

1. Create workflow via API
2. Generate `~/.refly/skill/<name>/SKILL.md` with workflowId
3. Create symlink: `~/.claude/skills/<name>` → `~/.refly/skill/<name>/`

```bash
refly skill create --name my-skill
# Output:
# ✓ Created workflow wf-xxx
# ✓ Created skill at ~/.refly/skill/my-skill/
# ✓ Created symlink ~/.claude/skills/my-skill
```

### `refly skill uninstall <installationId>`

Uninstall a skill:

1. Remove symlink from `~/.claude/skills/`
2. Remove skill directory from `~/.refly/skill/`
3. Delete installation via API

```bash
refly skill uninstall si-xxx
# Output:
# ✓ Removed symlink ~/.claude/skills/image-gen
# ✓ Removed ~/.refly/skill/image-gen/
# ✓ Uninstalled skill
```

## Implementation Details

### Directory Structure

```typescript
const REFLY_SKILL_DIR = path.join(os.homedir(), '.refly', 'skill');
const CLAUDE_SKILL_DIR = path.join(os.homedir(), '.claude', 'skills');
```

### Symlink Creation

```typescript
async function createSkillSymlink(skillName: string): Promise<void> {
  const source = path.join(REFLY_SKILL_DIR, skillName);
  const target = path.join(CLAUDE_SKILL_DIR, skillName);

  // Ensure Claude skills directory exists
  await fs.mkdir(CLAUDE_SKILL_DIR, { recursive: true });

  // Remove existing symlink if present
  try {
    await fs.unlink(target);
  } catch (e) {
    // Ignore if doesn't exist
  }

  // Create symlink
  await fs.symlink(source, target, 'dir');
}
```

### SKILL.md Generation

```typescript
interface SkillMetadata {
  name: string;
  displayName: string;
  description: string;
  workflowId: string;
  installationId: string;
  triggers: string[];
}

function generateSkillMd(metadata: SkillMetadata): string {
  const frontmatter = yaml.stringify({
    name: metadata.name,
    displayName: metadata.displayName,
    description: metadata.description,
    workflowId: metadata.workflowId,
    installationId: metadata.installationId,
    triggers: metadata.triggers,
  });

  return `---
${frontmatter}---

# ${metadata.displayName}

${metadata.description}

## Usage

This skill is executed via Refly CLI:

\`\`\`bash
refly skill run ${metadata.installationId} --input '<json>'
\`\`\`
`;
}
```

## Migration Path

1. **Phase 1**: Implement new commands (`refly init`, modified `install`/`create`)
2. **Phase 2**: Add `refly skill migrate` to convert existing installations
3. **Phase 3**: Deprecate `domain-skills/` directory

### Migration Command

```bash
refly skill migrate
# Migrates existing installations to symlink format:
# 1. Read existing installations from API
# 2. Create SKILL.md for each in ~/.refly/skill/<name>/
# 3. Create symlinks in ~/.claude/skills/
# 4. Remove deprecated domain-skills/ directory
```

## Benefits

1. **Claude Code Discovery**: Skills appear in Claude Code's skill list
2. **Clean Separation**: Base skill vs domain skills clearly separated
3. **Standard Format**: Follows Claude Code skill conventions
4. **Easy Management**: Symlinks make installation/uninstallation clean
5. **CLI Execution**: Maintains existing CLI-based execution model

## Files to Modify

| File | Changes |
|------|---------|
| `packages/cli/src/commands/init.ts` | New command - create base skill + symlink |
| `packages/cli/src/commands/skill/install.ts` | Add symlink creation |
| `packages/cli/src/commands/skill/create.ts` | Add symlink creation |
| `packages/cli/src/commands/skill/uninstall.ts` | Add symlink removal |
| `packages/cli/src/utils/skill-symlink.ts` | New utility for symlink operations |
| `packages/cli/src/templates/base-skill/` | Base skill template files |
