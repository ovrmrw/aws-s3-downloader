import { Downloader, DownloadResult } from './downloader';
import { Options } from './types';

export { Downloader, DownloadResult, Options };

// const [, , bucket = '', prefix = '', regexp = ''] = process.argv;
// const downloader = new Downloader();
// downloader.download({ bucket, prefix, regexp, filename: 'merged.txt' })
//   .then(result => console.log(result))
//   .catch(console.error);
