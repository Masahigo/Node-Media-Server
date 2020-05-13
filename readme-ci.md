# Building and testing image

```bash
# npm i
docker build -t node-media-server .
docker run -e AUTH_SECRET="dummy" --name nms -d -p 1935:1935 -p 8000:8000 node-media-server
docker logs nms -f

# Generate hash
node genDummyAuth.js

# Test from OBS Studio 
# Server: rtmp://localhost/live
# Stream key: stream?sign=<copy paste hash here>
```

## Push to Docker Hub

docker login
docker tag <your image id> masahigo/node-media-server:latest
docker push masahigo/node-media-server
