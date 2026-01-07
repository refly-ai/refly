import {
  generateLimitExceededEmail,
  generateInsufficientCreditsEmail,
  generateScheduleSuccessEmail,
  generateScheduleFailedEmail,
  formatDateTime,
  type LimitExceededData,
  type InsufficientCreditsData,
  type ScheduleSuccessData,
  type ScheduleFailedData,
} from './schedule-email-templates';

describe('Schedule Email Templates', () => {
  const mockOrigin = 'https://refly.ai';

  describe('formatDateTime', () => {
    it('should format date to 12-hour format with AM using UTC timezone', () => {
      const date = new Date('2026-01-04T09:35:00Z');
      const result = formatDateTime(date, 'UTC');
      expect(result).toBe('01/04/2026, 09:35 AM');
    });

    it('should format date to 12-hour format with PM using UTC timezone', () => {
      const date = new Date('2026-01-04T18:35:00Z');
      const result = formatDateTime(date, 'UTC');
      expect(result).toBe('01/04/2026, 06:35 PM');
    });

    it('should handle midnight (12:00 AM) using UTC timezone', () => {
      const date = new Date('2026-01-04T00:00:00Z');
      const result = formatDateTime(date, 'UTC');
      expect(result).toBe('01/04/2026, 12:00 AM');
    });

    it('should handle noon (12:00 PM) using UTC timezone', () => {
      const date = new Date('2026-01-04T12:00:00Z');
      const result = formatDateTime(date, 'UTC');
      expect(result).toBe('01/04/2026, 12:00 PM');
    });

    it('should accept string date input', () => {
      const result = formatDateTime('2026-01-04T18:35:00Z', 'UTC');
      expect(result).toBe('01/04/2026, 06:35 PM');
    });

    it('should convert UTC time to Asia/Shanghai timezone', () => {
      // 18:35 UTC = 02:35 next day in Asia/Shanghai (UTC+8)
      const date = new Date('2026-01-04T18:35:00Z');
      const result = formatDateTime(date, 'Asia/Shanghai');
      expect(result).toBe('01/05/2026, 02:35 AM');
    });

    it('should convert UTC time to America/New_York timezone', () => {
      // 18:35 UTC = 13:35 in New York (UTC-5)
      const date = new Date('2026-01-04T18:35:00Z');
      const result = formatDateTime(date, 'America/New_York');
      expect(result).toBe('01/04/2026, 01:35 PM');
    });

    it('should use Asia/Shanghai as default timezone', () => {
      const date = new Date('2026-01-04T18:35:00Z');
      const result = formatDateTime(date);
      expect(result).toBe('01/05/2026, 02:35 AM');
    });

    it('should handle invalid timezone gracefully with fallback', () => {
      const date = new Date('2026-01-04T18:35:00Z');
      // Invalid timezone should fall back to local time formatting
      const result = formatDateTime(date, 'Invalid/Timezone');
      // Result should still be a valid date format
      expect(result).toMatch(/\d{2}\/\d{2}\/\d{4}, \d{2}:\d{2} (AM|PM)/);
    });
  });

  describe('generateLimitExceededEmail', () => {
    const mockData: LimitExceededData = {
      userName: 'John Doe',
      scheduleName: 'Daily Report',
      limit: 5,
      currentCount: 6,
      schedulesLink: `${mockOrigin}/workflow-list`,
    };

    it('should generate correct email subject', () => {
      const result = generateLimitExceededEmail(mockData);
      expect(result.subject).toBe('Your scheduled workflow has been paused');
    });

    it('should include user name in greeting', () => {
      const result = generateLimitExceededEmail(mockData);
      expect(result.html).toContain('Hi John Doe,');
    });

    it('should include schedule name in first paragraph', () => {
      const result = generateLimitExceededEmail(mockData);
      expect(result.html).toContain('"Daily Report"');
      expect(result.html).toContain(
        "has been paused because you've reached the maximum number of active schedules",
      );
    });

    it('should include "What happened" section with correct content', () => {
      const result = generateLimitExceededEmail(mockData);
      expect(result.html).toContain('What happened');
      expect(result.html).toContain('Your plan allows up to 5 active scheduled workflows');
      expect(result.html).toContain('You currently have 6 active schedules');
    });

    it('should include "temporarily stopped" text', () => {
      const result = generateLimitExceededEmail(mockData);
      expect(result.html).toContain(
        'this schedule has been temporarily stopped and will not run until the issue is resolved',
      );
    });

    it('should include "What you can do" section with correct content', () => {
      const result = generateLimitExceededEmail(mockData);
      expect(result.html).toContain('What you can do');
      expect(result.html).toContain(
        'Disable or delete an existing schedule from your Schedules page',
      );
      expect(result.html).toContain('Or upgrade your plan to unlock more scheduled workflows');
    });

    it('should include resume condition text', () => {
      const result = generateLimitExceededEmail(mockData);
      expect(result.html).toContain(
        'Once the number of active schedules is back within your plan limit, this schedule will automatically resume',
      );
    });

    it('should include correct button text and link', () => {
      const result = generateLimitExceededEmail(mockData);
      expect(result.html).toContain('View and manage your schedules:');
      expect(result.html).toContain('View Schedule Workflow');
      expect(result.html).toContain(`${mockOrigin}/workflow-list`);
    });

    it('should include team signature', () => {
      const result = generateLimitExceededEmail(mockData);
      expect(result.html).toContain('— The Refly.AI Team');
    });
  });

  describe('generateInsufficientCreditsEmail', () => {
    const mockData: InsufficientCreditsData = {
      userName: 'Jane Smith',
      scheduleName: 'Weekly Summary',
      currentBalance: 0,
      schedulesLink: `${mockOrigin}/run-history/record-123`,
      nextRunTime: '01/15/2024, 10:00 AM',
    };

    it('should generate correct email subject', () => {
      const result = generateInsufficientCreditsEmail(mockData);
      expect(result.subject).toBe(
        "Your scheduled workflow couldn't run due to insufficient credits",
      );
    });

    it('should include user name in greeting', () => {
      const result = generateInsufficientCreditsEmail(mockData);
      expect(result.html).toContain('Hi Jane Smith,');
    });

    it('should include schedule name in first paragraph', () => {
      const result = generateInsufficientCreditsEmail(mockData);
      expect(result.html).toContain('"Weekly Summary"');
      expect(result.html).toContain(
        "was unable to run because your account doesn't have enough credits",
      );
    });

    it('should include "What happened" section with all three items', () => {
      const result = generateInsufficientCreditsEmail(mockData);
      expect(result.html).toContain('What happened');
      expect(result.html).toContain('The workflow requires credits to execute');
      expect(result.html).toContain('Your current credit balance is insufficient');
      expect(result.html).toContain('Next Scheduled Run: 01/15/2024, 10:00 AM');
      expect(result.html).toContain('(This will only trigger if credits are available)');
    });

    it('should handle missing nextRunTime', () => {
      const dataWithoutNextRun = { ...mockData, nextRunTime: undefined };
      const result = generateInsufficientCreditsEmail(dataWithoutNextRun);
      expect(result.html).toContain('Next Scheduled Run: N/A');
    });

    it('should include temporarily paused text', () => {
      const result = generateInsufficientCreditsEmail(mockData);
      expect(result.html).toContain(
        'This schedule has been temporarily paused and will not run until your credits are replenished',
      );
    });

    it('should include auto-resume text', () => {
      const result = generateInsufficientCreditsEmail(mockData);
      expect(result.html).toContain(
        'Once your credit balance is restored, the schedule will automatically resume and continue running as planned',
      );
    });

    it('should include correct button text and link to run history', () => {
      const result = generateInsufficientCreditsEmail(mockData);
      expect(result.html).toContain('View and manage your schedules:');
      expect(result.html).toContain('View Run Detail');
      expect(result.html).toContain(`${mockOrigin}/run-history/record-123`);
    });

    it('should include team signature', () => {
      const result = generateInsufficientCreditsEmail(mockData);
      expect(result.html).toContain('— The Refly.AI Team');
    });
  });

  describe('generateScheduleSuccessEmail', () => {
    const mockData: ScheduleSuccessData = {
      userName: 'Bob Johnson',
      scheduleName: 'Data Sync',
      scheduledAt: '01/15/2024, 09:30 AM',
      nextRunTime: '01/16/2024, 09:30 AM',
      schedulesLink: `${mockOrigin}/run-history/record-456`,
      runDetailsLink: `${mockOrigin}/run-history/record-456`,
    };

    it('should generate correct email subject', () => {
      const result = generateScheduleSuccessEmail(mockData);
      expect(result.subject).toBe('Scheduled workflow Succeeded successfully');
    });

    it('should include user name in greeting', () => {
      const result = generateScheduleSuccessEmail(mockData);
      expect(result.html).toContain('Hi Bob Johnson,');
    });

    it('should NOT include "Great news!" prefix', () => {
      const result = generateScheduleSuccessEmail(mockData);
      expect(result.html).not.toContain('Great news!');
      expect(result.html).toContain(
        'Your scheduled workflow <strong>"Data Sync"</strong> ran successfully',
      );
    });

    it('should include "Run details" section with all items', () => {
      const result = generateScheduleSuccessEmail(mockData);
      expect(result.html).toContain('Run details');
      expect(result.html).toContain('Status: <span style="color: #12B76A;">Succeeded</span>');
      expect(result.html).toContain('Run time: 01/15/2024, 09:30 AM');
      expect(result.html).toContain('Next scheduled run: 01/16/2024, 09:30 AM');
    });

    it('should use correct success color', () => {
      const result = generateScheduleSuccessEmail(mockData);
      expect(result.html).toContain('color: #12B76A');
    });

    it('should include view details text with "here"', () => {
      const result = generateScheduleSuccessEmail(mockData);
      expect(result.html).toContain('You can view the full run details and results here:');
    });

    it('should include correct button text and link to run history', () => {
      const result = generateScheduleSuccessEmail(mockData);
      expect(result.html).toContain('View Run Detail');
      expect(result.html).toContain(`${mockOrigin}/run-history/record-456`);
    });

    it('should include team signature', () => {
      const result = generateScheduleSuccessEmail(mockData);
      expect(result.html).toContain('— The Refly.AI Team');
    });
  });

  describe('generateScheduleFailedEmail', () => {
    const mockData: ScheduleFailedData = {
      userName: 'Alice Williams',
      scheduleName: 'Backup Task',
      scheduledAt: '01/15/2024, 11:00 AM',
      nextRunTime: '01/16/2024, 11:00 AM',
      schedulesLink: `${mockOrigin}/run-history/record-789`,
      runDetailsLink: `${mockOrigin}/run-history/record-789`,
    };

    it('should generate correct email subject', () => {
      const result = generateScheduleFailedEmail(mockData);
      expect(result.subject).toBe('Scheduled workflow failed to run');
    });

    it('should include user name in greeting', () => {
      const result = generateScheduleFailedEmail(mockData);
      expect(result.html).toContain('Hi Alice Williams,');
    });

    it('should include schedule name in first paragraph', () => {
      const result = generateScheduleFailedEmail(mockData);
      expect(result.html).toContain('"Backup Task"');
      expect(result.html).toContain('failed during its most recent run');
    });

    it('should include "Run details" section with all items', () => {
      const result = generateScheduleFailedEmail(mockData);
      expect(result.html).toContain('Run details');
      expect(result.html).toContain('Status: <span style="color: #F04438;">Failed</span>');
      expect(result.html).toContain('Run time: 01/15/2024, 11:00 AM');
      expect(result.html).toContain('Next scheduled run: 01/16/2024, 11:00 AM');
    });

    it('should use correct error color', () => {
      const result = generateScheduleFailedEmail(mockData);
      expect(result.html).toContain('color: #F04438');
    });

    it('should include schedule still active text', () => {
      const result = generateScheduleFailedEmail(mockData);
      expect(result.html).toContain(
        'The schedule itself is still active and will attempt to run again at the next scheduled time',
      );
    });

    it('should include troubleshoot text with "here"', () => {
      const result = generateScheduleFailedEmail(mockData);
      expect(result.html).toContain(
        'You can review the failure details and troubleshoot the workflow here:',
      );
    });

    it('should include correct button text and link to run history', () => {
      const result = generateScheduleFailedEmail(mockData);
      expect(result.html).toContain('View Run Detail');
      expect(result.html).toContain(`${mockOrigin}/run-history/record-789`);
    });

    it('should include team signature', () => {
      const result = generateScheduleFailedEmail(mockData);
      expect(result.html).toContain('— The Refly.AI Team');
    });
  });

  describe('Link Verification Tests', () => {
    it('Limit Exceeded should link to /workflow-list', () => {
      const mockData: LimitExceededData = {
        userName: 'Test User',
        scheduleName: 'Test Schedule',
        limit: 5,
        currentCount: 6,
        schedulesLink: `${mockOrigin}/workflow-list`,
      };
      const result = generateLimitExceededEmail(mockData);
      expect(result.html).toContain(`href="${mockOrigin}/workflow-list"`);
    });

    it('Insufficient Credits should link to /run-history/{scheduleRecordId}', () => {
      const scheduleRecordId = 'test-record-123';
      const mockData: InsufficientCreditsData = {
        userName: 'Test User',
        scheduleName: 'Test Schedule',
        currentBalance: 0,
        schedulesLink: `${mockOrigin}/run-history/${scheduleRecordId}`,
      };
      const result = generateInsufficientCreditsEmail(mockData);
      expect(result.html).toContain(`href="${mockOrigin}/run-history/${scheduleRecordId}"`);
    });

    it('Success should link to /run-history/{scheduleRecordId}', () => {
      const scheduleRecordId = 'success-record-456';
      const mockData: ScheduleSuccessData = {
        userName: 'Test User',
        scheduleName: 'Test Schedule',
        scheduledAt: '01/15/2024, 10:00 AM',
        nextRunTime: '01/16/2024, 10:00 AM',
        schedulesLink: `${mockOrigin}/run-history/${scheduleRecordId}`,
        runDetailsLink: `${mockOrigin}/run-history/${scheduleRecordId}`,
      };
      const result = generateScheduleSuccessEmail(mockData);
      expect(result.html).toContain(`href="${mockOrigin}/run-history/${scheduleRecordId}"`);
    });

    it('Failure should link to /run-history/{scheduleRecordId}', () => {
      const scheduleRecordId = 'failed-record-789';
      const mockData: ScheduleFailedData = {
        userName: 'Test User',
        scheduleName: 'Test Schedule',
        scheduledAt: '01/15/2024, 11:00 AM',
        nextRunTime: '01/16/2024, 11:00 AM',
        schedulesLink: `${mockOrigin}/run-history/${scheduleRecordId}`,
        runDetailsLink: `${mockOrigin}/run-history/${scheduleRecordId}`,
      };
      const result = generateScheduleFailedEmail(mockData);
      expect(result.html).toContain(`href="${mockOrigin}/run-history/${scheduleRecordId}"`);
    });
  });

  describe('Button Text Verification Tests', () => {
    it('Limit Exceeded button text should be "View Schedule Workflow"', () => {
      const mockData: LimitExceededData = {
        userName: 'Test',
        scheduleName: 'Test',
        limit: 5,
        currentCount: 6,
        schedulesLink: `${mockOrigin}/workflow-list`,
      };
      const result = generateLimitExceededEmail(mockData);
      expect(result.html).toContain('>View Schedule Workflow</a>');
    });

    it('Insufficient Credits button text should be "View Run Detail"', () => {
      const mockData: InsufficientCreditsData = {
        userName: 'Test',
        scheduleName: 'Test',
        currentBalance: 0,
        schedulesLink: `${mockOrigin}/run-history/test`,
      };
      const result = generateInsufficientCreditsEmail(mockData);
      expect(result.html).toContain('>View Run Detail</a>');
    });

    it('Success button text should be "View Run Detail"', () => {
      const mockData: ScheduleSuccessData = {
        userName: 'Test',
        scheduleName: 'Test',
        scheduledAt: '01/15/2024, 10:00 AM',
        nextRunTime: '01/16/2024, 10:00 AM',
        schedulesLink: `${mockOrigin}/run-history/test`,
        runDetailsLink: `${mockOrigin}/run-history/test`,
      };
      const result = generateScheduleSuccessEmail(mockData);
      expect(result.html).toContain('>View Run Detail</a>');
    });

    it('Failure button text should be "View Run Detail"', () => {
      const mockData: ScheduleFailedData = {
        userName: 'Test',
        scheduleName: 'Test',
        scheduledAt: '01/15/2024, 11:00 AM',
        nextRunTime: '01/16/2024, 11:00 AM',
        schedulesLink: `${mockOrigin}/run-history/test`,
        runDetailsLink: `${mockOrigin}/run-history/test`,
      };
      const result = generateScheduleFailedEmail(mockData);
      expect(result.html).toContain('>View Run Detail</a>');
    });
  });

  describe('Strict Copy Verification Tests - Negative Cases', () => {
    describe('Limit Exceeded - should NOT contain wrong copy', () => {
      const mockData: LimitExceededData = {
        userName: 'Test',
        scheduleName: 'Test',
        limit: 5,
        currentCount: 6,
        schedulesLink: `${mockOrigin}/workflow-list`,
      };

      it('should NOT have "temporarily paused" in first paragraph', () => {
        const result = generateLimitExceededEmail(mockData);
        // Should be "has been paused", NOT "has been temporarily paused"
        expect(result.html).not.toMatch(/has been temporarily paused because you/);
      });

      it('should NOT use "to free up a slot"', () => {
        const result = generateLimitExceededEmail(mockData);
        expect(result.html).not.toContain('to free up a slot');
      });

      it('should NOT have "Or" without proper list format', () => {
        const result = generateLimitExceededEmail(mockData);
        // Should have "Or upgrade" in a list item
        expect(result.html).toMatch(/<li[^>]*>Or upgrade your plan/);
      });

      it('should NOT link to /workflow/{canvasId}', () => {
        const result = generateLimitExceededEmail(mockData);
        expect(result.html).not.toMatch(/href="[^"]*\/workflow\/[^"]*"/);
      });

      it('should NOT have button text "Manage My Schedules"', () => {
        const result = generateLimitExceededEmail(mockData);
        expect(result.html).not.toContain('>Manage My Schedules</a>');
      });
    });

    describe('Insufficient Credits - should NOT contain wrong copy', () => {
      const mockData: InsufficientCreditsData = {
        userName: 'Test',
        scheduleName: 'Test',
        currentBalance: 0,
        schedulesLink: `${mockOrigin}/run-history/test`,
        nextRunTime: '2024-01-15 10:00:00',
      };

      it('should NOT have only 2 items in What happened section', () => {
        const result = generateInsufficientCreditsEmail(mockData);
        // Must have all 3 items
        const whatHappenedMatch = result.html.match(
          /<div[^>]*>What happened<\/div>\s*<ul[^>]*>([\s\S]*?)<\/ul>/,
        );
        expect(whatHappenedMatch).toBeTruthy();
        const listItems = whatHappenedMatch![1].match(/<li[^>]*>/g);
        expect(listItems?.length).toBe(3);
      });

      it('should NOT miss the credit trigger warning text', () => {
        const result = generateInsufficientCreditsEmail(mockData);
        expect(result.html).toContain('(This will only trigger if credits are available)');
      });

      it('should NOT link to /workflow/{canvasId}', () => {
        const result = generateInsufficientCreditsEmail(mockData);
        expect(result.html).not.toMatch(/href="[^"]*\/workflow\/[^"]*"/);
      });

      it('should NOT have button text "View Workflow"', () => {
        const result = generateInsufficientCreditsEmail(mockData);
        expect(result.html).not.toContain('>View Workflow</a>');
      });
    });

    describe('Success - should NOT contain wrong copy', () => {
      const mockData: ScheduleSuccessData = {
        userName: 'Test',
        scheduleName: 'Test',
        scheduledAt: '2024-01-15 10:00:00',
        nextRunTime: '2024-01-16 10:00:00',
        schedulesLink: `${mockOrigin}/run-history/test`,
        runDetailsLink: `${mockOrigin}/run-history/test`,
      };

      it('should NOT have "Great news!" prefix', () => {
        const result = generateScheduleSuccessEmail(mockData);
        expect(result.html).not.toContain('Great news!');
      });

      it('should NOT use "below" instead of "here"', () => {
        const result = generateScheduleSuccessEmail(mockData);
        expect(result.html).not.toContain('details and results below');
        expect(result.html).toContain('details and results here');
      });

      it('should NOT have button text "View Run Details" (plural)', () => {
        const result = generateScheduleSuccessEmail(mockData);
        expect(result.html).not.toContain('>View Run Details</a>');
      });
    });

    describe('Failure - should NOT contain wrong copy', () => {
      const mockData: ScheduleFailedData = {
        userName: 'Test',
        scheduleName: 'Test',
        scheduledAt: '2024-01-15 11:00:00',
        nextRunTime: '2024-01-16 11:00:00',
        schedulesLink: `${mockOrigin}/run-history/test`,
        runDetailsLink: `${mockOrigin}/run-history/test`,
      };

      it('should NOT have button text "Troubleshoot Issue"', () => {
        const result = generateScheduleFailedEmail(mockData);
        expect(result.html).not.toContain('>Troubleshoot Issue</a>');
      });

      it('should NOT use "below" instead of "here"', () => {
        const result = generateScheduleFailedEmail(mockData);
        expect(result.html).not.toContain('troubleshoot the workflow below');
        expect(result.html).toContain('troubleshoot the workflow here');
      });
    });
  });

  describe('Strict Exact Copy Matching Tests', () => {
    describe('Limit Exceeded - exact copy validation', () => {
      const mockData: LimitExceededData = {
        userName: 'Test User',
        scheduleName: 'Test Schedule',
        limit: 5,
        currentCount: 6,
        schedulesLink: `${mockOrigin}/workflow-list`,
      };

      it('should have exact first paragraph text', () => {
        const result = generateLimitExceededEmail(mockData);
        expect(result.html).toMatch(
          /Your scheduled workflow <strong>"Test Schedule"<\/strong> has been paused because you've reached the maximum number of active schedules allowed for your current plan\./,
        );
      });

      it('should have exact "What happened" list items', () => {
        const result = generateLimitExceededEmail(mockData);
        expect(result.html).toContain('Your plan allows up to 5 active scheduled workflows');
        expect(result.html).toContain('You currently have 6 active schedules');
      });

      it('should have exact "As a result" text', () => {
        const result = generateLimitExceededEmail(mockData);
        expect(result.html).toContain(
          'As a result, this schedule has been temporarily stopped and will not run until the issue is resolved.',
        );
      });

      it('should have exact "What you can do" list items', () => {
        const result = generateLimitExceededEmail(mockData);
        expect(result.html).toContain(
          'Disable or delete an existing schedule from your Schedules page',
        );
        expect(result.html).toContain('Or upgrade your plan to unlock more scheduled workflows');
      });

      it('should have exact resume condition text', () => {
        const result = generateLimitExceededEmail(mockData);
        expect(result.html).toContain(
          'Once the number of active schedules is back within your plan limit, this schedule will automatically resume.',
        );
      });

      it('should have exact link introduction text', () => {
        const result = generateLimitExceededEmail(mockData);
        expect(result.html).toContain('View and manage your schedules:');
      });
    });

    describe('Insufficient Credits - exact copy validation', () => {
      const mockData: InsufficientCreditsData = {
        userName: 'Test User',
        scheduleName: 'Test Schedule',
        currentBalance: 0,
        schedulesLink: `${mockOrigin}/run-history/test`,
        nextRunTime: '01/15/2024, 10:00 AM',
      };

      it('should have exact first paragraph text', () => {
        const result = generateInsufficientCreditsEmail(mockData);
        expect(result.html).toMatch(
          /Your scheduled workflow <strong>"Test Schedule"<\/strong> was unable to run because your account doesn't have enough credits\./,
        );
      });

      it('should have exact "What happened" list items in order', () => {
        const result = generateInsufficientCreditsEmail(mockData);
        const whatHappenedSection = result.html.match(
          /<div[^>]*>What happened<\/div>\s*<ul[^>]*>([\s\S]*?)<\/ul>/,
        );
        expect(whatHappenedSection).toBeTruthy();

        const section = whatHappenedSection![0];
        expect(section).toContain('The workflow requires credits to execute');
        expect(section).toContain('Your current credit balance is insufficient');
        expect(section).toContain(
          'Next Scheduled Run: 01/15/2024, 10:00 AM (This will only trigger if credits are available)',
        );
      });

      it('should have exact paused text', () => {
        const result = generateInsufficientCreditsEmail(mockData);
        expect(result.html).toContain(
          'This schedule has been temporarily paused and will not run until your credits are replenished.',
        );
      });

      it('should have exact resume text', () => {
        const result = generateInsufficientCreditsEmail(mockData);
        expect(result.html).toContain(
          'Once your credit balance is restored, the schedule will automatically resume and continue running as planned.',
        );
      });
    });

    describe('Success - exact copy validation', () => {
      const mockData: ScheduleSuccessData = {
        userName: 'Test User',
        scheduleName: 'Test Schedule',
        scheduledAt: '01/15/2024, 10:00 AM',
        nextRunTime: '01/16/2024, 10:00 AM',
        schedulesLink: `${mockOrigin}/run-history/test`,
        runDetailsLink: `${mockOrigin}/run-history/test`,
      };

      it('should have exact first paragraph text without "Great news!"', () => {
        const result = generateScheduleSuccessEmail(mockData);
        expect(result.html).toMatch(
          /Your scheduled workflow <strong>"Test Schedule"<\/strong> ran successfully\./,
        );
        expect(result.html).not.toContain('Great news!');
      });

      it('should have exact view details text with "here"', () => {
        const result = generateScheduleSuccessEmail(mockData);
        expect(result.html).toContain('You can view the full run details and results here:');
      });
    });

    describe('Failure - exact copy validation', () => {
      const mockData: ScheduleFailedData = {
        userName: 'Test User',
        scheduleName: 'Test Schedule',
        scheduledAt: '01/15/2024, 11:00 AM',
        nextRunTime: '01/16/2024, 11:00 AM',
        schedulesLink: `${mockOrigin}/run-history/test`,
        runDetailsLink: `${mockOrigin}/run-history/test`,
      };

      it('should have exact first paragraph text', () => {
        const result = generateScheduleFailedEmail(mockData);
        expect(result.html).toMatch(
          /Your scheduled workflow <strong>"Test Schedule"<\/strong> failed during its most recent run\./,
        );
      });

      it('should have exact schedule still active text', () => {
        const result = generateScheduleFailedEmail(mockData);
        expect(result.html).toContain(
          'The schedule itself is still active and will attempt to run again at the next scheduled time.',
        );
      });

      it('should have exact troubleshoot text with "here"', () => {
        const result = generateScheduleFailedEmail(mockData);
        expect(result.html).toContain(
          'You can review the failure details and troubleshoot the workflow here:',
        );
      });
    });
  });

  describe('Link Format Strict Validation', () => {
    it('Limit Exceeded should have exact href format', () => {
      const mockData: LimitExceededData = {
        userName: 'Test',
        scheduleName: 'Test',
        limit: 5,
        currentCount: 6,
        schedulesLink: `${mockOrigin}/workflow-list`,
      };
      const result = generateLimitExceededEmail(mockData);
      expect(result.html).toMatch(
        /<a href="https:\/\/refly\.ai\/workflow-list"[^>]*>View Schedule Workflow<\/a>/,
      );
    });

    it('Insufficient Credits should have exact href format', () => {
      const scheduleRecordId = 'test-record-123';
      const mockData: InsufficientCreditsData = {
        userName: 'Test',
        scheduleName: 'Test',
        currentBalance: 0,
        schedulesLink: `${mockOrigin}/run-history/${scheduleRecordId}`,
      };
      const result = generateInsufficientCreditsEmail(mockData);
      expect(result.html).toMatch(
        new RegExp(
          `<a href="https://refly\\.ai/run-history/${scheduleRecordId}"[^>]*>View Run Detail</a>`,
        ),
      );
    });

    it('Success should have exact href format', () => {
      const scheduleRecordId = 'success-record-456';
      const mockData: ScheduleSuccessData = {
        userName: 'Test',
        scheduleName: 'Test',
        scheduledAt: '01/15/2024, 10:00 AM',
        nextRunTime: '01/16/2024, 10:00 AM',
        schedulesLink: `${mockOrigin}/run-history/${scheduleRecordId}`,
        runDetailsLink: `${mockOrigin}/run-history/${scheduleRecordId}`,
      };
      const result = generateScheduleSuccessEmail(mockData);
      expect(result.html).toMatch(
        new RegExp(
          `<a href="https://refly\\.ai/run-history/${scheduleRecordId}"[^>]*>View Run Detail</a>`,
        ),
      );
    });

    it('Failure should have exact href format', () => {
      const scheduleRecordId = 'failed-record-789';
      const mockData: ScheduleFailedData = {
        userName: 'Test',
        scheduleName: 'Test',
        scheduledAt: '01/15/2024, 11:00 AM',
        nextRunTime: '01/16/2024, 11:00 AM',
        schedulesLink: `${mockOrigin}/run-history/${scheduleRecordId}`,
        runDetailsLink: `${mockOrigin}/run-history/${scheduleRecordId}`,
      };
      const result = generateScheduleFailedEmail(mockData);
      expect(result.html).toMatch(
        new RegExp(
          `<a href="https://refly\\.ai/run-history/${scheduleRecordId}"[^>]*>View Run Detail</a>`,
        ),
      );
    });
  });
});
