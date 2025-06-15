#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

/**
 * Refly I18n Translation Consistency Checker
 * check i18n consistency in packages/i18n
 */

// config
const CONFIG = {
  I18N_DIR: path.join(__dirname, '../packages/i18n/src'),
  LANGUAGES: {
    base: 'en-US', // base language (english)
    target: 'zh-Hans', // target language (simplified chinese)
  },
  TRANSLATION_FILES: ['ui.ts', 'skill.ts', 'skill-log.ts'],
  OUTPUT: {
    reportPath: path.join(__dirname, '../i18n-consistency-report.json'),
    verbose: true,
  },
};

// console colors
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m',
  bold: '\x1b[1m',
};

class I18nConsistencyChecker {
  constructor() {
    this.errors = [];
    this.warnings = [];
    this.stats = {
      totalKeys: 0,
      checkedFiles: 0,
      languages: 2,
      missingTranslations: 0,
      extraTranslations: 0,
    };
  }

  /**
   * extract translation keys from TypeScript translation files
   */
  extractTranslationKeys(filePath) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');

      // match const translations = { ... } pattern
      const translationMatch = content.match(
        /const translations = ({[\s\S]*?});?\s*export default translations/,
      );
      if (!translationMatch) {
        throw new Error(`failed to parse translation object: ${filePath}`);
      }

      // clean and preprocess translation object string
      let translationStr = translationMatch[1];

