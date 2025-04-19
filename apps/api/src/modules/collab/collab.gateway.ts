import { Request } from 'express';
import { WebSocket } from 'ws';
import { OnGatewayConnection, WebSocketGateway } from '@nestjs/websockets';
import { CollabService } from '../collab/collab.service';

@WebSocketGateway()
export class CollabGateway implements OnGatewayConnection {
  constructor(private collabService: CollabService) {}

  handleConnection(connection: WebSocket, request: Request): void {
    this.collabService.handleConnection(connection, request);
  }
}
