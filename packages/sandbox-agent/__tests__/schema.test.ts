import { File, UserRequest, CodeInterpreterResponse, SessionStatus } from '../schema';

describe('Schema Tests', () => {
  describe('File', () => {
    it('should create a File instance', () => {
      const content = Buffer.from('test content');
      const file = new File('test.txt', content);

      expect(file.name).toBe('test.txt');
      expect(file.content).toEqual(content);
    });

    it('should convert to string', () => {
      const file = new File('test.txt', Buffer.from('content'));
      expect(file.toString()).toBe('test.txt');
    });
  });

  describe('UserRequest', () => {
    it('should create a UserRequest', () => {
      const request = new UserRequest({
        content: 'Hello',
        files: [],
      });

      expect(request.content).toBe('Hello');
      expect(request.files).toEqual([]);
    });

    it('should handle files', () => {
      const file = new File('test.txt', Buffer.from('content'));
      const request = new UserRequest({
        content: 'Process this file',
        files: [file],
      });

      expect(request.files.length).toBe(1);
      expect(request.files[0].name).toBe('test.txt');
    });
  });

  describe('CodeInterpreterResponse', () => {
    it('should create a response', () => {
      const response = new CodeInterpreterResponse({
        content: 'Result',
        files: [],
        codeLog: [],
      });

      expect(response.content).toBe('Result');
      expect(response.files).toEqual([]);
      expect(response.codeLog).toEqual([]);
    });

    it('should handle code log', () => {
      const codeLog: Array<[string, string]> = [
        ['print("hello")', 'hello'],
        ['2 + 2', '4'],
      ];

      const response = new CodeInterpreterResponse({
        content: 'Done',
        files: [],
        codeLog,
      });

      expect(response.codeLog.length).toBe(2);
      expect(response.codeLog[0][0]).toBe('print("hello")');
    });
  });

  describe('SessionStatus', () => {
    it('should create from status string', () => {
      const status = SessionStatus.fromCodeBoxStatus('running');
      expect(status.status).toBe('running');
    });

    it('should create from status object', () => {
      const status = SessionStatus.fromCodeBoxStatus({ status: 'stopped' });
      expect(status.status).toBe('stopped');
    });
  });
});
