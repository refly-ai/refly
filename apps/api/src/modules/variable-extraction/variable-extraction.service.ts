import { Injectable, Logger } from '@nestjs/common';
import { User, WorkflowVariable, VariableValue } from '@refly/openapi-schema';
import { PrismaService } from '../common/prisma.service';
import { CanvasService } from '../canvas/canvas.service';
import { CanvasSyncService } from '../canvas-sync/canvas-sync.service';
import { ProviderService } from '../provider/provider.service';
import { genVariableExtractionSessionID } from '@refly/utils';
import { buildUnifiedPrompt } from './prompt';
import { buildAppPublishPrompt } from './app-publish-prompt';
import { genVariableID } from '@refly/utils';

import {
  ExtractionContext,
  VariableExtractionResult,
  CandidateRecord,
  CanvasData,
  CanvasContext,
  VariableExtractionOptions,
  HistoricalData,
  AppTemplateResult,
} from './variable-extraction.dto';
import {
  addTimestampsToNewVariable,
  updateTimestampForVariable,
  hasVariableChanged,
} from './utils';
import { CanvasContentItem } from '../canvas/canvas.dto';

// Define proper types for LLM response parsing
interface LLMVariableResponse {
  name: string;
  value: string[] | VariableValue[];
  description?: string;
  variableType?: 'string' | 'option' | 'resource';
  source?: string;
  extractionReason?: string;
  confidence?: number;
}

interface LLMReusedVariableResponse {
  detectedText: string;
  reusedVariableName: string;
  confidence: number;
  reason: string;
}

interface LLMAnalysisResponse {
  userIntent?: string;
  extractionConfidence?: number;
  complexityScore?: number;
  extractedEntityCount?: number;
  variableTypeDistribution?: Record<string, number>;
}

interface LLMExtractionResponse {
  analysis?: LLMAnalysisResponse;
  variables: LLMVariableResponse[];
  reusedVariables: LLMReusedVariableResponse[];
  processedPrompt?: string;
  originalPrompt?: string;
}

@Injectable()
export class VariableExtractionService {
  private logger = new Logger(VariableExtractionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly canvasService: CanvasService,
    private readonly canvasSyncService: CanvasSyncService,
    private readonly providerService: ProviderService,
  ) {}

  /**
   * Core variable extraction method (unified approach)
   *
   * Use cases:
   * - direct mode: directly update Canvas variables, suitable for user-confirmed variable extraction
   * - candidate mode: return candidate solutions, suitable for scenarios requiring user confirmation
   *
   * Purpose: intelligently extract workflow variables based on user input and canvas context,
   * using unified high-quality extraction strategy
   */
  async extractVariables(
    user: User,
    prompt: string,
    canvasId: string,
    options: VariableExtractionOptions = {},
  ): Promise<VariableExtractionResult> {
    const { mode = 'direct', sessionId, triggerType = 'askAI_direct' } = options;

    // 1. Check candidate record (when sessionId exists, regardless of mode)
    if (mode === 'direct' && sessionId) {
      const candidateRecord = await this.getCandidateRecord(sessionId);
      if (candidateRecord && !candidateRecord.applied) {
        return this.applyCandidateRecord(user, canvasId, candidateRecord);
      }
    }

    // 2. Build context (multi-dimensional analysis)
    const context = await this.buildEnhancedContext(canvasId, user);

    // 3. Perform unified variable extraction
    const extractionResult = await this.performUnifiedVariableExtraction(
      prompt,
      context,
      user,
      canvasId,
      sessionId,
    );

    // Get model name for recording
    const model = await this.prepareChatModel(user);
    const modelName = model?.constructor?.name || 'unknown';

    // 4. Process results based on mode (unified storage logic)
    if (mode === 'direct') {
      await this.updateCanvasVariables(user, canvasId, extractionResult.variables);

      // Use unified save function
      await this.saveExtractionRecord(user, canvasId, extractionResult, {
        mode: 'direct',
        triggerType,
        model: modelName,
        status: 'applied',
      });
    } else {
      // Candidate mode: use unified save function
      const finalSessionId = await this.saveExtractionRecord(user, canvasId, extractionResult, {
        mode: 'candidate',
        triggerType,
        model: modelName,
        status: 'pending',
      });
      extractionResult.sessionId = finalSessionId;
    }

    return extractionResult;
  }

  /**
   * Unified variable extraction method
   * Uses the same high-quality strategy for both direct and candidate modes
   */
  private async performUnifiedVariableExtraction(
    prompt: string,
    context: ExtractionContext,
    user: User,
    canvasId: string,
    sessionId?: string,
  ): Promise<VariableExtractionResult> {
    this.logger.log('Performing unified variable extraction with enhanced features');

    // 1. Get comprehensive historical data
    const historicalData = await this.getComprehensiveHistoricalData(user.uid, canvasId);

    // 2. Build unified enhanced prompt
    const enhancedPrompt = this.buildUnifiedEnhancedPrompt(prompt, context, historicalData);

    // 3. Execute LLM extraction
    const extractionResult = await this.performLLMExtraction(enhancedPrompt, user, prompt, context);

    // 4. Basic quality check
    extractionResult.extractionConfidence = this.calculateOverallConfidence(
      extractionResult,
      context,
    );

    // 5. Set sessionId if provided
    if (sessionId) {
      extractionResult.sessionId = sessionId;
    }

    return extractionResult;
  }

  private async prepareChatModel(user: User) {
    const chatPi = await this.providerService.findDefaultProviderItem(user, 'chat');
    if (!chatPi || chatPi.category !== 'llm' || !chatPi.enabled) {
      throw new Error('No valid LLM provider found for variable extraction');
    }

    const model = await this.providerService.prepareChatModel(user, chatPi.itemId);

    return model;
  }

