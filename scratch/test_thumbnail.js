const axios = require('axios');
const fs = require('fs');

async function test() {
  const fileId = '14IBdERlL4MA9Y4IZFqi4alxfL_RTrrzk';
  const url = `https://drive.google.com/thumbnail?id=${fileId}&sz=w220`;
  console.log('Fetching thumbnail from:', url);
  try {
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      timeout: 10000
    });
    console.log('Status:', response.status);
    console.log('Content-Type:', response.headers['content-type']);
    console.log('Data Length:', response.data.length);
    const base64 = Buffer.from(response.data).toString('base64');
    const mime = response.headers['content-type'] || 'image/jpeg';
    console.log('Base64 prefix:', `data:${mime};base64,` + base64.substring(0, 100));
  } catch (err) {
    console.error('Error fetching thumbnail:', err.message);
  }
}

test();
