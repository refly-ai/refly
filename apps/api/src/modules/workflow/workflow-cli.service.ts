import { Injectable, Logger } from '@nestjs/common';
import { CanvasService } from '../canvas/canvas.service';
import { CanvasSyncService } from '../canvas-sync/canvas-sync.service';
import { ToolService } from '../tool/tool.service';
import { User, CanvasNode, CanvasNodeType } from '@refly/openapi-schema';
import { genCanvasID, genNodeID, genNodeEntityId } from '@refly/utils';
import { CreateWorkflowRequest } from './workflow-cli.dto';
import {
  CliNodeInput,
  buildConnectToFilters,
  transformCliNodesToCanvasNodes,
} from './workflow-cli.utils';
import { CanvasNodeFilter } from '@refly/canvas-common';

@Injectable()
export class WorkflowCliService {
  private readonly logger = new Logger(WorkflowCliService.name);

  constructor(
    private readonly canvasService: CanvasService,
    private readonly canvasSyncService: CanvasSyncService,
    private readonly toolService: ToolService,
  ) {}

  async createWorkflowFromSpec(
    user: User,
    body: CreateWorkflowRequest,
  ): Promise<{ workflowId: string; name: string; createdAt: string }> {
    this.logger.log(`Creating workflow for user ${user.uid}: ${body.name}`);

    const canvasId = genCanvasID();
    const hasUserNodes = body.spec?.nodes?.length > 0;
    const userProvidesStartNode = body.spec?.nodes?.some((n: any) => n.type === 'start');
    const skipDefaultNodes = hasUserNodes;

    const canvas = await this.canvasService.createCanvas(
      user,
      {
        canvasId,
        title: body.name,
        variables: body.variables,
      },
      { skipDefaultNodes },
    );

    if (hasUserNodes) {
      const transformedNodes = transformCliNodesToCanvasNodes(
        body.spec.nodes as unknown as CliNodeInput[],
      );

      for (const node of transformedNodes) {
        const toolsetKeys = (node.data?.metadata as Record<string, unknown>)?.toolsetKeys as
          | string[]
          | undefined;
        if (toolsetKeys?.length) {
          this.logger.log(`[CREATE] Resolving toolset keys: ${toolsetKeys.join(', ')}`);
          const { resolved } = await this.toolService.resolveToolsetsByKeys(user, toolsetKeys);
          this.logger.log(`[CREATE] Resolved ${resolved.length} toolsets`);
          const metadata = node.data?.metadata as Record<string, unknown>;
          const existingToolsets = (metadata?.selectedToolsets as unknown[]) || [];
          metadata.selectedToolsets = [...existingToolsets, ...resolved];
          metadata.toolsetKeys = undefined;

          if (resolved.length > 0) {
            const toolsetMentions = resolved
              .map((t) => `@{type=toolset,id=${t.id},name=${t.name}}`)
              .join(' ');
            const existingQuery = (metadata.query as string) || '';
            if (!existingQuery.includes('@{type=toolset')) {
              metadata.query = existingQuery
                ? `使用 ${toolsetMentions} ${existingQuery}`
                : toolsetMentions;
              this.logger.log(`[CREATE] Updated query with toolset mentions: ${metadata.query}`);
            }
          }
        }
      }

      if (!userProvidesStartNode) {
        const startNode = {
          node: {
            id: genNodeID(),
            type: 'start' as const,
            data: {
              title: 'Start',
              entityId: genNodeEntityId('start'),
            },
          },
          connectTo: [],
        };

        await this.canvasSyncService.addNodesToCanvas(user, canvasId, [startNode], {
          autoLayout: true,
        });
      }

      let connectToMap: Map<string, CanvasNodeFilter[]> = new Map();

      if (body.spec.edges) {
        connectToMap = buildConnectToFilters(
          transformedNodes.map((n) => ({
            ...n,
            id: n.id!,
            position: { x: 0, y: 0 },
          })) as CanvasNode[],
          body.spec.edges,
        );
      } else {
        const cliNodes = body.spec.nodes as unknown as CliNodeInput[];
        for (const cliNode of cliNodes) {
          if (cliNode.dependsOn?.length) {
            const connectTo: CanvasNodeFilter[] = cliNode.dependsOn
              .map((sourceId) => {
                const sourceNode = transformedNodes.find((n) => n.id === sourceId);
                if (sourceNode?.data?.entityId) {
                  return {
                    type: sourceNode.type as CanvasNodeType,
                    entityId: sourceNode.data.entityId,
                  };
                }
                return null;
              })
              .filter((x): x is CanvasNodeFilter => x !== null);

            if (connectTo.length > 0) {
              connectToMap.set(cliNode.id, connectTo);
            }
          }
        }
      }

      const nodesToAdd = transformedNodes.map((node) => ({
        node,
        connectTo: connectToMap.get(node.id!) || [],
      }));

      await this.canvasSyncService.addNodesToCanvas(user, canvasId, nodesToAdd, {
        autoLayout: true,
      });
    }

    return {
      workflowId: canvas.canvasId,
      name: canvas.title ?? body.name,
      createdAt: canvas.createdAt.toJSON(),
    };
  }
}
