const { sources } = require('@rspack/core');

type Compiler = any;

type PrecacheManifestPluginOptions = {
  shouldIncludeAsset: (asset: string) => boolean;
  filename: string;
};

export class PrecacheManifestPlugin {
  private shouldIncludeAsset: (asset: string) => boolean;
  private filename: string;

  constructor(options: PrecacheManifestPluginOptions) {
    this.shouldIncludeAsset = options.shouldIncludeAsset;
    this.filename = options.filename;
  }

  apply(compiler: Compiler) {
    compiler.hooks.thisCompilation.tap('PrecacheManifestPlugin', (compilation: any) => {
      compilation.hooks.processAssets.tap('PrecacheManifestPlugin', () => {
        const normalize = (file: string) => (file.startsWith('/') ? file : `/${file}`);
        const normalizeList = (files: Iterable<string>) => {
          const result: string[] = [];
          for (const file of files) {
            if (this.shouldIncludeAsset(file)) {
              result.push(normalize(file));
            }
          }
          return result;
        };

        const collectGroupFiles = (groupName: string): Set<string> => {
          const rootGroup = compilation.namedChunkGroups.get(groupName);
          if (!rootGroup) {
            return new Set();
          }

          const files = new Set<string>();
          const visited = new Set<object>();
          const visit = (group: any) => {
            if (!group || visited.has(group)) {
              return;
            }
            visited.add(group);
            for (const file of group.getFiles()) {
              files.add(file);
            }
            for (const child of group.childrenIterable || []) {
              visit(child);
            }
          };
          visit(rootGroup);
          return files;
        };

        const coreFiles = new Set<string>();
        for (const entry of compilation.entrypoints.values()) {
          for (const file of entry.getFiles()) {
            coreFiles.add(file);
          }
        }
        for (const asset of compilation.getAssets()) {
          if (!this.shouldIncludeAsset(asset.name)) {
            continue;
          }
          if (
            /\/static\/js\/(index|lib-react|lib-router)(\.[a-f0-9]+)?\.js$/.test(asset.name) ||
            /\/static\/css\/index(\.[a-f0-9]+)?\.css$/.test(asset.name)
          ) {
            coreFiles.add(asset.name);
          }
        }

        const workflowFiles = collectGroupFiles('group-workflow');
        for (const file of workflowFiles) {
          if (file.includes('group-workflow-public')) {
            workflowFiles.delete(file);
          }
        }
        const workspaceFiles = collectGroupFiles('group-workspace');

        for (const file of workflowFiles) {
          if (this.shouldIncludeAsset(file)) {
            coreFiles.add(file);
          }
        }

        const allFiles = new Set<string>();
        for (const asset of compilation.getAssets()) {
          if (this.shouldIncludeAsset(asset.name)) {
            allFiles.add(asset.name);
          }
        }

        const payload = {
          core: normalizeList(coreFiles),
          workflow: normalizeList(workflowFiles),
          workspace: normalizeList(workspaceFiles),
          all: normalizeList(allFiles),
        };

        const content = JSON.stringify(payload, null, 2);
        compilation.emitAsset(this.filename, new sources.RawSource(content));
      });
    });
  }
}
