/**
 * This file contains example workflows that demonstrate proper tool sequencing
 * based on the requirements for the Pilot workflow system:
 *
 * 1. Research stage (70%): MUST use webSearch, librarySearch, commonQnA for information gathering and analysis
 * 2. Creation stage (30%): MUST ONLY use generateDoc, codeArtifacts, generateMedia in the final steps after sufficient context gathering
 *
 * The workflow MUST follow the correct sequence: research → creation
 * Final output tools (generateDoc, codeArtifacts, generateMedia) MUST ONLY be used in the final 1-2 steps
 * Final output tools MUST almost always reference previous context items (only in extremely rare cases can they generate without context dependency)
 * All codeArtifacts for visualizations MUST produce self-contained single-page HTML files
 */

import { type PilotStepRawOutput } from './index';

/**
 * Builds example user questions for various research scenarios
 */
export function exampleUserQuestions() {
  return {
    marketResearch:
      'I need to research the current state of the electric vehicle market, focusing on major players, technology trends, and consumer adoption barriers.',
    climateImpacts:
      'I need to understand the impacts of global climate change on agriculture, economy, and population migration, and generate a comprehensive report.',
    renewableEnergy:
      'Research global renewable energy investment opportunities, especially focusing on growth projections, key companies, and technological advancements in solar, wind, and hydrogen sectors, and create a professional PowerPoint presentation for potential investors.',
    cityLivability:
      'I need to research the livability index of 50 major global cities, including factors like housing costs, environmental quality, transportation, safety, healthcare, and education, and create an interactive webpage that allows users to compare scores and rankings across different cities.',
  };
}

/**
 * Example 1: Market Research Workflow for Electric Vehicles
 * Demonstrates proper sequencing of tasks from research → creation
 * Note: Creation tasks (generateDoc, codeArtifacts) are ONLY used in the final 1-2 steps
 * and MUST reference previous context items
 */
export function evMarketResearchExample(): PilotStepRawOutput[] {
  return [
    // RESEARCH STAGE - Begin with information gathering
    {
      name: 'Overview of global EV market',
      skillName: 'webSearch',
      query: 'current state of global electric vehicle market 2023 statistics',
      contextItemIds: [],
      workflowStage: 'research',
      priority: 1,
    },
    {
      name: 'Major EV manufacturers research',
      skillName: 'webSearch',
      query: 'leading electric vehicle manufacturers market share comparison',
      contextItemIds: [],
      workflowStage: 'research',
      priority: 1,
    },
    {
      name: 'Current EV technology trends',
      skillName: 'webSearch',
      query: 'latest electric vehicle technology trends battery range charging',
      contextItemIds: ['ev-market-overview-node-id'],
      workflowStage: 'research',
      priority: 2,
    },
    {
      name: 'Consumer adoption barriers',
      skillName: 'librarySearch',
      query: 'barriers to electric vehicle adoption consumer concerns',
      contextItemIds: ['ev-market-overview-node-id'],
      workflowStage: 'research',
      priority: 2,
    },

    // RESEARCH STAGE CONTINUED - Analyze and synthesize the gathered information using commonQnA
    {
      name: 'EV market trends analysis',
      skillName: 'commonQnA',
      query:
        'Analyze the current trends and future trajectory of the electric vehicle market based on the research',
      contextItemIds: [
        'ev-market-overview-node-id',
        'ev-manufacturers-node-id',
        'ev-tech-trends-node-id',
      ],
      workflowStage: 'research',
      priority: 3,
    },
    {
      name: 'EV adoption challenges analysis',
      skillName: 'commonQnA',
      query: 'Analyze the main barriers to EV adoption and potential solutions',
      contextItemIds: ['ev-market-overview-node-id', 'ev-consumer-barriers-node-id'],
      workflowStage: 'research',
      priority: 3,
    },

    // CREATION STAGE - ONLY in the final 1-2 steps and MUST reference previous context items
    {
      name: 'EV market comprehensive report',
      skillName: 'generateDoc',
      query:
        'Create a comprehensive report on the EV market, including major players, technology trends, and consumer adoption barriers',
      contextItemIds: [
        'ev-market-overview-node-id',
        'ev-manufacturers-node-id',
        'ev-tech-trends-node-id',
        'ev-consumer-barriers-node-id',
        'ev-market-analysis-node-id',
        'ev-adoption-analysis-node-id',
      ],
      workflowStage: 'creation',
      priority: 4,
    },
    {
      name: 'EV market visualization',
      skillName: 'codeArtifacts',
      query:
        'Create a single-page HTML visualization dashboard showing EV market share by manufacturer and projected growth. Include interactive bar charts and trend lines with tooltips in a self-contained HTML file with all JavaScript, CSS, and data embedded directly in the file.',
      contextItemIds: [
        'ev-market-overview-node-id',
        'ev-manufacturers-node-id',
        'ev-market-analysis-node-id',
      ],
      workflowStage: 'creation',
      priority: 4,
    },
  ];
}

