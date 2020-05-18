const NodeMediaServer = require('./');
const MediaRoot = process.env.MEDIA_ROOT || './media'
const FfmpegPath = process.env.FFMPEG_PATH || '/usr/bin/ffmpeg'
const fs = require('fs');
const path = require('path');
const getStream = require('into-stream');

const { BlobServiceClient } = require("@azure/storage-blob");
const { DefaultAzureCredential } = require("@azure/identity");

const ONE_MEGABYTE = 1024 * 1024;
const uploadOptions = { bufferSize: 8 * ONE_MEGABYTE, maxBuffers: 20 };
const sleep = (waitTimeInMs) => new Promise(resolve => setTimeout(resolve, waitTimeInMs));

const account = process.env.AZURE_STORAGE_ACCOUNT_NAME || "";
const defaultAzureCredential = new DefaultAzureCredential();

const blobServiceClient = new BlobServiceClient(
  `https://${account}.blob.core.windows.net`,
  defaultAzureCredential
);

// Ensure required ENV vars are set
let requiredEnv = [
  'AUTH_SECRET','AZURE_TENANT_ID','AZURE_CLIENT_ID','AZURE_CLIENT_SECRET'
];
let unsetEnv = requiredEnv.filter((env) => !(typeof process.env[env] !== 'undefined'));

if (unsetEnv.length > 0) {
  throw new Error("Required ENV variables are not set: [" + unsetEnv.join(', ') + "]");
}

// Optimize encoding for H.264: https://trac.ffmpeg.org/wiki/Encode/H.264

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
        vc: "copy",
        vcParam: ['-preset', 'slow', '-crf', '22'],
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

function removeFile(path) {
  return new Promise((resolve, reject) => {
    fs.unlink(path, function (err, data) {
      if (err) {
        reject(err);
      }
      resolve(data);
    });
  });
}

async function uploadToAzureBlobStorage(StreamPath){
  console.log('[uploadToAzureBlobStorage]', `StreamPath=${StreamPath}`);

  let ouPath = `${config.http.mediaroot}${StreamPath}`;
  let files = await readdirAsync(ouPath);

  for (const filename of files) {
    if (filename.endsWith('.mp4')) {

      let containerName = path.basename(StreamPath);
      let containerClient = blobServiceClient.getContainerClient(containerName);
      if(!(await containerClient.exists())) {
        const createContainerResponse = await containerClient.create();
        console.log(`[uploadToAzureBlobStorage] Create container ${containerName} successfully`, createContainerResponse.requestId);  
      }

      let filepath = ouPath + '/' + filename;
      data = await readFile(filepath);
      console.log(`[uploadToAzureBlobStorage] mp4 buffer length：${data.length}`);
      if(data.length > 0) {
        let stream = getStream(data);
        let blockBlobClient = containerClient.getBlockBlobClient(filename);
        
        // if blob already exists no need to copy it again
        if(!(await blockBlobClient.exists())) {
          try {
            console.log('[uploadToAzureBlobStorage] Uploading ' + filename + ' to Azure Blob Storage..');
            const uploadBlobResponse = await blockBlobClient.uploadStream(stream, uploadOptions.bufferSize, 5, { blobHTTPHeaders: { blobContentType: "video/mp4" } });
            console.log(`[uploadToAzureBlobStorage] Upload block blob ${filename} successfully`, uploadBlobResponse.requestId);
          }
          catch(err) {
            console.log(err)
          }
        }
        
        // Cleanup
        console.log(`[uploadToAzureBlobStorage] Remove file ${filepath} from MediaRoot..`);
        await removeFile(filepath);
      }
    }
  }

  console.log(`[uploadToAzureBlobStorage] Completed!`);
}