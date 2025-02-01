import http from "http";
import { WebSocketServer } from "ws";

const app = http.createServer();
const wss = new WebSocketServer({ port: 8080 });

wss.on("connection", (ws) => {
  console.log("connected");

  ws.on("message", function message(data) {
    console.log("received: %s", data);
  });

  ws.on("close", function close() {
    console.log("disconnected");
  });
  
  ws.on("error", console.error);
});

app.listen(3000, () => {
  console.log("BE running on port 3000");
});
