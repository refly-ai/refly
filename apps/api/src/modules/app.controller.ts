import { Controller, Get } from '@nestjs/common';
import { BRANDING_NAME } from '@refly/utils';
@Controller()
export class AppController {
  @Get()
  ping() {
    return { message: 'Refly API Endpoint', version: 'v1', brand: BRANDING_NAME };
  }
}
