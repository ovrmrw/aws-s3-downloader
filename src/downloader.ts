import * as fs from 'fs';
import { WriteStream } from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as AWS from 'aws-sdk';
import { S3 } from 'aws-sdk';
import * as lodash from 'lodash';
import { ListObjectsOutput, ListObjectsRequest } from './type';
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
   * @param bucket Bucket name
   * @param prefix Prefix of Key
   * @param regexp regular-expression string for filrtering Keys
   */
  download(bucket: string, prefix: string, regexp?: string): Promise<void> {
    console.log('download:', { bucket, prefix, regexp });
    const options: ListObjectsRequest = {
      Bucket: bucket || '',
      Prefix: prefix || '',
    };
    this.regexp = regexp ? new RegExp(regexp) : null;
    this.ws1 = fs.createWriteStream(path.join(this.mergedDirpath, 'mergedfile.txt'));
    this.ws1.on('close', () => console.log('write-stream is closed.'));
    this.keyCounter = 0;
    this.filteredKeyCounter = 0;
    return this.listObjects(options)
      .then(() => {
        if (this.ws1) {
          this.ws1.end();
        }
        console.log('total key count:', this.keyCounter);
        console.log('total filtered-key count:', this.filteredKeyCounter);
      });
  }

  private listObjects(options: ListObjectsRequest, nextToken?: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const _options: ListObjectsRequest = nextToken
        ? { ...options, ContinuationToken: nextToken }
        : options;
      console.log('listObjects:', _options);
      s3.listObjectsV2(_options, (err, data) => {
        if (err) {
          reject(err);
          return;
        }
        this.writeFileFromListObject(data, options)
          .then(() => {
            if (data.NextContinuationToken) {
              this.listObjects(options, data.NextContinuationToken)
                .then(() => resolve());
            } else {
              resolve();
            }
          });
      });
    });
  }

  private writeFileFromListObject(data: ListObjectsOutput, options: ListObjectsRequest): Promise<void> {
    console.log('writeFileFromListObject:', { keyCount: data.KeyCount });
    this.keyCounter += data.KeyCount || 0;

    const contents = data.Contents && data.Contents.length > 0
      ? lodash.orderBy(data.Contents.filter(content => content.Key), 'Key')
      : [];
    if (contents && contents.length > 0) {
      const promises = contents.map((content, index) => {
        return new Promise((resolve, reject) => {
          if (content.Key) {
            if (!this.regexp || (this.regexp && this.regexp.test(content.Key))) {
              this.filteredKeyCounter++;
              s3.getObject({ Bucket: options.Bucket, Key: content.Key }, (err, data) => {
                if (err) {
                  reject(err);
                  return;
                }
                const downloadsDirpath = makeDir('downloads');
                const ws2 = fs.createWriteStream(path.join(downloadsDirpath, options.Bucket + '_' + content.Key!.replace(/\//g, '_')));
                ws2.write(data.Body);
                if (this.ws1) {
                  this.ws1.write(data.Body);
                }
                resolve();
              });
            } else {
              resolve();
            }
          } else {
            reject('content.Key is undefined.');
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
