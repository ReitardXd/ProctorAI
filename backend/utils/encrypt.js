require('dotenv').config({ path: __dirname + '/../.env' });
const CryptoJS = require('crypto-js');

const SECRET = process.env.ENCRYPTION_SECRET;

if (!SECRET) {
  throw new Error('ENCRYPTION_SECRET environment variable is required');
}

function encrypt(data) {
  if (!data) {
    throw new Error('Data to encrypt is required');
  }
  
  const str = typeof data === 'string' ? data : JSON.stringify(data);
  const encrypted = CryptoJS.AES.encrypt(str, SECRET).toString();
  
  if (!encrypted) {
    throw new Error('Encryption failed');
  }
  
  return encrypted;
}

function decrypt(ciphertext) {
  if (!ciphertext) {
    throw new Error('Ciphertext is required');
  }
  
  try {
    const bytes = CryptoJS.AES.decrypt(ciphertext, SECRET);
    
    if (bytes.sigBytes <= 0) {
      throw new Error('Decryption resulted in empty data');
    }
    
    const str = bytes.toString(CryptoJS.enc.Utf8);
    
    if (!str) {
      throw new Error('Decrypted string is empty');
    }
    
    try {
      return JSON.parse(str);
    } catch {
      return str;
    }
  } catch (err) {
    console.error('Decryption error:', err.message);
    throw new Error('Failed to decrypt data');
  }
}

module.exports = { encrypt, decrypt };
