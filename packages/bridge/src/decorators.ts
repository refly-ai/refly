import 'reflect-metadata';
import { kubectlProxySingleton } from './kubectl';
import { ensure } from './lib/ensure';
import { RemoteMethodError } from './lib/exceptions';
import { instance } from './lib/axios';

export const REMOTE_SERVICE_CONFIG = Symbol('RemoteServiceConfig');
export const REMOTE_METHOD_META = Symbol('RemoteMethodMeta');

export interface RemoteServiceConfig {
  host: string;
  port: number;
}

export interface RemoteMethodMeta {
  path: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
}

export function remote(): never {
  throw new Error('Remote method not initialized. Ensure @RemoteMethod decorator is applied.');
}

export function RemoteService(config: RemoteServiceConfig): ClassDecorator {
  return (target: any) => {
    Reflect.defineMetadata(REMOTE_SERVICE_CONFIG, config, target);
    return target;
  };
}

function extractServiceConfig(target: any, propertyKey: string | symbol) {
  return ensure
    .nonNull(
      Reflect.getMetadata(REMOTE_SERVICE_CONFIG, target.constructor) as RemoteServiceConfig | null,
    )
    .orThrow(
      () =>
        new RemoteMethodError(
          `@RemoteService decorator not found on class ${target.constructor.name}`,
          {
            className: target.constructor.name,
            methodName: String(propertyKey),
          },
        ),
    );
}

export function RemoteMethod(meta: RemoteMethodMeta) {
  return (target: any, propertyKey: string | symbol, descriptor: PropertyDescriptor) => {
    Reflect.defineMetadata(REMOTE_METHOD_META, meta, target, propertyKey);

    descriptor.value = async function (this: any, ...args: any[]) {
      const serviceConfig = extractServiceConfig(target, propertyKey);

      await kubectlProxySingleton.ensureRunning();

      const url = kubectlProxySingleton.getProxyUrl(
        serviceConfig.host,
        serviceConfig.port,
        meta.path,
      );

      const response = await instance.request({
        url,
        method: meta.method,
        data: args[0],
      });

      return response.data;
    };

    return descriptor;
  };
}
