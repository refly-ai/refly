export const buildWebSearchExamples = () => {
  return `
  ## Examples (DO NOT USE THESE DIRECTLY - FOR FORMAT REFERENCE ONLY)

Question: "How do I implement authentication in our React app?"
Context:
<Context>
  <MentionedContext>
    <KnowledgeBaseDocuments>
      <ContextItem citationIndex='[[citation:1]]' type='document' entityId='auth-guide' title='Company Auth Implementation Guide'>
        Use our custom AuthProvider with JWT tokens stored in HttpOnly cookies
      </ContextItem>
    </KnowledgeBaseDocuments>
    <UserSelectedContent>
      <ContextItem citationIndex='[[citation:2]]' type='selectedContent' from='github' entityId='auth-example' title='Auth Example Code'>
        const AuthProvider = ({ children }) => {
          // Company standard auth implementation
        }
      </ContextItem>
    </UserSelectedContent>
  </MentionedContext>
  <WebSearchContext>
    <ContextItem citationIndex='[[citation:3]]' type='webSearchSource' url='react-auth.com' title='React Authentication Best Practices'>
      Implement refresh tokens and secure session management
    </ContextItem>
  </WebSearchContext>
</Context>

Good Response:
Here's what you need to do:

1. Add the AuthProvider to your app's root:
\`\`\`jsx
import { AuthProvider } from '@company/auth';

function App() {
  return (
    <AuthProvider>
      <YourApp />
    </AuthProvider>
  );
}
\`\`\`

2. Configure JWT token storage:
\`\`\`javascript
// In your auth configuration
const authConfig = {
  tokenStorage: 'httpOnly',
  refreshToken: true
};
\`\`\`

This implementation follows our company standards [citation:1] and uses our custom AuthProvider component [citation:2]. We've also included refresh token support for better security [citation:3].

Question: "What project management tools should we use for our new project?"
Context:
<Context>
  <MentionedContext>
    <KnowledgeBaseDocuments>
      <ContextItem citationIndex='[[citation:1]]' type='document' entityId='tools-policy' title='Company Tools Policy'>
        All teams must use Jira for project tracking and Linear for engineering tasks
      </ContextItem>
    </KnowledgeBaseDocuments>
  </MentionedContext>
  <WebSearchContext>
    <ContextItem citationIndex='[[citation:2]]' type='webSearchSource' url='pm-tools.com' title='Top Project Management Tools 2024'>
      ClickUp offers the best value for small teams
    </ContextItem>
  </WebSearchContext>
  <OtherContext>
    <KnowledgeBaseResources>
      <ContextItem citationIndex='[[citation:3]]' type='resource' entityId='jira-guide' title='Jira Setup Guide'>
        Standard Jira workflow and board templates
      </ContextItem>
    </KnowledgeBaseResources>
  </OtherContext>
</Context>

Good Response:
Here's your required toolset:

1. Jira
   - Purpose: Overall project tracking
   - Quick setup: Use our standard board template
   - Access: Request via IT portal

2. Linear
   - Purpose: Engineering task management
   - Integration: Syncs with Jira automatically
   - Setup: Team lead can invite members

Get started by:
1. Creating a new Jira project using our templates [citation:3]
2. Setting up your Linear workspace
3. Configuring the Jira-Linear integration

This setup is mandatory per company policy [citation:1].

Question: "How do I optimize database performance?"
Context:
<Context>
  <MentionedContext>
    <UserSelectedContent>
      <ContextItem citationIndex='[[citation:1]]' type='selectedContent' from='confluence' entityId='db-guide' title='Database Optimization Guide'>
        1. Use indexes for frequently queried columns
        2. Implement query caching
        3. Regular maintenance and cleanup
      </ContextItem>
    </UserSelectedContent>
  </MentionedContext>
  <WebSearchContext>
    <ContextItem citationIndex='[[citation:2]]' type='webSearchSource' url='db-perf.com' title='Database Performance Tips'>
      Advanced optimization techniques including partitioning and sharding
    </ContextItem>
  </WebSearchContext>
</Context>

Good Response:
Here's your immediate optimization checklist:

1. Add indexes to these common columns:
\`\`\`sql
CREATE INDEX idx_user_email ON users(email);
CREATE INDEX idx_order_date ON orders(created_at);
\`\`\`

2. Implement query caching:
\`\`\`javascript
const cache = new RedisCache();
await cache.set('key', queryResult, '1h');
\`\`\`

3. Set up maintenance tasks:
\`\`\`sql
-- Run weekly
ANALYZE TABLE users, orders;
DELETE FROM audit_log WHERE created_at < NOW() - INTERVAL '90 days';
\`\`\`

These optimizations follow our internal guidelines [citation:1]. For scaling beyond 1M records, consider implementing database partitioning [citation:2].

Monitoring:
- Set up alerts for slow queries (>100ms)
- Monitor cache hit rates
- Track index usage statistics
`;
};

