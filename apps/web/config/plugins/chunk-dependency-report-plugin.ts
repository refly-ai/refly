const { sources } = require('@rspack/core');

type Compiler = any;

export class ChunkDependencyReportPlugin {
  apply(compiler: Compiler) {
    compiler.hooks.thisCompilation.tap('ChunkDependencyReportPlugin', (compilation: any) => {
      compilation.hooks.processAssets.tap('ChunkDependencyReportPlugin', () => {
        const stats = compilation.getStats().toJson({
          all: false,
          chunks: true,
          chunkModules: true,
          modules: true,
          reasons: true,
          moduleTrace: true,
        });

        const chunks = stats.chunks || [];
        const reportChunks: Record<string, any> = {};
        const moduleSetsByGroup: Record<string, Set<string>> = {
          workspace: new Set(),
          workflow: new Set(),
          workflowPublic: new Set(),
        };

        const getChunkNames = (chunk: any): string[] => {
          if (Array.isArray(chunk.names) && chunk.names.length > 0) {
            return chunk.names.map((name: string) => name.toString());
          }
          if (chunk.id !== undefined && chunk.id !== null) {
            return [String(chunk.id)];
          }
          return ['(unknown)'];
        };

        const addToGroup = (group: keyof typeof moduleSetsByGroup, moduleId: string) => {
          moduleSetsByGroup[group].add(moduleId);
        };

        const formatModule = (module: any) => ({
          name: module.name || module.identifier || '(anonymous)',
          identifier: module.identifier,
          size: module.size,
          reasons: Array.isArray(module.reasons)
            ? module.reasons.map((reason: any) => ({
                moduleName: reason.moduleName,
                resolvedModule: reason.resolvedModule,
                type: reason.type,
                userRequest: reason.userRequest,
                loc: reason.loc,
              }))
            : [],
          issuerPath: Array.isArray(module.issuerPath)
            ? module.issuerPath.map((issuer: any) => ({
                name: issuer.name,
                identifier: issuer.identifier,
              }))
            : [],
        });

        for (const chunk of chunks) {
          const names = getChunkNames(chunk);
          const files = Array.isArray(chunk.files) ? chunk.files : [];
          const modules = Array.isArray(chunk.modules) ? chunk.modules : [];

          for (const name of names) {
            if (
              name.includes('group-workflow-public') ||
              name.includes('group-workspace') ||
              name.includes('group-workflow')
            ) {
              reportChunks[name] = {
                files,
                modules: modules.map(formatModule),
              };

              for (const module of modules) {
                const moduleId = module.identifier || module.name || '(anonymous)';
                if (name.includes('group-workspace')) {
                  addToGroup('workspace', moduleId);
                } else if (name.includes('group-workflow-public')) {
                  addToGroup('workflowPublic', moduleId);
                } else if (name.includes('group-workflow')) {
                  addToGroup('workflow', moduleId);
                }
              }
            }
          }
        }

        const sharedWorkspaceWorkflowPublic = Array.from(moduleSetsByGroup.workspace).filter(
          (moduleId) => moduleSetsByGroup.workflowPublic.has(moduleId),
        );

        const report = {
          generatedAt: new Date().toISOString(),
          chunks: reportChunks,
          shared: {
            workspace_vs_workflow_public: sharedWorkspaceWorkflowPublic,
          },
        };

        compilation.emitAsset(
          'chunk-deps.json',
          new sources.RawSource(JSON.stringify(report, null, 2)),
        );
      });
    });
  }
}
