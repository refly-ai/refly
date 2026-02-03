/**
 * DTO for updating OpenAPI configuration
 */
export interface UpdateOpenapiConfigDto {
  canvasId: string;
  resultNodeIds?: string[] | null;
}
