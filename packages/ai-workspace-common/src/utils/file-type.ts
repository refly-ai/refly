/**
 * File extension to language mapping for syntax highlighting
 * Only includes languages supported by shiki in syntax-highlighter.tsx
 */
const EXTENSION_TO_LANGUAGE: Record<string, string> = {
  // JavaScript/TypeScript
  js: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  jsx: 'jsx',
  ts: 'typescript',
  mts: 'typescript',
  cts: 'typescript',
  tsx: 'tsx',

  // Python
  py: 'python',
  pyw: 'python',

  // Java
  java: 'java',

  // C/C++
  c: 'c',
  h: 'c',
  cpp: 'cpp',
  cc: 'cpp',
  cxx: 'cpp',
  hpp: 'cpp',
  hxx: 'cpp',

  // C#
  cs: 'csharp',

  // Go
  go: 'go',

  // Rust
  rs: 'rust',

  // Ruby
  rb: 'ruby',
  rake: 'ruby',

  // PHP
  php: 'php',

  // Swift
  swift: 'swift',

  // Kotlin
  kt: 'kotlin',
  kts: 'kotlin',

  // Scala
  scala: 'scala',

  // Lua
  lua: 'lua',

  // Perl
  pl: 'perl',
  pm: 'perl',

  // R
  r: 'r',

  // Web
  html: 'html',
  htm: 'html',
  css: 'css',
  scss: 'scss',
  sass: 'sass',
  less: 'less',
  vue: 'vue',
  svelte: 'svelte',

  // Data formats
  json: 'json',
  jsonc: 'json',
  json5: 'json',
  yaml: 'yaml',
  yml: 'yaml',
  toml: 'toml',
  xml: 'xml',
  svg: 'svg',

  // Markdown
  md: 'markdown',
  markdown: 'markdown',
  mdx: 'mdx',

  // SQL
  sql: 'sql',

  // GraphQL
  graphql: 'graphql',
  gql: 'graphql',

  // Shell
  sh: 'shell',
  bash: 'shell',
  zsh: 'zsh',
  fish: 'fish',
  ps1: 'powershell',

  // Config files
  dockerfile: 'dockerfile',
  makefile: 'makefile',
  cmake: 'cmake',
  nginx: 'nginx',

  // Other
  diff: 'diff',
  ini: 'ini',
  latex: 'latex',
  tex: 'latex',

  // Plain text
  txt: 'plaintext',
  text: 'text',
  log: 'log',
};

/**
 * Get file extension from filename
 */
const getFileExtension = (filename: string): string => {
  const parts = filename.split('.');
  if (parts.length === 1) return '';
  return parts[parts.length - 1]?.toLowerCase() ?? '';
};

/**
 * Check if file is a code file based on extension
 */
export const isCodeFile = (filename: string): boolean => {
  const ext = getFileExtension(filename);
  return ext in EXTENSION_TO_LANGUAGE;
};

/**
 * Get language identifier for syntax highlighting
 */
export const getCodeLanguage = (filename: string): string | null => {
  const ext = getFileExtension(filename);
  return EXTENSION_TO_LANGUAGE[ext] ?? null;
};