  /**
   * Enhanced quality check with minimalist principles
   * Aligns with prompt engineering requirements
   */
  private performBasicQualityCheck(
    result: VariableExtractionResult,
    context: ExtractionContext,
  ): number {
    try {
      // 1. Variable quantity validation (CRITICAL from prompt)
      const quantityValid = this.validateVariableQuantity(result);

      // 2. Minimalist extraction validation
      const minimalistValid = this.validateMinimalistExtraction(result);

      // 3. Syntax validation
      const syntaxValid = this.validateSyntax(result);

      // 4. Context relevance check
      const contextRelevant = this.checkContextRelevance(result, context);

      // 5. Variable completeness check
      const variableCompleteness = this.checkVariableCompleteness(result);

      // 6. Calculate overall score with new weights
      const overallScore = this.calculateEnhancedOverallScore(
        quantityValid,
        minimalistValid,
        syntaxValid,
        contextRelevant,
        variableCompleteness,
      );

      return overallScore;
    } catch (error) {
      this.logger.error(`Enhanced quality check failed: ${error.message}`);
      return 0.5; // Return medium score as fallback
    }
  }

  /**
   * Syntax validation
   */
  private validateSyntax(result: VariableExtractionResult): boolean {
    return result.variables.every(
      (v) => v.name && v.name.length > 0 && v.variableType && Array.isArray(v.value),
    );
  }

  /**
   * Context relevance check
   */
  private checkContextRelevance(
    result: VariableExtractionResult,
    context: ExtractionContext,
  ): boolean {
    // If no existing variables, consider relevant
    if (context.variables.length === 0) {
      return true;
    }

    // Check if extracted variables overlap with existing variables
    const existingNames = new Set(context.variables.map((v) => v.name));
    const extractedNames = new Set(result.variables.map((v) => v.name));

    const overlap = Array.from(existingNames).filter((name) => extractedNames.has(name));
    return overlap.length > 0 || result.variables.length > 0;
  }

  /**
   * Variable quantity validation - CRITICAL from prompt requirements
   * Ensures each variable type stays within 10-variable limit
   */
  private validateVariableQuantity(result: VariableExtractionResult): number {
    if (result.variables.length === 0) return 0;

    const typeCounts = new Map<string, number>();

    // Count variables by type
    for (const variable of result.variables) {
      const type = variable.variableType || 'string';
      typeCounts.set(type, (typeCounts.get(type) || 0) + 1);
    }

    let totalScore = 0;
    let typeCount = 0;

    // Check each type against 10-variable limit
    for (const [_type, count] of typeCounts) {
      typeCount++;
      if (count <= 10) {
        // Bonus for staying well under limit (prefer 3-6 total variables)
        if (count <= 6) {
          totalScore += 1.0; // Perfect score
        } else {
          totalScore += 0.8; // Good score
        }
      } else {
        totalScore += 0.2; // Penalty for exceeding limit
      }
    }

    // Average score across all types
    return typeCount > 0 ? totalScore / typeCount : 0;
  }

  /**
   * Minimalist extraction validation - ensures quality over quantity
   * Aligns with prompt engineering principle of extracting only essential variables
   */
  private validateMinimalistExtraction(result: VariableExtractionResult): number {
    if (result.variables.length === 0) return 0;

    // Target range: 3-6 variables total (from examples analysis)
    const totalVariables = result.variables.length;

    if (totalVariables >= 3 && totalVariables <= 6) {
      return 1.0; // Perfect minimalist extraction
    } else if (totalVariables <= 8) {
      return 0.8; // Good extraction
    } else if (totalVariables <= 10) {
      return 0.6; // Acceptable but not ideal
    } else {
      return 0.3; // Too many variables - violates minimalist principle
    }
  }

  /**
   * Variable completeness check
   */
  private checkVariableCompleteness(result: VariableExtractionResult): boolean {
    if (result.variables.length === 0) return false;

    // Check if each variable has necessary fields
    const completeVariables = result.variables.filter(
      (v) => v.name && v.variableType && v.description,
    );

    return completeVariables.length / result.variables.length >= 0.8;
  }

  /**
   * Enhanced overall score calculation with minimalist principles
   */
  private calculateEnhancedOverallScore(
    quantityValid: number,
    minimalistValid: number,
    syntaxValid: boolean,
    contextRelevant: boolean,
    variableCompleteness: boolean,
  ): number {
    let score = 0;

    // Quantity validation has highest weight (30%) - critical from prompt
    score += quantityValid * 0.3;

    // Minimalist extraction validation (25%) - new requirement
    score += minimalistValid * 0.25;

    // Syntax validation (20%)
    score += (syntaxValid ? 1 : 0) * 0.2;

    // Context relevance (15%)
    score += (contextRelevant ? 1 : 0) * 0.15;

    // Variable completeness (10%)
    score += (variableCompleteness ? 1 : 0) * 0.1;

    return score;
  }

  /**
   * Legacy overall score calculation (kept for backward compatibility)
   */
  private calculateOverallScore(
    syntaxValid: boolean,
    contextRelevant: boolean,
    variableCompleteness: boolean,
  ): number {
    let score = 0;

    if (syntaxValid) score += 0.4;
    if (contextRelevant) score += 0.3;
    if (variableCompleteness) score += 0.3;

    return score;
  }

