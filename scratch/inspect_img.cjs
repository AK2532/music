const Jimp = require('jimp');

async function main() {
  const image = await Jimp.read('../android/app/asset/image.png');
  console.log(`Width: ${image.bitmap.width}, Height: ${image.bitmap.height}`);
  for (let y = 0; y < 10; y++) {
    let row = '';
    for (let x = 0; x < 10; x++) {
      const hex = image.getPixelColor(x, y).toString(16).padStart(8, '0');
      row += hex + ' ';
    }
    console.log(row);
  }
}
main();
