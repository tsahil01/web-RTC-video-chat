import { Device } from "mediasoup-client";
import { RtpCapabilities } from "mediasoup-client/lib/RtpParameters";
import { Transport } from "mediasoup-client/lib/types";
import { useEffect, useRef, useState } from "react";

export default function Producer() {
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const [params, setParams] = useState({
        encoding: [
          { rid: "r0", maxBitrate: 100000, scalabilityMode: "S1T3" }, // Lowest quality layer
          { rid: "r1", maxBitrate: 300000, scalabilityMode: "S1T3" }, // Middle quality layer
          { rid: "r2", maxBitrate: 900000, scalabilityMode: "S1T3" }, // Highest quality layer
        ],
        codecOptions: { videoGoogleStartBitrate: 1000 }, // Initial bitrate
        track: null as MediaStreamTrack | null, // Add track property
      });
    const deviceRef = useRef<Device | null>(null);
    const socketRef = useRef<WebSocket | null>(null);
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
        socketRef.current = ws;

        ws.onopen = async () => {
            console.log("Connected to the server");
            startCamera();
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

                        transport?.on('connect', ({ dtlsParameters }, callback, errback) => {
                            try {

                                console.log("Transport connected");
                                socketRef.current?.send(JSON.stringify({
                                    type: "connectProducerTransport",
                                    dtlsParameters: dtlsParameters
                                }));
                                callback();
                            } catch (error) {
                                console.error("Error connecting transport: ", error);
                                errback(error as Error);
                            }
                        });
                        

                        transport?.on("produce", async (parameters, callback, errback) => {
                            try {
                                console.log("Producing");
                                console.log("Parameters: ", parameters);
                                console.log("Socket: ", socketRef.current);
                                socketRef.current?.send(JSON.stringify({
                                    type: "produce",
                                    kind: parameters.kind,
                                    rtpParameters: parameters.rtpParameters
                                }));
                                callback({
                                    id: "1234"
                                })
                            } catch (error) {
                                console.error("Error producing: ", error);
                                errback(error as Error);
                            }
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
        socketRef.current?.send(JSON.stringify({ type: "getRouterRtpCapabilities" }));
    }

    function createTransport() {
        console.log("Creating transport");
        socketRef.current?.send(JSON.stringify({
            type: "createTransport",
            producer: true
        }));
    }

    const connectSendTransport = async () => {
        if (!producerTransport || !params?.track) return;
    
        try {
            const producer = await producerTransport.produce({
                track: params.track,
            });
    
            producer.on("trackended", () => {
                console.log("Track ended");
            });
    
            producer.on("transportclose", () => {
                console.log("Transport closed");
            });
    
        } catch (error) {
            console.error("Error producing:", error);
        }
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