  /**
   * Get comprehensive historical data
   */
  private async getComprehensiveHistoricalData(
    uid: string,
    canvasId: string,
  ): Promise<HistoricalData> {
    try {
      const [extractionHistory, canvasPatterns] = await Promise.all([
        this.prisma.variableExtractionHistory.findMany({
          where: { uid, status: 'applied' },
          orderBy: { createdAt: 'desc' },
          take: 3,
        }),
        this.getRecentVariablePatterns(canvasId),
      ]);

      return {
        extractionHistory,
        canvasPatterns,
      };
    } catch (error) {
      this.logger.error(`Failed to get comprehensive historical data: ${error.message}`);
      // Return empty data as fallback
      return {
        extractionHistory: [],
        canvasPatterns: [],
      };
    }
  }

  /**
   * Build unified enhanced prompt
   */
  private buildUnifiedEnhancedPrompt(
    prompt: string,
    context: ExtractionContext,
    historicalData: HistoricalData,
  ): string {
    return buildUnifiedPrompt(
      prompt,
      context.variables,
      {
        nodeCount: context.analysis.nodeCount,
        complexity: context.analysis.complexity,
        resourceCount: context.analysis.resourceCount,
        lastExtractionTime: context.extractionContext.lastExtractionTime,
        recentVariablePatterns: context.extractionContext.recentVariablePatterns,
        workflowType: context.analysis.workflowType,
        primarySkills: context.analysis.primarySkills,
      } as CanvasContext,
      historicalData,
    );
  }

  /**
   * Build context - multi-dimensional Canvas analysis
   *
   * Use cases: context preparation before variable extraction, needs to analyze canvas state and historical information
   *
   * Purpose:
   * - Get Canvas data and content items
   * - Analyze workflow complexity and features
   * - Detect workflow type and primary skills
   * - Build complete extraction context information
   */
  public async buildEnhancedContext(canvasId: string, user: User): Promise<ExtractionContext> {
    try {
      // 1. Get Canvas data and content items
      const contentItems = await this.canvasService.getCanvasContentItems(user, canvasId, true);

      const skillResponses = await this.canvasService.getCanvasSkillResponses(user, canvasId);

      // 2. Get Canvas workflow information (including existing variables)
      const canvasData = await this.getCanvasWorkflowData(user, canvasId);

      // 3. Extract existing workflow variables
      const variables = await this.getCanvasVariables(user, canvasId);

      // 4. Smartly analyze Canvas features
      const analysis = {
        // Calculate workflow complexity (number of nodes, connections, nesting level)
        complexity: this.calculateComplexityScore(canvasData),

        // Basic statistics
        nodeCount: canvasData.nodes?.length || 0,
        variableCount: variables.length,
        resourceCount: contentItems.filter((item) => item.type === 'resource').length,

        // Workflow type and skill analysis
        workflowType: this.detectWorkflowType(contentItems, variables),
        primarySkills: this.detectPrimarySkills(contentItems, variables),
      };

      this.logger.log(
        `Built context for canvas ${canvasId}: ${analysis.nodeCount} nodes, ${analysis.variableCount} variables`,
      );

      return {
        canvasData,
        variables,
        contentItems,
        skillResponses,
        analysis,
        // Context metadata
        extractionContext: {
          lastExtractionTime: await this.getLastExtractionTime(canvasId),
          recentVariablePatterns: await this.getRecentVariablePatterns(canvasId),
        },
      };
    } catch (error) {
      this.logger.error(`Error building context for canvas ${canvasId}:`, error);
      // Return empty context to ensure service availability
      return {
        canvasData: { nodes: [] },
        variables: [],
        contentItems: [],
        skillResponses: [],
        analysis: {
          complexity: 0,
          nodeCount: 0,
          variableCount: 0,
          resourceCount: 0,
          workflowType: 'Generic Workflow',
          primarySkills: ['Content Generation'],
        },
        extractionContext: {
          lastExtractionTime: undefined,
          recentVariablePatterns: [],
        },
      };
    }
  }

  private async getCandidateRecord(sessionId: string): Promise<CandidateRecord | null> {
    try {
      const record = await this.prisma.variableExtractionHistory.findUnique({
        where: {
          sessionId,
          status: 'pending',
          extractionMode: 'candidate',
        },
      });

      if (!record) {
        return null;
      }

      return {
        sessionId: record.sessionId!,
        canvasId: record.canvasId,
        uid: record.uid,
        originalPrompt: record.originalPrompt,
        extractedVariables: JSON.parse(record.extractedVariables) as WorkflowVariable[],
        reusedVariables: JSON.parse(record.reusedVariables) as Array<{
          detectedText: string;
          reusedVariableName: string;
          confidence: number;
          reason: string;
        }>,
        applied: record.status === 'applied',
        createdAt: record.createdAt,
      };
    } catch (error) {
      this.logger.error(`Error getting candidate record ${sessionId}:`, error);
      return null;
    }
  }

  private async applyCandidateRecord(
    user: User,
    canvasId: string,
    record: CandidateRecord,
  ): Promise<VariableExtractionResult> {
    try {
      this.logger.log(`Applying candidate record ${record.sessionId} for canvas ${canvasId}`);

      // Convert candidate record to extraction result
      const result: VariableExtractionResult = {
        originalPrompt: record.originalPrompt, // Use original prompt from candidate record
        processedPrompt: this.generateProcessedPrompt(
          record.originalPrompt,
          record.extractedVariables,
        ),
        variables: record.extractedVariables,
        reusedVariables: record.reusedVariables,
        sessionId: record.sessionId, // Keep session ID
      };

      // Update candidate record status to applied
      await this.prisma.variableExtractionHistory.update({
        where: {
          sessionId: record.sessionId,
          uid: user.uid,
        },
        data: {
          status: 'applied',
          appliedAt: new Date(),
        },
      });

      // Update Canvas variables
      await this.updateCanvasVariables(user, canvasId, record.extractedVariables);

      this.logger.log(`Successfully applied candidate record ${record.sessionId}`);
      return result;
    } catch (error) {
      this.logger.error(`Error applying candidate record ${record.sessionId}:`, error);
      throw new Error(`Failed to apply candidate record: ${error.message}`);
    }
  }

