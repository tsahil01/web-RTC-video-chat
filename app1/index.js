import http from "http";
import express from "express";
import { createWorker } from "mediasoup";
import { WebSocketServer } from "ws";

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ port: 8080 });

const mediaCodecs = [
  {
    kind: "audio",
    mimeType: "audio/opus",
    clockRate: 48000,
    channels: 2,
    preferredPayloadType: 96,
    rtcpFeedback: [{ type: "nack" }, { type: "nack", parameter: "pli" }],
  },
  {
    kind: "video",
    mimeType: "video/VP8",
    clockRate: 90000,
    parameters: {
      "x-google-start-bitrate": 1000,
    },
    preferredPayloadType: 97,
    rtcpFeedback: [
      { type: "nack" },
      { type: "ccm", parameter: "fir" },
      { type: "goog-remb" },
    ],
  },
];

let worker;
let router;
let producerTransport;
let producer;
let consumerTransport;
let consumer;

async function workerInit() {
  const newWorker = await createWorker({
    rtcMinPort: 2000,
    rtcMaxPort: 2020,
  });

  console.log(`Worker process ID ${newWorker.pid}`);

  newWorker.on("died", () => console.error("Worker has died"));

  return newWorker;
}

async function createWebRtcTransport() {
    
}

worker = workerInit();

wss.on("connection", async (ws) => {
  console.log("connected");

  router = await worker.createRouter({
    mediaCodecs: mediaCodecs,
  });

  ws.on("message", function message(data) {
    console.log("received: %s", data);
    switch(data.type) {
        case "getRouterRtpCapabilities": {
            break;
        }
        case "createTransport": {
            if(data.sender) {

            } else {

            }
            break;
        }
        case "connectProducerTransport": {
            // dtlsParameters
            break;
        }
        case "connectConsumerTransport": {
            // dtlsParameters
            break;
        }
        case "transport-produce": {
            // kind, rtpParameters
            break;
        }
        case "consumeMedia": {
            // rtpCapabilities
            break;
        }
        case "resumePausedConsumer": {
            break;
        }
        default: 
            console.log('Invalid msg type: ', message.type)
    }
  });

  ws.on("close", function close() {
    console.log("disconnected");
  });

  ws.on("error", console.error);
});

server.listen(3000, () => {
  console.log("BE running on port 3000");
});
