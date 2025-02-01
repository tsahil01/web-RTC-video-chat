# web-RTC-video-chat
Will be using mediasoup (maybe)
- Web Socket working: https://medium.com/agora-io/how-does-webrtc-work-996748603141

## [Mediasoup](https://mediasoup.org/)
- https://www.youtube.com/watch?v=DOe7GkQgwPo
- MS is based on consumers and producers
- Produces sends media via MS router.
- Receiver receives media via MS router also.
- To create producers and consumers we need to create Transports.
- Transports are created from routers.
- Router can represent a room.
- One Router can have multiple Transports (sender or reveicer)
- Transport can have video/ audio producer or video/ auto consumer.


- Router is created from Worker.

```
Client A (Producer)           mediasoup Server (SFU)           Client B (Consumer)
    |                                 |                                 |
    |--- Signaling: Join Room ------> |                                 |
    |                                 |                                 |
    |<---- ICE/DTLS Params ---------- |                                 |
    |--- ICE Candidates ------------> |                                 |
    |                                 |                                 |
    |--- DTLS Handshake ------------- |                                 |
    |                                 |                                 |
    |--- produce() (Video Track) ---> |                                 |
    |                                 |--- Notify New Producer -------> |
    |                                 |                                 |
    |                                 |<--- Request Consumer -----------|
    |                                 |--- createConsumer() ----------->|
    |                                 |                                 |
    |--- RTP Packets (VP8) ---------> |                                 |
    |                                 |--- Forward RTP ---------------->|
    |                                 |                                 |
```

```
Worker (CPU process)
  └─ Router (Room/Session)
      └─ Multiple Transports (One per participant)
          └─ Producers/Consumers (Media streams)
```


1. **Worker Creation**
   - We create ONE worker that can handle multiple rooms
   - Think of this as starting up a powerful engine that will process all media

2. **Router Creation (The Room)**
   - We create a router which is like creating a virtual "room"
   - We tell it what types of media it should support (VP8 video and Opus audio)
   - One router = one video chat room

3. **When Alice Joins**
   - We create a transport for Alice (like her personal door into the room)
   - When she starts her video, we create a "producer" (her video stream)
   - The producer is like Alice raising her hand to speak in the room

4. **When Bob Joins**
   - Bob gets his own transport (his door to the room)
   - To see Alice's video, we create a "consumer" for Bob
   - The consumer is like Bob turning to look at Alice when she's speaking

So in real terms:
```
Worker (The building)
  └─ Router (Room #1)
      ├─ Alice's Transport (Alice's door to Room #1)
      │   └─ Producer (Alice's video camera)
      └─ Bob's Transport (Bob's door to Room #1)
          └─ Consumer (Bob's screen showing Alice)
```