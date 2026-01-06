/**
 * Prompt templates for multimodal interpretation
 * Supports: Image, Video, Document, Audio
 */

import type { InterpretationPromptOptions, VisionToolPromptOptions } from './types';

// ============================================================================
// Shared Utility Functions
// ============================================================================

/**
 * Build context section for prompts
 * Handles both simple queries and enriched queries with context
 * (User Query + Relevant Context + Available Files from buildContextSummary in preprocess.ts)
 */
function buildContextSection(query?: string): string {
  if (!query) return '';

  // Check if this is an enriched query (contains "User Query:" prefix from buildContextSummary)
  if (query.includes('User Query:')) {
    return `\n## Analysis Context\nThe following context is provided to help you focus your analysis:\n\n${query}\n\nUse this context to prioritize what to analyze and how to describe the content.`;
  }

  // Simple query - treat as user's question
  return `\n## User's Question\n"${query}"\n\nFocus your analysis on aspects relevant to answering this question.`;
}

// ============================================================================
// Video Analysis Prompt Options
// ============================================================================

export interface VideoAnalysisPromptOptions {
  query?: string;
  mode: 'general' | 'transcript' | 'timeline';
}

// ============================================================================
// Document Analysis Prompt Options
// ============================================================================

export interface DocumentAnalysisPromptOptions {
  query?: string;
  mode: 'summary' | 'extract' | 'qa';
  pageRange?: { start?: number; end?: number };
}

// ============================================================================
// Audio Analysis Prompt Options
// ============================================================================

export interface AudioAnalysisPromptOptions {
  query?: string;
  mode: 'transcription' | 'summary' | 'qa' | 'speaker_diarization';
  language?: string;
}

/**
 * Build interpretation prompt for ImageInterpreter
 * This prompt converts images into structured text for downstream reasoning
 *
 * @param opts.query - Can be a simple query or an enriched query with context
 *                     (User Query + Relevant Context + Available Files from buildContextSummary)
 */
export function buildInterpretationPrompt(opts: InterpretationPromptOptions): string {
  const { query, maxChars, imageCount } = opts;
  const plural = imageCount > 1;

  // Build the context section - handles both simple queries and enriched queries with context
  const contextSection = buildContextSection(query);

  return `You are an "Image Interpreter" that converts ${imageCount} image${plural ? 's' : ''} into structured, objective text for downstream AI reasoning.

## Rules
- Describe ONLY observable facts - no speculation or assumptions
- Do NOT produce final answers, conclusions, or recommendations
- Output must be directly usable as context for a reasoning AI
- Be comprehensive but concise - prioritize information density
${maxChars ? `- Total output must not exceed ${maxChars} characters` : ''}
${contextSection}

## Output Format
${plural ? 'For each image, provide:\n' : ''}
### ${plural ? 'Image [N]: ' : ''}Content Summary
- **Main Subjects**: Primary objects, people, UI elements, or focal points
- **Text Content**: Transcribe any visible text verbatim (labels, buttons, titles, body text)
- **Visual Structure**: Layout, organization, visual hierarchy
- **Data & Information**: Numbers, statistics, chart data, table contents (if present)
- **Notable Details**: Colors, styles, states, conditions that may be relevant
- **Uncertainties**: Anything unclear, partially visible, or ambiguous

Now analyze the image${plural ? 's' : ''}:`;
}

/**
 * Build prompt for vision_read tool
 * This is a more focused prompt for specific image analysis tasks
 */
export function buildVisionToolPrompt(opts: VisionToolPromptOptions): string {
  const { intent, maxChars = 2500 } = opts;

  return `Analyze this image and extract information relevant to the following intent:

Intent: "${intent}"

## Guidelines
- Focus specifically on aspects relevant to the stated intent
- Be factual and precise - avoid speculation
- Include any visible text that relates to the intent
- If data, charts, or tables are present and relevant, extract key information
- Keep response under ${maxChars} characters

Provide a focused analysis:`;
}

/**
 * Build a simple OCR-focused prompt
 */
export function buildOcrPrompt(): string {
  return `Extract ALL visible text from this image.
Preserve the original layout and formatting as much as possible.
Organize text by visual sections if applicable.
Do not add any interpretation or commentary - only transcribe the text.`;
}

/**
 * Build a data extraction focused prompt
 */
export function buildDataExtractionPrompt(): string {
  return `Extract structured data from this image.

If the image contains:
- Tables: Format as markdown tables
- Charts/Graphs: Extract data points, labels, and values
- Forms: List field names and their values
- Lists: Format as bullet points

Present the data in a clean, structured format.`;
}

// ============================================================================
// Video Analysis Prompts
// ============================================================================

/**
 * Build prompt for video analysis
 * @param opts.query - Can be a simple query or an enriched query with context
 */
