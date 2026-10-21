// Credit billing of agent runs by terminal outcome.
// The heavy collaborators of SkillInvokerService are replaced by stubs so the test only drives the
// invocation loop (stream events -> usage aggregation -> terminal status -> credit billing).
jest.mock('@refly/skill-template', () => ({ createSkillInventory: jest.fn(() => []) }));
jest.mock('@refly/observability', () => {
  const span = {
    setStatus: jest.fn(),
    recordException: jest.fn(),
    end: jest.fn(),
    setAttributes: jest.fn(),
  };
  return {
    getTracer: () => ({
      startActiveSpan: (
        _name: string,
        _opts: unknown,
        _ctx: unknown,
        fn: (s: unknown) => unknown,
      ) => fn(span),
    }),
    Trace: () => () => undefined,
    FilteredLangfuseCallbackHandler: class {},
  };
});
jest.mock('@refly/utils/token', () => ({ countToken: jest.fn(() => 1) }));
jest.mock('../tool/tool.service', () => ({ ToolService: class {} }));
jest.mock('../tool/ptc', () => ({
  PtcSdkService: class {},
  getPtcConfig: jest.fn(),
  isPtcEnabledForToolsets: jest.fn(() => false),
}));
jest.mock('../drive/drive.service', () => ({ DriveService: class {} }));
jest.mock('./skill-engine.service', () => ({ SkillEngineService: class {} }));
jest.mock('../provider/provider.service', () => ({ ProviderService: class {} }));
jest.mock('../credit/credit.service', () => ({ CreditService: class {} }));
jest.mock('../misc/misc.service', () => ({ MiscService: class {} }));
jest.mock('../action/action.service', () => ({ ActionService: class {} }));
jest.mock('../canvas-sync/canvas-sync.service', () => ({ CanvasSyncService: class {} }));
jest.mock('../tool-call/tool-call.service', () => ({
  ToolCallService: class {},
  ToolCallStatus: {},
}));
jest.mock('../step/step.service', () => ({ StepService: class {} }));
jest.mock('../common/prisma.service', () => ({ PrismaService: class {} }));
jest.mock('./skill-invoke.metrics', () => ({ SkillInvokeMetrics: class {} }));

import { SkillInvokerService } from './skill-invoker.service';

type StreamEvent = Record<string, unknown>;

const modelCallEnd = (inputTokens: number, outputTokens: number): StreamEvent => ({
  event: 'on_chat_model_end',
  run_id: `run-${inputTokens}`,
  metadata: { ls_model_name: 'operator-model', step: { name: 'answerQuestion' } },
  data: {
    output: {
      usage_metadata: { input_tokens: inputTokens, output_tokens: outputTokens },
      response_metadata: {},
    },
  },
});

function buildService() {
  const fn = () => jest.fn().mockResolvedValue(undefined);
  const prisma = {
    actionMessage: { createMany: fn(), update: fn() },
    actionStep: { createMany: jest.fn(() => 'actionStep.createMany') },
    actionResult: {
      updateMany: jest.fn((_args: { data: Record<string, unknown> }) => 'actionResult.updateMany'),
      findFirst: fn(),
    },
    workflowNodeExecution: { updateMany: jest.fn(), findUnique: fn() },
    canvas: { findFirst: fn() },
    $transaction: jest.fn().mockResolvedValue([]),
  };
  const config = { get: jest.fn(() => undefined) };
  const logger = {
    setContext: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  };
  const providerService = {
    findLLMProviderItemByModelID: jest.fn().mockResolvedValue({
      itemId: 'pi-operator',
      name: 'Operator model',
      tier: 't1',
      provider: { name: 'operator' },
    }),
  };
  const actionService = {
    deleteQueuedJob: fn(),
    registerAbortController: jest.fn(),
    unregisterAbortController: jest.fn(),
    isAbortRequested: jest.fn().mockResolvedValue(false),
    abortActionFromReq: fn(),
  };
  const stepService = { buildCacheKey: jest.fn(() => 'steps'), setCache: fn(), clearCache: fn() };
  const metrics = {
    llm: { success: jest.fn(), fail: jest.fn(), duration: jest.fn(), token: jest.fn() },
    tool: { success: jest.fn(), fail: jest.fn(), duration: jest.fn() },
  };
  const skillEngineService = { getEngine: jest.fn(() => ({})) };
  const driveService = { archiveFiles: fn(), generateDriveFileUrls: fn() };

  const service = new SkillInvokerService(
    prisma as any,
    config as any,
    logger as any,
    {} as any, // miscService
    providerService as any,
    driveService as any,
    {} as any, // toolService
    {} as any, // toolCallService
    skillEngineService as any,
    actionService as any,
    stepService as any,
    {} as any, // creditService
    {} as any, // canvasSyncService
    metrics as any,
    {} as any, // ptcSdkService
  );
  jest.spyOn(service as any, 'buildInvokeConfig').mockResolvedValue({
    config: { configurable: {}, metadata: {} },
    cleanupResources: jest.fn().mockResolvedValue(undefined),
  });
  const billing = jest
    .spyOn(service as any, 'processCreditUsageReport')
    .mockResolvedValue(undefined);
  return { service, billing, prisma };
}

