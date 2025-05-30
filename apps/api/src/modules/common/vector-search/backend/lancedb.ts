import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as lancedb from '@lancedb/lancedb';
import {
  VectorSearchBackend,
  VectorPoint,
  VectorSearchRequest,
  VectorSearchResult,
  VectorFilter,
  VectorScrollRequest,
} from './interface';
import { toLanceDBFilter } from './filter-utils';

@Injectable()
export class LanceDBVectorSearchBackend implements VectorSearchBackend {
  private readonly logger = new Logger(LanceDBVectorSearchBackend.name);
  private readonly INIT_TIMEOUT = 10000; // 10 seconds timeout

  private db: lancedb.Connection;
  private tableName: string;
  private table: lancedb.Table;
  private isInitialized = false;

  constructor(private configService: ConfigService) {
    this.tableName = this.configService.get<string>('vectorStore.lancedb.tableName', 'vectors');
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      await Promise.race([
        this.initializeConnection(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('LanceDB initialization timeout')), this.INIT_TIMEOUT),
        ),
      ]);
      this.isInitialized = true;
      this.logger.log('LanceDB backend initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize LanceDB backend:', error);
      throw error;
    }
  }

  private async initializeConnection(): Promise<void> {
    const uri = this.configService.get<string>('vectorStore.lancedb.uri', './lancedb');
    this.logger.log(`Connecting to LanceDB at: ${uri}`);

    this.db = await lancedb.connect(uri);

    try {
      this.table = await this.db.openTable(this.tableName);
      this.logger.log(`Opened existing table: ${this.tableName}`);
    } catch {
      this.logger.log(
        `Table ${this.tableName} does not exist, will be created on first data insert`,
      );
    }
  }

  async isCollectionEmpty(): Promise<boolean> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      if (!this.table) {
        return true;
      }

      const count = await this.table.countRows();
      return count === 0;
    } catch (error) {
      this.logger.warn('Error checking if collection is empty:', error);
      return true;
    }
  }

  async batchSaveData(points: VectorPoint[]): Promise<any> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (points.length === 0) {
      return;
    }

    try {
      const data = points.map((point) => ({
        id: point.id,
        vector: point.vector,
        ...point.payload,
      }));

      if (!this.table) {
        this.table = await this.db.createTable(this.tableName, data);
        this.logger.log(`Created new table: ${this.tableName}`);
      } else {
        await this.table.add(data);
      }

      this.logger.log(`Successfully saved ${points.length} points to LanceDB`);
      return { success: true, count: points.length };
    } catch (error) {
      this.logger.error('Error saving data to LanceDB:', error);
      throw error;
    }
  }

  async batchDelete(filter: VectorFilter): Promise<any> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (!this.table) {
      return;
    }

    try {
      const whereClause = toLanceDBFilter(filter);
      if (!whereClause) {
        this.logger.warn('No valid filter provided for deletion');
        return;
      }

      await this.table.delete(whereClause);
      this.logger.log(`Successfully deleted points with filter: ${whereClause}`);
      return { success: true };
    } catch (error) {
      this.logger.error('Error deleting data from LanceDB:', error);
      throw error;
    }
  }

  async search(request: VectorSearchRequest, filter: VectorFilter): Promise<VectorSearchResult[]> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (!this.table) {
      return [];
    }

    try {
      if (!request.vector) {
        throw new Error('Vector is required for LanceDB search');
      }

      let query = this.table.search(request.vector);

      const whereClause = toLanceDBFilter(filter);
      if (whereClause) {
        query = query.where(whereClause);
      }

      if (request.limit) {
        query = query.limit(request.limit);
      }

      const results = await query.toArray();

      return results.map((result) => ({
        id: String(result.id),
        score: 1 - (result._distance || 0), // Convert distance to similarity score
        payload: this.extractPayload(result),
      }));
    } catch (error) {
      this.logger.error('Error searching in LanceDB:', error);
      throw error;
    }
  }

  async scroll(request: VectorScrollRequest): Promise<VectorPoint[]> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (!this.table) {
      return [];
    }

    try {
      let query = this.table.query();

      const whereClause = toLanceDBFilter(request.filter);
      if (whereClause) {
        query = query.where(whereClause);
      }

      if (request.limit) {
        query = query.limit(request.limit);
      }

      // Note: LanceDB doesn't have built-in offset support like Qdrant
      // For pagination, you might need to implement custom logic
      if (request.offset) {
        this.logger.warn('Offset-based pagination is not directly supported in LanceDB');
      }

      const results = await query.toArray();

      return results.map((result) => ({
        id: String(result.id),
        vector: result.vector || [],
        payload: this.extractPayload(result),
      }));
    } catch (error) {
      this.logger.error('Error scrolling in LanceDB:', error);
      throw error;
    }
  }

  async updatePayload(filter: VectorFilter, payload: Record<string, any>): Promise<any> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (!this.table) {
      return;
    }

    try {
      const whereClause = toLanceDBFilter(filter);
      if (!whereClause) {
        this.logger.warn('No valid filter provided for update');
        return;
      }

      // LanceDB doesn't have a direct update method like Qdrant
      // We need to implement update by reading, modifying, and replacing data
      const existingData = await this.table.query().where(whereClause).toArray();

      if (existingData.length === 0) {
        this.logger.log('No records found matching the filter for update');
        return;
      }

      // Update the payload for matching records
      const updatedData = existingData.map((record) => ({
        ...record,
        ...payload,
      }));

      // Delete old records and insert updated ones
      await this.table.delete(whereClause);
      await this.table.add(updatedData);

      this.logger.log(`Successfully updated ${updatedData.length} records`);
      return { success: true, count: updatedData.length };
    } catch (error) {
      this.logger.error('Error updating payload in LanceDB:', error);
      throw error;
    }
  }

  estimatePointsSize(points: VectorPoint[]): number {
    return points.reduce((acc, point) => {
      const vectorSize = point.vector.length * 4; // 4 bytes per float32
      const payloadSize = JSON.stringify(point.payload).length;
      const idSize = point.id.length;
      return acc + vectorSize + payloadSize + idSize;
    }, 0);
  }

  /**
   * Extract payload from result, excluding system fields
   */
  private extractPayload(result: any): Record<string, any> {
    const { id, vector, _distance, ...payload } = result;
    return payload;
  }
}
