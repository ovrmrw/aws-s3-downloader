# aws-s3-downloader
For download tons of log files stored in your S3 Buckets.

---

## Prepare

Create `{HOME_DIR}/.aws/nodejs/config.json` file for your environment. (ref: https://docs.aws.amazon.com/sdk-for-javascript/v2/developer-guide/loading-node-credentials-json-file.html )

## Install

```
$ npm install s3-bulk-downloader
```

## How to use (for example)

```ts
import { Downloader } from 's3-bulk-downloader';

const [, , bucket, prefix, regexp] = process.argv;
const downloader = new Downloader();
downloader.download(bucket, prefix, regexp);
```

then `$ node build/index.js <Bucket name> <Prefix> <regular-expression string>`
