import { v5 as uuidv5 } from 'uuid';

const RESOURCE_NAMESPACE = '45c341a9-8061-415e-ab09-a890f6934eda';

export function genResourceUuid(name: string): string {
  return uuidv5(name, RESOURCE_NAMESPACE);
}
