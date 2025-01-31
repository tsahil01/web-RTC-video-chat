# web-RTC-video-chat
Will be using mediasoup (maybe)
- https://medium.com/agora-io/how-does-webrtc-work-996748603141

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