/**
 * Example 2: Web Research and Comprehensive Analysis on Climate Change Impacts
 * Shows how to structure a complex research workflow with proper tool sequencing
 * Note: Creation tasks (generateDoc, codeArtifacts) are ONLY used in the final 1-2 steps
 * and MUST reference previous context items
 */
export function climateChangeResearchExample(): PilotStepRawOutput[] {
  return [
    // RESEARCH STAGE - Begin with information gathering from various sources
    {
      name: 'Overview of climate change',
      skillName: 'webSearch',
      query: 'latest data on global climate change trends and projections',
      contextItemIds: [],
      workflowStage: 'research',
      priority: 1,
    },
    {
      name: 'Climate impact on agriculture',
      skillName: 'webSearch',
      query: 'impacts of climate change on global agriculture and food security',
      contextItemIds: [],
      workflowStage: 'research',
      priority: 1,
    },
    {
      name: 'Economic impacts of climate change',
      skillName: 'webSearch',
      query: 'economic impacts of climate change by region and industry',
      contextItemIds: ['climate-overview-node-id'],
      workflowStage: 'research',
      priority: 2,
    },
    {
      name: 'Climate-induced migration patterns',
      skillName: 'webSearch',
      query: 'climate change population displacement and migration patterns',
      contextItemIds: ['climate-overview-node-id'],
      workflowStage: 'research',
      priority: 2,
    },
    {
      name: 'Climate policy research',
      skillName: 'librarySearch',
      query: 'global climate policy frameworks and mitigation strategies',
      contextItemIds: ['climate-overview-node-id'],
      workflowStage: 'research',
      priority: 2,
    },
    {
      name: 'Climate case studies collection',
      skillName: 'librarySearch',
      query: 'case studies of climate change impacts in vulnerable regions',
      contextItemIds: [
        'climate-agriculture-node-id',
        'climate-economic-node-id',
        'climate-migration-node-id',
      ],
      workflowStage: 'research',
      priority: 3,
    },

    // RESEARCH STAGE CONTINUED - Process and synthesize the research data using commonQnA
    {
      name: 'Climate research synthesis',
      skillName: 'commonQnA',
      query: 'Synthesize key findings from all climate research into main themes and connections',
      contextItemIds: [
        'climate-overview-node-id',
        'climate-agriculture-node-id',
        'climate-economic-node-id',
        'climate-migration-node-id',
        'climate-policy-node-id',
        'climate-cases-node-id',
      ],
      workflowStage: 'research',
      priority: 3,
    },
    {
      name: 'Future climate scenarios analysis',
      skillName: 'commonQnA',
      query:
        'Analyze potential future climate scenarios and their projected impacts based on current research',
      contextItemIds: [
        'climate-overview-node-id',
        'climate-policy-node-id',
        'climate-synthesis-node-id',
      ],
      workflowStage: 'research',
      priority: 3,
    },

    // CREATION STAGE - ONLY in the final 1-2 steps and MUST reference previous context items
    {
      name: 'Climate change comprehensive report',
      skillName: 'generateDoc',
      query:
        'Create a comprehensive report on climate change impacts on agriculture, economy, and population migration',
      contextItemIds: ['climate-synthesis-node-id', 'climate-scenarios-node-id'],
      workflowStage: 'creation',
      priority: 4,
    },
    {
      name: 'Climate impacts visualization',
      skillName: 'codeArtifacts',
      query:
        'Create a single-page HTML dashboard visualization showing climate change impacts across sectors and regions. Include an interactive heatmap, line charts for trends, and a choropleth map, all in one self-contained HTML file with all data and JavaScript embedded directly in the file.',
      contextItemIds: ['climate-synthesis-node-id'],
      workflowStage: 'creation',
      priority: 4,
    },
  ];
}

/**
 * Example 3: Deep Research and Presentation Creation for Renewable Energy Investment
 * Demonstrates thorough research before creating investment presentation
 * Note: Creation tasks (generateDoc, codeArtifacts) are ONLY used in the final 1-2 steps
 * and MUST reference previous context items
 */
