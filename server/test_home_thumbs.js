import YTMusic from 'ytmusic-api';
const ytmusic = new YTMusic();
await ytmusic.initialize();

const sections = await ytmusic.getHomeSections();
sections.forEach(s => {
  console.log('Section:', s.title);
  s.contents.slice(0, 2).forEach(item => {
    console.log(' - Item:', item.title || item.name, '| Type:', item.type);
    console.log('   Thumbnails:', JSON.stringify(item.thumbnails || item.thumbnail, null, 2));
  });
});
