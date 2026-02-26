import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { CodeExample } from './code-example';
import { Divider } from 'antd';

const tableClassName =
  'w-full border-collapse my-4 text-sm rounded-lg overflow-hidden border border-[var(--integration-docs-border,rgba(0,0,0,0.12))] bg-[var(--integration-docs-bg)] [&_tr:last-child_td]:border-b-0';
const tableHeaderCellClassName =
  'text-left px-3 py-2.5 border-b border-r border-[var(--integration-docs-border,rgba(0,0,0,0.12))] bg-[var(--integration-docs-bg-subtle)] font-medium text-refly-text-0 last:border-r-0';
const tableCellClassName =
  'text-left px-3 py-2.5 border-b border-r border-[var(--integration-docs-border,rgba(0,0,0,0.12))] text-refly-text-1 last:border-r-0';
const inlineCodeClassName =
  'bg-[var(--integration-docs-inline-code-bg)] px-1.5 py-0.5 rounded text-[13px] text-[var(--integration-docs-inline-code-text)]';
const sectionDescClassName = 'mt-2 mb-4 text-sm text-refly-text-1 leading-relaxed';

export const SkillDocsTab = memo(() => {
  const { t } = useTranslation();

  const installCliExample = 'npm install -g @powerformer/refly-cli';

  const createSkillExample = `refly skill create --name "my-skill" --workflow "c-xxxxx"`;

  const updateSkillExample = `refly skill update --name "my-skill"`;

  const publishSkillExample = 'refly skill publish <skill-id>';

  const runSkillExample = `refly skill run --name "my-skill" --input '{"query": "review this code"}'`;

  const installSkillExample = 'refly skill install <skill-id>';

  const uninstallSkillExample = `refly skill uninstall --name "code-review"`;

  return (
    <div className="mx-auto w-full max-w-[814px]">
      <div className="mb-8 pt-6">
        <h2 className="text-[22px] md:text-[28px] font-semibold text-refly-text-0 mb-2">
          {t('integration.skill.title')}
        </h2>
        <p className="m-0 text-[15px] text-refly-text-1 leading-relaxed">
          {t('integration.skill.description')}
        </p>

        {/* Skill Registry Callout */}
        <div className="mt-5 rounded-xl border-2 border-[var(--integration-docs-primary-text)] bg-[var(--integration-docs-bg-subtle)] p-5">
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <svg
                className="w-5 h-5 text-[var(--integration-docs-primary-text)]"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
              </svg>
              <span className="text-base font-semibold text-refly-text-0">
                {t('integration.skill.registryLabel')}
              </span>
            </div>
            <p className="text-sm text-refly-text-1 m-0">
              {t('integration.skill.registryDescription')}
            </p>
            <a
              href="https://github.com/refly-ai/refly-skills"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 mt-1 px-4 py-2 rounded-lg bg-[var(--integration-docs-primary-text)] text-white text-sm font-medium hover:opacity-90 transition-opacity w-fit"
            >
              <span>github.com/refly-ai/refly-skills</span>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                />
              </svg>
            </a>
          </div>
        </div>
      </div>

      {/* Skill Workflow Section Group */}
      <section id="skill-workflow" className="mb-10 scroll-mt-6">
        <h2 className="text-xl font-semibold text-refly-text-0 mb-6 pb-3 border-b-2 border-[var(--integration-docs-border)]">
          {t('integration.sections.skillWorkflow')}
        </h2>
      </section>

      {/* Install CLI Section */}
      <section id="skill-install-cli" className="mb-10 scroll-mt-6 last:mb-0">
        <h3 className="text-lg font-semibold text-refly-text-0 mb-4 pb-2 border-b border-[var(--integration-docs-border)]">
          {t('integration.skill.installCliTitle')}
        </h3>
        <p className={sectionDescClassName}>{t('integration.skill.installCliDescription')}</p>
        <CodeExample language="bash" code={installCliExample} />
      </section>

      {/* Create Skill Section */}
      <section id="skill-create" className="mb-10 scroll-mt-6 last:mb-0">
        <h3 className="text-lg font-semibold text-refly-text-0 mb-4 pb-2 border-b border-[var(--integration-docs-border)]">
          {t('integration.skill.createSkillTitle')}
        </h3>
        <p className={sectionDescClassName}>{t('integration.skill.createSkillDescription')}</p>
        <CodeExample language="bash" code={createSkillExample} />
        <div className="mt-4 rounded-lg border border-[var(--integration-docs-border)] bg-[var(--integration-docs-bg-subtle)] px-4 py-3">
          <h4 className="text-sm font-semibold text-refly-text-0 mb-2">
            {t('integration.skill.whatHappensTitle')}
          </h4>
          <ul className="list-disc list-inside space-y-1 text-sm text-refly-text-1">
            <li>{t('integration.skill.createStep1')}</li>
            <li>{t('integration.skill.createStep2')}</li>
            <li>{t('integration.skill.createStep3')}</li>
          </ul>
        </div>
      </section>

      {/* Update Skill Section */}
      <section id="skill-update" className="mb-10 scroll-mt-6 last:mb-0">
        <h3 className="text-lg font-semibold text-refly-text-0 mb-4 pb-2 border-b border-[var(--integration-docs-border)]">
          {t('integration.skill.updateSkillTitle')}
        </h3>
        <p className={sectionDescClassName}>{t('integration.skill.updateSkillDescription')}</p>
        <CodeExample language="bash" code={updateSkillExample} />
        <div className="mt-4 rounded-lg border border-[var(--integration-docs-border)] bg-[var(--integration-docs-bg-subtle)] px-4 py-3">
          <h4 className="text-sm font-semibold text-refly-text-0 mb-2">
            {t('integration.skill.updateableFieldsTitle')}
          </h4>
          <table className={tableClassName}>
            <thead>
              <tr>
                <th className={tableHeaderCellClassName}>{t('integration.skill.fieldName')}</th>
                <th className={tableHeaderCellClassName}>
                  {t('integration.skill.fieldDescription')}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className={tableCellClassName}>
                  <code className={inlineCodeClassName}>name</code>
                </td>
                <td className={tableCellClassName}>{t('integration.skill.fieldNameDesc')}</td>
              </tr>
              <tr>
                <td className={tableCellClassName}>
                  <code className={inlineCodeClassName}>description</code>
                </td>
                <td className={tableCellClassName}>
                  {t('integration.skill.fieldDescriptionDesc')}
                </td>
              </tr>
              <tr>
                <td className={tableCellClassName}>
                  <code className={inlineCodeClassName}>workflowId</code>
                </td>
                <td className={tableCellClassName}>{t('integration.skill.fieldWorkflowIdDesc')}</td>
              </tr>
              <tr>
                <td className={tableCellClassName}>
                  <code className={inlineCodeClassName}>version</code>
                </td>
                <td className={tableCellClassName}>{t('integration.skill.fieldVersionDesc')}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* Publish Skill Section */}
      <section id="skill-publish" className="mb-10 scroll-mt-6 last:mb-0">
        <h3 className="text-lg font-semibold text-refly-text-0 mb-4 pb-2 border-b border-[var(--integration-docs-border)]">
          {t('integration.skill.publishSkillTitle')}
        </h3>
        <p className={sectionDescClassName}>{t('integration.skill.publishSkillDescription')}</p>
        <CodeExample language="bash" code={publishSkillExample} />
        <div className="mt-4 rounded-lg border border-[var(--integration-docs-border)] bg-[var(--integration-docs-bg-subtle)] px-4 py-3">
          <h4 className="text-sm font-semibold text-refly-text-0 mb-2">
            {t('integration.skill.publishWorkflowTitle')}
          </h4>
          <ul className="list-disc list-inside space-y-1 text-sm text-refly-text-1">
            <li>{t('integration.skill.publishStep1')}</li>
            <li>{t('integration.skill.publishStep2')}</li>
            <li>{t('integration.skill.publishStep3')}</li>
            <li>{t('integration.skill.publishStep4')}</li>
          </ul>
        </div>
      </section>

      {/* Use Skill Section */}
      <section id="skill-use" className="mb-10 scroll-mt-6 last:mb-0">
        <h3 className="text-lg font-semibold text-refly-text-0 mb-4 pb-2 border-b border-[var(--integration-docs-border)]">
          {t('integration.skill.useSkillTitle')}
        </h3>
        <p className={sectionDescClassName}>{t('integration.skill.useSkillDescription')}</p>
        <CodeExample language="bash" code={runSkillExample} />
        <div className="mt-4 rounded-lg border border-[var(--integration-docs-border)] bg-[var(--integration-docs-bg-subtle)] px-4 py-3">
          <h4 className="text-sm font-semibold text-refly-text-0 mb-2">
            {t('integration.skill.whatHappensTitle')}
          </h4>
          <ul className="list-disc list-inside space-y-1 text-sm text-refly-text-1">
            <li>{t('integration.skill.useStep1')}</li>
            <li>{t('integration.skill.useStep2')}</li>
            <li>{t('integration.skill.useStep3')}</li>
          </ul>
        </div>
        {/* Claude Code callout - quote/dialog style */}
        <blockquote className="mt-5 pl-4 border-l-4 border-[var(--integration-docs-primary-text)] bg-[var(--integration-docs-bg-subtle)] rounded-r-lg py-4 pr-4">
          <div className="flex items-center gap-2 mb-2">
            <svg
              className="w-5 h-5 text-[var(--integration-docs-primary-text)]"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z" />
            </svg>
            <span className="text-base font-semibold text-refly-text-0">
              {t('integration.skill.claudeCodeTitle')}
            </span>
          </div>
          <p className="text-sm text-refly-text-1 m-0 italic">
            {t('integration.skill.claudeCodeDescription')}
          </p>
          <div className="mt-3 px-3 py-2 rounded-lg bg-[var(--integration-docs-inline-code-bg)]">
            <code className="text-[13px] text-[var(--integration-docs-inline-code-text)]">
              {t('integration.skill.claudeCodeExample')}
            </code>
          </div>
        </blockquote>
      </section>
      <Divider />
      {/* Skill Registry Section Group */}
      <section id="skill-registry" className="mb-10 scroll-mt-6">
        <h2 className="text-xl font-semibold text-refly-text-0 mb-6 pb-3 border-b-2 border-[var(--integration-docs-border)]">
          {t('integration.sections.skillRegistry')}
        </h2>
      </section>

      {/* Examples Section */}
      <section id="skill-examples" className="mb-10 scroll-mt-6 last:mb-0">
        <h3 className="text-lg font-semibold text-refly-text-0 mb-4 pb-2 border-b border-[var(--integration-docs-border)]">
          {t('integration.skill.examplesTitle')}
        </h3>
        <p className={sectionDescClassName}>{t('integration.skill.examplesDescription')}</p>

        <div className="mt-4 rounded-lg border border-[var(--integration-docs-border)] bg-[var(--integration-docs-bg-subtle)] px-4 py-3">
          <h4 className="text-sm font-semibold text-refly-text-0 mb-3">
            {t('integration.skill.supportedAssistantsTitle')}
          </h4>
          <table className={tableClassName}>
            <thead>
              <tr>
                <th className={tableHeaderCellClassName}>{t('integration.skill.assistantName')}</th>
                <th className={tableHeaderCellClassName}>
                  {t('integration.skill.assistantSkillPath')}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className={tableCellClassName}>Claude Code</td>
                <td className={tableCellClassName}>
                  <code className={inlineCodeClassName}>~/.claude/skills/</code>
                </td>
              </tr>
              <tr>
                <td className={tableCellClassName}>Codex</td>
                <td className={tableCellClassName}>
                  <code className={inlineCodeClassName}>~/.codex/skills/</code>
                </td>
              </tr>
              <tr>
                <td className={tableCellClassName}>Antigravity</td>
                <td className={tableCellClassName}>
                  <code className={inlineCodeClassName}>~/.antigravity/skills/</code>
                </td>
              </tr>
              <tr>
                <td className={tableCellClassName}>OpenCode</td>
                <td className={tableCellClassName}>
                  <code className={inlineCodeClassName}>~/.opencode/skills/</code>
                </td>
              </tr>
              <tr>
                <td className={tableCellClassName}>Cursor</td>
                <td className={tableCellClassName}>
                  <code className={inlineCodeClassName}>~/.cursor/skills/</code>
                </td>
              </tr>
              <tr>
                <td className={tableCellClassName}>VS Code</td>
                <td className={tableCellClassName}>
                  <code className={inlineCodeClassName}>~/.vscode/skills/</code>
                </td>
              </tr>
              <tr>
                <td className={tableCellClassName}>Trae</td>
                <td className={tableCellClassName}>
                  <code className={inlineCodeClassName}>~/.trae/skills/</code>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="mt-4 rounded-lg border border-[var(--integration-docs-border)] bg-[var(--integration-docs-bg-subtle)] px-4 py-3">
          <h4 className="text-sm font-semibold text-refly-text-0 mb-2">
            {t('integration.skill.examplePromptsTitle')}
          </h4>
          <ul className="list-disc list-inside space-y-2 text-sm text-refly-text-1">
            <li>
              <code className={inlineCodeClassName}>{t('integration.skill.examplePrompt1')}</code>
              <span className="ml-2 text-[var(--integration-docs-text-3)]">
                → {t('integration.skill.exampleSkill1')}
              </span>
            </li>
            <li>
              <code className={inlineCodeClassName}>{t('integration.skill.examplePrompt2')}</code>
              <span className="ml-2 text-[var(--integration-docs-text-3)]">
                → {t('integration.skill.exampleSkill2')}
              </span>
            </li>
            <li>
              <code className={inlineCodeClassName}>{t('integration.skill.examplePrompt3')}</code>
              <span className="ml-2 text-[var(--integration-docs-text-3)]">
                → {t('integration.skill.exampleSkill3')}
              </span>
            </li>
          </ul>
        </div>
      </section>

      {/* Install from Repository Section */}
      <section id="skill-install" className="mb-10 scroll-mt-6 last:mb-0">
        <h3 className="text-lg font-semibold text-refly-text-0 mb-4 pb-2 border-b border-[var(--integration-docs-border)]">
          {t('integration.skill.installFromRepoTitle')}
        </h3>
        <p className={sectionDescClassName}>{t('integration.skill.installFromRepoDescription')}</p>
        <CodeExample language="bash" code={installSkillExample} />
        <div className="mt-4 rounded-lg border border-[var(--integration-docs-border)] bg-[var(--integration-docs-bg-subtle)] px-4 py-3">
          <h4 className="text-sm font-semibold text-refly-text-0 mb-2">
            {t('integration.skill.whatHappensTitle')}
          </h4>
          <ul className="list-disc list-inside space-y-1 text-sm text-refly-text-1">
            <li>{t('integration.skill.installStep1')}</li>
            <li>{t('integration.skill.installStep2')}</li>
            <li>{t('integration.skill.installStep3')}</li>
          </ul>
        </div>
        <div className="mt-3">
          <span className="text-sm text-refly-text-1">
            {t('integration.skill.browseSkillsHint')}{' '}
            <a
              href="https://github.com/refly-ai/refly-skills/tree/main/skills"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--integration-docs-primary-text)] hover:underline"
            >
              {t('integration.skill.browseSkillsLink')}
            </a>
          </span>
        </div>
      </section>

      {/* Uninstall Skill Section */}
      <section id="skill-uninstall" className="mb-10 scroll-mt-6 last:mb-0">
        <h3 className="text-lg font-semibold text-refly-text-0 mb-4 pb-2 border-b border-[var(--integration-docs-border)]">
          {t('integration.skill.uninstallSkillTitle')}
        </h3>
        <p className={sectionDescClassName}>{t('integration.skill.uninstallSkillDescription')}</p>
        <CodeExample language="bash" code={uninstallSkillExample} />
        <div className="mt-4 rounded-lg border border-[var(--integration-docs-border)] bg-[var(--integration-docs-bg-subtle)] px-4 py-3">
          <h4 className="text-sm font-semibold text-refly-text-0 mb-2">
            {t('integration.skill.whatHappensTitle')}
          </h4>
          <ul className="list-disc list-inside space-y-1 text-sm text-refly-text-1">
            <li>{t('integration.skill.uninstallStep1')}</li>
            <li>{t('integration.skill.uninstallStep2')}</li>
            <li>{t('integration.skill.uninstallStep3')}</li>
          </ul>
        </div>
      </section>

      {/* Skill Structure Section */}
      <section id="skill-structure" className="mb-10 scroll-mt-6 last:mb-0">
        <h3 className="text-lg font-semibold text-refly-text-0 mb-4 pb-2 border-b border-[var(--integration-docs-border)]">
          {t('integration.skill.structureTitle')}
        </h3>
        <p className={sectionDescClassName}>{t('integration.skill.structureDescription')}</p>
        <table className={tableClassName}>
          <thead>
            <tr>
              <th className={tableHeaderCellClassName}>{t('integration.skill.fileName')}</th>
              <th className={tableHeaderCellClassName}>{t('integration.skill.fileDescription')}</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className={tableCellClassName}>
                <code className={inlineCodeClassName}>SKILL.md</code>
              </td>
              <td className={tableCellClassName}>{t('integration.skill.skillMdDesc')}</td>
            </tr>
            <tr>
              <td className={tableCellClassName}>
                <code className={inlineCodeClassName}>README.md</code>
              </td>
              <td className={tableCellClassName}>{t('integration.skill.readmeMdDesc')}</td>
            </tr>
          </tbody>
        </table>
      </section>

      {/* Support Section */}
      <section id="skill-support" className="mb-10 scroll-mt-6 last:mb-0">
        <h3 className="text-lg font-semibold text-refly-text-0 mb-4 pb-2 border-b border-[var(--integration-docs-border)]">
          {t('integration.skill.supportTitle')}
        </h3>
        <ul className="list-disc list-inside space-y-2 text-sm text-refly-text-1">
          <li>
            <a
              href="https://github.com/refly-ai/refly-skills/discussions"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--integration-docs-primary-text)] hover:underline"
            >
              GitHub Discussions
            </a>{' '}
            - {t('integration.skill.supportDiscussions')}
          </li>
          <li>
            <a
              href="https://github.com/refly-ai/refly-skills/issues"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--integration-docs-primary-text)] hover:underline"
            >
              GitHub Issues
            </a>{' '}
            - {t('integration.skill.supportIssues')}
          </li>
          <li>
            <a
              href="https://discord.gg/refly"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--integration-docs-primary-text)] hover:underline"
            >
              Discord
            </a>{' '}
            - {t('integration.skill.supportDiscord')}
          </li>
        </ul>
      </section>
    </div>
  );
});

SkillDocsTab.displayName = 'SkillDocsTab';
