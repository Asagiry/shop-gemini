import fs from 'fs';
import path from 'path';

const logFilePath = path.resolve(__dirname, '../../server.log');

export function logEvent(message: string) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}\n`;
  try {
    fs.appendFileSync(logFilePath, logMessage, 'utf8');
    console.log(`LOG: ${message}`);
  } catch (err) {
    console.error('Failed to write to server.log:', err);
  }
}
