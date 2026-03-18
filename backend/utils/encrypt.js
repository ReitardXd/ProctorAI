require('dotenv').config({ path: __dirname + '/../.env' });
const CryptoJS = require('crypto-js');

const SECRET = process.env.ENCRYPTION_SECRET;

function encrypt(data) {
  const str = typeof data === 'string' ? data : JSON.stringify(data);
  return CryptoJS.AES.encrypt(str, SECRET).toString();
}

function decrypt(ciphertext) {
  const bytes = CryptoJS.AES.decrypt(ciphertext, SECRET);
  const str   = bytes.toString(CryptoJS.enc.Utf8);
  try { return JSON.parse(str); } catch { return str; }
}

module.exports = { encrypt, decrypt };