async function runAgent(events: StreamEvent[], failure?: Error) {
  const { service, billing, prisma } = buildService();
  (service as any).skillInventory = [
    {
      name: 'commonQnA',
      async *streamEvents() {
        for (const event of events) {
          yield event;
        }
        if (failure) {
          throw failure;
        }
      },
    },
  ];
  await (service as any)._invokeSkill(
    { uid: 'u-customer' },
    {
      skillName: 'commonQnA',
      input: { query: 'read the attached files and save notes' },
      context: {},
      result: { resultId: 'ar-test', version: 0, actionMeta: {}, status: 'executing', errors: [] },
      providerItem: { config: {} },
      mode: 'node_agent',
    },
  );
  const updates = prisma.actionResult.updateMany.mock.calls;
  const status = updates[updates.length - 1]?.[0]?.data;
  let recordedInputTokens = 0;
  if (billing.mock.calls.length) {
    const aggregator = billing.mock.calls[0][3] as any;
    const steps = await aggregator.getSteps({ resultId: 'ar-test', version: 0 });
    for (const step of steps) {
      for (const usage of JSON.parse(step.tokenUsage)) {
        recordedInputTokens += usage.inputTokens;
      }
    }
  }
  return { billing, status, recordedInputTokens };
}

describe('SkillInvokerService credit billing by run outcome', () => {
  afterEach(() => {
    jest.clearAllTimers();
  });

  it('bills the model calls of a run that completes', async () => {
    const { billing, status, recordedInputTokens } = await runAgent([
      modelCallEnd(3000, 20),
      modelCallEnd(45000, 20),
    ]);
    expect(status).toMatchObject({ status: 'finish' });
    expect(billing).toHaveBeenCalledTimes(1);
    expect(recordedInputTokens).toBe(48000);
  });

  it('bills the model calls that completed before the user aborted', async () => {
    const abort = new Error('Aborted by user');
    abort.name = 'AbortError';
    const { billing, status } = await runAgent(
      [modelCallEnd(3000, 20), modelCallEnd(45000, 20)],
      abort,
    );
    expect(status).toMatchObject({ status: 'failed', errorType: 'userAbort' });
    expect(billing).toHaveBeenCalledTimes(1);
  });

  it('bills the model calls that completed before a later model call failed', async () => {
    const providerError = new Error(
      "400 This model's maximum context length is 128000 tokens. However, your messages resulted in 166088 tokens.",
    );
    const { billing, status, recordedInputTokens } = await runAgent(
      [modelCallEnd(3000, 20), modelCallEnd(45000, 20), modelCallEnd(90000, 20)],
      providerError,
    );
    expect(status).toMatchObject({ status: 'failed', errorType: 'systemError' });
    expect(billing).toHaveBeenCalledTimes(1);
    expect(recordedInputTokens).toBe(138000);
  });
});
