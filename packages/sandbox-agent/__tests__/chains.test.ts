import { extractPythonCode, getFileModifications } from '../chains';

describe('Chains Tests', () => {
  describe('extractPythonCode', () => {
    it('should extract code from markdown code block', () => {
      const text = '```python\nprint("hello")\n```';
      const result = extractPythonCode(text);
      expect(result).toBe('print("hello")');
    });

    it('should return original text if no code block', () => {
      const text = 'print("hello")';
      const result = extractPythonCode(text);
      expect(result).toBe('print("hello")');
    });
  });

  describe('getFileModifications', () => {
    it('should detect CSV file operations', async () => {
      const code = 'df.to_csv("output.csv")';
      const result = await getFileModifications(code, null as any);

      expect(result).not.toBeNull();
      expect(result).toContain('output.csv');
    });

    it('should detect multiple file operations', async () => {
      const code = `
        df.to_csv("data.csv")
        plt.savefig("chart.png")
      `;
      const result = await getFileModifications(code, null as any);

      expect(result).not.toBeNull();
      expect(result?.length).toBeGreaterThan(0);
    });

    it('should return null when no file operations', async () => {
      const code = 'print("hello")';
      const result = await getFileModifications(code, null as any);

      expect(result).toBeNull();
    });

    it('should handle open() statements', async () => {
      const code = 'with open("file.txt", "w") as f: f.write("data")';
      const result = await getFileModifications(code, null as any);

      expect(result).not.toBeNull();
    });
  });
});
