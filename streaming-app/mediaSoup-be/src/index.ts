import http from 'http'
import express from 'express'
import cors from 'cors'
import { WebSocketServer } from 'ws';
import { Consumer, Producer, Transport, Worker, Router, DtlsState } from 'mediasoup/node/lib/types';
import { createWorker } from 'mediasoup';
import { mediaCodecs } from './config';
const PORT = 3000;

const app = express();
app.use(express.json());
app.use(cors())
const server = http.createServer(app);

const wss = new WebSocketServer({ port: 8080 });

let worker: Worker;
let router: Router | null;
let producerTransport: Transport | null;
let consumerTransport: Transport | null;
let producer: Producer
let consumer: Consumer

async function workerInit() {
    const newWorker = await createWorker({
        rtcMinPort: 2000,
        rtcMaxPort: 2020,
    })
    console.log("Worker created: ", newWorker.pid);

    newWorker.on('died', () => {
        console.log("Worker has died");
        setTimeout(() => {
            process.exit();
        }, 2000);
    })

    return newWorker;
}

async function routerInit() {
    try {
        if (!worker) {
            console.log("No worker found");
            return null;
        }
        const newRouter = await worker.createRouter({ mediaCodecs })
        return newRouter

    } catch (error) {
        console.error(`Error creating router: `, error);
        return null;
    }
}

async function transportInit() {
    try {
        if (!router) {
            console.log("No router found");
            return null;
        }

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
        })

        transport.on('dtlsstatechange', (dlsState: DtlsState) => {
            if (dlsState === 'closed') {
                transport.close()
            }
        })

        transport.on('@close', () => {
            console.log("transport closed");
        });

        return transport

    } catch (error) {
        console.log("Unable to create transport :", error);
        return null;
    }
}

(async () => {
    worker = await workerInit();
    router = await routerInit();
})()

wss.on('connection', async (ws) => {
    console.log("WS Connected");
    ws.on('message', async (data: string) => {
        const message = JSON.parse(data);
        console.log("Message received: ", message);
        switch (message.type) {

            case "getRouterRtpCapabilities": {
                ws.send(JSON.stringify({
                    type: "routerRtpCapabilities",
                    routerRtpCapabilities: router?.rtpCapabilities
                }));
                break;
            }

            case "createTransport": {
                const newTransport = await transportInit();
                if (newTransport === null) {
                    ws.send(JSON.stringify({
                        type: "error",
                        message: "Error creating Transport"
                    }));
                    break;
                }
                if (message.producer) {
                    producerTransport = newTransport;
                } else {
                    consumerTransport = newTransport;
                }

                const { id, iceParameters, iceCandidates, dtlsParameters } = newTransport

                ws.send(JSON.stringify({
                    type: "createTransportdone",
                    data: {
                        id,
                        iceParameters,
                        iceCandidates,
                        dtlsParameters
                    }
                }))
                break;
            }

            case "connectProducerTransport": {
                if (producerTransport == null) {
                    ws.send(JSON.stringify({
                        type: "error",
                        message: "Producer Transport is null"
                    }));
                    break
                }
                try {
                    const { dtlsParameters } = message;
                    await producerTransport.connect({ dtlsParameters });
                    ws.send(JSON.stringify({
                        type: "producerTransportConnected"
                    }))
                } catch (error) {
                    console.log("Error connecting: ", error)
                    ws.send(JSON.stringify({
                        type: "error",
                        message: `Error: ${error}`
                    }));
                }
                break;
            }

            case "connectConsumerTransport": {
                if (consumerTransport == null) {
                    ws.send(JSON.stringify({
                        type: "error",
                        message: "consumer Transport is nul"
                    }));
                    break
                }
                try {
                    const { dtlsParameters } = message;
                    await consumerTransport.connect({ dtlsParameters });
                    ws.send(JSON.stringify({
                        type: "consumerTransportConnected"
                    }))
                } catch (error) {
                    console.log("Error connecting: ", error)
                    ws.send(JSON.stringify({
                        type: "error",
                        message: `Error: ${error}`
                    }));
                }
                break;
            }

            case "produce": {
                if (producerTransport == null) {
                    ws.send(JSON.stringify({
                        type: "error",
                        message: "producer Transport is null"
                    }));
                    break
                }

                try {
                    const { kind, rtpParameters } = message;
                    producer = await producerTransport.produce({ kind, rtpParameters })
                    producer.on("transportclose", () => {
                        producer.close();
                    });
                    ws.send(JSON.stringify({
                        type: "produce",
                        data: { id: producer.id }
                    }))
                } catch (error) {
                    console.log("Error producing: ", error);
                    ws.send(JSON.stringify({
                        type: "error",
                        message: "Error producing"
                    }))
                }

                break;
            }

            case "consume": {
                if (consumerTransport == null) {
                    ws.send(JSON.stringify({
                        type: 'error',
                        message: "consumer Transport is null"
                    }));
                    break
                }

                try {
                    const { rtpCapabilities } = message;
                    if (!producer) {
                        throw new Error("No producer exists");
                    }

                    consumer = await consumerTransport.consume({
                        producerId: producer.id,
                        rtpCapabilities,
                        paused: true
                    })
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
                    console.log("Error consuming: ", error);
                    ws.send(
                        JSON.stringify({
                            type: "error",
                            message: `Error consuming: ${error}`,
                        })
                    );
                }

                break;
            }

            case "resumeConsumer": {
                try {

                    await consumer.resume();
                    ws.send(JSON.stringify({ type: "consumerResumed" }));
                    break;
                } catch (error) {
                    console.log(`cannot resumeConsumer: ${error}`);
                    ws.send(JSON.stringify({
                        type: "error",
                        message: `cannot resumeConsumer: ${error}`
                    }))
                }
            }

            default:
                console.log("Invalid msg type", message.type);
                ws.send(JSON.stringify({
                    type: 'invalid',
                    message: 'invalid message send'
                }))

        }
    });


    ws.on('close', () => {
        if (producerTransport) producerTransport.close()
        if (consumerTransport) consumerTransport.close()
        if (producer) producer.close()
        if (consumer) consumer.close()
        console.log("Connection Closed")
    })

    ws.on("error", console.error);
})

server.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`)
});
