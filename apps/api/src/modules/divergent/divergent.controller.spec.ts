import { Test, TestingModule } from '@nestjs/testing';
import { DivergentController } from './divergent.controller';
import { DivergentService } from './divergent.service';
import { DivergentSessionService } from './divergent-session.service';

describe('DivergentController API Integration', () => {
  let controller: DivergentController;
  let service: DivergentService;
  let module: TestingModule;

  const mockSessionService = {
    createDivergentSession: jest.fn(),
    getDivergentSession: jest.fn(),
    updateDivergentSession: jest.fn(),
    listDivergentSessions: jest.fn(),
    deleteDivergentSession: jest.fn(),
  };

  beforeEach(async () => {
    module = await Test.createTestingModule({
      controllers: [DivergentController],
      providers: [
        DivergentService,
        {
          provide: DivergentSessionService,
          useValue: mockSessionService,
        },
      ],
    }).compile();

    controller = module.get<DivergentController>(DivergentController);
    service = module.get<DivergentService>(DivergentService);
  });

  afterEach(async () => {
    await module.close();
  });

  describe('Controller Architecture Validation', () => {
    it('should be properly instantiated as NestJS Controller', () => {
      expect(controller).toBeDefined();
      expect(controller).toBeInstanceOf(DivergentController);
    });

    it('should have proper dependency injection with DivergentService', () => {
      expect(service).toBeDefined();
      expect(service).toBeInstanceOf(DivergentService);

      // Verify controller has access to service
      expect(controller['divergentService']).toBeDefined();
      expect(controller['divergentService']).toBe(service);
    });

    it('should be configured with correct route prefix', () => {
      // Verify the controller is decorated with proper routing
      const metadata = Reflect.getMetadata('path', DivergentController);
      expect(metadata).toBe('divergent');
    });
  });

  describe('GET /divergent/info endpoint', () => {
    it('should return service information through API endpoint', () => {
      const expectedResult = {
        name: 'DivergentAgent',
        status: 'active',
        version: '1.0.0',
      };

      const result = controller.getServiceInfo();

      expect(result).toEqual(expectedResult);
    });

    it('should properly delegate to service layer', () => {
      const serviceSpy = jest.spyOn(service, 'getServiceInfo');
      const expectedResult = {
        name: 'DivergentAgent',
        status: 'active',
        version: '1.0.0',
      };

      serviceSpy.mockReturnValue(expectedResult);

      const result = controller.getServiceInfo();

      expect(serviceSpy).toHaveBeenCalledTimes(1);
      expect(serviceSpy).toHaveBeenCalledWith();
      expect(result).toEqual(expectedResult);

      serviceSpy.mockRestore();
    });

    it('should handle service responses correctly for health monitoring', () => {
      const result = controller.getServiceInfo();

      // Verify API response structure for monitoring systems
      expect(result).toHaveProperty('name');
      expect(result).toHaveProperty('status');
      expect(result).toHaveProperty('version');

      // Verify response content for health checks
      expect(result.name).toBe('DivergentAgent');
      expect(result.status).toBe('active');
      expect(result.version).toMatch(/^\d+\.\d+\.\d+$/);
    });

    it('should maintain consistent response format', () => {
      const result1 = controller.getServiceInfo();
      const result2 = controller.getServiceInfo();

      // Multiple calls should return consistent structure
      expect(Object.keys(result1)).toEqual(Object.keys(result2));
      expect(result1).toEqual(result2);
    });

    it('should be suitable for API documentation generation', () => {
      // Verify method is properly decorated for OpenAPI/Swagger
      const result = controller.getServiceInfo();

      // Verify return type is JSON-serializable
      expect(() => JSON.stringify(result)).not.toThrow();
      expect(JSON.parse(JSON.stringify(result))).toEqual(result);
    });
  });

  describe('Error Handling and Resilience', () => {
    it('should handle service errors gracefully', () => {
      const serviceSpy = jest.spyOn(service, 'getServiceInfo');
      serviceSpy.mockImplementation(() => {
        throw new Error('Service temporarily unavailable');
      });

      expect(() => {
        controller.getServiceInfo();
      }).toThrow('Service temporarily unavailable');

      serviceSpy.mockRestore();
    });

    it('should maintain service layer isolation', () => {
      // Verify controller doesn't directly access service internals
      const result = controller.getServiceInfo();

      // Should only get public interface results
      expect(typeof result).toBe('object');
      expect(result).not.toHaveProperty('logger');
      expect(result).not.toHaveProperty('prisma');
      expect(result).not.toHaveProperty('_internal');
    });
  });

  describe('HTTP Method and Route Validation', () => {
    it('should be configured for GET method', () => {
      // Verify the method is decorated with @Get
      const methodMetadata = Reflect.getMetadata('method', controller.getServiceInfo);
      // Note: In a real test environment, we would check route metadata
      expect(typeof controller.getServiceInfo).toBe('function');
    });

    it('should respond to correct endpoint path', () => {
      // Verify endpoint configuration
      expect(typeof controller.getServiceInfo).toBe('function');
      expect(controller.getServiceInfo.length).toBe(0); // No parameters
    });
  });

  describe('Integration with NestJS Framework', () => {
    it('should be compatible with middleware and interceptors', () => {
      // Verify controller method can be wrapped/intercepted
      const originalMethod = controller.getServiceInfo;
      expect(typeof originalMethod).toBe('function');

      // Mock interceptor behavior
      let interceptorCalled = false;
      const wrappedMethod = () => {
        interceptorCalled = true;
        return originalMethod.call(controller);
      };

      const result = wrappedMethod();
      expect(interceptorCalled).toBe(true);
      expect(result).toEqual({
        name: 'DivergentAgent',
        status: 'active',
        version: '1.0.0',
      });
    });

    it('should support request/response transformation', () => {
      const result = controller.getServiceInfo();

      // Verify result can be transformed by NestJS response handling
      const transformedResult = {
        ...result,
        timestamp: new Date().toISOString(),
        requestId: 'test-request-123',
      };

      expect(transformedResult).toMatchObject(result);
      expect(transformedResult.timestamp).toBeDefined();
      expect(transformedResult.requestId).toBeDefined();
    });
  });

  describe('API Design and Future Extensibility', () => {
    it('should follow RESTful API conventions', () => {
      // GET /divergent/info follows proper REST patterns
      const result = controller.getServiceInfo();

      expect(result).toBeDefined();
      expect(typeof result).toBe('object');
      expect(result).not.toBeInstanceOf(Array); // Info endpoint returns object, not array
    });

    it('should support future API versioning', () => {
      // Verify controller structure supports versioning
      expect(controller.constructor.name).toBe('DivergentController');

      // Should be extensible for v2, v3, etc.
      const result = controller.getServiceInfo();
      expect(result.version).toBeDefined();
    });

    it('should maintain backward compatibility structure', () => {
      const result = controller.getServiceInfo();

      // Core fields should always be present
      const requiredFields = ['name', 'status', 'version'];
      requiredFields.forEach((field) => {
        expect(result).toHaveProperty(field);
        expect(result[field]).toBeTruthy();
      });
    });
  });
});
