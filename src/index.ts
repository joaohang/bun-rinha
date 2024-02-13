import { Elysia } from "elysia";
import { clientsController } from "./controllers/clients.controller";


const PORT = process.env.PORT || 3000;
export const app = new Elysia();

app
  .use(clientsController)
  .listen(PORT, () => {
    console.log(`🦊 Elysia is running at ${app.server?.hostname}:${PORT}`);
  });