export function renewableEnergyExample(): PilotStepRawOutput[] {
  return [
    // RESEARCH STAGE - Comprehensive research on multiple sectors
    {
      name: 'Renewable energy market overview',
      skillName: 'webSearch',
      query: 'global renewable energy market overview investment trends 2023',
      contextItemIds: [],
      workflowStage: 'research',
      priority: 1,
    },
    {
      name: 'Solar energy investment research',
      skillName: 'webSearch',
      query: 'solar energy industry investment opportunities key companies',
      contextItemIds: [],
      workflowStage: 'research',
      priority: 1,
    },
    {
      name: 'Wind energy investment research',
      skillName: 'webSearch',
      query: 'wind energy industry investment opportunities key companies',
      contextItemIds: [],
      workflowStage: 'research',
      priority: 1,
    },
    {
      name: 'Hydrogen energy investment research',
      skillName: 'webSearch',
      query: 'hydrogen energy industry investment opportunities key companies',
      contextItemIds: [],
      workflowStage: 'research',
      priority: 2,
    },
    {
      name: 'Renewable technology advancements',
      skillName: 'librarySearch',
      query: 'latest technological advancements in renewable energy sectors',
      contextItemIds: [
        'renewable-solar-node-id',
        'renewable-wind-node-id',
        'renewable-hydrogen-node-id',
      ],
      workflowStage: 'research',
      priority: 2,
    },
    {
      name: 'Renewable energy policies research',
      skillName: 'webSearch',
      query: 'global renewable energy policies subsidies incentives by region',
      contextItemIds: ['renewable-market-node-id'],
      workflowStage: 'research',
      priority: 2,
    },

    // RESEARCH STAGE CONTINUED - In-depth analysis of research findings using commonQnA
    {
      name: 'Renewable investment risk analysis',
      skillName: 'commonQnA',
      query:
        'Analyze the risks and challenges associated with different renewable energy investments',
      contextItemIds: [
        'renewable-market-node-id',
        'renewable-solar-node-id',
        'renewable-wind-node-id',
        'renewable-hydrogen-node-id',
      ],
      workflowStage: 'research',
      priority: 3,
    },
    {
      name: 'Renewable ROI comparison',
      skillName: 'commonQnA',
      query: 'Compare projected returns on investment for different renewable energy sectors',
      contextItemIds: [
        'renewable-solar-node-id',
        'renewable-wind-node-id',
        'renewable-hydrogen-node-id',
        'renewable-risk-node-id',
      ],
      workflowStage: 'research',
      priority: 3,
    },
    {
      name: 'Investment strategy recommendations',
      skillName: 'commonQnA',
      query: 'Formulate strategic recommendations for investing in renewable energy',
      contextItemIds: [
        'renewable-market-node-id',
        'renewable-risk-node-id',
        'renewable-roi-node-id',
        'renewable-policy-node-id',
      ],
      workflowStage: 'research',
      priority: 3,
    },
    {
      name: 'Presentation outline creation',
      skillName: 'commonQnA',
      query:
        'Create a detailed outline for a professional renewable energy investment presentation',
      contextItemIds: [
        'renewable-market-node-id',
        'renewable-solar-node-id',
        'renewable-wind-node-id',
        'renewable-hydrogen-node-id',
        'renewable-strategy-node-id',
      ],
      workflowStage: 'research',
      priority: 4,
    },

    // CREATION STAGE - ONLY in the final 1-2 steps and MUST reference previous context items
    {
      name: 'Renewable investment data visualizations',
      skillName: 'codeArtifacts',
      query:
        'Create a single-page HTML dashboard comparing renewable energy sectors, returns, and growth projections. Include stacked bar charts, ROI comparison charts, and trend lines all integrated in one page.',
      contextItemIds: ['renewable-market-node-id', 'renewable-roi-node-id'],
      workflowStage: 'creation',
      priority: 4,
    },
    {
      name: 'Professional investment presentation',
      skillName: 'codeArtifacts',
      query:
        'Create a single-page HTML presentation for potential renewable energy investors. Build a complete slideshow interface with all slides embedded, charts, and interactive elements in one self-contained HTML file. Include all JavaScript, CSS, and data directly in the file.',
      contextItemIds: [
        'renewable-outline-node-id',
        'renewable-strategy-node-id',
        'renewable-tech-node-id',
        'renewable-visualizations-node-id',
      ],
      workflowStage: 'creation',
      priority: 5,
    },
  ];
}

/**
 * Example 4: Interactive Data Visualization for Global City Livability
 * Shows proper sequencing from research to data processing to final interactive output
 * Note: Creation tasks (generateDoc, codeArtifacts) are ONLY used in the final 1-2 steps
 * and MUST reference previous context items
 */
