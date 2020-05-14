const NodeMediaServer = require('./');
const MediaRoot = process.env.MEDIA_ROOT || './media'
const FfmpegPath = process.env.FFMPEG_PATH || '/usr/bin/ffmpeg'
const fs = require('fs');
const path = require('path');
const getStream = require('into-stream');

const {
  BlobServiceClient,
  AnonymousCredential
} = require('@azure/storage-blob');

const ONE_MEGABYTE = 1024 * 1024;
const uploadOptions = { bufferSize: 8 * ONE_MEGABYTE, maxBuffers: 20 };
const sleep = (waitTimeInMs) => new Promise(resolve => setTimeout(resolve, waitTimeInMs));

const account = process.env.AZURE_STORAGE_ACCOUNT_NAME || "";
const accountSas = process.env.AZURE_STORAGE_ACCOUNT_SAS || "";

// Use AnonymousCredential when url already includes a SAS signature
const anonymousCredential = new AnonymousCredential();
const blobServiceClient = new BlobServiceClient(
  // When using AnonymousCredential, following url should include a valid SAS or support public access
  `https://${account}.blob.core.windows.net?${accountSas}`,
  anonymousCredential
);

// Ensure required ENV vars are set
let requiredEnv = [
  'AUTH_SECRET','AZURE_STORAGE_ACCOUNT_NAME','AZURE_STORAGE_ACCOUNT_SAS'
];
let unsetEnv = requiredEnv.filter((env) => !(typeof process.env[env] !== 'undefined'));

if (unsetEnv.length > 0) {
  throw new Error("Required ENV variables are not set: [" + unsetEnv.join(', ') + "]");
}

const config = {
  rtmp: {
    port: 1935,
    chunk_size: 60000,
    gop_cache: true,
    ping: 30,
    ping_timeout: 60
  },
  http: {
    port: 8000,
    mediaroot: MediaRoot,
    allow_origin: '*'
  },
  trans: {
    ffmpeg: FfmpegPath,
    tasks: [
      {
        app: 'live',
        mp4: true,
        mp4Flags: '[movflags=faststart]',
      }
    ]
  },
  auth: {
    play: true,
    publish: true,
    secret: process.env.AUTH_SECRET
  }
};


let nms = new NodeMediaServer(config)
nms.run();

nms.on('preConnect', (id, args) => {
  console.log('[NodeEvent on preConnect]', `id=${id} args=${JSON.stringify(args)}`);
  // let session = nms.getSession(id);
  // session.reject();
});

nms.on('postConnect', (id, args) => {
  console.log('[NodeEvent on postConnect]', `id=${id} args=${JSON.stringify(args)}`);
});

nms.on('doneConnect', (id, args) => {
  console.log('[NodeEvent on doneConnect]', `id=${id} args=${JSON.stringify(args)}`);
});

nms.on('prePublish', (id, StreamPath, args) => {
  console.log('[NodeEvent on prePublish]', `id=${id} StreamPath=${StreamPath} args=${JSON.stringify(args)}`);
  // let session = nms.getSession(id);
  // session.reject();
});

nms.on('postPublish', (id, StreamPath, args) => {
  console.log('[NodeEvent on postPublish]', `id=${id} StreamPath=${StreamPath} args=${JSON.stringify(args)}`);
});

nms.on('donePublish', (id, StreamPath, args) => {
  console.log('[NodeEvent on donePublish]', `id=${id} StreamPath=${StreamPath} args=${JSON.stringify(args)}`);
});

nms.on('doneTransSession', (StreamPath) => {
  console.log('[NodeEvent on doneTransSession]', `StreamPath=${StreamPath}`);
  setImmediate(() => {

    sleep(2000).then(() => {
      uploadToAzureBlobStorage(StreamPath);
    });
    
  })
});

nms.on('prePlay', (id, StreamPath, args) => {
  console.log('[NodeEvent on prePlay]', `id=${id} StreamPath=${StreamPath} args=${JSON.stringify(args)}`);
  // let session = nms.getSession(id);
  // session.reject();
});

nms.on('postPlay', (id, StreamPath, args) => {
  console.log('[NodeEvent on postPlay]', `id=${id} StreamPath=${StreamPath} args=${JSON.stringify(args)}`);
});

nms.on('donePlay', (id, StreamPath, args) => {
  console.log('[NodeEvent on donePlay]', `id=${id} StreamPath=${StreamPath} args=${JSON.stringify(args)}`);
});

function readdirAsync(path) {
  return new Promise(function (resolve, reject) {
    fs.readdir(path, function (error, result) {
      if (error) {
        reject(error);
      } else {
        resolve(result);
      }
    });
  });
}

function readFile(path) {
  return new Promise((resolve, reject) => {
    fs.readFile(path, function (err, data) {
      if (err) {
        reject(err);
      }
      resolve(data);
    });
  });
}

async function uploadToAzureBlobStorage(StreamPath){
  let ouPath = `${config.http.mediaroot}/${StreamPath}`;
  let files = await readdirAsync(ouPath);

  for (const filename of files) {
    if (filename.endsWith('.mp4')) {

      let containerName = path.basename(StreamPath);
      let containerClient = blobServiceClient.getContainerClient(containerName);
      if(!(await containerClient.exists())) {
        const createContainerResponse = await containerClient.create();
        console.log(`Create container ${containerName} successfully`, createContainerResponse.requestId);  
      }

      let filepath = ouPath + '/' + filename;
      data = await readFile(filepath);
      console.log(`mp4 buffer length：${data.length}`);
      if(data.length > 0) {
        let stream = getStream(data);
        let blockBlobClient = containerClient.getBlockBlobClient(filename);

        try {
          console.log('[Uploading ' + filename + ' to Azure Blob Storage..]');
          const uploadBlobResponse = await blockBlobClient.uploadStream(stream, uploadOptions.bufferSize, 5, { blobHTTPHeaders: { blobContentType: "video/mp4" } });
          console.log(`Upload block blob ${filename} successfully`, uploadBlobResponse.requestId);
        }
        catch(err) {
          console.log(err)
        }
        
        // TODO: clean out copied file from mediaroot?
      }
    }
  }

}