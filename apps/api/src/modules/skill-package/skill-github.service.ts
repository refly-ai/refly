/**
 * Skill GitHub Service - handles submission of skills to the GitHub registry.
 *
 * This service manages the automatic creation of PRs to the refly-ai/refly-skill
 * repository when skills are published via `refly skill publish`.
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Octokit } from '@octokit/rest';
import { createAppAuth } from '@octokit/auth-app';
import { SkillPackage, User } from '@prisma/client';

export interface GitHubSubmitResult {
  prUrl: string;
  prNumber: number;
}

@Injectable()
export class SkillGithubService {
  private readonly logger = new Logger(SkillGithubService.name);
  private octokit: Octokit | null = null;
  private readonly repoOwner: string;
  private readonly repoName: string;
  private readonly isConfigured: boolean;

  constructor(private readonly configService: ConfigService) {
    const appId = this.configService.get<string>('GITHUB_APP_ID');
    const installationId = this.configService.get<string>('GITHUB_APP_INSTALLATION_ID');
    const privateKey = this.configService.get<string>('GITHUB_APP_PRIVATE_KEY');

    this.repoOwner = this.configService.get<string>('GITHUB_REPO_OWNER') || 'refly-ai';
    this.repoName = this.configService.get<string>('GITHUB_REPO_NAME') || 'refly-skill';

    // Check if GitHub App is configured
    if (appId && installationId && privateKey) {
      try {
        // Convert \n to actual newlines in private key
        const normalizedPrivateKey = privateKey.replace(/\\n/g, '\n');

        this.octokit = new Octokit({
          authStrategy: createAppAuth,
          auth: {
            appId: Number.parseInt(appId, 10),
            privateKey: normalizedPrivateKey,
            installationId: Number.parseInt(installationId, 10),
          },
        });

        this.isConfigured = true;
        this.logger.log(
          `GitHub App configured successfully. App ID: ${appId}, Installation ID: ${installationId}`,
        );
      } catch (error) {
        this.logger.error(`Failed to initialize GitHub App: ${error.message}`);
        this.isConfigured = false;
      }
    } else {
      this.isConfigured = false;
      this.logger.warn(
        'GitHub App not configured. Set GITHUB_APP_ID, GITHUB_APP_INSTALLATION_ID, and GITHUB_APP_PRIVATE_KEY to enable skill registry submission.',
      );
    }
  }

  /**
   * Check if the skill has already been submitted to GitHub
   */
  async hasExistingSubmission(skill: SkillPackage): Promise<boolean> {
    return !!(skill.githubPrNumber && skill.githubPrUrl);
  }

  /**
   * Submit a skill to the GitHub registry by creating a PR.
   * If skillContent is provided, it will be used as SKILL.md directly (source of truth).
   * Otherwise, a SKILL.md will be generated from the skill package data.
   */
  async submitSkillToRegistry(
    skill: SkillPackage,
    user: User,
    skillContent?: string,
  ): Promise<GitHubSubmitResult> {
    if (!this.isConfigured || !this.octokit) {
      throw new Error('GitHub App not configured');
    }

    // Check if already submitted
    const hasExisting = await this.hasExistingSubmission(skill);

    // If already submitted and no skillContent provided (no local changes), skip
    if (hasExisting && !skillContent) {
      this.logger.log(`Skill ${skill.skillId} already submitted to GitHub, skipping`);
      return {
        prUrl: skill.githubPrUrl!,
        prNumber: skill.githubPrNumber!,
      };
    }

    // If already submitted but skillContent provided, update the existing PR
    if (hasExisting && skillContent) {
      this.logger.log(`Skill ${skill.skillId} already submitted, updating PR`);
      return await this.updateExistingPR(skill, skillContent);
    }

    // 1. Determine SKILL.md content
    // If skillContent provided, use it directly (CLI publish with local SKILL.md)
    // Otherwise, generate from skill package data (legacy or direct API call)
    const skillMdContent = skillContent || this.generateSkillMd(skill);

    // 2. Generate README.md content (for human readability)
    const readme = this.generateReadme(skill, user);

    // 3. Create branch name
    const timestamp = Date.now();
    const safeName = skill.name.toLowerCase().replace(/[^a-z0-9-]/g, '-');
    const branchName = `skill/${safeName}-${timestamp}`;

    this.logger.log(`Creating branch: ${branchName}`);

    // 4. Get the default branch's latest commit SHA
    const { data: defaultBranch } = await this.octokit.repos.get({
      owner: this.repoOwner,
      repo: this.repoName,
    });

    const { data: refData } = await this.octokit.git.getRef({
      owner: this.repoOwner,
      repo: this.repoName,
      ref: `heads/${defaultBranch.default_branch}`,
    });

    const baseCommitSha = refData.object.sha;

    // 5. Get the tree SHA from the commit (GitHub API requires tree SHA, not commit SHA)
    const { data: commitData } = await this.octokit.git.getCommit({
      owner: this.repoOwner,
      repo: this.repoName,
      commit_sha: baseCommitSha,
    });
    const baseTreeSha = commitData.tree.sha;

    // 6. Create the new branch
    await this.octokit.git.createRef({
      owner: this.repoOwner,
      repo: this.repoName,
      ref: `refs/heads/${branchName}`,
      sha: baseCommitSha,
    });

    // 7. Create tree with new files: SKILL.md + README.md
    const skillMdPath = `skills/${safeName}/SKILL.md`;
    const readmePath = `skills/${safeName}/README.md`;

    this.logger.log(`Committing files: ${skillMdPath}, ${readmePath}`);

    const { data: tree } = await this.octokit.git.createTree({
      owner: this.repoOwner,
      repo: this.repoName,
      base_tree: baseTreeSha,
      tree: [
        {
          path: skillMdPath,
          mode: '100644',
          type: 'blob',
          content: skillMdContent,
        },
        {
          path: readmePath,
          mode: '100644',
          type: 'blob',
          content: readme,
        },
      ],
    });

    // 8. Create commit
    const { data: commit } = await this.octokit.git.createCommit({
      owner: this.repoOwner,
      repo: this.repoName,
      message: `Add skill: ${skill.name}`,
      tree: tree.sha,
      parents: [baseCommitSha],
    });

    // 9. Update branch to point to new commit
    await this.octokit.git.updateRef({
      owner: this.repoOwner,
      repo: this.repoName,
      ref: `heads/${branchName}`,
      sha: commit.sha,
    });

    // 10. Create pull request
    const prBody = this.generatePrBody(skill, user);
    const { data: pr } = await this.octokit.pulls.create({
      owner: this.repoOwner,
      repo: this.repoName,
      title: `Add skill: ${skill.name}`,
      head: branchName,
      base: defaultBranch.default_branch,
      body: prBody,
    });

    this.logger.log(`PR created: #${pr.number}`);

    return {
      prUrl: pr.html_url,
      prNumber: pr.number,
    };
  }

  /**
   * Update existing PR with new content
   */
  private async updateExistingPR(
    skill: SkillPackage,
    skillContent: string,
  ): Promise<GitHubSubmitResult> {
    if (!this.octokit || !skill.githubPrNumber) {
      throw new Error('Cannot update PR: missing octokit or PR number');
    }

    this.logger.log(`Updating PR #${skill.githubPrNumber} for skill ${skill.skillId}`);

    // Get the PR to find the branch name
    const { data: pr } = await this.octokit.pulls.get({
      owner: this.repoOwner,
      repo: this.repoName,
      pull_number: skill.githubPrNumber,
    });

    const branchName = pr.head.ref;

    // Get the branch's latest commit
    const { data: refData } = await this.octokit.git.getRef({
      owner: this.repoOwner,
      repo: this.repoName,
      ref: `heads/${branchName}`,
    });

    const baseCommitSha = refData.object.sha;

    // Get the tree SHA from the commit
    const { data: commitData } = await this.octokit.git.getCommit({
      owner: this.repoOwner,
      repo: this.repoName,
      commit_sha: baseCommitSha,
    });
    const baseTreeSha = commitData.tree.sha;

    // Update SKILL.md file
    const safeName = skill.name.toLowerCase().replace(/[^a-z0-9-]/g, '-');
    const skillMdPath = `skills/${safeName}/SKILL.md`;

    const { data: tree } = await this.octokit.git.createTree({
      owner: this.repoOwner,
      repo: this.repoName,
      base_tree: baseTreeSha,
      tree: [
        {
          path: skillMdPath,
          mode: '100644',
          type: 'blob',
          content: skillContent,
        },
      ],
    });

    // Create new commit
    const { data: commit } = await this.octokit.git.createCommit({
      owner: this.repoOwner,
      repo: this.repoName,
      message: `Update skill: ${skill.name}`,
      tree: tree.sha,
      parents: [baseCommitSha],
    });

    // Update branch to point to new commit
    await this.octokit.git.updateRef({
      owner: this.repoOwner,
      repo: this.repoName,
      ref: `heads/${branchName}`,
      sha: commit.sha,
    });

    this.logger.log(`Updated PR #${skill.githubPrNumber}`);

    return {
      prUrl: pr.html_url,
      prNumber: pr.number,
    };
  }

  /**
   * Generate SKILL.md content from skill package data.
   * Used when no skillContent is provided (legacy or direct API call).
   *
   * Note: description should be provided by user in Claude Code compatible format:
   * "[What it does]. Use when [scenarios]: (1) [case1], (2) [case2], or [catch-all]."
   */
  private generateSkillMd(skill: SkillPackage): string {
    const description = skill.description || `Skill: ${skill.name}`;

    const frontmatterLines = ['---', `name: ${skill.name}`];
    frontmatterLines.push(`description: ${description}`);
    frontmatterLines.push(`skillId: ${skill.skillId}`);

    // Note: workflowId not available in SkillPackage directly, using placeholder
    // In real usage, skillContent will be provided from CLI which has workflowId
    frontmatterLines.push('workflowId: see-workflow-mapping');

    if (skill.triggers.length > 0) {
      frontmatterLines.push('triggers:');
      frontmatterLines.push(...skill.triggers.map((t) => `  - ${t}`));
    }

    if (skill.tags.length > 0) {
      frontmatterLines.push('tags:');
      frontmatterLines.push(...skill.tags.map((t) => `  - ${t}`));
    }

    frontmatterLines.push(`version: ${skill.version}`);
    frontmatterLines.push('---');

    const content = `

# ${skill.name}

${skill.description || '_No description provided._'}

## Installation

\`\`\`bash
refly skill install ${skill.skillId}
\`\`\`

## Usage

After installation, run the skill using your installation ID:

\`\`\`bash
refly skill run <installationId> --input '{}'
\`\`\`

The installation ID is returned when you run \`refly skill install\`.
`;

    return frontmatterLines.join('\n') + content;
  }

  /**
   * Generate the README.md content
   */
  private generateReadme(skill: SkillPackage, user: User): string {
    const triggersSection =
      skill.triggers.length > 0
        ? skill.triggers.map((t) => `- ${t}`).join('\n')
        : '- _(No triggers defined)_';

    const tagsSection =
      skill.tags.length > 0 ? skill.tags.map((t) => `\`${t}\``).join(' ') : '_No tags_';

    const authorName = user.name || user.nickname || 'Anonymous';

    return `# ${skill.name}

${skill.description || '_No description provided._'}

## Installation

\`\`\`bash
refly skill install ${skill.skillId}
\`\`\`

## Triggers

${triggersSection}

## Tags

${tagsSection}

## Author

${authorName}

## Links

- [View on Refly](https://refly.ai/skill/${skill.skillId})
`;
  }

  /**
   * Generate the PR body/description
   */
  private generatePrBody(skill: SkillPackage, user: User): string {
    const authorName = user.name || user.nickname || 'Anonymous';

    return `## New Skill Submission

**Skill Name:** ${skill.name}
**Skill ID:** \`${skill.skillId}\`
**Version:** ${skill.version}
**Author:** ${authorName}

### Description

${skill.description || '_No description provided._'}

### Installation

\`\`\`bash
refly skill install ${skill.skillId}
\`\`\`

---

_This PR was automatically generated by Refly when the skill was published._
`;
  }
}