  /**
   * Generate processed prompt template based on extracted variables
   */
  private generateProcessedPrompt(originalPrompt: string, variables: WorkflowVariable[]): string {
    let processedPrompt = originalPrompt;

    // Replace variables with placeholder format
    for (const variable of variables) {
      const placeholder = `{{${variable.name}}}`;

      // Handle new VariableValue structure - process ALL values, not just the first one
      if (variable.value && Array.isArray(variable.value) && variable.value.length > 0) {
        // Process all values in the array
        for (const valueItem of variable.value) {
          let valueToReplace: string | undefined;

          if (valueItem.type === 'text' && valueItem.text) {
            valueToReplace = valueItem.text;
          } else if (valueItem.type === 'resource' && valueItem.resource) {
            valueToReplace = valueItem.resource.name;
          }

          if (valueToReplace) {
            // Escape regex special characters to prevent errors
            const escapedValue = valueToReplace.toString().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            // Simple text replacement, actual implementation may require more intelligent matching
            processedPrompt = processedPrompt.replace(new RegExp(escapedValue, 'gi'), placeholder);
          }
        }
      }
    }

    return processedPrompt;
  }

  /**
   * Execute LLM variable extraction
   *
   * Use cases: core variable extraction logic, needs to call LLM for intelligent analysis
   *
   * Purpose:
   * - Get LLM model instance
   * - Build enhanced variable extraction prompt
   * - Call LLM for variable extraction
   * - Parse and validate LLM response
   */
  public async performLLMExtraction(
    llmPrompt: string,
    user: User,
    originalPrompt: string,
    context: ExtractionContext,
  ): Promise<VariableExtractionResult> {
    try {
      // 1. Get LLM model instance
      const model = await this.prepareChatModel(user);

      this.logger.log(`Performing LLM extraction for prompt: "${llmPrompt.substring(0, 100)}..."`);

      // 2. Call LLM for variable extraction
      const response = await model.invoke(llmPrompt);
      const responseText = response.content.toString();

      // 3. Parse LLM response
      const extractionResult = this.parseLLMResponse(responseText, originalPrompt, context);

      this.logger.log(
        `LLM extraction completed with ${extractionResult.variables.length} variables`,
      );

      return extractionResult;
    } catch (error) {
      this.logger.error(`Error in LLM extraction: ${error.message}`);

      // Fallback to basic extraction, ensure service availability
      this.logger.warn('Falling back to basic extraction due to LLM failure');
      return {
        originalPrompt,
        processedPrompt: originalPrompt,
        variables: [],
        reusedVariables: [],
      };
    }
  }

  /**
   * Parse LLM response to get variable extraction result
   */
  private parseLLMResponse(
    responseText: string,
    originalPrompt: string,
    context: ExtractionContext,
  ): VariableExtractionResult {
    try {
      this.logger.log('Parsing LLM response for variable extraction');

      // Try to extract JSON from response, supporting multiple formats
      const jsonMatch =
        responseText.match(/```json\s*\n([\s\S]*?)\n\s*```/) ||
        responseText.match(/```\s*\n([\s\S]*?)\n\s*```/) ||
        responseText.match(/\{[\s\S]*\}/) ||
        responseText.match(/\[[\s\S]*\]/);

      if (!jsonMatch) {
        this.logger.warn('No JSON structure found in LLM response');
        throw new Error('No JSON found in LLM response');
      }

      const jsonText = jsonMatch[1] || jsonMatch[0];
      this.logger.debug(`Parsing JSON: ${jsonText.substring(0, 200)}...`);

      const parsed = JSON.parse(jsonText) as LLMExtractionResponse;

      // Validate response structure - support new analysis fields
      if (!parsed.variables || !Array.isArray(parsed.variables)) {
        this.logger.warn('Invalid response structure: missing or invalid variables array');
        throw new Error('Invalid response structure: missing variables array');
      }

      // Validate analysis fields
      if (!parsed.analysis) {
        this.logger.warn('Missing analysis field in LLM response');
      }

      // Process reused variables
      const reusedVariables = (parsed.reusedVariables || []).map(
        (rv: LLMReusedVariableResponse) => ({
          detectedText: rv.detectedText || '',
          reusedVariableName: rv.reusedVariableName || '',
          confidence: rv.confidence || 0.5,
          reason: rv.reason || 'System detected reuse opportunity',
        }),
      );

      const canvasVariables = context.variables;

      // Convert to standard format, ensure all required fields exist
      const extractedVariables: WorkflowVariable[] = parsed.variables.map(
        (v: LLMVariableResponse, index: number) => {
          // Convert to proper VariableValue structure
          let value: VariableValue[];
          if (Array.isArray(v.value)) {
            if (v.value.length > 0 && typeof v.value[0] === 'object' && 'type' in v.value[0]) {
              // Already in VariableValue format
              value = v.value as VariableValue[];
            } else {
              // Convert from string array to VariableValue array
              value = (v.value as string[]).map((text) => ({
                type: 'text' as const,
                text: text || '',
              }));
            }
          } else {
            value = [
              {
                type: 'text' as const,
                text: '',
              },
            ];
          }

          return {
            variableId: genVariableID(),
            name: v.name || `extracted_var_${index + 1}`,
            value,
            description: v.description || `Extracted variable ${index + 1}`,
            variableType: v.variableType || 'string',
          };
        },
      );

      // Add reused variables from canvas that are not already in extracted variables
      const reusedCanvasVariables: WorkflowVariable[] = (reusedVariables || [])
        .filter((rv) => {
          // Find the corresponding canvas variable
          const canvasVar = canvasVariables?.find((cv) => cv.name === rv.reusedVariableName);
          if (!canvasVar) return false;

          // Check if this variable is already in extracted variables
          const isAlreadyExtracted = extractedVariables.some(
            (ev) => ev.name === rv.reusedVariableName,
          );
          return !isAlreadyExtracted;
        })
        .map((rv) => {
          const canvasVar = canvasVariables?.find((cv) => cv.name === rv.reusedVariableName);
          return {
            variableId: canvasVar?.variableId || genVariableID(),
            name: rv.reusedVariableName,
            value: canvasVar?.value ?? [{ type: 'text' as const, text: '' }],
            description: canvasVar?.description ?? `Reused variable: ${rv.reusedVariableName}`,
            variableType: canvasVar?.variableType ?? 'string',
          };
        });

      // Combine extracted and reused variables, ensuring no duplicates
      const variables: WorkflowVariable[] = [...extractedVariables, ...reusedCanvasVariables];

      // Get processed prompt
      const processedPrompt =
        parsed.processedPrompt || this.generateProcessedPrompt(originalPrompt, variables);

      // Record extraction statistics
      const analysis = parsed.analysis || {};
      this.logger.log(
        `LLM extraction completed: ${variables.length} variables, ` +
          `confidence: ${analysis.extractionConfidence || 'unknown'}, ` +
          `complexity: ${analysis.complexityScore || 'unknown'}`,
      );

      return {
        originalPrompt,
        processedPrompt,
        variables,
        reusedVariables,
      };
    } catch (error) {
      this.logger.error(`Failed to parse LLM response: ${error.message}`);
      this.logger.debug(`Raw response: ${responseText.substring(0, 500)}...`);

      // Return basic result, ensure service availability
      return {
        originalPrompt,
        processedPrompt: originalPrompt,
        variables: [],
        reusedVariables: [],
      };
    }
  }

