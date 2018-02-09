import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';

export interface AWSAuthenticationConfig {
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
}

const configFile = path.join(os.homedir(), '.aws', 'nodejs', 'config.json');

export function getConfig(accountName?: string): AWSAuthenticationConfig {
  let result = { accessKeyId: '', secretAccessKey: '', region: '' };
  try {
    const config = require(configFile);
    const hasMultiAccounts: boolean = !config.accessKeyId && !config.secretAccessKey;
    if (hasMultiAccounts && accountName) {
      result = { ...result, ...config[accountName] };
    } else if (hasMultiAccounts && !accountName) {
      let firstConfig;
      Object.keys(config).forEach((key, index) => {
        if (index === 0) {
          firstConfig = config[key];
        }
      });
      result = { ...result, ...firstConfig };
    } else {
      result = { ...result, ...config };
    }
  } catch (err) {
    throw err;
  }
  return result;
}
