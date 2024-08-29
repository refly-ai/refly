import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { cut, extract } from '@node-rs/jieba';
import { PrismaService } from '@/common/prisma.service';
import {
  ResourceMeta,
  ResourceType,
  SearchRequest,
  SearchResult,
  User,
} from '@refly/openapi-schema';
import { RAGService } from '@/rag/rag.service';

interface ProcessedSearchRequest extends SearchRequest {
  tokens: string[];
}

@Injectable()
export class SearchService {
  constructor(private prisma: PrismaService, private rag: RAGService) {}

  preprocessSearchRequest(req: SearchRequest): ProcessedSearchRequest {
    if (!req.limit || req.limit <= 0) {
      req.limit = 5;
    }
    if (req.limit > 10) {
      req.limit = 10;
    }
    req.mode ??= 'keyword';
    req.domains ??= ['resource', 'note', 'collection', 'conversation', 'skill'];

    let tokens = cut(req.query);
    if (tokens.length > 5) {
      const extractedTokens = extract(req.query, 5).map((item) => item.keyword);
      if (extractedTokens.length > 0) {
        tokens = extractedTokens;
      }
    }
    return { ...req, tokens };
  }

  async emptySearchResources(user: User, req: ProcessedSearchRequest): Promise<SearchResult[]> {
    const results = await this.prisma.resource.findMany({
      select: {
        resourceId: true,
        resourceType: true,
        title: true,
        content: true,
        createdAt: true,
        updatedAt: true,
      },
      where: {
        uid: user.uid,
      },
      orderBy: { updatedAt: 'desc' },
      take: req.limit || 5,
    });

    return results.map((result) => ({
      id: result.resourceId,
      domain: 'resource',
      title: result.title,
      content: [result.content.slice(0, 250) + '...'], // TODO: truncate in sql to reduce traffic
      metadata: {
        resourceType: result.resourceType as ResourceType,
      },
      createdAt: result.createdAt.toJSON(),
      updatedAt: result.updatedAt.toJSON(),
    }));
  }

  async searchResourcesByKeywords(
    user: User,
    req: ProcessedSearchRequest,
  ): Promise<SearchResult[]> {
    const tokens = req.tokens;

    interface ResourceResult {
      resource_id: string;
      resource_type: ResourceType;
      meta: string;
      created_at: string;
      updated_at: string;
      title: string;
      content: string;
    }
    const tokenList = tokens.join(' ');
    const tokenOrList = tokens.join(' OR ');
    const resources = await this.prisma.$queryRaw<ResourceResult[]>`
      SELECT   resource_id,
               resource_type,
               meta,
               created_at,
               updated_at,
               pgroonga_highlight_html(
                 title, pgroonga_query_extract_keywords(${tokenList}::TEXT)
               ) AS title,
               pgroonga_highlight_html(
                 content, pgroonga_query_extract_keywords(${tokenList}::TEXT)
               ) AS content
      FROM     resources
      WHERE    uid = ${user.uid}
      AND      (title &@~ ${tokenList}::TEXT OR content &@~ ${tokenOrList}::TEXT)
      ORDER BY pgroonga_score(tableoid, ctid) DESC,
               updated_at DESC
      LIMIT    ${req.limit || 5}
    `;

    return resources.map((resource) => ({
      id: resource.resource_id,
      domain: 'resource',
      title: resource.title,
      content: resource.content
        .split(/\r?\n+/)
        .filter((line) => /<span\b[^>]*>(.*?)<\/span>/gi.test(line)),
      metadata: {
        resourceMeta: JSON.parse(resource.meta || '{}'),
        resourceType: resource.resource_type,
      },
      createdAt: resource.created_at,
      updatedAt: resource.updated_at,
    }));
  }

