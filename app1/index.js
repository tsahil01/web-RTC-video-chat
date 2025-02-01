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
  const transport = await router.createWebRtcTransport({
    listenIps: [
      {
        ip: "0.0.0.0",
        announcedIp: "127.0.0.1",
      },
    ],
    enableUdp: true,
    enableTcp: true,
    preferUdp: true,
    initialAvailableOutgoingBitrate: 1000000,
  });

  transport.on("dtlsstatechange", (dtlsState) => {
    if (dtlsState === "closed") {
      transport.close();
    }
  });

  transport.on("close", () => {
    console.log("transport closed");
  });

  return transport;
}

(async () => {
  worker = await workerInit();
})();

wss.on("connection", async (ws) => {
  console.log("connected");

  router = await worker.createRouter({
    mediaCodecs: mediaCodecs,
  });

  ws.on("message", async function message(data) {
    const message = JSON.parse(data);
    console.log("received: %s", message);
    switch (message.type) {
      case "getRouterRtpCapabilities": {
        ws.send(
          JSON.stringify({
            type: "routerRtpCapabilities",
            data: router.rtpCapabilities,
          })
        );
        break;
      }
      
      case "createTransport": {
        try {
          const transport = await createWebRtcTransport();
          if (message.producer) {
            producerTransport = transport;
          } else {
            consumerTransport = transport;
          }

          const { id, iceParameters, iceCandidates, dtlsParameters } =
            transport;
          ws.send(
            JSON.stringify({
              type: "createTransport",
              data: {
                id,
                iceParameters,
                iceCandidates,
                dtlsParameters,
              },
            })
          );
        } catch (e) {
          console.error(e);
          ws.send(
            JSON.stringify({
              type: "error",
              message: e.message,
            })
          );
        }
        break;
      }

      case "connectProducerTransport": {
        await producerTransport.connect({
          dtlsParameters: message.dtlsParameters,
        });
        ws.send(JSON.stringify({ type: "producerTransportConnected" }));
        break;
      }

      case "connectConsumerTransport": {
        await consumerTransport.connect({
          dtlsParameters: message.dtlsParameters,
        });
        ws.send(JSON.stringify({ type: "consumerTransportConnected" }));
        break;
      }

      case "produce": {
        // kind, rtpParameters
        const { kind, rtpParameters } = message;
        producer = await producerTransport.produce({ kind, rtpParameters });

        producer.on("transportclose", () => {
          producer.close();
        });

        ws.send(
          JSON.stringify({
            type: "produced",
            data: { id: producer.id },
          })
        );
        break;
      }

      case "consume": {
        try {
          if (!producer) {
            throw new Error("No producer exists");
          }

          consumer = await consumerTransport.consume({
            producerId: producer.id,
            rtpCapabilities: message.rtpCapabilities,
            paused: true,
          });

          consumer.on("transportclose", () => {
            consumer.close();
          });

          ws.send(
            JSON.stringify({
              type: "consumed",
              data: {
                id: consumer.id,
                producerId: producer.id,
                kind: consumer.kind,
                rtpParameters: consumer.rtpParameters,
              },
            })
          );
        } catch (error) {
          console.error(error);
          ws.send(
            JSON.stringify({
              type: "error",
              message: error.message,
            })
          );
        }
        break;
      }

      case "resumeConsumer": {
        await consumer.resume();
        ws.send(JSON.stringify({ type: "consumerResumed" }));
        break;
      }

      default:
        console.log("Invalid msg type: ", message.type);
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
