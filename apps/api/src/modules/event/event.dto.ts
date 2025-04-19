import { EntityType, SimpleEventName } from '@refly/openapi-schema';

export interface SimpleEventData {
  uid: string;
  name: SimpleEventName;
  entityType: EntityType;
  entityId: string;
}
