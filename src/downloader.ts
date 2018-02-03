import * as fs from 'fs';
import { WriteStream } from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as AWS from 'aws-sdk';
import { S3 } from 'aws-sdk';
import * as lodash from 'lodash';
import { ListObjectsOutput, ListObjectsRequest, Options } from './type';
import { makeDir } from './helpers';

AWS.config.loadFromPath(path.join(os.homedir(), '.aws', 'nodejs', 'config.json'));
const s3 = new S3();

export class Downloader {
  private mergedDirpath: string;
  private downloadsDirpath: string;
  private ws1: WriteStream | null = null;
  private regexp: RegExp | null = null;
  private keyCounter: number = 0;
  private filteredKeyCounter: number = 0;

  constructor() {
    this.mergedDirpath = makeDir('merged');
    this.downloadsDirpath = makeDir('downloads');
  }

  /**
   * Download log files from your S3 Buckets.
   * @param options
   */
  download(options: Options): Promise<void> {
    console.log('download options:', options);
    const params: ListObjectsRequest = {
      Bucket: options.bucket || '',
      Prefix: options.prefix || '',
    };
    this.regexp = options.regexp ? new RegExp(options.regexp) : null;
    const filenamePrefix = `${options.bucket}_${options.prefix.replace(/\//g, '_')}`;
    const filename = options.filename
      ? options.filename.indexOf('.') > -1
        ? `${filenamePrefix}_${options.filename}`
        : `${filenamePrefix}_${options.filename}.txt`
      : `${filenamePrefix}_${Date.now()}.txt`;
    this.ws1 = fs.createWriteStream(path.join(this.mergedDirpath, filename));
    this.ws1.on('close', () => console.log('write-stream is closed.'));
    this.keyCounter = 0;
    this.filteredKeyCounter = 0;
    return this.listObjects(params)
      .then(() => {
        if (this.ws1) {
          this.ws1.end();
        }
        console.log('total key count:', this.keyCounter);
        console.log('total filtered-key count:', this.filteredKeyCounter);
      });
  }

  private listObjects(params: ListObjectsRequest, nextToken?: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const _params: ListObjectsRequest = nextToken
        ? { ...params, ContinuationToken: nextToken }
        : params;
      console.log('listObjects params:', _params);
      s3.listObjectsV2(_params, (err, data) => {
        if (err) {
          reject(err);
          return;
        }
        this.writeFile(data, params)
          .then(() => {
            if (data.NextContinuationToken) {
              this.listObjects(params, data.NextContinuationToken)
                .then(() => resolve());
            } else {
              resolve();
            }
          });
      });
    });
  }

  private writeFile(data: ListObjectsOutput, params: ListObjectsRequest): Promise<void> {
    this.keyCounter += data.KeyCount || 0;
    const contents = data.Contents && data.Contents.length > 0
      ? lodash.orderBy(data.Contents.filter(content => content.Key), 'Key')
      : [];
    if (contents && contents.length > 0) {
      const promises = contents.map((content, index) => {
        return new Promise((resolve, reject) => {
          const shouldWrite: boolean = !!content.Key &&
            (!this.regexp || (this.regexp && this.regexp.test(content.Key)));
          if (shouldWrite) {
            this.filteredKeyCounter++;
            s3.getObject({ Bucket: params.Bucket, Key: content.Key! }, (err, data) => {
              if (err) {
                reject(err);
                return;
              }
              const filename = params.Bucket + '_' + content.Key!.replace(/\//g, '_');
              const ws2 = fs.createWriteStream(path.join(this.downloadsDirpath, filename));
              ws2.write(data.Body);
              if (this.ws1) {
                this.ws1.write(data.Body);
              }
              resolve();
            });
          } else {
            resolve();
          }
        });
      });
      return Promise.all(promises)
        .then(() => void 0)
        .catch(err => { throw err; });
    } else {
      return Promise.resolve();
    }
  }

}
