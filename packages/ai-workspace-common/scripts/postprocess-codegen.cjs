const { readFileSync, writeFileSync, unlinkSync, existsSync } = require('node:fs');
const { execSync } = require('node:child_process');
const { join } = require('node:path');

/**
 * Gets the biome executable path from pnpm bin
 */
function getBiomePath() {
  try {
    // Get pnpm bin directory
    const biomePath = join(__dirname, '..', '..', '..', 'node_modules', '.bin', 'biome');

    // Check if biome exists in pnpm bin
    try {
      execSync(`"${biomePath}" --version`, { encoding: 'utf-8' });
      return biomePath;
    } catch {
      // Fallback to system biome if not found in pnpm bin
      return 'biome';
    }
  } catch {
    console.warn('Could not get pnpm bin directory, falling back to system biome');
    return 'biome';
  }
}

/**
 * Prints biome version and path information
 */
function printBiomeInfo() {
  try {
    console.log('=== Biome Information ===');

    const biomePath = getBiomePath();

    // Get biome version
    const version = execSync(`"${biomePath}" --version`, {
      encoding: 'utf-8',
    }).trim();
    console.log(`Biome Version: ${version}`);

    // Get biome path
    console.log(`Biome Path: ${biomePath}`);
    console.log('========================\n');
  } catch (error) {
    console.error('Error getting biome information:', error.message);
    console.log('Make sure biome is installed and available in PATH\n');
  }
}

/**
 * Runs biome check on specified directories
 * @param directories - Array of directory paths to check
 */
function runBiomeCheck(directories) {
  try {
    const biomePath = getBiomePath();

    for (const dir of directories) {
      console.log(`Running biome check on ${dir}...`);
      const command = `"${biomePath}" check ${dir} --write --no-errors-on-unmatched`;
      execSync(command, { stdio: 'inherit' });
      console.log(`Successfully ran biome check on ${dir}`);
    }
  } catch (error) {
    console.error('Error running biome check:', error);
    process.exit(1);
  }
}

/**
 * Adds @ts-nocheck to the top of a given file
 * @param filePath - Path to the file to modify
 */
function addTsNoCheck(filePath) {
  try {
    // Read the file content
    const content = readFileSync(filePath, 'utf-8');

    // Check if @ts-nocheck already exists
    if (content.includes('@ts-nocheck')) {
      console.log(`File ${filePath} already contains @ts-nocheck`);
      return;
    }

    // Add @ts-nocheck to the top of the file
    const newContent = `// @ts-nocheck\n${content}`;

    // Write the modified content back to the file
    writeFileSync(filePath, newContent, 'utf-8');

    console.log(`Successfully added @ts-nocheck to ${filePath}`);
  } catch (error) {
    console.error(`Error processing file ${filePath}:`, error);
    process.exit(1);
  }
}

/**
 * Updates import paths in queries files from relative requests imports to @refly/openapi-schema
 */
function updateImportPaths() {
  const queriesDir = join(__dirname, '..', 'src', 'queries');

  // Get all .ts files in the queries directory
  const fs = require('node:fs');
  const files = fs.readdirSync(queriesDir).filter((file) => file.endsWith('.ts'));

  console.log('Updating import paths in queries files...');

  for (const file of files) {
    const filePath = join(queriesDir, file);

    try {
      let content = readFileSync(filePath, 'utf-8');
      let modified = false;

      // Replace import paths
      const replacements = [
        { from: '../requests/services.gen', to: '@refly/openapi-schema' },
        { from: '../requests/types.gen', to: '@refly/openapi-schema' },
        { from: '../requests/provider-community', to: '@refly/openapi-schema' },
      ];

      for (const replacement of replacements) {
        if (content.includes(replacement.from)) {
          content = content.replace(new RegExp(replacement.from, 'g'), replacement.to);
          modified = true;
        }
      }

      if (modified) {
        writeFileSync(filePath, content, 'utf-8');
        console.log(`Updated import paths in ${file}`);
      }
    } catch (error) {
      console.error(`Error updating import paths in ${file}:`, error);
      process.exit(1);
    }
  }

  console.log('Import paths update completed!');
}

/**
 * Removes generated files in the requests directory
 */
function removeGeneratedRequestsFiles() {
  const requestsDir = join(__dirname, '..', 'src', 'requests');

  // List of generated files to remove
  const generatedFiles = ['index.ts', 'services.gen.ts', 'types.gen.ts'];

  console.log('Removing generated files in requests directory...');

  for (const fileName of generatedFiles) {
    const filePath = join(requestsDir, fileName);

    try {
      if (existsSync(filePath)) {
        unlinkSync(filePath);
        console.log(`Removed generated file: ${fileName}`);
      } else {
        console.log(`File not found (already removed): ${fileName}`);
      }
    } catch (error) {
      console.error(`Error removing file ${fileName}:`, error);
      process.exit(1);
    }
  }

  console.log('Generated files removal completed!');
}

/**
 * Processes queries workflow - runs biome check and adds ts-nocheck to queries.ts
 */
function postprocessQueries() {
  // Get the root directory of the source code
  const srcDir = join(__dirname, '..', 'src');

  // Define directories to run biome check on
  const directoriesToCheck = [join(srcDir, 'requests'), join(srcDir, 'queries')];

  // Define the queries file path
  const queriesFilePath = join(srcDir, 'queries', 'queries.ts');

  console.log('Starting queries processing...');

  // First remove generated files in requests directory
  removeGeneratedRequestsFiles();

  // Then update import paths in queries files
  updateImportPaths();

  // Then run biome check on the specified directories
  runBiomeCheck(directoriesToCheck);

  // Then add ts-nocheck to queries/queries.ts
  addTsNoCheck(queriesFilePath);

  console.log('Queries processing completed successfully!');
}

/**
 * Main function to handle command line arguments
 */
function main() {
  // Print biome information at the beginning
  printBiomeInfo();

  postprocessQueries();
}

main();
