/**
 * Canvas Events
 *
 * Events emitted by the Canvas module for other modules to react to.
 */

/**
 * Event emitted when a canvas is deleted (soft delete)
 * This event is used by ScheduleEventListener to cleanup associated schedules
 */
export class CanvasDeletedEvent {
  constructor(
    public readonly canvasId: string,
    public readonly uid: string,
  ) {}
}
