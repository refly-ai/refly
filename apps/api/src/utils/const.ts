export const QUEUE_RESOURCE = 'resource';
export const QUEUE_SKILL = 'skill';
export const QUEUE_ACTION = 'action';
export const QUEUE_SIMPLE_EVENT = 'simpleEvent';
export const QUEUE_SYNC_TOKEN_USAGE = 'syncTokenUsage';
export const QUEUE_SYNC_TOKEN_CREDIT_USAGE = 'syncTokenCreditUsage';
export const QUEUE_SYNC_MEDIA_CREDIT_USAGE = 'syncMediaCreditUsage';
export const QUEUE_SYNC_TOOL_CREDIT_USAGE = 'syncToolCreditUsage';
export const QUEUE_SYNC_STORAGE_USAGE = 'syncStorageUsage';
export const QUEUE_SYNC_CANVAS_ENTITY = 'syncCanvasEntity';
export const QUEUE_CLEAR_CANVAS_ENTITY = 'clearCanvasEntity';
export const QUEUE_DELETE_KNOWLEDGE_ENTITY = 'deleteKnowledgeEntity';
export const QUEUE_POST_DELETE_KNOWLEDGE_ENTITY = 'postDeleteKnowledgeEntity';
export const QUEUE_AUTO_NAME_CANVAS = 'autoNameCanvas';
export const QUEUE_POST_DELETE_CANVAS = 'postDeleteCanvas';
export const QUEUE_VERIFY_NODE_ADDITION = 'verifyNodeAddition';
export const QUEUE_RUN_PILOT = 'runPilot';
export const QUEUE_SYNC_PILOT_STEP = 'syncPilotStep';
export const QUEUE_RUN_WORKFLOW = 'runWorkflow';
export const QUEUE_POLL_WORKFLOW = 'pollWorkflow';
export const QUEUE_CREATE_SHARE = 'createShare';
export const QUEUE_SCALEBOX_EXECUTE = 'scaleboxExecute';
export const QUEUE_SCALEBOX_PAUSE = 'scaleboxPause';
export const QUEUE_SCALEBOX_KILL = 'scaleboxKill';
export const QUEUE_SCHEDULE_EXECUTION = 'scheduleExecution';

export const QUEUE_CHECK_CANCELED_SUBSCRIPTIONS = 'checkCanceledSubscriptions';
export const QUEUE_EXPIRE_AND_RECHARGE_CREDITS = 'expireAndRechargeCredits';
export const QUEUE_SYNC_REQUEST_USAGE = 'syncRequestUsage';
export const QUEUE_IMAGE_PROCESSING = 'imageProcessing';
export const QUEUE_CLEAN_STATIC_FILES = 'cleanStaticFiles';
export const QUEUE_CHECK_STUCK_ACTIONS = 'checkStuckActions';
export const QUEUE_CLEANUP_EXPIRED_VOUCHERS = 'cleanupExpiredVouchers';
export const SUCCESS_STATUS = 'success';
export const FAILED_STATUS = 'failed';
export const QUEUE_WORKFLOW_APP_TEMPLATE = 'workflowAppTemplate';

// Lambda processing queues
export const QUEUE_LAMBDA_DOC_INGEST = 'lambdaDocIngest';
export const QUEUE_LAMBDA_IMAGE_TRANSFORM = 'lambdaImageTransform';
export const QUEUE_LAMBDA_DOC_RENDER = 'lambdaDocRender';
export const QUEUE_LAMBDA_VIDEO_ANALYZE = 'lambdaVideoAnalyze';
export const QUEUE_LAMBDA_RESULT = 'lambdaResult';

// Lambda job types
export const LAMBDA_JOB_TYPE_DOC_INGEST = 'document-ingest';
export const LAMBDA_JOB_TYPE_IMAGE_TRANSFORM = 'image-transform';
export const LAMBDA_JOB_TYPE_DOC_RENDER = 'document-render';
export const LAMBDA_JOB_TYPE_VIDEO_ANALYZE = 'video-analyze';

// Lambda job statuses
export const LAMBDA_JOB_STATUS_PENDING = 'pending';
export const LAMBDA_JOB_STATUS_PROCESSING = 'processing';
export const LAMBDA_JOB_STATUS_SUCCESS = 'success';
export const LAMBDA_JOB_STATUS_FAILED = 'failed';

// Lambda storage types
export const LAMBDA_STORAGE_TYPE_TEMPORARY = 'temporary';
export const LAMBDA_STORAGE_TYPE_PERMANENT = 'permanent';
