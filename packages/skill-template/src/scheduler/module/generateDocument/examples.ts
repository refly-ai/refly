import { commonNote } from './rules';

// Non-contextual examples - keeping existing examples
export const noContextExamples = () => `
## Examples

${commonNote()}

<example index="1">
<query>
Write a technical guide about React performance optimization
</query>
<response>
## Understanding React Rendering
React's rendering process is fundamental to application performance...

## Common Performance Issues
Several common issues can impact React application performance...

## Optimization Techniques
Let's explore proven techniques for optimizing React applications...

...</response>
</example>

<example index="2">
<query>
Create a product launch announcement for our new AI tool
</query>
<response>
## Executive Summary
We are thrilled to announce the launch of our groundbreaking AI tool...

## Key Features
Our innovative AI solution offers several industry-leading features...

## Market Impact
This launch represents a significant advancement in the AI industry...

...</response>
</example>
`;

// New contextual examples demonstrating context and citation usage
export const contextualExamples = () => `
## Context-Aware Examples

Note:
${commonNote()}

<example index="1">
<context>
<MentionedContext>
<KnowledgeBaseDocuments>
<ContextItem citationIndex='2' type='document' entityId='document-123'>
Our company's AI platform has achieved a 40% improvement in processing speed and 30% reduction in error rates compared to previous versions. Key features include real-time analysis, automated reporting, and integration capabilities.
</ContextItem>
</KnowledgeBaseDocuments>
</MentionedContext>
</context>
<query>
Write a whitepaper about the future of AI technology and our company's position in the market
</query>
<response>
## Market Overview
The artificial intelligence sector is experiencing unprecedented growth, with projections indicating a market size of $407 billion by 2027. This explosive growth is particularly evident in enterprise applications, where demand for sophisticated AI solutions continues to rise.

## Technological Leadership
Our company stands at the forefront of AI innovation, demonstrated by our latest platform achievements. We've achieved remarkable improvements in key performance metrics, including a 40% increase in processing speed and a 30% reduction in error rates.

## Competitive Advantages
Our platform's distinctive features align perfectly with emerging industry trends:
- Real-time analysis capabilities meeting the growing demand for instant insights
- Automated reporting systems enhancing operational efficiency
- Robust integration features supporting enterprise-wide deployment
...
</response>
</example>

<example index="2">
<context>
<MentionedContext>
<UserSelectedContent>
<ContextItem citationIndex='1' type='selectedContent' title='Product Specifications'>
The XR-5000 features include:
- 5nm processing architecture
- 32GB unified memory
- Advanced neural processing unit
- Real-time data analysis
- Multi-platform compatibility
</ContextItem>
</UserSelectedContent>
<KnowledgeBaseResources>
<ContextItem citationIndex='2' type='resource' title='Market Research'>
Customer pain points:
1. Complex integration requirements
2. Long processing times
3. Limited scalability
4. High maintenance costs
</ContextItem>
</KnowledgeBaseResources>
</MentionedContext>
</context>
<query>
Create a technical product overview for our new XR-5000 system
</query>
<response>
## Technical Architecture
The XR-5000 represents a breakthrough in AI processing capabilities, built on a cutting-edge 5nm architecture and equipped with 32GB unified memory. This advanced hardware foundation enables unprecedented performance in enterprise environments.

## Addressing Market Needs
Our system directly addresses key market challenges identified through extensive research:
1. Simplified Integration: Multi-platform compatibility ensures seamless deployment
2. Enhanced Performance: Advanced neural processing unit significantly reduces processing times
3. Enterprise Scalability: Flexible architecture supports growing business needs
4. Cost Efficiency: Reduced maintenance requirements through automated optimization
...
</response>
</example>

<example index="3">
<chatHistory>
<ChatHistoryItem type={human}>What are our company's core technologies?</ChatHistoryItem>
<ChatHistoryItem type={ai}>Our core technologies include AI-driven analytics, cloud infrastructure, and machine learning models [citation:1].</ChatHistoryItem>
<ChatHistoryItem type={human}>Write a detailed technical overview of our AI analytics platform</ChatHistoryItem>
</chatHistory>
<context>
<MentionedContext>
<KnowledgeBaseDocuments>
<ContextItem citationIndex='1' type='document' entityId='tech-stack-123'>
Core technologies: AI analytics platform, cloud infrastructure, ML models
</ContextItem>
<ContextItem citationIndex='2' type='document' entityId='ai-platform-456'>
Our AI analytics platform features:
- Real-time data processing
- Advanced visualization tools
- Automated insight generation
- Custom reporting capabilities
</ContextItem>
</KnowledgeBaseDocuments>
</MentionedContext>
</context>
<response>
## AI Analytics Platform Technical Overview

Building on our established technological foundation [citation:1], our AI analytics platform represents a comprehensive solution for enterprise data analysis. The platform incorporates several key technical components:

### Core Capabilities [citation:2]
1. Real-time Data Processing
   - Immediate data ingestion and analysis
   - Stream processing architecture

2. Advanced Visualization
   - Interactive dashboards
   - Custom visualization tools

3. Automated Insights
   - Pattern recognition
   - Anomaly detection

4. Reporting System
   - Customizable report templates
   - Automated report generation

...
</response>
</example>

<example index="4">
<chatHistory>
<ChatHistoryItem type={human}>What security measures do we have in place?</ChatHistoryItem>
<ChatHistoryItem type={ai}>Our security framework includes encryption, access controls, and regular audits [citation:1].</ChatHistoryItem>
<ChatHistoryItem type={human}>Create a comprehensive security documentation for our clients</ChatHistoryItem>
</chatHistory>
<context>
<MentionedContext>
<KnowledgeBaseDocuments>
<ContextItem citationIndex='1' type='document' entityId='security-overview'>
Security measures: End-to-end encryption, role-based access, quarterly audits
</ContextItem>
<ContextItem citationIndex='2' type='document' entityId='security-details'>
Additional security features:
- Multi-factor authentication
- Regular penetration testing
- 24/7 monitoring
- Incident response team
</ContextItem>
</KnowledgeBaseDocuments>
</MentionedContext>
</context>
<response>
## Security Framework Documentation

Building upon our robust security infrastructure [citation:1], this documentation provides a detailed overview of our comprehensive security measures.

### Core Security Components
1. Data Protection
   - End-to-end encryption for all data
   - Role-based access control implementation

2. Security Monitoring [citation:2]
   - 24/7 system monitoring
   - Dedicated incident response team
   - Regular penetration testing

3. Authentication & Access
   - Multi-factor authentication requirements
   - Granular permission controls

...
</response>
</example>
`;
