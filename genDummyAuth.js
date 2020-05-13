const md5 = require('crypto').createHash('md5');
let key = 'dummy';
// note: your local computer time can differ from the container time so use enough expiration here
let exp = (Date.now() / 1000 | 0) + 1440;
let streamId = '/live/stream';
let hash = exp+'-'+md5.update(streamId+'-'+exp+'-'+key).digest('hex');
console.log(hash);