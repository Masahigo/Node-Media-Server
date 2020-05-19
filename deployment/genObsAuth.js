const md5 = require('crypto').createHash('md5');
let key = 'replaceme';
let exp = (Date.now() / 1000 | 0) + 999999;
let streamId = '/live/obs';
console.log(exp+'-'+md5.update(streamId+'-'+exp+'-'+key).digest('hex'));
