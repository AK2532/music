const https = require('https');

function check(url) {
  https.get(url, (res) => {
    console.log(`${res.statusCode} : ${url}`);
  });
}

check('https://lh3.googleusercontent.com/AhK3o07HdRpZNMz8nbPyKrFhwvdTGLJzx07UeIdaqdMDZpW-T0jlbAKD1wUlS-H4s6hw_F0cTbSDkyEx=w540-h540-l90-rj');
check('https://lh3.googleusercontent.com/AhK3o07HdRpZNMz8nbPyKrFhwvdTGLJzx07UeIdaqdMDZpW-T0jlbAKD1wUlS-H4s6hw_F0cTbSDkyEx=w1080-h1080-l90-rj');