      // process template strings and function calls
      translationStr = translationStr.replace(/t\([^)]+\)/g, '"__TEMPLATE_FUNCTION__"');
      translationStr = translationStr.replace(/returnObjects:\s*true/g, '"__RETURN_OBJECTS__"');

      // safely evaluate translation object
      const translationObj = this.safeEval(translationStr);

      return this.flattenTranslationObject(translationObj);
    } catch (error) {
      this.errors.push({
        type: 'parse_error',
        file: filePath,
        message: `failed to parse file: ${error.message}`,
      });
      return {};
    }
  }

  /**
   * safely evaluate translation object
   */
  safeEval(str) {
    try {
      // use Function constructor instead of eval for security
      return new Function(`return ${str}`)();
    } catch (error) {
      throw new Error(`translation object syntax error: ${error.message}`);
    }
  }

  /**
   * flatten nested translation object to dot notation keys
   */
  flattenTranslationObject(obj, prefix = '') {
    const flattened = {};

    for (const key in obj) {
      if (Object.hasOwn(obj, key)) {
        const fullKey = prefix ? `${prefix}.${key}` : key;
        const value = obj[key];

        if (value && typeof value === 'object' && !Array.isArray(value)) {
          // recursively process nested objects
          Object.assign(flattened, this.flattenTranslationObject(value, fullKey));
        } else {
          // leaf node
          flattened[fullKey] = value;
        }
      }
    }

    return flattened;
  }

  /**
   * compare translation keys of two languages
   */
  compareTranslations(baseKeys, targetKeys, fileName) {
    const baseKeySet = new Set(Object.keys(baseKeys));
    const targetKeySet = new Set(Object.keys(targetKeys));

    // find missing translations (english has, chinese doesn't)
    const missingKeys = [...baseKeySet].filter((key) => !targetKeySet.has(key));
    if (missingKeys.length > 0) {
      this.errors.push({
        type: 'missing_translations',
        file: `zh-Hans/${fileName}`,
        count: missingKeys.length,
        keys: missingKeys,
        message: `missing ${missingKeys.length} chinese translations`,
      });
      this.stats.missingTranslations += missingKeys.length;
    }

    // find extra translations (chinese has, english doesn't)
    const extraKeys = [...targetKeySet].filter((key) => !baseKeySet.has(key));
    if (extraKeys.length > 0) {
      this.warnings.push({
        type: 'extra_translations',
        file: `zh-Hans/${fileName}`,
        count: extraKeys.length,
        keys: extraKeys,
        message: `found ${extraKeys.length} extra chinese translations`,
      });
      this.stats.extraTranslations += extraKeys.length;
    }

    // check empty translations
    const emptyTranslations = Object.keys(targetKeys).filter((key) => {
      const value = targetKeys[key];
      return value === '' || value === null || value === undefined;
    });

    if (emptyTranslations.length > 0) {
      this.warnings.push({
        type: 'empty_translations',
        file: `zh-Hans/${fileName}`,
        count: emptyTranslations.length,
        keys: emptyTranslations,
        message: `found ${emptyTranslations.length} empty chinese translations`,
      });
    }

    // check if there are translations that are the same as english (possibly forgotten)
    const untranslatedKeys = Object.keys(targetKeys).filter((key) => {
      const baseValue = baseKeys[key];
      const targetValue = targetKeys[key];
      return (
        baseValue &&
        targetValue &&
        typeof baseValue === 'string' &&
        typeof targetValue === 'string' &&
        baseValue === targetValue &&
        /^[a-zA-Z\s]+$/.test(baseValue)
      ); // only check pure english text
    });

    if (untranslatedKeys.length > 0) {
      this.warnings.push({
        type: 'untranslated_text',
        file: `zh-Hans/${fileName}`,
        count: untranslatedKeys.length,
        keys: untranslatedKeys,
        message: `found ${untranslatedKeys.length} possible untranslated texts`,
      });
    }
  }

  /**
   * run consistency check
   */
  runConsistencyCheck() {
    console.log(`${colors.blue}${colors.bold}🌐 checking i18n consistency...${colors.reset}\n`);

    for (const fileName of CONFIG.TRANSLATION_FILES) {
      console.log(`${colors.cyan}📄 checking ${fileName}...${colors.reset}`);

      const baseFilePath = path.join(CONFIG.I18N_DIR, CONFIG.LANGUAGES.base, fileName);
      const targetFilePath = path.join(CONFIG.I18N_DIR, CONFIG.LANGUAGES.target, fileName);

      // check if file exists
      if (!fs.existsSync(baseFilePath)) {
        this.errors.push({
          type: 'file_not_found',
          file: `${CONFIG.LANGUAGES.base}/${fileName}`,
          message: `english translation file not found: ${baseFilePath}`,
        });
        continue;
      }

      if (!fs.existsSync(targetFilePath)) {
        this.errors.push({
          type: 'file_not_found',
          file: `${CONFIG.LANGUAGES.target}/${fileName}`,
          message: `chinese translation file not found: ${targetFilePath}`,
        });
        continue;
      }

      // extract translation keys
      const baseKeys = this.extractTranslationKeys(baseFilePath);
      const targetKeys = this.extractTranslationKeys(targetFilePath);

      if (Object.keys(baseKeys).length === 0 || Object.keys(targetKeys).length === 0) {
        continue; // if parsing fails, error has already been recorded
      }

      this.stats.totalKeys += Object.keys(baseKeys).length;

      // compare translations
      this.compareTranslations(baseKeys, targetKeys, fileName);

      this.stats.checkedFiles++;
    }
  }

  /**
   * generate detailed report
   */
  generateReport() {
    console.log(`\n${colors.blue}${colors.bold}📊 i18n consistency report${colors.reset}`);
    console.log(`${colors.blue}${'='.repeat(50)}${colors.reset}\n`);

    // statistics
    console.log(`${colors.cyan}📈 statistics:${colors.reset}`);
    console.log('  • checked languages: chinese (zh-Hans) ↔ english (en-US)');
    console.log(`  • checked files: ${this.stats.checkedFiles}/${CONFIG.TRANSLATION_FILES.length}`);
    console.log(`  • total english translations: ${this.stats.totalKeys}`);
    console.log(`  • missing chinese translations: ${this.stats.missingTranslations}`);
    console.log(`  • extra chinese translations: ${this.stats.extraTranslations}`);
    console.log(`  • found errors: ${this.errors.length}`);
    console.log(`  • found warnings: ${this.warnings.length}\n`);

    // error details
    if (this.errors.length > 0) {
      console.log(`${colors.red}${colors.bold}❌ errors (${this.errors.length}):${colors.reset}`);
      this.errors.forEach((error, index) => {
        console.log(`  ${index + 1}. ${error.message}`);
        if (error.keys && error.keys.length > 0) {
          const displayKeys = error.keys.slice(0, 5);
          console.log(
            `     missing keys: ${displayKeys.join(', ')}${error.keys.length > 5 ? ` and ${error.keys.length - 5} more` : ''}`,
          );
        }
      });
      console.log('');
    }

    // warning details
    if (this.warnings.length > 0) {
      console.log(
        `${colors.yellow}${colors.bold}⚠️  warnings (${this.warnings.length}):${colors.reset}`,
      );
      this.warnings.forEach((warning, index) => {
        console.log(`  ${index + 1}. ${warning.message}`);
        if (warning.keys && warning.keys.length > 0) {
          const displayKeys = warning.keys.slice(0, 3);
          console.log(
            `     related keys: ${displayKeys.join(', ')}${warning.keys.length > 3 ? ` and ${warning.keys.length - 3} more` : ''}`,
          );
        }
      });
      console.log('');
    }

    // summary
    const hasErrors = this.errors.length > 0;
    const hasWarnings = this.warnings.length > 0;

    if (!hasErrors && !hasWarnings) {
      console.log(
        `${colors.green}${colors.bold}✅ i18n consistency check passed!${colors.reset}\n`,
      );
      return true;
    } else if (!hasErrors) {
      console.log(
        `${colors.yellow}${colors.bold}⚠️  i18n consistency check passed, but there are some issues to be aware of${colors.reset}\n`,
      );
      return true;
    } else {
      console.log(
        `${colors.red}${colors.bold}❌ i18n consistency check failed, please fix the issues!${colors.reset}\n`,
      );
      return false;
    }
  }

  /**
   *  make JSON report
   */
  generateJsonReport() {
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        success: this.errors.length === 0,
        totalErrors: this.errors.length,
        totalWarnings: this.warnings.length,
        checkedFiles: this.stats.checkedFiles,
        totalKeys: this.stats.totalKeys,
        missingTranslations: this.stats.missingTranslations,
        extraTranslations: this.stats.extraTranslations,
      },
      languages: {
        base: CONFIG.LANGUAGES.base,
        target: CONFIG.LANGUAGES.target,
      },
      files: CONFIG.TRANSLATION_FILES,
      errors: this.errors,
      warnings: this.warnings,
      stats: this.stats,
    };

    try {
      fs.writeFileSync(CONFIG.OUTPUT.reportPath, JSON.stringify(report, null, 2), 'utf8');
      console.log(
        `${colors.blue}📄 detailed report saved to: ${CONFIG.OUTPUT.reportPath}${colors.reset}\n`,
      );
    } catch (error) {
      console.error(`${colors.red}failed to save report: ${error.message}${colors.reset}`);
    }

    return report;
  }

  /**
   * run full check process
   */
  run() {
    try {
      console.log(`${colors.bold}Refly I18n Translation Consistency Checker${colors.reset}`);
      console.log(`${colors.cyan}checking directory: ${CONFIG.I18N_DIR}${colors.reset}\n`);

      this.runConsistencyCheck();
      const success = this.generateReport();
      this.generateJsonReport();

      // set exit code based on result
      process.exit(success ? 0 : 1);
    } catch (error) {
      console.error(
        `${colors.red}${colors.bold}💥 error occurred during check: ${error.message}${colors.reset}`,
      );
      console.error(error.stack);
      process.exit(1);
    }
  }
}

// if directly run this script
if (require.main === module) {
  const checker = new I18nConsistencyChecker();
  checker.run();
}

module.exports = I18nConsistencyChecker;
