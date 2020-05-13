# Building and testing image

```bash
# npm i
docker build -t node-media-server .
docker run --name nms -d -v `pwd`:`pwd` -w `pwd` -p 1935:1935 -p 8000:8000 node-media-server
docker logs nms -f
```

## Push to Docker Hub

docker login
docker tag <your image id> masahigo/node-media-server:latest
docker push masahigo/node-media-server
