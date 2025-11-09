/**
 * Test file to verify prompts integration
 */

import { ChatOpenAI } from '@langchain/openai';
import {
  CODE_INTERPRETER_SYSTEM_MESSAGE,
  getSystemMessage,
  DETERMINE_MODIFICATIONS_PROMPT,
  parseModifications,
  REMOVE_DL_LINK_PROMPT,
  extractCleanResponse,
} from './prompts';
import { getFileModifications, removeDownloadLink } from './chains';

async function testSystemMessage() {
  console.log('🧪 Testing System Message\n');
  console.log('Default System Message:');
  console.log(`${CODE_INTERPRETER_SYSTEM_MESSAGE.substring(0, 200)}...\n`);

  const customMessage = getSystemMessage(['tensorflow', 'pytorch']);
  console.log('Custom System Message (with packages):');
  console.log(`${customMessage.substring(customMessage.length - 100)}\n`);
}

async function testModificationsPrompt() {
  console.log('🧪 Testing Modifications Detection\n');

  const testCode = `
import pandas as pd
import matplotlib.pyplot as plt

df = pd.read_csv('data.csv')
df.to_excel('output.xlsx')
plt.savefig('chart.png')
`;

  console.log('Test Code:');
  console.log(testCode);

  // Test with LLM (if API key is set)
  if (process.env.OPENAI_API_KEY) {
    try {
      const llm = new ChatOpenAI({
        modelName: 'gpt-4o',
        temperature: 0,
      });

      const modifications = await getFileModifications(testCode, llm);
      console.log('\nDetected Modifications (with LLM):');
      console.log(modifications);
    } catch (error: any) {
      console.log('\nLLM test skipped:', error.message);
    }
  } else {
    console.log('\nLLM test skipped (no API key)');
  }

  // Test parsing
  const mockResponse = `\`\`\`json
{
  "modifications": ["output.xlsx", "chart.png"]
}
\`\`\``;

  const parsed = parseModifications(mockResponse);
  console.log('\nParsed from mock response:');
  console.log(parsed);
  console.log();
}

async function testRemoveLinkPrompt() {
  console.log('🧪 Testing Download Link Removal\n');

  const testText =
    'The analysis is complete. You can download the results [here](sandbox:/results.csv). The chart shows interesting trends.';

  console.log('Original Text:');
  console.log(testText);

  // Test regex-based extraction
  const cleaned = extractCleanResponse(testText);
  console.log('\nCleaned Text (regex):');
  console.log(cleaned);

  // Test with LLM (if API key is set)
  if (process.env.OPENAI_API_KEY) {
    try {
      const llm = new ChatOpenAI({
        modelName: 'gpt-4o',
        temperature: 0,
      });

      const cleanedWithLLM = await removeDownloadLink(testText, llm);
      console.log('\nCleaned Text (with LLM):');
      console.log(cleanedWithLLM);
    } catch (error: any) {
      console.log('\nLLM test skipped:', error.message);
    }
  } else {
    console.log('\nLLM test skipped (no API key)');
  }

  console.log();
}

async function testPromptTemplates() {
  console.log('🧪 Testing Prompt Templates\n');

  // Test DETERMINE_MODIFICATIONS_PROMPT
  console.log('Modifications Prompt Template:');
  const modPrompt = await DETERMINE_MODIFICATIONS_PROMPT.format({
    code: 'df.to_csv("data.csv")',
  });
  console.log(`${modPrompt.substring(0, 150)}...\n`);

  // Test REMOVE_DL_LINK_PROMPT
  console.log('Remove Link Prompt Template:');
  const linkMessages = await REMOVE_DL_LINK_PROMPT.formatMessages({
    input_response: 'Test response',
  });
  console.log(`Messages count: ${linkMessages.length}`);
  console.log(`Last message type: ${linkMessages[linkMessages.length - 1]._getType()}`);
  console.log();
}

async function main() {
  console.log('═'.repeat(60));
  console.log('🧪 SANDBOX AGENT PROMPTS TEST SUITE');
  console.log('═'.repeat(60));
  console.log();

  try {
    await testSystemMessage();
    await testModificationsPrompt();
    await testRemoveLinkPrompt();
    await testPromptTemplates();

    console.log('═'.repeat(60));
    console.log('✅ All tests completed!');
    console.log('═'.repeat(60));
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Run tests
main();