  async searchResourcesByVector(user: User, req: ProcessedSearchRequest): Promise<SearchResult[]> {
    const nodes = await this.rag.retrieve(user, {
      query: req.query,
      limit: req.limit,
      filter: { nodeTypes: ['resource'] },
    });
    if (nodes.length === 0) {
      return [];
    }

    const resourceIds = [...new Set(nodes.map((node) => node.resourceId).filter((id) => !!id))];
    const resources = await this.prisma.resource.findMany({
      where: {
        resourceId: { in: resourceIds },
        deletedAt: null,
      },
    });
    const resourceMap = new Map(
      resources.map((resource) => [resource.resourceId, JSON.parse(resource.meta) as ResourceMeta]),
    );

    return nodes.map((node) => ({
      id: node.resourceId,
      domain: 'resource',
      title: node.title,
      content: [node.content],
      metadata: {
        resourceMeta: resourceMap.get(node.resourceId),
        resourceType: node.resourceType,
      },
    }));
  }

  async searchResources(user: User, req: ProcessedSearchRequest): Promise<SearchResult[]> {
    const tokens = req.tokens;

    if (tokens.length === 0) {
      return this.emptySearchResources(user, req);
    }

    switch (req.mode) {
      case 'keyword':
        return this.searchResourcesByKeywords(user, req);
      case 'vector':
        return this.searchResourcesByVector(user, req);
      case 'hybrid':
        throw new BadRequestException('Not implemented');
      default:
        return this.searchResourcesByKeywords(user, req);
    }
  }

  async emptySearchNotes(user: User, req: ProcessedSearchRequest): Promise<SearchResult[]> {
    const notes = await this.prisma.note.findMany({
      select: {
        noteId: true,
        title: true,
        content: true,
        createdAt: true,
        updatedAt: true,
      },
      where: { uid: user.uid, deletedAt: null },
      orderBy: { updatedAt: 'desc' },
      take: req.limit || 5,
    });
    return notes.map((note) => ({
      id: note.noteId,
      domain: 'note',
      title: note.title,
      content: [note.content ? note.content.slice(0, 250) + '...' : ''],
      createdAt: note.createdAt.toJSON(),
      updatedAt: note.updatedAt.toJSON(),
    }));
  }

  async searchNotesByKeywords(user: User, req: ProcessedSearchRequest): Promise<SearchResult[]> {
    const tokens = req.tokens;

    interface NoteResult {
      note_id: string;
      created_at: string;
      updated_at: string;
      title: string;
      content: string;
    }
    const tokenList = tokens.join(' ');
    const tokenOrList = tokens.join(' OR ');
    const notes = await this.prisma.$queryRaw<NoteResult[]>`
      SELECT   note_id,
               created_at,
               updated_at,
               pgroonga_highlight_html(
                 title, pgroonga_query_extract_keywords(${tokenList}::TEXT)
               ) AS title,
               pgroonga_highlight_html(
                 content, pgroonga_query_extract_keywords(${tokenList}::TEXT)
               ) AS content
      FROM     notes
      WHERE    uid = ${user.uid}
      AND      (title &@~ ${tokenList}::TEXT OR content &@~ ${tokenOrList}::TEXT)
      ORDER BY pgroonga_score(tableoid, ctid) DESC,
               updated_at DESC
      LIMIT    ${req.limit || 5}
    `;

    return notes.map((note) => ({
      id: note.note_id,
      domain: 'note',
      title: note.title,
      content: note.content
        .split(/\r?\n+/)
        .filter((line) => /<span\b[^>]*>(.*?)<\/span>/gi.test(line)),
      createdAt: note.created_at,
      updatedAt: note.updated_at,
    }));
  }

  async searchNotesByVector(user: User, req: ProcessedSearchRequest): Promise<SearchResult[]> {
    const nodes = await this.rag.retrieve(user, {
      query: req.query,
      limit: req.limit,
      filter: { nodeTypes: ['note'] },
    });
    if (nodes.length === 0) {
      return [];
    }

    return nodes.map((node) => ({
      id: node.noteId,
      domain: 'note',
      title: node.title,
      content: [node.content],
    }));
  }

