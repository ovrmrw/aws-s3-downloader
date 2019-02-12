# s3-bulk-downloader
For download tons of log files stored in your S3 Buckets.

---

## Install

```
$ npm install s3-bulk-downloader
```

## How to use (for example)

```ts
import { Downloader } from 's3-bulk-downloader';

const [, , bucket, prefix, regexp] = process.argv;
const downloader = new Downloader({ profileName: 'foo' });
downloader.download({ bucket, prefix, regexp })
  .then(result => {
    console.log(result.downloaded); // array of downloaded filepaths.
    console.log(result.merged); // filepath merged all downloaded files.  
  });
```

then

`$ node index.js <Bucket name *1> <Prefix *2> <regular-expression string *3>`

- *1 ... full Bucket name.
- *2 ... Prefix of Key name.
- *3 ... regular-expression string for filtering.
