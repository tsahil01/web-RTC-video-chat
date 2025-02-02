import { Device } from "mediasoup-client";
import { RtpCapabilities } from "mediasoup-client/lib/RtpParameters";
import { Transport } from "mediasoup-client/lib/types";
import { useEffect, useRef, useState } from "react";

export default function Producer() {
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const [params, setParams] = useState<{ track: MediaStreamTrack } | null>(null);

    const deviceRef = useRef<Device | null>(null);
    const [socket, setSocket] = useState<WebSocket | null>(null);
    const [rtpCapabilities, setRtpCapabilities] = useState<RtpCapabilities | null>(null);
    const [producerTransport, setProducerTransport] = useState<Transport | null>(null);


    const startCamera = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            if (videoRef.current) {
                const track = stream.getVideoTracks()[0];
                videoRef.current.srcObject = stream;
                setParams((current) => ({ ...current, track }));
            }
        } catch (error) {
            console.error("Error accessing camera:", error);
        }
    };

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
            ws.onmessage = (event) => {
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
                            setProducerTransport(transport);
                        }

                        transport?.on('connect', async (dtlsParameters) => {
                            console.log("Transport connected");
                            socket?.send(JSON.stringify({
                                type: "connectProducerTransport",
                                dtlsParameters: dtlsParameters
                            }));
                        });

                        transport?.on('produce', async (params) => {
                            console.log("Producing");
                            socket?.send(JSON.stringify({
                                type: "produce",
                                kind: params.kind,
                                rtpParameters: params.rtpParameters
                            }));
                        });

                        break;
                    }

                    case "producerTransportConnected": {
                        console.log("Producer transport connected");
                        break;
                    }

                    case "produce": {
                        console.log("Produce from server: ", message.data.id);
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


    async function getRouterRtpCapabilities() {
        socket?.send(JSON.stringify({ type: "getRouterRtpCapabilities" }));
    }

    function createTransport() {
        console.log("Creating transport");
        socket?.send(JSON.stringify({
            type: "createTransport",
            producer: true
        }));
    }

    const connectSendTransport = async () => {
        if (!producerTransport || !params) return;
        const localProducer = await producerTransport.produce(params);
        localProducer.on("trackended", () => {
            console.log("trackended");
        });
        localProducer.on("transportclose", () => {
            console.log("transportclose");
        });
    };

    return <>
        <h1>Producer</h1>
        <video ref={videoRef} autoPlay playsInline muted />
        <button onClick={startCamera}>Start Camera</button>
        <button onClick={getRouterRtpCapabilities}>Get Router Rtp Capabilities</button>
        <button onClick={createDevice}>Create Device</button>
        <button onClick={createTransport}>Create Transport</button>
        <button onClick={connectSendTransport}>Connect Send Transport</button>

    </>
}