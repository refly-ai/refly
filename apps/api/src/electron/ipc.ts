// import { AuthService } from '@refly/api/src/auth/auth.service';

// export async function registerIpc() {
//   const app = await NestFactory.createApplicationContext(AppModule);

//   const authService = app.get(AuthService);

//   ipcMain.handle('/auth/config', () => {
//     const config = authService.getAuthConfig();
//     return config;
//   });
// }
