import { toolsetInventory } from './inventory';

export function listAllTools() {
  console.log('🔧 Refly Agent Tools Inventory\n');

  for (const toolset of toolsetInventory) {
    console.log(`📦 **${toolset.key}**`);

    try {
      // Create toolset instance to access properties
      const toolsetInstance = new toolset.class();

      const description = toolsetInstance.descriptionDict?.en ?? 'No description available';
      console.log(`   Description: ${description}`);

      const tools = toolsetInstance.tools ?? [];
      console.log(`   Tools (${tools.length}):`);

      if (tools.length > 0) {
        tools.forEach(
          (
            ToolCtor: new (
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              ...args: any[]
            ) => { name?: string; description?: string },
            index: number,
          ) => {
            try {
              // Try to create tool instance with fallback to mock parameters
              let toolInstance: { name?: string; description?: string } | undefined;
              try {
                const NoArgCtor = ToolCtor as new () => { name?: string; description?: string };
                toolInstance = new NoArgCtor();
              } catch {
                const WithArgCtor = ToolCtor as new (
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  p: any,
                ) => { name?: string; description?: string };
                toolInstance = new WithArgCtor({ apiKey: 'mock-api-key' });
              }

              const toolName = toolInstance?.name ?? 'Unknown';
              const toolDescription = toolInstance?.description ?? 'No description available';
              console.log(`     ${index + 1}. ${toolName}: ${toolDescription}`);
            } catch {
              // Fallback to metadata if instantiation fails
              console.log(`     ${index + 1}. Unknown: No description available`);
            }
          },
        );
      } else {
        console.log('     No tools found in this toolset');
      }
    } catch (error) {
      console.log(`   ❌ Error accessing toolset: ${error}`);
    }

    console.log(''); // Empty line for better readability
  }
}

async function dynamicInvoke(toolsetKey: string, toolName: string, params: any, input: any) {
  const toolset = toolsetInventory.find((t) => t.key === toolsetKey);
  if (!toolset) {
    throw new Error(`Toolset ${toolsetKey} not found`);
  }

  // Create toolset instance and initialize tools with params
  const toolsetInstance = new toolset.class(params);
  const tool = toolsetInstance.getToolInstance(toolName);
  return tool.invoke(input);
}

// Execute the function
// listAllTools();

async function main() {
  const res = await dynamicInvoke('calculator', 'add', undefined, {
    a: 1,
    b: 2,
  });
  console.log(res);
}

main();
