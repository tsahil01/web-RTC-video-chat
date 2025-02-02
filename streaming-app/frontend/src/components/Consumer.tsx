import { Device } from "mediasoup-client";
import { RtpCapabilities } from "mediasoup-client/lib/RtpParameters";
import { Transport } from "mediasoup-client/lib/types";
import { useEffect, useRef, useState } from "react";

export default function Consumer() {
    const remoteVideoRef = useRef<HTMLVideoElement | null>(null);

    const deviceRef = useRef<Device | null>(null);
    const [socket, setSocket] = useState<WebSocket | null>(null);
    const [rtpCapabilities, setRtpCapabilities] = useState<RtpCapabilities | null>(null);
    const [consumerTransport, setConsumerTransport] = useState<Transport | null>(null);

    const createDevice = async () => {
        try {
            console.log("Creating device");
            if (!rtpCapabilities) return;
            const device = new Device();
            console.log("Device created", device);
            deviceRef.current = device;
            console.log("Loading device");
            await device.load({ routerRtpCapabilities: rtpCapabilities });
            console.log("Device loaded", device);
        } catch (error: unknown) {
            console.log(error);
            if (error instanceof Error && error.name === "UnsupportedError") {
                console.error("Browser not supported");
            }
        }
    };

    useEffect(() => {
        const ws = new WebSocket("ws://localhost:8080");
        setSocket(ws);

        ws.onopen = async () => {
            console.log("Connected to the server");
            ws.onmessage = async (event) => {
                const message = JSON.parse(event.data);
                console.log("Message received: ", message);
                switch (message.type) {

                    case 'error': {
                        console.error("Error: ", message.message);
                        break;
                    }

                    case "routerRtpCapabilities": {
                        setRtpCapabilities(message.routerRtpCapabilities);
                        createTransport();
                        break;
                    }

                    case "createTransportdone": {
                        console.log("Creating transport");
                        console.log("Device", deviceRef.current);
                        const transport = deviceRef.current?.createSendTransport({
                            id: message.data.id,
                            iceParameters: message.data.iceParameters,
                            iceCandidates: message.data.iceCandidates,
                            dtlsParameters: message.data.dtlsParameters
                        });
                        console.log("Transport created");
                        if (transport) {
                            setConsumerTransport(transport);
                        }

                        transport?.on('connect', async (dtlsParameters) => {
                            console.log("Transport connected");
                            socket?.send(JSON.stringify({
                                type: "connectConsumerTransport",
                                dtlsParameters: dtlsParameters
                            }));
                        });

                        break;
                    }

                    case "consumerTransportConnected": {
                        console.log("Consumer transport connected");
                        break;
                    }

                    case "consumed": {
                        if (!consumerTransport) {
                            console.log("Consumer transport not found");
                            break;
                        }
                        console.log("Consumed");
                        const consumer = await consumerTransport.consume({
                            id: message.data.id,
                            kind: message.data.kind,
                            rtpParameters: message.data.rtpParameters
                        });
                        const { track } = consumer
                        if (remoteVideoRef.current) {
                            remoteVideoRef.current.srcObject = new MediaStream([track]);
                        }

                        ws.send(JSON.stringify({
                            type: "resumeConsumer",
                            id: message.data.id
                        }));

                        break;
                    }

                    case "consumerResumed": {
                        console.log("Consumer resumed");
                        break;
                    }

                    default: {
                        console.log("Unknown message type: ", message.type);
                        break;
                    }
                }
            };
        };

        return () => {
            ws.close();
        };
    }, []);


    function createTransport() {
        console.log("Creating transport");
        socket?.send(JSON.stringify({
            type: "createTransport",
            producer: false
        }));
    }

    const connectRecvTransport = async () => {
        socket?.send(JSON.stringify({
            type: "consume",
            rtpCapabilities: rtpCapabilities
        }));
    };

    async function getRouterRtpCapabilities() {
        socket?.send(JSON.stringify({ type: "getRouterRtpCapabilities" }));
    }

    return <>
        <h1>Consumer</h1>
        <video ref={remoteVideoRef} autoPlay playsInline muted />
        <button onClick={getRouterRtpCapabilities}>Get router rtp capabilities</button>
        <button onClick={createDevice}>Create device</button>
        <button onClick={createTransport}>Create recv transport</button>
        <button onClick={connectRecvTransport}>
            Connect recv transport and consume
        </button>

    </>
}