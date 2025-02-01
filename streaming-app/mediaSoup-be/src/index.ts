import http from 'http'
import express from 'express'
import cors from 'cors'
import { WebSocketServer } from 'ws';
import { Consumer, Producer, Transport, Worker, Router } from 'mediasoup/node/lib/types';
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
let producerTransport: Transport
let consumerTransport: Transport
let produer: Producer
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

(async () => {
    worker = await workerInit()
})()

wss.on('connection', async (ws) => {
    console.log("WS Connected");

    router = await routerInit();

    ws.on('close', () => {
        console.log("Connection Closed")
    })
})

server.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`)
});
