const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: "new" });
  const page = await browser.newPage();

  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.toString()));
  page.on('requestfailed', request => {
    console.log('REQUEST FAILED:', request.url(), request.failure().errorText);
  });

  await page.goto('http://localhost:5173');
  
  // Wait for app to load
  await page.waitForTimeout(5000);

  try {
    // Click "Continue as Guest" if it exists
    const guestBtn = await page.$('text/Continue as Guest');
    if (guestBtn) await guestBtn.click();
    await page.waitForTimeout(2000);
  } catch (e) {}

  // Click on a song card to play
  try {
    console.log("Clicking a song...");
    const songCard = await page.$('.song-card'); // Or any selector that matches a song
    if (songCard) {
      await songCard.click();
      console.log("Song clicked. Waiting for playback...");
      await page.waitForTimeout(15000); // Wait 15s for stream to load
    } else {
      console.log("No song card found on the page.");
    }
  } catch(e) {
    console.error("Error clicking song:", e);
  }

  await browser.close();
})();
