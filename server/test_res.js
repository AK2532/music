const https = require('https');

function check(url) {
  https.get(url, (res) => {
    console.log(`${res.statusCode} : ${url}`);
  });
}

const id = 'RGwtLJiaxPA';
check(`https://i.ytimg.com/vi/${id}/maxresdefault.jpg`);
check(`https://i.ytimg.com/vi/${id}/hq720.jpg`);
check(`https://i.ytimg.com/vi/${id}/sddefault.jpg`);
check(`https://i.ytimg.com/vi/${id}/hqdefault.jpg`);
