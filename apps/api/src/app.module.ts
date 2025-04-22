import { Module } from '@nestjs/common';
import { MCPModule } from './modules/mcp/mcp.module';

@Module({
  imports: [
    // ... existing imports ...
    MCPModule,
  ],
  // ... existing providers, controllers, etc. ...
})
export class AppModule {}
