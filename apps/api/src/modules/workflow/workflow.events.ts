export class WorkflowCompletedEvent {
  constructor(
    public readonly executionId: string,
    public readonly canvasId: string,
    public readonly userId: string,
    public readonly triggerType: string,
    public readonly outputs: any,
    public readonly executionTime: number,
    public readonly scheduleId?: string,
  ) {}
}

export class WorkflowFailedEvent {
  constructor(
    public readonly executionId: string,
    public readonly canvasId: string,
    public readonly userId: string,
    public readonly triggerType: string,
    public readonly error: any,
    public readonly executionTime: number,
    public readonly scheduleId?: string,
  ) {}
}
