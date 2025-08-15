import { CanvasState, InvokeSkillRequest, SkillInput, SkillContext } from '@refly/openapi-schema';

export interface WorkflowNode {
  id: string;
  type: string;
  entityId: string;
  title: string;
  status: 'waiting' | 'executing' | 'finished' | 'failed';
  children: string[];
  parents: string[];
  progress?: number; // Add progress tracking for polling
  startTime?: number; // Track when execution started
}

export class NodeExecutor {
  private canvasState: CanvasState | null = null;
  private maxExecutionTime = 30000; // Maximum execution time per node in milliseconds (30 seconds)

  /**
   * Set canvas state for context access
   */
  setCanvasState(canvasState: CanvasState): void {
    this.canvasState = canvasState;
  }

  /**
   * Execute single node
   */
  async executeNode(node: WorkflowNode): Promise<void> {
    console.log(`Starting execution of node: ${node.title} (${node.type})`);

    try {
      // Handle different node types
      switch (node.type) {
        case 'skill':
          await this.executeSkillNode(node);
          break;
        default:
          await this.executeGenericNode(node);
          break;
      }

      // Mark node as completed
      node.status = 'finished';
      node.progress = 100;

      console.log(`Finished executing node: ${node.title}`);
    } catch (error) {
      // Handle execution error
      console.error(`Node execution failed: ${node.title}`, error);
      node.status = 'failed';
      throw error; // Re-throw to be caught by the caller
    }
  }

  /**
   * Execute skill node - simulate InvokeSkillRequest
   */
  private async executeSkillNode(node: WorkflowNode): Promise<void> {
    console.log(`Processing skill node: ${node.title}`);

    // Simulate InvokeSkillRequest
    const skillRequest: InvokeSkillRequest = {
      input: {
        query: node.title || 'Process workflow step',
      } as SkillInput,
      context: this.buildSkillContext(node),
      skillName: 'commonQnA', // Default skill
      resultId: node.entityId,
    };

    console.log('Simulated InvokeSkillRequest:', {
      skillName: skillRequest.skillName,
      query: skillRequest.input?.query,
      contextItems: skillRequest.context ? Object.keys(skillRequest.context).length : 0,
    });

    // Simulate skill processing with progress updates
    const totalSteps = 5; // Reduced for faster testing
    for (let step = 1; step <= totalSteps; step++) {
      await new Promise((resolve) => setTimeout(resolve, 50)); // 50ms per step
      node.progress = (step / totalSteps) * 100;

      // Simulate some processing steps
      if (step === 3) {
        console.log(`Skill node ${node.title}: Processing input data...`);
      } else if (step === 6) {
        console.log(`Skill node ${node.title}: Generating response...`);
      } else if (step === 9) {
        console.log(`Skill node ${node.title}: Finalizing results...`);
      }
    }

    console.log(`Skill execution completed for: ${node.title}`);
  }

  /**
   * Execute generic node
   */
  private async executeGenericNode(node: WorkflowNode): Promise<void> {
    console.log(`Processing generic node: ${node.title}`);

    // Simulate generic processing with progress updates
    const totalSteps = 3; // Reduced for faster testing
    for (let step = 1; step <= totalSteps; step++) {
      await new Promise((resolve) => setTimeout(resolve, 30)); // 30ms per step
      node.progress = (step / totalSteps) * 100;

      // Simulate different processing phases
      if (step === 2) {
        console.log(`Generic node ${node.title}: Initializing...`);
      } else if (step === 4) {
        console.log(`Generic node ${node.title}: Processing...`);
      }
    }

    console.log(`Generic processing completed for: ${node.title}`);
  }

  /**
   * Check if node has timed out
   */
  isNodeTimedOut(node: WorkflowNode): boolean {
    if (!node.startTime) return false;
    return Date.now() - node.startTime > this.maxExecutionTime;
  }

  /**
   * Build skill context from canvas state
   */
  private buildSkillContext(node: WorkflowNode): SkillContext {
    if (!this.canvasState) {
      return {};
    }

    const context: SkillContext = {
      contentList: [
        {
          content: `Processing workflow step: ${node.title}`,
          metadata: {
            source: 'workflow',
            nodeId: node.id,
            nodeType: node.type,
          },
        },
      ],
    };

    // Add canvas metadata to context
    if (this.canvasState.nodes?.length > 0) {
      context.contentList?.push({
        content: `Canvas contains ${this.canvasState.nodes.length} nodes`,
        metadata: {
          source: 'canvas',
          canvasId: 'workflow-canvas',
        },
      });
    }

    return context;
  }
}