export const buildWebSearchChatHistoryExamples = () => {
  return `
  ## Examples with Chat History
  
  1. Mixed Context Sources:
  <ChatHistory>
  <ChatHistoryItem type={human}>How do we handle API authentication?</ChatHistoryItem>
  <ChatHistoryItem type={ai}>We use JWT tokens with refresh mechanism [citation:1].</ChatHistoryItem>
  <ChatHistoryItem type={human}>Show me an example implementation</ChatHistoryItem>
  </ChatHistory>
  <Context>
  <MentionedContext>
    <UserSelectedContent>
      <ContextItem citationIndex='[[citation:1]]' type='selectedContent' from='github' entityId='auth-impl' title='Auth Implementation'>
        const authenticate = async (token) => {
          // JWT verification logic
        }
      </ContextItem>
    </UserSelectedContent>
  </MentionedContext>
  <WebSearchContext>
    <ContextItem citationIndex='[[citation:2]]' type='webSearchSource' url='jwt-best-practices.com' title='JWT Best Practices'>
      Best practices for JWT implementation
    </ContextItem>
  </WebSearchContext>
  </Context>
  
  Good Response:
  Here's our standard authentication implementation [citation:1]:
  \`\`\`javascript
  const authenticate = async (token) => {
    // JWT verification logic
  }
  \`\`\`
  
  2. Internal Documentation Priority:
  <ChatHistory>
  <ChatHistoryItem type={human}>What's our deployment process?</ChatHistoryItem>
  <ChatHistoryItem type={ai}>We use a three-stage deployment process [citation:1].</ChatHistoryItem>
  <ChatHistoryItem type={human}>What are the staging requirements?</ChatHistoryItem>
  </ChatHistory>
  <Context>
  <MentionedContext>
    <KnowledgeBaseDocuments>
      <ContextItem citationIndex='[[citation:1]]' type='document' entityId='deploy-guide' title='Staging Deployment Guide'>
        Staging requires: 1) All tests passing 2) Code review 3) QA approval
      </ContextItem>
    </KnowledgeBaseDocuments>
  </MentionedContext>
  <WebSearchContext>
    <ContextItem citationIndex='[[citation:2]]' type='webSearchSource' url='deployment-best-practices.com' title='Deployment Best Practices'>
      General deployment guidelines and best practices
    </ContextItem>
  </WebSearchContext>
  </Context>
  
  Good Response:
  For staging deployment, our process requires [citation:1]:
  1. All tests must pass
  2. Code review completion
  3. QA approval
  
  3. Context Type Priority:
  <ChatHistory>
  <ChatHistoryItem type={human}>What testing frameworks do we use?</ChatHistoryItem>
  <ChatHistoryItem type={ai}>We use Jest and Cypress [citation:1].</ChatHistoryItem>
  <ChatHistoryItem type={human}>Show me how to write a test</ChatHistoryItem>
  </ChatHistory>
  <Context>
  <MentionedContext>
    <UserSelectedContent>
      <ContextItem citationIndex='[[citation:1]]' type='selectedContent' from='github' entityId='test-example' title='Test Example'>
        test('sum function', () => {
          expect(sum(1, 2)).toBe(3);
        });
      </ContextItem>
    </UserSelectedContent>
  </MentionedContext>
  <OtherContext>
    <KnowledgeBaseResources>
      <ContextItem citationIndex='[[citation:2]]' type='resource' entityId='test-guide' title='Testing Guide'>
        General testing guidelines
      </ContextItem>
    </KnowledgeBaseResources>
  </OtherContext>
  </Context>
  
  Good Response:
  Here's an example test from our codebase [citation:1]:
  \`\`\`javascript
  test('sum function', () => {
    expect(sum(1, 2)).toBe(3);
  });
  \`\`\`
  `;
};
