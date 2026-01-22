import * as fs from 'node:fs';
import * as path from 'node:path';
import Handlebars from 'handlebars';

/**
 * PromptTemplate class for loading and rendering Handlebars templates.
 * Provides a clean interface for template operations with caching support.
 */
export class PromptTemplate {
  private template: HandlebarsTemplateDelegate;
  private static partialsRegistered = false;

  /**
   * Private constructor - use PromptTemplate.load() instead
   * @param compiledTemplate - The compiled Handlebars template
   */
  private constructor(compiledTemplate: HandlebarsTemplateDelegate) {
    this.template = compiledTemplate;
  }

  /**
   * Register all partials from the partials directory.
   * This is called automatically when loading a template.
   */
  private static registerPartials(): void {
    if (PromptTemplate.partialsRegistered) {
      return;
    }

    const partialsDir = path.join(__dirname, 'templates', 'partials');

    // Check if partials directory exists
    if (!fs.existsSync(partialsDir)) {
      PromptTemplate.partialsRegistered = true;
      return;
    }

    // Read all files in the partials directory
    const partialFiles = fs.readdirSync(partialsDir);

    for (const file of partialFiles) {
      if (file.endsWith('.md')) {
        const partialName = path.basename(file, '.md');
        const partialPath = path.join(partialsDir, file);
        const partialContent = fs.readFileSync(partialPath, 'utf-8');
        Handlebars.registerPartial(partialName, partialContent);
      }
    }

    PromptTemplate.partialsRegistered = true;
  }

  /**
   * Load and compile a template from file.
   * @param templateName - Name of the template file (e.g., 'node-agent-system.md')
   * @returns A new PromptTemplate instance with the compiled template
   */
  static load(templateName: string): PromptTemplate {
    // Register partials before loading template
    PromptTemplate.registerPartials();

    const templatePath = path.join(__dirname, 'templates', templateName);
    const templateContent = fs.readFileSync(templatePath, 'utf-8');
    const compiledTemplate = Handlebars.compile(templateContent);
    return new PromptTemplate(compiledTemplate);
  }

  /**
   * Render the template with provided data.
   * @param data - Data object to pass to the template
   * @returns Rendered template string
   */
  render(data?: Record<string, any>): string {
    return this.template(data ?? {});
  }
}
