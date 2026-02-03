/**
 * refly platform sync - Detect installed agents and sync skills to all platforms
 */

import * as fs from 'node:fs';
import { Command } from 'commander';
import { ok, fail, ErrorCodes } from '../../utils/output.js';
import { detectInstalledAgents, deploySkillToAllPlatforms } from '../../platform/manager.js';
import { agents, type AgentType, isValidAgentType } from '../../platform/registry.js';
import { getReflySkillsDir, getReflyBaseSkillDir } from '../../config/paths.js';
import { printSuccess, printDim, println, printError } from '../../utils/logo.js';
import { isPrettyOutput } from '../../utils/output.js';
import { isTTY } from '../../utils/ui.js';

export const platformSyncCommand = new Command('sync')
  .description('Detect installed agents and sync skills to all platforms')
  .option('--agent <agents...>', 'Specific agents to sync to (comma-separated)')
  .option('--dry-run', 'Show what would be done without making changes')
  .option('--yes', 'Skip confirmation prompts')
  .action(async (options) => {
    try {
      const pretty = isPrettyOutput();
      const tty = isTTY();

      // Parse agent filter if provided
      let targetAgents: AgentType[] | undefined;
      if (options.agent) {
        const agentList = options.agent.flatMap((a: string) => a.split(','));
        const validatedAgents: AgentType[] = [];
        for (const agent of agentList) {
          const trimmed = agent.trim();
          if (!isValidAgentType(trimmed)) {
            return fail(ErrorCodes.INVALID_INPUT, `Unknown agent: ${trimmed}`, {
              hint: `Valid agents: ${Object.keys(agents).join(', ')}`,
            });
          }
          validatedAgents.push(trimmed);
        }
        targetAgents = validatedAgents;
      }

      // Detect installed agents
      if (pretty && tty) {
        println('Scanning for installed agents...');
        println('');
      }

      const installedAgents = targetAgents
        ? targetAgents.map((name) => agents[name])
        : await detectInstalledAgents();

      const deployableAgents = installedAgents.filter((a) => a.format !== 'unknown');

      if (deployableAgents.length === 0) {
        if (pretty && tty) {
          printError('No supported agents found');
          printDim('Install an AI coding assistant and try again.');
        } else {
          ok('platform.sync', {
            message: 'No supported agents found',
            installedAgents: [],
            skillsSynced: 0,
          });
        }
        return;
      }

      // Display found agents
      if (pretty && tty) {
        println(`Found ${deployableAgents.length} installed agent(s):`);
        for (const agent of deployableAgents) {
          const dir = agent.globalSkillsDir || agent.skillsDir || 'N/A';
          println(`  \u2713 ${agent.displayName.padEnd(16)} ${dir}`);
        }
        println('');
      }

      // Get all skills to sync
      const skillsDir = getReflySkillsDir();
      const baseSkillDir = getReflyBaseSkillDir();
      const skillsToSync: string[] = [];

      // Add base skill if it exists
      if (fs.existsSync(baseSkillDir)) {
        skillsToSync.push('refly');
      }

      // Add domain skills
      if (fs.existsSync(skillsDir)) {
        const entries = fs.readdirSync(skillsDir, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.isDirectory() && entry.name !== 'base') {
            skillsToSync.push(entry.name);
          }
        }
      }

      if (skillsToSync.length === 0) {
        if (pretty && tty) {
          printDim('No skills found to sync.');
          printDim('Run `refly init` to install the base skill.');
        } else {
          ok('platform.sync', {
            message: 'No skills found to sync',
            installedAgents: deployableAgents.map((a) => a.name),
            skillsSynced: 0,
          });
        }
        return;
      }

      if (pretty && tty) {
        println(`Syncing ${skillsToSync.length} skill(s) to all installed agents...`);
      }

      if (options.dryRun) {
        // Dry run - just show what would be done
        if (pretty && tty) {
          println('');
          println('Dry run - no changes made:');
          for (const skillName of skillsToSync) {
            const agentNames = deployableAgents.map((a) => a.displayName).join(', ');
            println(`  ${skillName} -> ${agentNames}`);
          }
        } else {
          ok('platform.sync', {
            dryRun: true,
            installedAgents: deployableAgents.map((a) => a.name),
            skillsToSync,
          });
        }
        return;
      }

      // Sync each skill
      const results: Array<{
        skillName: string;
        success: number;
        failed: number;
        details: Array<{ agent: string; success: boolean; path?: string; error?: string }>;
      }> = [];

      for (const skillName of skillsToSync) {
        const deployResult = await deploySkillToAllPlatforms(skillName, {
          force: true, // Force to ensure repair
          agents: targetAgents,
        });

        const details: Array<{ agent: string; success: boolean; path?: string; error?: string }> =
          [];

        for (const [agentName, result] of deployResult.results) {
          details.push({
            agent: agentName,
            success: result.success,
            path: result.deployedPath || undefined,
            error: result.error,
          });
        }

        results.push({
          skillName,
          success: deployResult.successCount,
          failed: deployResult.failureCount,
          details,
        });

        if (pretty && tty) {
          const statusParts = deployableAgents.map((agent) => {
            const result = deployResult.results.get(agent.name);
            return result?.success ? '\u2713' : '\u2717';
          });
          println(`  ${skillName.padEnd(20)} ${statusParts.join(' ')}`);
        }
      }

      // Summary
      const totalSuccess = results.reduce((sum, r) => sum + r.success, 0);
      const totalFailed = results.reduce((sum, r) => sum + r.failed, 0);

      if (pretty && tty) {
        println('');
        printSuccess(
          `Done! ${deployableAgents.length} agent(s), ${skillsToSync.length} skill(s) synced.`,
        );
        if (totalFailed > 0) {
          printError(`${totalFailed} deployment(s) failed. Check logs for details.`);
        }
      } else {
        ok('platform.sync', {
          installedAgents: deployableAgents.map((a) => ({
            name: a.name,
            displayName: a.displayName,
            format: a.format,
            globalSkillsDir: a.globalSkillsDir,
          })),
          skillsSynced: skillsToSync.length,
          totalSuccess,
          totalFailed,
          results,
        });
      }
    } catch (error) {
      fail(
        ErrorCodes.INTERNAL_ERROR,
        error instanceof Error ? error.message : 'Failed to sync platforms',
      );
    }
  });
