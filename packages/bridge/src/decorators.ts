import 'reflect-metadata';
import { kubectlProxySingleton } from './kubectl';
import { ensure } from './lib/ensure';
import { RemoteMethodError } from './lib/exceptions';
import { instance } from './lib/axios';

export const REMOTE_SERVICE_CONFIG = Symbol('RemoteServiceConfig');
export const REMOTE_METHOD_META = Symbol('RemoteMethodMeta');

export interface RemoteServiceConfig {
  host?: string;
  serviceName?: string;
  port: number;
  proxy?: boolean;
}

export interface RemoteMethodMeta {
  path: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  host?: string;
  proxy?: boolean;
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

      let host: string;
      if (meta.host) {
        host = meta.host;
      } else if (serviceConfig.host) {
        host = serviceConfig.host;
      } else if (serviceConfig.serviceName) {
        const svcSuffix = process.env.BRIDGE_SVC_SUFFIX || '';
        host = `${serviceConfig.serviceName}${svcSuffix}`;
      } else {
        throw new RemoteMethodError(
          'No host configuration found. Provide either host, serviceName in @RemoteService, or host in @RemoteMethod',
          {
            className: target.constructor.name,
            methodName: String(propertyKey),
          },
        );
      }

      const proxyEnabled =
        meta.proxy !== undefined
          ? meta.proxy
          : serviceConfig.proxy !== undefined
            ? serviceConfig.proxy
            : process.env.BRIDGE_KUBECTL_PROXY_ENABLED === 'true';

      if (proxyEnabled) {
        await kubectlProxySingleton.ensureRunning();
      }

      const url = kubectlProxySingleton.getProxyUrl(
        host,
        serviceConfig.port,
        meta.path,
        proxyEnabled,
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
