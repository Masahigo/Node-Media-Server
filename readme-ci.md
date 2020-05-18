# Misc instructions

## Prerequisites

- Docker
- Create Azure AD app following the instructions from here: https://github.com/Azure/azure-sdk-for-js/blob/master/sdk/storage/storage-blob/samples/javascript/azureAdAuth.js
- Configure `.env` file with following values

```text
AUTH_SECRET=dummy
AZURE_STORAGE_ACCOUNT_NAME=<name of your storage account>
AZURE_TENANT_ID=<your Azure tenant id>
AZURE_CLIENT_ID=<your Azure AD app's client/app ID>
AZURE_CLIENT_SECRET=<your Azure AD app's client secret>
```

## Building and testing image

```bash
# npm i
docker build -t node-media-server .
docker run -e --env-file ./.env --name nms -d -p 1935:1935 -p 8000:8000 node-media-server
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