  private async updateCanvasVariables(
    user: User,
    canvasId: string,
    variables: WorkflowVariable[],
  ): Promise<void> {
    try {
      this.logger.log(
        `Updating canvas ${canvasId} with ${variables.length} variables for user ${user.uid}`,
      );

      // Get current canvas state to retrieve workflow variables
      const currentVariables = await this.canvasService.getWorkflowVariables(user, {
        canvasId,
      });

      // Merge new variables with existing ones, properly handling timestamps
      const mergedVariables = [...(currentVariables || [])];
      let hasChanges = false;

      for (const newVariable of variables) {
        const existingIndex = mergedVariables.findIndex((v) => v.name === newVariable.name);

        if (existingIndex >= 0) {
          // Found existing variable - check if it actually changed
          const existingVariable = mergedVariables[existingIndex];

          if (hasVariableChanged(newVariable, existingVariable)) {
            // Variable has meaningful changes - update with new timestamp
            mergedVariables[existingIndex] = updateTimestampForVariable(
              newVariable,
              existingVariable,
            );
            hasChanges = true;
            this.logger.debug(`Updated existing variable: ${newVariable.name}`);
          } else {
            // No meaningful changes - keep existing variable with original timestamps
            this.logger.debug(`No changes detected for variable: ${newVariable.name}`);
          }
        } else {
          // New variable - add with creation timestamp
          const newVariableWithTimestamp = addTimestampsToNewVariable(newVariable);
          mergedVariables.push(newVariableWithTimestamp);
          hasChanges = true;
          this.logger.debug(`Added new variable: ${newVariable.name}`);
        }
      }

      // Only update if there are actual changes
      if (hasChanges) {
        // Use CanvasService to update workflow variables in canvas
        await this.canvasService.updateWorkflowVariables(user, {
          canvasId,
          variables: mergedVariables,
        });
        this.logger.log(`Canvas variables updated successfully for canvas ${canvasId}`);
      } else {
        this.logger.log(`No variable changes detected for canvas ${canvasId}, skipping update`);
      }
    } catch (error) {
      this.logger.error(`Failed to update canvas variables for ${canvasId}: ${error.message}`);
      throw new Error(`Failed to update canvas variables: ${error.message}`);
    }
  }

  /**
   * Unified variable extraction record saving method
   *
   * Use cases: unified handling of candidate records and direct mode historical records
   *
   * Purpose:
   * - Avoid code duplication
   * - Unified error handling
   * - Provide consistent logging
   */
  private async saveExtractionRecord(
    user: User,
    canvasId: string,
    result: VariableExtractionResult,
    options: {
      mode: 'candidate' | 'direct';
      triggerType: string;
      model?: string;
      status: 'pending' | 'applied';
    },
  ): Promise<string | undefined> {
    try {
      const sessionId =
        options.mode === 'candidate' ? genVariableExtractionSessionID() : result.sessionId;

      const recordData = {
        sessionId: options.mode === 'candidate' ? sessionId : result.sessionId || null,
        canvasId,
        uid: user.uid,
        triggerType: options.triggerType,
        extractionMode: options.mode,
        originalPrompt: result.originalPrompt,
        processedPrompt: result.processedPrompt,
        extractedVariables: JSON.stringify(result.variables),
        reusedVariables: JSON.stringify(result.reusedVariables),
        extractionConfidence: result.extractionConfidence,
        llmModel: options.model || null,
        status: options.status,
        ...(options.status === 'applied' && { appliedAt: new Date() }),
      };

      await this.prisma.variableExtractionHistory.create({
        data: recordData,
      });

      const logMessage =
        options.mode === 'candidate'
          ? `Saved candidate record ${sessionId} for canvas ${canvasId}`
          : `Saved extraction history for canvas ${canvasId}, mode: ${options.mode}`;

      this.logger.log(logMessage);

      // Candidate mode returns sessionId, direct mode returns undefined
      return options.mode === 'candidate' ? sessionId : undefined;
    } catch (error) {
      const errorMessage = `Error saving ${options.mode} record for canvas ${canvasId}: ${error.message}`;
      this.logger.error(errorMessage);

      throw new Error(`Failed to save candidate record: ${error.message}`);
    }
  }

