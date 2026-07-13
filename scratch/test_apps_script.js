const axios = require('axios');

async function test() {
  const folderId = '1rFXDtGbygXGobiojQiGENTJ7j14C4xog';
  const googleScriptUrl = "https://script.google.com/macros/s/AKfycbxCWY_Sre0t9V-4ilK-TWIXKAttWdUWqNBa2fTnneVJHbHxGQcWVKq9Ug6UYCf_ewCJ/exec";
  const url = `${googleScriptUrl}?action=getFolderImages&folderId=${folderId}`;
  console.log('Fetching:', url);
  try {
    const response = await axios.get(url, { timeout: 15000 });
    console.log('Status:', response.status);
    console.log('Headers:', response.headers);
    console.log('Data type:', typeof response.data);
    console.log('Data snippet:', JSON.stringify(response.data).substring(0, 1000));
  } catch (err) {
    console.error('Error:', err.message);
  }
}

test();
