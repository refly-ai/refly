import { ChatPromptTemplate } from '@langchain/core/prompts';

/**
 * Prompt template for determining file modifications from code
 */
export const DETERMINE_MODIFICATIONS_PROMPT =
  ChatPromptTemplate.fromTemplate(`The user will input some code and you need to determine if the code makes any changes to the file system.
With changes it means creating new files or modifying existing ones.
Format your answer as JSON inside a codeblock with a list of filenames that are modified by the code.
If the code does not make any changes to the file system, return an empty list.

Determine modifications:
\`\`\`python
import matplotlib.pyplot as plt
import numpy as np

t = np.arange(0.0, 4.0*np.pi, 0.1)

s = np.sin(t)

fig, ax = plt.subplots()

ax.plot(t, s)

ax.set(xlabel="time (s)", ylabel="sin(t)",
   title="Simple Sin Wave")
ax.grid()

plt.savefig("sin_wave.png")
\`\`\`

Answer:
\`\`\`json
{{
  "modifications": ["sin_wave.png"]
}}
\`\`\`

Determine modifications:
\`\`\`python
import matplotlib.pyplot as plt
import numpy as np

x = np.linspace(0, 10, 100)
y = x**2

plt.figure(figsize=(8, 6))
plt.plot(x, y)
plt.title("Simple Quadratic Function")
plt.xlabel("x")
plt.ylabel("y = x^2")
plt.grid(True)
plt.show()
\`\`\`

Answer:
\`\`\`json
{{
  "modifications": []
}}
\`\`\`

Determine modifications:
\`\`\`python
{code}
\`\`\`

Answer:
\`\`\`json
`);

/**
 * Parse modifications from LLM response
 */
export function parseModifications(response: string): string[] | null {
  try {
    // Extract JSON from code block
    const jsonMatch = response.match(/```json\n([\s\S]*?)\n```/);
    if (!jsonMatch) {
      // Try to find JSON without code block
      const directJsonMatch = response.match(/\{[\s\S]*"modifications"[\s\S]*\}/);
      if (!directJsonMatch) {
        return null;
      }
      const parsed = JSON.parse(directJsonMatch[0]);
      return parsed.modifications || [];
    }

    const jsonStr = jsonMatch[1];
    const parsed = JSON.parse(jsonStr);

    if (parsed.modifications && Array.isArray(parsed.modifications)) {
      return parsed.modifications;
    }

    return null;
  } catch (error) {
    console.error('Error parsing modifications:', error);
    return null;
  }
}
