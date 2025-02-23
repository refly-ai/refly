export const buildVagueQueryRewriteExamples = () => {
  return `
  Examples of vague queries that need rewriting:

  1. No Context or History:
     Original query: "tell me more about it"
     Analysis: {
       queryAnalysis: "Vague reference without context or history to clarify the subject",
       queryRewriteStrategy: "Cannot rewrite due to lack of context",
       summary: "User requests more information about an unspecified subject"
     }
     rewrittenQueries: ["tell me more about it"]
     mentionedContext: []
     Reasoning: No context or history available to clarify the reference.

  2. With Chat History Only:
     <ChatHistory>
     <ChatHistoryItem type={human}>What are the key features of React 18?</ChatHistoryItem>
     <ChatHistoryItem type={ai}>React 18 introduces automatic batching, concurrent features, and Suspense support.</ChatHistoryItem>
     <ChatHistoryItem type={human}>tell me more details</ChatHistoryItem>
     </ChatHistory>

     Analysis: {
       queryAnalysis: "Follow-up question about React 18 features mentioned in chat history",
       queryRewriteStrategy: "Break down into specific feature aspects from chat history",
       summary: "User seeks detailed information about React 18's key features, particularly automatic batching, concurrent features, and Suspense"
     }
     rewrittenQueries: [
       "explain React 18's automatic batching feature in detail",
       "describe React 18's concurrent features implementation",
       "how does Suspense support work in React 18"
     ]
     mentionedContext: []
     Reasoning: Used chat history to identify specific features to explore.

  3. With Context Only:
     <Context>
     <ContextItem type='document' entityId='doc-1' title='API Documentation'>New authentication system requires MFA setup with biometric and TOTP options.</ContextItem>
     </Context>

     Original query: "how does this work?"
     Analysis: {
       queryAnalysis: "Question about MFA authentication system implementation",
       queryRewriteStrategy: "Break down MFA system components from context",
       summary: "User wants to understand the implementation of the new MFA authentication system with biometric and TOTP features"
     }
     rewrittenQueries: [
       "how does the new MFA authentication system work with biometric verification",
       "how does TOTP-based authentication work in the new MFA system",
       "what is the overall MFA setup process"
     ]
     mentionedContext: [{"type": "document", "entityId": "doc-1", "title": "API Documentation", "useWholeContent": true}]
     Reasoning: Used context to identify the authentication system components and generate focused queries.`;
};

export const buildNormalQueryRewriteExamples = () => {
  return `
  Examples of more specific queries:

  1. Unrelated to Context/History:
     <Context>
     <ContextItem type='document' entityId='doc-1' title='Project Plan'>Q4 deliverables...</ContextItem>
     </Context>
     <ChatHistory>
     <ChatHistoryItem type={human}>How's the project timeline?</ChatHistoryItem>
     </ChatHistory>

     Original query: "What's the weather in New York?"
     Analysis: {
       queryAnalysis: "Direct weather inquiry for New York, unrelated to available context",
       queryRewriteStrategy: "Keep original query as it's clear and self-contained",
       summary: "User wants to know current weather conditions in New York"
     }
     rewrittenQueries: ["What's the weather in New York?"]
     mentionedContext: []
     Reasoning: Query is clear and unrelated to available context/history. No rewrite needed.

  2. With Both Context and History:
     <Context>
     <ContextItem type='resource' entityId='res-1' title='Performance Metrics'>System latency reduced by 50% after implementing Redis caching and MongoDB indexing.</ContextItem>
     </Context>
     <ChatHistory>
     <ChatHistoryItem type={human}>What optimizations were made?</ChatHistoryItem>
     <ChatHistoryItem type={ai}>We implemented Redis caching and MongoDB indexing.</ChatHistoryItem>
     <ChatHistoryItem type={human}>what was the impact?</ChatHistoryItem>
     </ChatHistory>

     Original query: "can you explain these improvements?"
     Analysis: {
       queryAnalysis: "Request for detailed explanation of performance improvements from caching and indexing",
       queryRewriteStrategy: "Break down into specific optimization aspects and their impacts",
       summary: "User seeks to understand how Redis caching and MongoDB indexing improved system latency by 50%"
     }
     rewrittenQueries: [
       "how did Redis caching improve system performance and reduce latency",
       "what impact did MongoDB indexing have on system latency",
       "explain the overall 50% latency reduction from both optimizations"
     ]
     mentionedContext: [{"type": "resource", "entityId": "res-1", "title": "Performance Metrics", "useWholeContent": true}]
     Reasoning: Combined context and chat history to generate focused queries about specific optimizations.

  3. Clear Query with Relevant Context:
     <Context>
     <ContextItem type='selectedContent' entityId='content-1' title='Security Policy'>New password requirements: minimum 12 characters, must include uppercase, lowercase, numbers, and special characters.</ContextItem>
     </Context>

     Original query: "What are the password requirements?"
     Analysis: {
       queryAnalysis: "Direct question about password requirements with matching context",
       queryRewriteStrategy: "Keep original query and link relevant context",
       summary: "User wants to know the new password requirements specified in the security policy"
     }
     rewrittenQueries: ["What are the password requirements?"]
     mentionedContext: [{"type": "selectedContent", "entityId": "content-1", "title": "Security Policy", "useWholeContent": true}]
     Reasoning: Query is already clear and directly matches available context.`;
};