export function buildVideoAnalysisPrompt(opts: VideoAnalysisPromptOptions): string {
  const { query, mode } = opts;
  const contextSection = buildContextSection(query);

  switch (mode) {
    case 'transcript':
      return `Transcribe the audio content of this video.

## Guidelines
- Provide accurate transcription of all spoken content
- Include speaker labels if multiple speakers are present
- Note any significant non-verbal audio (music, sound effects)
- Format timestamps as [MM:SS] at natural breaks
${contextSection}

Provide the transcription:`;

    case 'timeline':
      return `Create a detailed timeline of this video's content.

## Guidelines
- List key events, scenes, or topics with timestamps [MM:SS]
- Note visual transitions, scene changes, and important moments
- Include any text overlays or captions that appear
- Summarize what happens at each timestamp
${contextSection}

Provide the timeline:`;

    default: // 'general'
      return `Analyze this video comprehensively.

## Guidelines
- Describe the main content and purpose of the video
- Identify key subjects, people, objects, or scenes
- Note any text, graphics, or data visualizations
- Summarize the narrative or information presented
- Mention audio elements (speech, music, effects) if significant
${contextSection}

Provide your analysis:`;
  }
}

// ============================================================================
// Document Analysis Prompts
// ============================================================================

/**
 * Build prompt for document (PDF) analysis
 * @param opts.query - Can be a simple query or an enriched query with context
 */
export function buildDocumentAnalysisPrompt(opts: DocumentAnalysisPromptOptions): string {
  const { query, mode, pageRange } = opts;
  const pageInfo = pageRange
    ? `Focus on pages ${pageRange.start || 1} to ${pageRange.end || 'end'}.`
    : '';
  const contextSection = buildContextSection(query);

  switch (mode) {
    case 'extract':
      return `Extract structured content from this document.

## Guidelines
- Extract all visible text content preserving structure
- Convert tables to markdown format
- Describe charts, graphs, and figures
- Note headers, footers, and page numbers
- Preserve document hierarchy (headings, sections)
${pageInfo ? `\n## Scope\n${pageInfo}` : ''}
${contextSection}

Provide the extracted content:`;

    case 'qa':
      return `Answer questions about this document.

## Guidelines
- Provide accurate answers based only on document content
- Quote relevant passages when appropriate
- Note page numbers for referenced information
- If information is not found, clearly state so
${pageInfo ? `\n## Scope\n${pageInfo}` : ''}
${contextSection}

Provide your answer:`;

    default: // 'summary'
      return `Summarize this document comprehensively.

## Guidelines
- Identify the document type and purpose
- Extract main themes, arguments, or findings
- Note key data, statistics, or conclusions
- Describe document structure and organization
- Highlight important tables, figures, or diagrams
${pageInfo ? `\n## Scope\n${pageInfo}` : ''}
${contextSection}

Provide the summary:`;
  }
}

// ============================================================================
// Audio Analysis Prompts
// ============================================================================

/**
 * Build prompt for audio analysis
 * @param opts.query - Can be a simple query or an enriched query with context
 */
export function buildAudioAnalysisPrompt(opts: AudioAnalysisPromptOptions): string {
  const { query, mode, language } = opts;
  const langHint = language ? `The audio is in ${language}.` : '';
  const contextSection = buildContextSection(query);

  switch (mode) {
    case 'transcription':
      return `Transcribe this audio content accurately.

## Guidelines
- Provide verbatim transcription of all spoken content
- Include timestamps [MM:SS] at natural breaks or speaker changes
- Note speaker changes if multiple speakers are present
- Include non-verbal sounds in brackets [laughter], [music], etc.
- Maintain original language unless translation is requested
${langHint ? `\n## Language\n${langHint}` : ''}
${contextSection}

Provide the transcription:`;

    case 'summary':
      return `Summarize this audio content.

## Guidelines
- Identify the type of audio (conversation, lecture, interview, etc.)
- Summarize main topics and key points discussed
- Note any conclusions, decisions, or action items mentioned
- Include relevant quotes if significant
${langHint ? `\n## Language\n${langHint}` : ''}
${contextSection}

Provide the summary:`;

    case 'speaker_diarization':
      return `Identify and label speakers in this audio.

## Guidelines
- Identify distinct speakers (Speaker 1, Speaker 2, etc.)
- Provide timestamps for each speaker segment [MM:SS - MM:SS]
- Transcribe what each speaker says
- Note speaker characteristics if distinguishable (gender, accent, etc.)
${langHint ? `\n## Language\n${langHint}` : ''}
${contextSection}

Provide the speaker-labeled transcription:`;

    default: // 'qa'
      return `Answer questions about this audio content.

## Guidelines
- Listen carefully and provide accurate answers
- Quote relevant portions when appropriate
- Note timestamps for referenced content [MM:SS]
- If information is not found in the audio, clearly state so
${langHint ? `\n## Language\n${langHint}` : ''}
${contextSection}

Provide your answer:`;
  }
}