  private calculateComplexityScore(canvasData: CanvasData): number {
    let score = 0;

    // Calculate base score based on number of nodes
    const nodeCount = canvasData.nodes?.length || 0;
    if (nodeCount > 0) {
      score += Math.min(30, nodeCount * 3);
    }

    // Calculate connection complexity based on number of edges
    const edgeCount = canvasData.edges?.length || 0;
    if (edgeCount > 0) {
      score += Math.min(25, edgeCount * 2);
    }

    // Calculate based on number of workflow variables
    const variableCount = canvasData.workflow?.variables?.length || 0;
    if (variableCount > 0) {
      score += Math.min(20, variableCount * 2);
    }

    // Calculate based on diversity of node types
    const nodeTypes = new Set(canvasData.nodes?.map((n) => n.type) || []);
    score += Math.min(25, nodeTypes.size * 5);

    return Math.min(100, score);
  }

  private async getLastExtractionTime(canvasId: string): Promise<Date | undefined> {
    try {
      const lastRecord = await this.prisma.variableExtractionHistory.findFirst({
        where: {
          canvasId,
          status: 'applied',
        },
        orderBy: {
          createdAt: 'desc',
        },
        select: {
          createdAt: true,
        },
      });

      return lastRecord?.createdAt;
    } catch (error) {
      this.logger.error(`Error getting last extraction time for canvas ${canvasId}:`, error);
      return undefined;
    }
  }

  private async getRecentVariablePatterns(canvasId: string): Promise<string[]> {
    try {
      const recentRecords = await this.prisma.variableExtractionHistory.findMany({
        where: {
          canvasId,
          status: 'applied',
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: 10,
        select: {
          extractedVariables: true,
        },
      });

      const patterns = new Set<string>();

      for (const record of recentRecords) {
        try {
          const variables = JSON.parse(record.extractedVariables) as WorkflowVariable[];
          for (const variable of variables) {
            if (variable.description) {
              patterns.add(variable.description);
            }
            patterns.add(variable.name);
          }
        } catch {
          // Ignore records with parsing errors
        }
      }

      return Array.from(patterns).slice(0, 10);
    } catch (error) {
      this.logger.error(`Error getting recent variable patterns for canvas ${canvasId}:`, error);
      // Return default patterns
      return [
        'Project Name',
        'Target User',
        'Function Scope',
        'Time Requirement',
        'Quality Standard',
      ];
    }
  }

  /**
   * Get Canvas workflow data
   */
  private async getCanvasWorkflowData(user: User, canvasId: string): Promise<CanvasData> {
    try {
      // This should call CanvasService to get workflow data
      // Since CanvasService may not have a direct workflow data interface, we return a basic structure for now
      const contentItems = await this.canvasService.getCanvasContentItems(user, canvasId, false);

      // Build node information from content items
      const nodes = contentItems.map((item) => ({
        id: item.id,
        type: item.type,
        title: item.title,
      }));

      return {
        nodes,
        edges: [], // Need to get connection information from Canvas service
        workflow: {
          variables: [], // Will be obtained in getCanvasVariables
        },
      };
    } catch (error) {
      this.logger.error(`Error getting canvas workflow data for ${canvasId}:`, error);
      return {
        nodes: [],
        edges: [],
        workflow: { variables: [] },
      };
    }
  }

  /**
   * Get existing Canvas variables
   */
  private async getCanvasVariables(user: User, canvasId: string): Promise<WorkflowVariable[]> {
    try {
      // Get workflow variables from Canvas service
      const variables = await this.canvasService.getWorkflowVariables(user, {
        canvasId,
      });

      this.logger.log(`Retrieved ${variables.length} canvas variables for canvas ${canvasId}`);
      return variables;
    } catch (error) {
      this.logger.error(`Error getting canvas variables for ${canvasId}:`, error);
      return [];
    }
  }

  /**
   * Enhanced confidence calculation with prompt engineering validation
   * Ensures extraction results align with prompt requirements
   */
  private calculateOverallConfidence(
    result: VariableExtractionResult,
    context: ExtractionContext,
  ): number {
    if (!result.variables.length) {
      return 0;
    }

    // 1. Use quality score as primary confidence indicator
    const qualityScore = this.performBasicQualityCheck(result, context);

    // 2. Calculate base confidence from LLM variable confidence
    const variableConfidences = result.variables
      .map((v) => {
        // Check if the variable has a confidence property from LLM response
        if ('confidence' in v && typeof v.confidence === 'number') {
          return v.confidence;
        }
        return 0.8; // Default confidence for variables without confidence property
      })
      .filter((conf) => conf > 0);

    if (variableConfidences.length === 0) {
      return qualityScore * 0.8; // Fallback to quality score
    }

    const baseConfidence =
      variableConfidences.reduce((sum, conf) => sum + conf, 0) / variableConfidences.length;

    // 3. Calculate confidence adjustments with better weighting
    const adjustments = {
      // Quality score has highest weight (35%) - includes prompt validation
      quality: qualityScore * 0.35,

      // LLM confidence has significant weight (30%)
      llmConfidence: baseConfidence * 0.3,

      // Prompt engineering compliance (20%) - NEW: validates against prompt requirements
      promptCompliance: this.validatePromptEngineeringCompliance(result) * 0.2,

      // Variable count adjustment (10%) - less aggressive
      variableCount: Math.max(0.7, 1 - (result.variables.length - 1) * 0.02) * 0.1,

      // Type distribution (3%)
      typeDistribution: this.calculateTypeDistributionConfidence(result.variables) * 0.03,

      // Reuse bonus (2%)
      reuseBonus: Math.min(0.02, result.reusedVariables.length * 0.01),
    };

    // 4. Calculate final confidence with weighted sum
    const finalConfidence = Object.values(adjustments).reduce((sum, value) => sum + value, 0);

    this.logger.debug(
      `Confidence calculation: ${Object.entries(adjustments)
        .map(([key, value]) => `${key}=${value.toFixed(3)}`)
        .join(', ')} => final=${finalConfidence.toFixed(3)}`,
    );

    return Math.min(1, Math.max(0, finalConfidence));
  }

  /**
   * Calculate confidence adjustment factor for variable type distribution
   */
  private calculateTypeDistributionConfidence(variables: WorkflowVariable[]): number {
    const typeCounts = new Map<string, number>();

    for (const variable of variables) {
      const type = variable.variableType || 'unknown';
      typeCounts.set(type, (typeCounts.get(type) || 0) + 1);
    }

    // More uniform type distribution, higher confidence
    const totalVariables = variables.length;
    const typeDiversity = typeCounts.size / Math.min(totalVariables, 3); // Max 3 types

    return 0.8 + typeDiversity * 0.2; // 0.8-1.0 range
  }

  /**
   * Validate prompt engineering compliance - NEW method
   * Ensures extraction results follow prompt engineering principles
   */
  private validatePromptEngineeringCompliance(result: VariableExtractionResult): number {
    let score = 0;

    // 1. Variable quantity compliance (CRITICAL from prompt)
    const quantityScore = this.validateVariableQuantity(result);
    score += quantityScore * 0.4;

    // 2. Minimalist extraction compliance
    const minimalistScore = this.validateMinimalistExtraction(result);
    score += minimalistScore * 0.3;

    // 3. Variable reuse compliance
    const reuseScore = result.reusedVariables.length > 0 ? 1.0 : 0.5;
    score += reuseScore * 0.2;

    // 4. Template quality compliance
    const templateScore = this.assessProcessedPromptQuality(result) * 10; // Scale to 0-1
    score += templateScore * 0.1;

    return Math.min(1, score);
  }

  /**
   * Assess quality of processed prompt
   */
  private assessProcessedPromptQuality(result: VariableExtractionResult): number {
    if (result.processedPrompt === result.originalPrompt) {
      return 0; // No processing, no bonus
    }

    // Check if placeholder count is reasonable
    const placeholderCount = (result.processedPrompt.match(/\{\{[^}]+\}\}/g) || []).length;
    const variableCount = result.variables.length;

    if (placeholderCount === 0 || variableCount === 0) {
      return 0;
    }

    // Placeholder count should match variable count
    const placeholderRatio =
      Math.min(placeholderCount, variableCount) / Math.max(placeholderCount, variableCount);

    // Check if placeholder format is correct
    const validPlaceholders = (
      result.processedPrompt.match(/\{\{[a-zA-Z_][a-zA-Z0-9_]*\}\}/g) || []
    ).length;
    const formatQuality = validPlaceholders / placeholderCount;

    return Math.min(0.1, placeholderRatio * formatQuality * 0.1);
  }