  async searchNotes(user: User, req: ProcessedSearchRequest): Promise<SearchResult[]> {
    const tokens = req.tokens;

    if (tokens.length === 0) {
      return this.emptySearchNotes(user, req);
    }

    switch (req.mode) {
      case 'keyword':
        return this.searchNotesByKeywords(user, req);
      case 'vector':
        return this.searchNotesByVector(user, req);
      case 'hybrid':
        throw new BadRequestException('Not implemented');
      default:
        return this.searchNotesByKeywords(user, req);
    }
  }

  async emptySearchCollections(user: User, req: ProcessedSearchRequest): Promise<SearchResult[]> {
    const collections = await this.prisma.collection.findMany({
      select: {
        collectionId: true,
        title: true,
        description: true,
        createdAt: true,
        updatedAt: true,
      },
      where: { uid: user.uid, deletedAt: null },
      orderBy: { updatedAt: 'desc' },
      take: req.limit || 5,
    });
    return collections.map((collection) => ({
      id: collection.collectionId,
      domain: 'collection',
      title: collection.title,
      createdAt: collection.createdAt.toJSON(),
      updatedAt: collection.updatedAt.toJSON(),
    }));
  }

  async searchCollections(user: User, req: ProcessedSearchRequest): Promise<SearchResult[]> {
    const tokens = req.tokens;

    if (tokens.length === 0) {
      return this.emptySearchCollections(user, req);
    }

    interface CollectionResult {
      collection_id: string;
      created_at: string;
      updated_at: string;
      title: string;
      description: string;
    }
    const tokenList = tokens.join(' ');
    const tokenOrList = tokens.join(' OR ');
    const colls = await this.prisma.$queryRaw<CollectionResult[]>`
      SELECT   collection_id,
               created_at,
               updated_at,
               pgroonga_highlight_html(
                 title, pgroonga_query_extract_keywords(${tokenList}::TEXT)
               ) AS title,
               pgroonga_highlight_html(
                 description, pgroonga_query_extract_keywords(${tokenList}::TEXT)
               ) AS description
      FROM     collections
      WHERE    uid = ${user.uid}
      AND      (title &@~ ${tokenOrList}::TEXT OR description &@~ ${tokenOrList}::TEXT)
      ORDER BY pgroonga_score(tableoid, ctid) DESC,
               updated_at DESC
      LIMIT    ${req.limit || 5}
    `;

    return colls.map((coll) => ({
      id: coll.collection_id,
      domain: 'collection',
      title: coll.title,
      content: [coll.description],
      createdAt: coll.created_at,
      updatedAt: coll.updated_at,
    }));
  }

  async emptySearchConversations(user: User, req: ProcessedSearchRequest): Promise<SearchResult[]> {
    const conversations = await this.prisma.conversation.findMany({
      select: {
        convId: true,
        title: true,
        lastMessage: true,
        createdAt: true,
        updatedAt: true,
      },
      where: { uid: user.uid },
      orderBy: { updatedAt: 'desc' },
      take: req.limit || 5,
    });
    return conversations.map((conversation) => ({
      id: conversation.convId,
      domain: 'conversation',
      title: conversation.title,
      content: [conversation.lastMessage],
      createdAt: conversation.createdAt.toJSON(),
      updatedAt: conversation.updatedAt.toJSON(),
    }));
  }

