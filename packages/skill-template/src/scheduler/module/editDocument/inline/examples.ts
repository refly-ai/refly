export const noContextExamples = `
## Examples

<example index="1">
<query>
Rewrite this section to be more comprehensive
</query>
<context>
<reflyArtifact identifier="tech-doc" type="document" title="Cloud Computing Overview">
Cloud computing is transforming modern business. <highlight>It provides scalable resources and reduces infrastructure costs. Companies can access computing power on demand.</highlight> Many organizations are adopting cloud solutions.
</reflyArtifact>
</context>
<response>
It delivers a comprehensive suite of scalable computing resources through a pay-as-you-go model, significantly reducing infrastructure costs while enabling organizations to dynamically adjust their computing capacity based on real-time demands.
</response>
</example>

<example index="2">
<query>
Translate this section to Chinese
</query>
<context>
<reflyArtifact identifier="tech-doc" type="document" title="Cloud Computing Overview">
Our platform enables <highlight>secure and reliable data processing with advanced encryption methods</highlight> for all users.
</reflyArtifact>
</context>
<response>
采用先进的加密方法进行安全可靠的数据处理
</response>
</example>

<example index="3">
<query>
Improve the grammar and clarity of this section
</query>
<context>
<reflyArtifact identifier="api-docs" type="document" title="API Documentation">
Authentication is required for all endpoints. <highlight>When you wanting to make API calls, you need getting the token first and then you putting it in the header of you're request</highlight>. See the authentication section for details.
</reflyArtifact>
</context>
<response>
To make API calls, first obtain an authentication token and include it in your request headers
</response>
</example>`;

// TODO: add citation
export const contextualExamples = `
## Context-Aware Examples

<example index="1">
<chatHistory>
<ChatHistoryItem type="human">What's our current cloud infrastructure cost?</ChatHistoryItem>
<ChatHistoryItem type="ai">Based on recent analysis, we've achieved 40% cost reduction.</ChatHistoryItem>
<ChatHistoryItem type="human">Please update our cloud overview with these details.</ChatHistoryItem>
</chatHistory>
<context>
<documentContext>
<reflyArtifact identifier="tech-doc" type="document" title="Cloud Computing Overview">
Cloud computing is transforming modern business. <highlight>It provides scalable resources and reduces infrastructure costs.</highlight> Many organizations are adopting cloud solutions.
</reflyArtifact>
</documentContext>

<referenceContext>
<MentionedContext>
<KnowledgeBaseResources>
<ContextItem citationIndex='1' type='resource' title='Cost Analysis'>
Our analysis shows:
- 40% reduction in infrastructure costs
- 60% improvement in resource utilization
- 30% faster deployment cycles
</ContextItem>
</KnowledgeBaseResources>
</MentionedContext>
</referenceContext>
</context>
<response>
It delivers elastic scalability with proven cost benefits, demonstrating a 40% reduction in infrastructure costs
</response>
</example>

<example index="2">
<chatHistory>
<ChatHistoryItem type="human">What authentication method do we use?</ChatHistoryItem>
<ChatHistoryItem type="ai">We use JWT tokens with 15-minute expiration.</ChatHistoryItem>
<ChatHistoryItem type="human">Update our auth docs to reflect this.</ChatHistoryItem>
</chatHistory>
<context>
<documentContext>
<reflyArtifact identifier="api-docs" type="document" title="API Documentation">
Authentication is required for all endpoints. <highlight>When you wanting to make API calls, you need getting the token first and then you putting it in the header of you're request.</highlight> See the authentication section for details.
</reflyArtifact>
</documentContext>

<referenceContext>
<MentionedContext>
<KnowledgeBaseDocuments>
<ContextItem citationIndex='1' type='document' title='Security Standards'>
Authentication requirements:
- JWT-based authentication
- 15-minute token expiration
- Rate limiting enforced
</ContextItem>
</KnowledgeBaseDocuments>
</MentionedContext>
</referenceContext>
</context>
<response>
To make API calls, obtain a JWT token (15-minute expiration) and include it in your request headers
</response>
</example>

<example index="3">
<chatHistory>
<ChatHistoryItem type="human">How do we handle database backups?</ChatHistoryItem>
<ChatHistoryItem type="ai">We use automated daily backups with 30-day retention.</ChatHistoryItem>
<ChatHistoryItem type="human">Please update our backup documentation.</ChatHistoryItem>
</chatHistory>
<context>
<documentContext>
<reflyArtifact identifier="ops-doc" type="document" title="Database Operations">
Database management is critical. <highlight>We perform regular backups to ensure data safety.</highlight> Recovery procedures are documented below.
</reflyArtifact>
</documentContext>

<referenceContext>
<MentionedContext>
<KnowledgeBaseDocuments>
<ContextItem citationIndex='1' type='document' title='Backup Policy'>
Current backup strategy:
- Automated daily backups
- 30-day retention period
- Encrypted storage
</ContextItem>
<ContextItem citationIndex='2' type='document' title='Recovery SLA'>
Recovery time objectives:
- Critical data: 1 hour
- Non-critical: 4 hours
</ContextItem>
</KnowledgeBaseDocuments>
</MentionedContext>
</referenceContext>
</context>
<response>
We implement automated daily backups with 30-day retention and encrypted storage
</response>
</example>

<example index="4">
<chatHistory>
<ChatHistoryItem type="human">What monitoring tools do we use?</ChatHistoryItem>
<ChatHistoryItem type="ai">We use Prometheus with Grafana dashboards.</ChatHistoryItem>
<ChatHistoryItem type="human">Update our monitoring section with these details.</ChatHistoryItem>
</chatHistory>
<context>
<documentContext>
<reflyArtifact identifier="ops-doc" type="document" title="Operations Guide">
System health is monitored continuously. <highlight>We use various tools to track performance metrics.</highlight> Alert thresholds are defined below.
</reflyArtifact>
</documentContext>

<referenceContext>
<MentionedContext>
<KnowledgeBaseDocuments>
<ContextItem citationIndex='1' type='document' title='Monitoring Stack'>
Current tooling:
- Prometheus metrics
- Grafana dashboards
- PagerDuty alerts
</ContextItem>
<ContextItem citationIndex='2' type='document' title='Alert Thresholds'>
Standard thresholds:
- CPU: 80%
- Memory: 90%
- Latency: 500ms
</ContextItem>
</KnowledgeBaseDocuments>
</MentionedContext>
</referenceContext>
</context>
<response>
We leverage Prometheus for metrics collection with Grafana dashboards for visualization, integrated with PagerDuty for alerting
</response>
</example>`;