  /**
   * Detect workflow type
   */
  private detectWorkflowType(
    contentItems: CanvasContentItem[],
    variables: WorkflowVariable[],
  ): string {
    // Detect workflow type based on content item types
    const itemTypes = contentItems.map((item) => item.type);

    if (itemTypes.includes('resource') && itemTypes.includes('skillResponse')) {
      return 'Content Generation Workflow';
    } else if (
      itemTypes.includes('resource') &&
      variables.some((v) => v.variableType === 'resource')
    ) {
      return 'File Processing Workflow';
    } else if (variables.some((v) => v.variableType === 'option')) {
      return 'Configuration Selection Workflow';
    } else {
      return 'Generic Workflow';
    }
  }

  /**
   * Detect primary skills
   */
  private detectPrimarySkills(
    contentItems: CanvasContentItem[],
    variables: WorkflowVariable[],
  ): string[] {
    const skills = new Set<string>();

    // Infer skills based on content item types
    const itemTypes = contentItems.map((item) => item.type);

    if (itemTypes.includes('skillResponse')) {
      skills.add('Content Generation');
    }
    if (itemTypes.includes('resource')) {
      skills.add('File Processing');
    }
    if (variables.some((v) => v.variableType === 'option')) {
      skills.add('Configuration Management');
    }
    if (variables.some((v) => v.variableType === 'string')) {
      skills.add('Parameterization Processing');
    }

    return Array.from(skills).length > 0 ? Array.from(skills) : ['Content Generation'];
  }

