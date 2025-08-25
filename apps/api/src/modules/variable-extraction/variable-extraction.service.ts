import { Injectable, Logger } from '@nestjs/common';
import { User } from '@refly/openapi-schema';
import { PrismaService } from '../common/prisma.service';
import { CanvasService } from '../canvas/canvas.service';
import { CanvasSyncService } from '../canvas/canvas-sync.service';
import { ProviderService } from '../provider/provider.service';
import { genVariableExtractionSessionID } from '@refly/utils';
import {
  buildVariableExtractionPrompt,
  buildValidationPrompt,
  buildHistoricalPrompt,
  buildConsensusPrompt,
} from './prompt';
import {
  ExtractionContext,
  VariableExtractionResult,
  WorkflowVariable,
  CandidateRecord,
  CanvasData,
  CanvasContext,
  VariableExtractionOptions,
  HistoricalData,
} from 'src/modules/variable-extraction/variable-extraction.dto';
import {
  addTimestampsToNewVariable,
  updateTimestampForVariable,
  hasVariableChanged,
} from './utils';

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
   * Core variable extraction method (integrated simplified gating mechanism)
   *
   * Use cases:
   * - direct mode: directly update Canvas variables, suitable for user-confirmed variable extraction
   * - candidate mode: return candidate solutions, suitable for scenarios requiring user confirmation
   *
   * Purpose: intelligently extract workflow variables based on user input and canvas context,
   * supporting dual-path validation and fallback strategies
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

    let extractionResult: VariableExtractionResult;

    // 3. Execute corresponding mode based on gating decision
    if (mode === 'direct') {
      // Enhanced direct mode: dual-path validation
      extractionResult = await this.performEnhancedDirectExtraction(
        prompt,
        context,
        user,
        canvasId,
      );
    } else {
      // Candidate mode: use existing complete implementation
      extractionResult = await this.performCandidateModeExtraction(
        prompt,
        context,
        user,
        canvasId,
        sessionId,
      );
    }

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
   * Enhanced direct mode: dual-path validation processing
   *
   * Use cases: high-quality variable extraction in direct mode, requiring double verification to ensure accuracy
   *
   * Purpose:
   * - Execute parallel main path and validation path LLM extractions
   * - Generate consensus results and perform quality checks
   * - Automatically downgrade to candidate mode if quality is not met
   */
  private async performEnhancedDirectExtraction(
    prompt: string,
    context: ExtractionContext,
    user: User,
    canvasId: string,
  ): Promise<VariableExtractionResult> {
    try {
      this.logger.log('Performing enhanced direct mode extraction with dual-path validation');

      // 1. Parallel dual-path processing
      const [primaryResult, validationResult] = await Promise.all([
        this.performLLMExtraction(prompt, context, user),
        this.performValidationLLMExtraction(prompt, context, user),
      ]);

      // 2. Generate consensus results
      const consensusResult = await this.generateConsensusResult(
        primaryResult,
        validationResult,
        user,
      );

      // 3. Basic quality check
      const qualityScore = await this.performBasicQualityCheck(consensusResult, context);

      if (qualityScore >= 0.8) {
        this.logger.log('Enhanced direct mode quality check passed');
        return consensusResult;
      } else {
        this.logger.warn(
          `Enhanced direct mode quality below threshold: ${qualityScore}, falling back to candidate mode`,
        );
        // Fallback to candidate mode
        return await this.performCandidateModeExtraction(
          prompt,
          context,
          user,
          canvasId,
          undefined,
        );
      }
    } catch (error) {
      this.logger.error(
        `Enhanced direct mode failed: ${error.message}, falling back to candidate mode`,
      );
      // Fallback to candidate mode
      return await this.performCandidateModeExtraction(prompt, context, user, canvasId, undefined);
    }
  }

  /**
   * Candidate mode: use existing complete implementation
   *
   * Use cases: variable extraction requiring user confirmation, or as a fallback strategy for direct mode
   *
   * Purpose:
   * - Get comprehensive historical data for analysis
   * - Build enhanced historical learning prompts
   * - Execute multi-round LLM processing to improve quality
   * - Does not handle storage, only responsible for extraction logic
   */
  private async performCandidateModeExtraction(
    prompt: string,
    context: ExtractionContext,
    user: User,
    canvasId: string,
    sessionId?: string,
  ): Promise<VariableExtractionResult> {
    this.logger.log('Performing candidate mode extraction with full features');

    // 1. Get comprehensive historical data
    const historicalData = await this.getComprehensiveHistoricalData(user.uid, canvasId);

    // 2. Build enhanced prompt
    const enhancedPrompt = this.buildAdvancedHistoryPrompt(prompt, context, historicalData);

    // 3. Execute multi-round LLM processing
    const extractionResult = await this.performMultiRoundLLMExtraction(
      enhancedPrompt,
      context,
      user,
      prompt,
    );

    // 4. Do not save candidate record here, let the caller handle storage logic
    // Only set sessionId if passed
    if (sessionId) {
      extractionResult.sessionId = sessionId;
    }

    return extractionResult;
  }

  private async prepareChatModel(user: User) {
    const chatPi = await this.providerService.findDefaultProviderItem(user, 'chat');
    if (!chatPi || chatPi.category !== 'llm' || !chatPi.enabled) {
      throw new Error('No valid LLM provider found for validation');
    }

    const model = await this.providerService.prepareChatModel(user, chatPi.itemId);

    return model;
  }

  /**
   * Validation LLM extraction (used for enhanced direct mode dual-path validation)
   *
   * Use cases: validation path in enhanced direct mode, providing second opinion to validate main path results
   *
   * Purpose:
   * - Use validation-oriented prompts for variable extraction
   * - Focus on variable accuracy and reasonability
   * - Provide validation and supplement for main path results
   */
  private async performValidationLLMExtraction(
    prompt: string,
    context: ExtractionContext,
    user: User,
  ): Promise<VariableExtractionResult> {
    try {
      // Use validation mode prompt
      const validationPrompt = buildValidationPrompt(prompt, context.variables, {
        nodeCount: context.analysis.nodeCount,
        complexity: context.analysis.complexity,
        resourceCount: context.analysis.resourceCount,
        lastExtractionTime: context.extractionContext.lastExtractionTime,
        recentVariablePatterns: context.extractionContext.recentVariablePatterns,
        workflowType: context.analysis.workflowType,
        primarySkills: context.analysis.primarySkills,
      } as CanvasContext);

      const model = await this.prepareChatModel(user);
      const response = await model.invoke(validationPrompt);
      const responseText = response.content.toString();

      return this.parseLLMResponse(responseText, prompt);
    } catch (error) {
      this.logger.error(`Validation LLM extraction failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Generate consensus results (used for enhanced direct mode)
   */
  private async generateConsensusResult(
    primaryResult: VariableExtractionResult,
    validationResult: VariableExtractionResult,
    user: User,
  ): Promise<VariableExtractionResult> {
    try {
      // Use consensus generation prompt
      const consensusPrompt = buildConsensusPrompt(primaryResult, validationResult);

      const model = await this.prepareChatModel(user);
      const response = await model.invoke(consensusPrompt);
      const responseText = response.content.toString();

      try {
        const consensusData = JSON.parse(responseText);
        if (consensusData.variables && Array.isArray(consensusData.variables)) {
          return {
            ...primaryResult,
            variables: consensusData.variables,
            reusedVariables: consensusData.reusedVariables || primaryResult.reusedVariables,
          };
        }
      } catch (parseError) {
        this.logger.warn(
          `Failed to parse consensus LLM response, using primary result: ${parseError}`,
        );
      }

      // If LLM consensus generation fails, use intelligent merge logic
      return this.mergeResultsIntelligently(primaryResult, validationResult);
    } catch (error) {
      this.logger.error(`Consensus generation failed: ${error.message}`);
      // Return intelligent merge result as fallback
      return this.mergeResultsIntelligently(primaryResult, validationResult);
    }
  }

  /**
   * Intelligent merge of two extraction results
   */
  private mergeResultsIntelligently(
    primaryResult: VariableExtractionResult,
    validationResult: VariableExtractionResult,
  ): VariableExtractionResult {
    const mergedVariables = [...primaryResult.variables];
    const mergedReusedVariables = [...primaryResult.reusedVariables];

    // Merge new variables from validation result
    for (const validationVar of validationResult.variables) {
      const existingIndex = mergedVariables.findIndex((v) => v.name === validationVar.name);
      if (existingIndex >= 0) {
        // If variable exists, choose the higher quality version
        const existingVar = mergedVariables[existingIndex];
        if (
          this.calculateVariableQuality(validationVar) > this.calculateVariableQuality(existingVar)
        ) {
          mergedVariables[existingIndex] = validationVar;
        }
      } else {
        // Add new variable
        mergedVariables.push(validationVar);
      }
    }

    // Merge reused variables
    for (const reuseVar of validationResult.reusedVariables) {
      const existingIndex = mergedReusedVariables.findIndex(
        (v) => v.reusedVariableName === reuseVar.reusedVariableName,
      );
      if (existingIndex < 0) {
        mergedReusedVariables.push(reuseVar);
      }
    }

    return {
      ...primaryResult,
      variables: mergedVariables,
      reusedVariables: mergedReusedVariables,
    };
  }

  /**
   * Calculate variable quality score
   */
  private calculateVariableQuality(variable: WorkflowVariable): number {
    let score = 0;

    // Based on variable name quality
    if (variable.name && variable.name.length > 0) score += 0.3;

    // Based on description quality
    if (variable.description && variable.description.length > 10) score += 0.3;

    // Based on variable type
    if (variable.variableType) score += 0.2;

    // Based on value existence
    if (variable.value && Array.isArray(variable.value) && variable.value.length > 0) score += 0.2;

    return score;
  }

  /**
   * Basic quality check (used for enhanced direct mode)
   */
  private async performBasicQualityCheck(
    result: VariableExtractionResult,
    context: ExtractionContext,
  ): Promise<number> {
    try {
      // 1. Syntax validation
      const syntaxValid = this.validateSyntax(result);

      // 2. Context relevance check
      const contextRelevant = this.checkContextRelevance(result, context);

      // 3. Variable completeness check
      const variableCompleteness = this.checkVariableCompleteness(result);

      // 4. Calculate overall score
      const overallScore = this.calculateOverallScore(
        syntaxValid,
        contextRelevant,
        variableCompleteness,
      );

      return overallScore;
    } catch (error) {
      this.logger.error(`Basic quality check failed: ${error.message}`);
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
   * Calculate overall score
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
   * Get comprehensive historical data (for candidate mode)
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
          take: 20,
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
   * Build advanced history prompt (for candidate mode)
   */
  private buildAdvancedHistoryPrompt(
    prompt: string,
    context: ExtractionContext,
    historicalData: HistoricalData,
  ): string {
    return buildHistoricalPrompt(
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
   * Execute multi-round LLM processing (for candidate mode)
   */
  private async performMultiRoundLLMExtraction(
    enhancedPrompt: string,
    context: ExtractionContext,
    user: User,
    prompt: string,
  ): Promise<VariableExtractionResult> {
    try {
      // Use enhanced prompt for LLM extraction

      const model = await this.prepareChatModel(user);
      const response = await model.invoke(enhancedPrompt);
      const responseText = response.content.toString();

      return this.parseLLMResponse(responseText, prompt);
    } catch (error) {
      this.logger.error(`Multi-round LLM extraction failed: ${error.message}`);
      // Fallback to basic extraction
      return this.performLLMExtraction(enhancedPrompt, context, user);
    }
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
        extractedVariables: JSON.parse(record.extractedVariables),
        reusedVariables: JSON.parse(record.reusedVariables),
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
      // Handle value as array, take the first value for replacement
      const valueToReplace = Array.isArray(variable.value) ? variable.value[0] : variable.value;
      if (valueToReplace) {
        // Simple text replacement, actual implementation may require more intelligent matching
        processedPrompt = processedPrompt.replace(new RegExp(valueToReplace, 'gi'), placeholder);
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
    originalPrompt: string,
    context: ExtractionContext,
    user: User,
  ): Promise<VariableExtractionResult> {
    try {
      // 1. Get LLM model instance (refer to pilot.service.ts pattern)
      const model = await this.prepareChatModel(user);

      // 2. Build variable extraction prompt (using enhanced version)
      const extractionPrompt = buildVariableExtractionPrompt(originalPrompt, context.variables, {
        nodeCount: context.analysis.nodeCount,
        complexity: context.analysis.complexity,
        resourceCount: context.analysis.resourceCount,
        lastExtractionTime: context.extractionContext.lastExtractionTime,
        recentVariablePatterns: context.extractionContext.recentVariablePatterns,
        workflowType: context.analysis.workflowType,
        primarySkills: context.analysis.primarySkills,
      } as CanvasContext);

      this.logger.log(
        `Performing LLM extraction for prompt: "${originalPrompt.substring(0, 100)}..."`,
      );

      // 3. Call LLM for variable extraction
      const response = await model.invoke(extractionPrompt);
      const responseText = response.content.toString();

      // 4. Parse LLM response
      const extractionResult = this.parseLLMResponse(responseText, originalPrompt);

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
  private parseLLMResponse(responseText: string, originalPrompt: string): VariableExtractionResult {
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

      const parsed = JSON.parse(jsonText);

      // Validate response structure - support new analysis fields
      if (!parsed.variables || !Array.isArray(parsed.variables)) {
        this.logger.warn('Invalid response structure: missing or invalid variables array');
        throw new Error('Invalid response structure: missing variables array');
      }

      // Validate analysis fields
      if (!parsed.analysis) {
        this.logger.warn('Missing analysis field in LLM response');
      }

      // Convert to standard format, ensure all required fields exist
      const variables: WorkflowVariable[] = parsed.variables.map((v: any, index: number) => {
        // Ensure variable value is in array format
        let value: string[];
        if (Array.isArray(v.value)) {
          value = v.value;
        } else if (typeof v.value === 'string') {
          value = [v.value];
        } else {
          value = [''];
        }

        return {
          name: v.name || `extracted_var_${index + 1}`,
          value,
          description: v.description || `Extracted variable ${index + 1}`,
          variableType: v.variableType || 'string',
          source: v.source || 'startNode',
        };
      });

      // Get processed prompt
      const processedPrompt =
        parsed.processedPrompt || this.generateProcessedPrompt(originalPrompt, variables);

      // Process reused variables
      const reusedVariables = (parsed.reusedVariables || []).map((rv: any) => ({
        detectedText: rv.detectedText || '',
        reusedVariableName: rv.reusedVariableName || '',
        confidence: rv.confidence || 0.5,
        reason: rv.reason || 'System detected reuse opportunity',
      }));

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
      const currentVariables = await this.canvasSyncService.getWorkflowVariables(user, {
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
        // Use CanvasSyncService to update workflow variables in canvas
        await this.canvasSyncService.updateWorkflowVariables(user, {
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
        extractionConfidence: this.calculateOverallConfidence(result),
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
      const variables = await this.canvasSyncService.getWorkflowVariables(user, {
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
   * Calculate overall confidence of extraction result
   * Based on confidence score returned by LLM, provide a more reliable evaluation
   */
  private calculateOverallConfidence(result: VariableExtractionResult): number {
    if (!result.variables.length) {
      return 0;
    }

    // 1. Calculate base score based on variable confidence returned by LLM
    const variableConfidences = result.variables
      .map((v) => (v as any).confidence || 0.8) // If no confidence, default to 0.8
      .filter((conf) => conf > 0); // Filter out invalid confidence

    if (variableConfidences.length === 0) {
      return 0.5; // If no valid confidence, return medium score
    }

    // 2. Calculate weighted average confidence (more variables, higher weight)
    const totalConfidence = variableConfidences.reduce((sum, conf) => sum + conf, 0);
    const baseConfidence = totalConfidence / variableConfidences.length;

    // 3. Adjust confidence based on number of variables (more variables, confidence may decrease)
    const variableCountAdjustment = Math.max(0.1, 1 - (result.variables.length - 1) * 0.05);

    // 4. Adjust confidence based on variable type distribution
    const typeDistribution = this.calculateTypeDistributionConfidence(result.variables);

    // 5. Adjust confidence based on reused variables
    const reuseAdjustment = result.reusedVariables.length > 0 ? 0.05 : 0;

    // 6. Adjust confidence based on quality of processed prompt
    const processedPromptQuality = this.assessProcessedPromptQuality(result);

    // 7. Comprehensive final confidence calculation
    const finalConfidence = Math.min(
      1,
      baseConfidence * variableCountAdjustment * typeDistribution +
        reuseAdjustment +
        processedPromptQuality,
    );

    this.logger.debug(
      `Confidence calculation: base=${baseConfidence.toFixed(3)}, ` +
        `countAdj=${variableCountAdjustment.toFixed(3)}, ` +
        `typeDist=${typeDistribution.toFixed(3)}, ` +
        `reuse=${reuseAdjustment.toFixed(3)}, ` +
        `promptQuality=${processedPromptQuality.toFixed(3)}, ` +
        `final=${finalConfidence.toFixed(3)}`,
    );

    return finalConfidence;
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
  private detectWorkflowType(contentItems: any[], variables: WorkflowVariable[]): string {
    // Detect workflow type based on content item types
    const itemTypes = contentItems.map((item) => item.type);

    if (itemTypes.includes('resource') && itemTypes.includes('text')) {
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
  private detectPrimarySkills(contentItems: any[], variables: WorkflowVariable[]): string[] {
    const skills = new Set<string>();

    // Infer skills based on content item types
    const itemTypes = contentItems.map((item) => item.type);

    if (itemTypes.includes('text')) {
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
}