  async searchConversations(user: User, req: ProcessedSearchRequest): Promise<SearchResult[]> {
    const tokens = req.tokens;

    if (tokens.length === 0) {
      return this.emptySearchConversations(user, req);
    }

    interface MessageResult {
      conv_id: string;
      content: string;
    }
    const tokenList = tokens.join(' ');
    const tokenOrList = tokens.join(' OR ');
    const messages = await this.prisma.$queryRaw<MessageResult[]>`
      SELECT   conv_id,
               pgroonga_highlight_html(
                 content, pgroonga_query_extract_keywords(${tokenList}::TEXT)
               ) AS content
      FROM     chat_messages
      WHERE    uid = ${user.uid}
      AND      content &@~ ${tokenOrList}::TEXT
      ORDER BY pgroonga_score(tableoid, ctid) DESC
    `;

    if (messages.length === 0) {
      return [];
    }

    interface ConversationResult {
      id: number;
      conv_id: string;
      title: string;
      created_at: string;
      updated_at: string;
    }
    const convIds = [...new Set(messages.map((message) => message.conv_id))];
    const conversations = await this.prisma.$queryRaw<ConversationResult[]>`
      SELECT   id,
               conv_id,
               created_at,
               updated_at,
               pgroonga_highlight_html(
                 title, pgroonga_query_extract_keywords(${tokenList}::TEXT)
               ) AS title
      FROM     conversations
      WHERE    uid = ${user.uid}
      AND      conv_id IN (${Prisma.join(convIds)})
      ORDER BY updated_at DESC
      LIMIT    ${req.limit || 5}
    `;

    return conversations.map((conversation) => ({
      id: conversation.conv_id,
      domain: 'conversation',
      title: conversation.title,
      content: messages
        .filter((message) => message.conv_id === conversation.conv_id)
        .map((message) => message.content),
      createdAt: conversation.created_at,
      updatedAt: conversation.updated_at,
    }));
  }

  async emptySearchSkills(user: User, req: ProcessedSearchRequest): Promise<SearchResult[]> {
    const skills = await this.prisma.skillInstance.findMany({
      where: { uid: user.uid, deletedAt: null },
      orderBy: { updatedAt: 'desc' },
      take: req.limit || 5,
    });
    return skills.map((skill) => ({
      id: skill.skillId,
      domain: 'skill',
      title: skill.displayName,
      createdAt: skill.createdAt.toJSON(),
      updatedAt: skill.updatedAt.toJSON(),
    }));
  }

  async searchSkills(user: User, req: ProcessedSearchRequest): Promise<SearchResult[]> {
    const tokens = req.tokens;

    if (tokens.length === 0) {
      return this.emptySearchSkills(user, req);
    }

    interface SkillResult {
      skill_id: string;
      created_at: string;
      updated_at: string;
      content: string;
    }
    const tokenList = tokens.join(' ');
    const tokenOrList = tokens.join(' OR ');
    const skills = await this.prisma.$queryRaw<SkillResult[]>`
      SELECT   skill_id,
               created_at,
               updated_at,
               pgroonga_highlight_html(
                 display_name, pgroonga_query_extract_keywords(${tokenList}::TEXT)
               ) AS content
      FROM     skill_instances
      WHERE    uid = ${user.uid}
      AND      deleted_at IS NULL
      AND      display_name &@~ ${tokenOrList}::TEXT
      ORDER BY pgroonga_score(tableoid, ctid) DESC,
               updated_at DESC
      LIMIT    ${req.limit || 5}
    `;

    return skills.map((skill) => ({
      id: skill.skill_id,
      domain: 'skill',
      title: skill.content,
      createdAt: skill.created_at,
      updatedAt: skill.updated_at,
    }));
  }

  async search(user: User, req: SearchRequest): Promise<SearchResult[]> {
    const processedReq = this.preprocessSearchRequest(req);

    const results = await Promise.all(
      processedReq.domains.map((domain) => {
        switch (domain) {
          case 'resource':
            return this.searchResources(user, processedReq);
          case 'note':
            return this.searchNotes(user, processedReq);
          case 'collection':
            return this.searchCollections(user, processedReq);
          case 'conversation':
            return this.searchConversations(user, processedReq);
          case 'skill':
            return this.searchSkills(user, processedReq);
          default:
            return [] as SearchResult[];
        }
      }),
    );

    return results.flat();
  }
}