export function cityLivabilityExample(): PilotStepRawOutput[] {
  return [
    // RESEARCH STAGE - Gather fundamental data
    {
      name: 'Major cities selection',
      skillName: 'webSearch',
      query: 'list of 50 major global cities by population and significance',
      contextItemIds: [],
      workflowStage: 'research',
      priority: 1,
    },
    {
      name: 'Livability metrics definition',
      skillName: 'commonQnA',
      query: 'Define key metrics and weights for city livability assessment',
      contextItemIds: [],
      workflowStage: 'research',
      priority: 1,
    },
    {
      name: 'Housing cost data collection',
      skillName: 'webSearch',
      query: 'housing costs comparison across major global cities',
      contextItemIds: ['cities-list-node-id'],
      workflowStage: 'research',
      priority: 2,
    },
    {
      name: 'Environmental quality data',
      skillName: 'webSearch',
      query: 'environmental quality air pollution water quality rankings global cities',
      contextItemIds: ['cities-list-node-id'],
      workflowStage: 'research',
      priority: 2,
    },
    {
      name: 'Transportation data collection',
      skillName: 'webSearch',
      query: 'public transportation quality and convenience in major global cities',
      contextItemIds: ['cities-list-node-id'],
      workflowStage: 'research',
      priority: 2,
    },
    {
      name: 'Safety index research',
      skillName: 'webSearch',
      query: 'safety rankings and crime rates in major global cities',
      contextItemIds: ['cities-list-node-id'],
      workflowStage: 'research',
      priority: 2,
    },
    {
      name: 'Healthcare quality research',
      skillName: 'webSearch',
      query: 'healthcare quality and accessibility in major global cities',
      contextItemIds: ['cities-list-node-id'],
      workflowStage: 'research',
      priority: 2,
    },
    {
      name: 'Education quality research',
      skillName: 'webSearch',
      query: 'education quality rankings for major global cities',
      contextItemIds: ['cities-list-node-id'],
      workflowStage: 'research',
      priority: 2,
    },

    // RESEARCH STAGE CONTINUED - Process and analyze the collected data using commonQnA
    {
      name: 'Data standardization plan',
      skillName: 'commonQnA',
      query:
        'Develop approach for standardizing different metrics across cities into comparable scores',
      contextItemIds: [
        'livability-metrics-node-id',
        'housing-data-node-id',
        'environment-data-node-id',
        'transport-data-node-id',
        'safety-data-node-id',
        'healthcare-data-node-id',
        'education-data-node-id',
      ],
      workflowStage: 'research',
      priority: 3,
    },
    {
      name: 'Livability score calculation',
      skillName: 'commonQnA',
      query:
        'Define algorithm for calculating comprehensive livability scores based on weighted factors',
      contextItemIds: ['livability-metrics-node-id', 'standardization-node-id'],
      workflowStage: 'research',
      priority: 3,
    },
    {
      name: 'City data analysis',
      skillName: 'commonQnA',
      query:
        'Analyze patterns and insights from city data, identifying key trends and correlations',
      contextItemIds: [
        'housing-data-node-id',
        'environment-data-node-id',
        'transport-data-node-id',
        'safety-data-node-id',
        'healthcare-data-node-id',
        'education-data-node-id',
      ],
      workflowStage: 'research',
      priority: 3,
    },
    {
      name: 'Visualization interface design',
      skillName: 'commonQnA',
      query: 'Design interface requirements for interactive city livability visualization',
      contextItemIds: ['livability-score-node-id', 'city-analysis-node-id'],
      workflowStage: 'research',
      priority: 4,
    },

    // CREATION STAGE - ONLY in the final 1-2 steps and MUST reference previous context items
    {
      name: 'City livability data dashboard',
      skillName: 'codeArtifacts',
      query:
        'Create a single-page HTML dashboard with built-in data processing for the city livability data. Include the data transformation logic directly in the HTML file with all normalization and scoring calculations.',
      contextItemIds: ['standardization-node-id', 'livability-score-node-id'],
      workflowStage: 'creation',
      priority: 4,
    },
    {
      name: 'Interactive city map visualization',
      skillName: 'codeArtifacts',
      query:
        'Create a single-page HTML map visualization showing cities colored by livability score. Include the complete interactive map with all necessary data embedded in the HTML file.',
      contextItemIds: [
        'cities-list-node-id',
        'livability-score-node-id',
        'interface-design-node-id',
      ],
      workflowStage: 'creation',
      priority: 5,
    },
    {
      name: 'City comparison tool',
      skillName: 'codeArtifacts',
      query:
        'Create a single-page HTML tool that allows users to compare selected cities across different metrics. Include all data and interactive elements in a self-contained HTML file.',
      contextItemIds: ['interface-design-node-id', 'data-processing-node-id'],
      workflowStage: 'creation',
      priority: 5,
    },
    {
      name: 'Complete livability web application',
      skillName: 'codeArtifacts',
      query:
        'Create a comprehensive single-page HTML application that integrates all city livability visualizations, comparison tools, and data. Include all functionality in one self-contained HTML file with embedded data and scripts.',
      contextItemIds: ['city-map-node-id', 'comparison-tool-node-id', 'interface-design-node-id'],
      workflowStage: 'creation',
      priority: 5,
    },
  ];
}

