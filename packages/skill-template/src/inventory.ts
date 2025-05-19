import { BaseSkill } from './base';
import { SkillEngine } from './engine';
import {
  CreateFormalEmailSkill,
  BasicSummarySkill,
  ExplainTermsSkill,
  TranslateSkill,
  BrainstormIdeasSkill,
  ChangeToneSkill,
  ContinueWritingSkill,
  CreateArticleOutlineSkill,
  CreateBlogPostSkill,
  CreateSocialMediaPostSkill,
  ExtractActionItemSkill,
  FixSpellingAndGrammarIssuesSkill,
  ImproveWritingSkill,
  LanguageSimplificationSkill,
  MakeShorterSkill,
  MakeLongerSkill,
} from './templates';
import {
  // CommonQnA,
  GenerateDoc,
  EditDoc,
  WebSearch,
  LibrarySearch,
  RecommendQuestions,
  CustomPrompt,
  CodeArtifacts,
  ImageGeneration,
} from './skills';
import { Agent } from './skills/agent';

export const createSkillTemplateInventory = (engine: SkillEngine): BaseSkill[] => {
  return [
    new CreateFormalEmailSkill(engine),
    new BasicSummarySkill(engine),
    new ExplainTermsSkill(engine),
    new TranslateSkill(engine),
    new BrainstormIdeasSkill(engine),
    new ChangeToneSkill(engine),
    new ContinueWritingSkill(engine),
    new CreateArticleOutlineSkill(engine),
    new CreateBlogPostSkill(engine),
    new CreateSocialMediaPostSkill(engine),
    new ExtractActionItemSkill(engine),
    new FixSpellingAndGrammarIssuesSkill(engine),
    new ImproveWritingSkill(engine),
    new LanguageSimplificationSkill(engine),
    new MakeShorterSkill(engine),
    new MakeLongerSkill(engine),
    new ImageGeneration(engine),
  ];
};

export const createSkillInventory = (engine: SkillEngine): BaseSkill[] => {
  return [
    new CodeArtifacts(engine),
    new ImageGeneration(engine),
    new WebSearch(engine),
    new LibrarySearch(engine),
    new CustomPrompt(engine),
    new GenerateDoc(engine),
    new RecommendQuestions(engine),
    // new CommonQnA(engine),
    // new RewriteDoc(engine),
    new EditDoc(engine),
    new Agent(engine),
  ];
};