  /**
   * Generate APP publish template
   * Based on Canvas all original prompts and variables, generate user-friendly natural language template
   * This is the core method for APP publishing workflow
   */
  async generateAppPublishTemplate(user: User, canvasId: string): Promise<AppTemplateResult> {
    try {
      this.logger.log(`Generating APP publish template for canvas ${canvasId}`);

      // 1. Build enhanced context for the canvas
      const context = await this.buildEnhancedContext(canvasId, user);

      // 2. Build APP publish prompt
      const appPublishPrompt = buildAppPublishPrompt(
        {
          nodes: context.canvasData.nodes || [],
          contentItems: context.contentItems,
          skillResponses: context.skillResponses,
          variables: context.variables,
          title: context.canvasData.title,
          description: context.canvasData.description,
        },
        context.analysis,
      );

      // 4. Execute LLM template generation
      const templateResult = await this.performLLMTemplateGeneration(
        appPublishPrompt,
        context,
        user,
      );

      // 5. Parse and validate template result
      const parsedTemplate = this.parseTemplateResult(templateResult, context);

      // 6. Build final result
      const result: AppTemplateResult = {
        templateContent: parsedTemplate.content,
        variables: parsedTemplate.variables,
        metadata: {
          extractedAt: Date.now(),
          variableCount: parsedTemplate.variables.length,
          promptCount: context.canvasData.nodes?.length || 0,
          canvasComplexity: this.getComplexityLevel(context.analysis.complexity),
          workflowType: context.analysis.workflowType,
          templateVersion: 1,
          skillResponses: context.skillResponses,
          workflowTitle: parsedTemplate.title,
          workflowDescription: parsedTemplate.description,
          estimatedExecutionTime: parsedTemplate.estimatedExecutionTime,
          skillTags: parsedTemplate.skillTags,
        },
      };

      this.logger.log(
        `Successfully generated APP template for canvas ${canvasId}: ${result.metadata.variableCount} variables, complexity: ${result.metadata.canvasComplexity}`,
      );

      return result;
    } catch (error) {
      this.logger.error(`Failed to generate APP publish template for canvas ${canvasId}:`, error);
      throw new Error(`APP template generation failed: ${error.message}`);
    }
  }

  /**
   * Execute LLM template generation
   */
  private async performLLMTemplateGeneration(
    prompt: string,
    _context: ExtractionContext,
    user: User,
  ): Promise<string> {
    try {
      const model = await this.prepareChatModel(user);
      this.logger.log('Executing LLM template generation');

      const response = await model.invoke(prompt);
      const responseText = response.content.toString();

      this.logger.log(`LLM template generation completed, response length: ${responseText.length}`);
      return responseText;
    } catch (error) {
      this.logger.error(`LLM template generation failed: ${error.message}`);
      throw new Error(`LLM template generation failed: ${error.message}`);
    }
  }

  /**
   * Parse template generation result
   */
  private parseTemplateResult(
    responseText: string,
    context: ExtractionContext,
  ): {
    content: string;
    title: string;
    description: string;
    variables: WorkflowVariable[];
    estimatedExecutionTime: string;
    skillTags: string[];
  } {
    try {
      this.logger.log('Parsing template generation result');

      // Try to extract JSON from response
      const jsonMatch =
        responseText.match(/```json\s*\n([\s\S]*?)\n\s*```/) ||
        responseText.match(/```\s*\n([\s\S]*?)\n\s*```/) ||
        responseText.match(/\{[\s\S]*\}/);

      if (!jsonMatch) {
        this.logger.warn('No JSON structure found in template response');
        throw new Error('No JSON found in template response');
      }

      const jsonText = jsonMatch[1] || jsonMatch[0];
      const parsed = JSON.parse(jsonText) as {
        template?: {
          content: string;
          title?: string;
          description?: string;
        };
        variables?: Array<{
          variableId?: string;
          name?: string;
          value?: VariableValue[];
          description?: string;
          variableType?: string;
        }>;
        analysis?: {
          estimatedExecutionTime?: string;
        };
        metadata?: {
          skillTags?: string[];
        };
      };

      // Validate required fields
      if (!parsed.template?.content) {
        throw new Error('Missing template content in response');
      }

      if (!parsed.variables || !Array.isArray(parsed.variables)) {
        throw new Error('Missing or invalid variables array in response');
      }

      // Process variables to ensure compatibility with new structure
      const processedVariables = parsed.variables.map(
        (v: {
          variableId?: string;
          name?: string;
          value?: VariableValue[];
          description?: string;
          variableType?: string;
        }) => {
          // Convert to proper VariableValue structure
          let value: VariableValue[];
          if (v.value && Array.isArray(v.value)) {
            if (v.value.length > 0 && typeof v.value[0] === 'object' && 'type' in v.value[0]) {
              // Already in VariableValue format
              value = v.value as VariableValue[];
            } else {
              // Convert from string array to VariableValue array
              value = (v.value as unknown as string[]).map((text) => ({
                type: 'text' as const,
                text: text || '',
              }));
            }
          } else {
            value = [{ type: 'text' as const, text: '' }];
          }

          return {
            variableId: genVariableID(),
            name: v.name || `var_${Math.random().toString(36).substr(2, 9)}`,
            value,
            description: v.description || `Variable ${v.name}`,
            variableType: (v.variableType as 'string' | 'resource' | 'option') || 'string',
          };
        },
      );

      return {
        content: parsed.template.content,
        title: parsed.template.title || 'Workflow Template',
        description: parsed.template.description || 'Generated workflow template',
        variables: processedVariables,
        estimatedExecutionTime: parsed.analysis?.estimatedExecutionTime || '5-10 minutes',
        skillTags: parsed.metadata?.skillTags ||
          context.analysis.primarySkills || ['Content Generation'],
      };
    } catch (error) {
      this.logger.error(`Failed to parse template result: ${error.message}`);
      this.logger.debug(`Raw response: ${responseText.substring(0, 500)}...`);

      // Return fallback template with proper VariableValue structure
      return {
        content: 'I will help you with your workflow. Please provide the necessary information.',
        title: 'Workflow Template',
        description: 'Generated workflow template',
        variables: context.variables.map((v) => ({
          ...v,
          value: v.value || [{ type: 'text' as const, text: '' }],
        })),
        estimatedExecutionTime: '5-10 minutes',
        skillTags: context.analysis.primarySkills || ['Content Generation'],
      };
    }
  }

  /**
   * Get complexity level string based on score
   */
  private getComplexityLevel(score: number): string {
    if (score < 30) return 'simple';
    if (score < 70) return 'medium';
    return 'complex';
  }
}
