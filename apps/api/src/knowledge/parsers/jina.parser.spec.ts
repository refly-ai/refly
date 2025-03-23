import { Test } from '@nestjs/testing';
import { JinaParser } from './jina.parser';
import * as childProcess from 'child_process';
import * as fs from 'fs/promises';
import { join } from 'path';

// 模拟axios和cheerio
jest.mock('axios');
const axios = require('axios');

// 模拟child_process
jest.mock('child_process');

// 模拟fs/promises
jest.mock('fs/promises');

describe('JinaParser', () => {
  let jinaParser: JinaParser;
  let jinaNodeParser: JinaParser;
  let mockSpawn;
  let mockSpawnSync;

  beforeEach(async () => {
    // 重置所有模拟
    jest.clearAllMocks();

    // 模拟spawnSync返回
    mockSpawnSync = jest.fn();
    (childProcess.spawnSync as jest.Mock).mockImplementation(mockSpawnSync);

    // 模拟spawn返回
    mockSpawn = jest.fn();
    (childProcess.spawn as jest.Mock).mockImplementation(mockSpawn);

    // 模拟fs.access和fs.mkdir
    (fs.access as jest.Mock).mockResolvedValue(undefined);
    (fs.mkdir as jest.Mock).mockResolvedValue(undefined);
    (fs.writeFile as jest.Mock).mockResolvedValue(undefined);

    // 创建模块
    const moduleRef = await Test.createTestingModule({
      providers: [JinaParser],
    }).compile();

    // 创建解析器实例，一个默认，一个强制使用Node
    jinaParser = moduleRef.get<JinaParser>(JinaParser);
    jinaNodeParser = new JinaParser({ useNodeFallback: true });
  });

  describe('检测Python环境', () => {
    it('应该检测到Python环境', async () => {
      // 模拟Python环境检测成功
      mockSpawnSync.mockReturnValueOnce({
        status: 0,
        stdout: Buffer.from('Python 3.9.0'),
      });

      // 模拟Trafilatura已安装
      mockSpawnSync.mockReturnValueOnce({
        status: 0,
        stdout: Buffer.from('ok'),
      });

      // 模拟spawn执行Python脚本
      const mockProcess = {
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        on: jest.fn(),
      };
      mockSpawn.mockReturnValueOnce(mockProcess);

      // 设置stdout和close事件处理
      const stdoutCallback = (callback) => {
        callback(Buffer.from(JSON.stringify({
          title: 'Test Title',
          content: 'Test Content',
          author: 'Test Author',
          date: '2023-01-01',
          url: 'https://example.com'
        })));
      };

      const closeCallback = (callback) => {
        callback(0);
      };

      mockProcess.stdout.on.mockImplementation((event, callback) => {
        if (event === 'data') {
          stdoutCallback(callback);
        }
      });

      mockProcess.stderr.on.mockImplementation((event, callback) => {});
      mockProcess.on.mockImplementation((event, callback) => {
        if (event === 'close') {
          closeCallback(callback);
        }
      });

      // 执行解析
      const result = await jinaParser.parse('https://example.com');

      // 验证结果
      expect(result).toEqual({
        title: 'Test Title',
        content: 'Test Content',
        metadata: {
          source: 'jina',
          author: 'Test Author',
          date: '2023-01-01',
          url: 'https://example.com'
        }
      });

      // 验证调用
      expect(childProcess.spawnSync).toHaveBeenCalledWith('python', ['--version']);
      expect(childProcess.spawn).toHaveBeenCalled();
    });

    it('当Python不可用时应该回退到Node.js解析', async () => {
      // 模拟Python和Python3命令都不可用
      mockSpawnSync.mockReturnValueOnce({
        status: 1,
        stderr: Buffer.from('command not found: python'),
      });
      mockSpawnSync.mockReturnValueOnce({
        status: 1,
        stderr: Buffer.from('command not found: python3'),
      });

      // 模拟axios.get返回
      axios.get.mockResolvedValueOnce({
        data: `
          <html>
            <head>
              <title>Test Page</title>
              <meta name="author" content="Test Author">
            </head>
            <body>
              <article>
                <h1>Test Heading</h1>
                <p>Test paragraph 1</p>
                <p>Test paragraph 2</p>
              </article>
            </body>
          </html>
        `,
      });

      // 执行解析
      const result = await jinaParser.parse('https://example.com');

      // 验证结果
      expect(result.title).toBe('Test Page');
      expect(result.content).toContain('Test paragraph 1');
      expect(result.content).toContain('Test paragraph 2');
      expect(result.metadata.source).toBe('jina');
      expect(result.metadata.author).toBe('Test Author');

      // 验证调用
      expect(axios.get).toHaveBeenCalledWith('https://example.com', expect.any(Object));
    });
  });

  describe('强制使用Node.js解析', () => {
    it('应该直接使用Node.js解析', async () => {
      // 模拟axios.get返回
      axios.get.mockResolvedValueOnce({
        data: `
          <html>
            <head>
              <title>Node Test</title>
            </head>
            <body>
              <main>
                <p>Node test content</p>
              </main>
            </body>
          </html>
        `,
      });

      // 执行解析
      const result = await jinaNodeParser.parse('https://example.com');

      // 验证结果
      expect(result.title).toBe('Node Test');
      expect(result.content).toContain('Node test content');
      expect(result.metadata.source).toBe('jina');

      // 验证没有尝试调用Python
      expect(childProcess.spawn).not.toHaveBeenCalled();
    });
  });

  describe('处理错误情况', () => {
    it('应该处理Python脚本执行失败的情况', async () => {
      // 模拟Python环境检测成功
      mockSpawnSync.mockReturnValueOnce({
        status: 0,
        stdout: Buffer.from('Python 3.9.0'),
      });

      // 模拟Trafilatura已安装
      mockSpawnSync.mockReturnValueOnce({
        status: 0,
        stdout: Buffer.from('ok'),
      });

      // 模拟spawn执行Python脚本失败
      const mockProcess = {
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        on: jest.fn(),
      };
      mockSpawn.mockReturnValueOnce(mockProcess);

      // 设置stderr和close事件处理
      mockProcess.stderr.on.mockImplementation((event, callback) => {
        if (event === 'data') {
          callback(Buffer.from('Python error'));
        }
      });

      mockProcess.stdout.on.mockImplementation((event, callback) => {});
      mockProcess.on.mockImplementation((event, callback) => {
        if (event === 'close') {
          callback(1); // 非零退出码表示错误
        }
      });

      // 模拟Node.js备选解析
      axios.get.mockResolvedValueOnce({
        data: `
          <html>
            <head>
              <title>Fallback Page</title>
            </head>
            <body>
              <div>Fallback content</div>
            </body>
          </html>
        `,
      });

      // 执行解析
      const result = await jinaParser.parse('https://example.com');

      // 验证结果表明使用了Node.js备选方案
      expect(result.title).toBe('Fallback Page');
      expect(result.content).toContain('Fallback content');
      expect(result.metadata.source).toBe('jina');

      // 验证调用了Python和Node.js
      expect(childProcess.spawn).toHaveBeenCalled();
      expect(axios.get).toHaveBeenCalled();
    });

    it('应该处理Node.js解析失败的情况', async () => {
      // 模拟Python和Python3命令都不可用
      mockSpawnSync.mockReturnValueOnce({
        status: 1,
        stderr: Buffer.from('command not found: python'),
      });
      mockSpawnSync.mockReturnValueOnce({
        status: 1,
        stderr: Buffer.from('command not found: python3'),
      });

      // 模拟axios.get失败
      const axiosError = new Error('Network error');
      axios.get.mockRejectedValueOnce(axiosError);

      // 执行解析
      const result = await jinaParser.parse('https://example.com');

      // 验证结果包含错误信息
      expect(result.error).toBe('Network error');
      expect(result.content).toBe('');

      // 验证调用
      expect(axios.get).toHaveBeenCalledWith('https://example.com', expect.any(Object));
    });
  });

  describe('模拟模式', () => {
    it('应该返回模拟内容', async () => {
      // 创建一个模拟模式的解析器
      const mockParser = new JinaParser({ mockMode: true });
      
      // 执行解析
      const result = await mockParser.parse('https://example.com');

      // 验证返回了模拟内容
      expect(result).toEqual({
        content: 'Mocked jina content',
        metadata: { source: 'jina' },
      });
      
      // 验证没有尝试调用Python或Node.js
      expect(childProcess.spawn).not.toHaveBeenCalled();
      expect(axios.get).not.toHaveBeenCalled();
    });
  });
}); 