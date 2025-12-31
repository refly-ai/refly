import {
  generateLimitExceededEmail,
  generateInsufficientCreditsEmail,
  generateScheduleSuccessEmail,
  generateScheduleFailedEmail,
} from './schedule-email-templates';

describe('Schedule Email Templates', () => {
  const commonData = {
    userName: 'Test User',
    scheduleName: 'Test Workflow',
    schedulesLink: 'https://refly.ai/schedules',
  };

  describe('generateLimitExceededEmail', () => {
    it('should generate correct HTML', () => {
      const result = generateLimitExceededEmail({
        ...commonData,
        limit: 5,
        currentCount: 6,
      });

      expect(result.subject).toContain('paused');
      expect(result.html).toContain('Test User');
      expect(result.html).toContain('temporarily paused');
      expect(result.html).toContain('5 active schedules');
    });
  });

  describe('generateInsufficientCreditsEmail', () => {
    it('should generate correct HTML', () => {
      const result = generateInsufficientCreditsEmail({
        ...commonData,
        currentBalance: 0,
        nextRunTime: '2024-01-01 10:00:00',
      });

      expect(result.subject).toContain('insufficient credits');
      expect(result.html).toContain('Test User');
      expect(result.html).toContain('requires credits to execute');
      expect(result.html).toContain('0 credits');
      expect(result.html).toContain('2024-01-01');
    });

    it('should handle missing nextRunTime', () => {
      const result = generateInsufficientCreditsEmail({
        ...commonData,
        currentBalance: 0,
      });
      expect(result.html).not.toContain('Next Scheduled Run');
    });
  });

  describe('generateScheduleSuccessEmail', () => {
    it('should generate correct HTML', () => {
      const result = generateScheduleSuccessEmail({
        ...commonData,
        runTime: '2024-01-01 10:00:00',
        nextRunTime: '2024-01-02 10:00:00',
        runDetailsLink: 'https://refly.ai/run/123',
      });

      expect(result.subject).toContain('successfully');
      expect(result.html).toContain('Test User');
      expect(result.html).toContain('Succeeded');
      expect(result.html).toContain('View Run Details');
    });
  });

  describe('generateScheduleFailedEmail', () => {
    it('should generate correct HTML', () => {
      const result = generateScheduleFailedEmail({
        ...commonData,
        runTime: '2024-01-01 10:00:00',
        nextRunTime: '2024-01-02 10:00:00',
        runDetailsLink: 'https://refly.ai/run/123',
      });

      expect(result.subject).toContain('failed');
      expect(result.html).toContain('Test User');
      expect(result.html).toContain('Failed');
      expect(result.html).toContain('Troubleshoot Issue');
    });
  });
});