/**
 * Builds formatted examples showing proper tool sequencing for LLM consumption
 * Includes examples for all workflow stages with clear labeling
 * @param stage The current workflow stage ('research' or 'creation')
 */
export function buildFormattedExamples(): string {
  // Get the full workflow examples
  const evMarketSteps = evMarketResearchExample();
  const cityLivabilitySteps = cityLivabilityExample();

  // Filter steps based on stage type
  const getStageSteps = (steps: PilotStepRawOutput[], targetStage: string) => {
    return steps.filter((step) => step.workflowStage === targetStage);
  };

  // Get examples for each stage - simplified two-stage workflow
  const researchSteps = getStageSteps(evMarketSteps, 'research').slice(0, 5);
  const creationSteps = getStageSteps(cityLivabilitySteps, 'creation').slice(0, 3);

  return `
## Proper Tool Sequencing Based on Epoch Progress

Research projects are divided into epochs (iterations), with each epoch representing progress through the simplified two-stage workflow:

1. **Research Epochs (0-70% Progress)**
   - Stage: RESEARCH
   - Tools: webSearch, librarySearch, commonQnA for information gathering and analysis
   - Focus: Collecting information, analyzing data, identifying patterns, and synthesizing insights
   - Activities: Data collection, analysis, synthesis, planning - all using research tools

2. **Creation Epochs (70-100% Progress)**
   - Stage: CREATION
   - Tools: generateDoc, codeArtifacts, generateMedia for final outputs
   - Focus: Creating polished deliverables based on all research work
   - Activities: Document generation, code creation, media production

IMPORTANT: Always follow the sequence appropriate for the current epoch. Research phase focuses on comprehensive information gathering and analysis, while creation phase focuses solely on output generation.

CRITICAL RULES FOR CREATION TOOLS:
- generateDoc, codeArtifacts, and generateMedia MUST ONLY be used in the final 1-2 steps of the workflow
- These tools MUST reference previous context items in almost all cases
- Only in extremely rare cases can they generate without context dependency
- Never use these tools until sufficient research and analysis has been completed

## Research Stage Examples (Research Phase: 0-70% Progress)
User Question: "${exampleUserQuestions().marketResearch}"

Canvas Content:
### Canvas Item 1 (ID: ev-market-overview-node-id, Type: document)
**Document Title:** Overview of Electric Vehicle Market
**Document Preview:**
This document provides a basic overview of the current state of the electric vehicle market, including trends and major players.
**Context ID:** ev-market-overview-node-id

Examples of good research steps including information gathering, analysis, and synthesis:
${JSON.stringify(researchSteps, null, 2)}

## Creation Stage Examples (Creation Phase: 70-100% Progress)
User Question: "${exampleUserQuestions().cityLivability}"

Canvas Content:
### Canvas Item 1 (ID: cities-list-node-id, Type: document)
**Document Title:** Major Global Cities Overview
**Document Preview:**
This document provides information about 50 major global cities, including basic demographic and geographic data.
**Context ID:** cities-list-node-id

### Canvas Item 2 (ID: livability-metrics-node-id, Type: skillResponse)
**Question:** What metrics determine city livability?
**Answer:**
Key livability metrics include housing affordability, environmental quality, public transportation, safety, healthcare access, and education quality.
**Context ID:** livability-metrics-node-id

### Canvas Item 3 (ID: city-analysis-node-id, Type: skillResponse)
**Question:** What are the key patterns in city livability data?
**Answer:**
Analysis shows correlations between public transportation quality, environmental factors, and overall livability scores. Cities with strong public infrastructure tend to score higher overall.
**Context ID:** city-analysis-node-id

Examples of good creation steps for final epochs:
${JSON.stringify(creationSteps, null, 2)}`;
}

// Alias for backward compatibility - now accepts stage parameter
export function buildDetailedExamples(): string {
  return buildFormattedExamples();
}

/**
 * Builds examples relevant to the current research stage
 * @param stage The current workflow stage ('research' or 'creation')
 */
export function buildResearchStepExamples(): string {
  return buildFormattedExamples();
}
