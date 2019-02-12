import * as fs from 'fs';
import { WriteStream } from 'fs';
import * as path from 'path';
import * as AWS from 'aws-sdk';
import { S3 } from 'aws-sdk';
import * as lodash from 'lodash';
import { LineStream } from 'byline';
import { ListObjectsOutput, ListObjectsRequest, Options } from './types';
import { makeDir } from './helpers';

export interface DownloadResult {
  downloaded: string[];
  merged: string;
}

export class Downloader {
  private s3: S3;
  private mergedDirpath: string;
  private downloadedDirpath: string;
  private ws1: WriteStream | null = null;
  private regexp: RegExp | null = null;
  private keyCounter: number = 0;
  private filteredKeyCounter: number = 0;

  constructor(args: { profileName?: string } = {}) {
    this.s3 = this.initializeSDK(args.profileName);
    this.mergedDirpath = makeDir('merged');
    this.downloadedDirpath = makeDir('downloaded');
  }

  private initializeSDK(profileName?: string): S3 {
    if (profileName) {
      const credentials = new AWS.SharedIniFileCredentials({
        profile: profileName
      });
      AWS.config.credentials = credentials;
    }
    return new S3();
  }

  /**
   * Download log files from your S3 Buckets.
   * @param options
   */
  download(options: Options): Promise<DownloadResult> {
    console.log('download options:', options);
    const params: ListObjectsRequest = {
      Bucket: options.bucket || '',
      Prefix: options.prefix || ''
    };
    this.regexp = options.regexp ? new RegExp(options.regexp) : null;
    const filenamePrefix = `${options.bucket}_${options.prefix.replace(
      /\//g,
      '_'
    )}`;
    const filename = options.filename
      ? options.filename.indexOf('.') > -1
        ? `${filenamePrefix}_${options.filename}`
        : `${filenamePrefix}_${options.filename}.txt`
      : `${filenamePrefix}_${Date.now()}.txt`;
    const mergedFilepath = path.join(this.mergedDirpath, filename);
    this.ws1 = fs.createWriteStream(mergedFilepath);
    this.ws1.on('finish', () => console.log('write-stream is finished.'));
    this.keyCounter = 0;
    this.filteredKeyCounter = 0;
    return this.listObjects(params).then(filepaths => {
      if (this.ws1) {
        this.ws1.end();
      }
      console.log('total key count:', this.keyCounter);
      console.log('total filtered-key count:', this.filteredKeyCounter);
      return { downloaded: filepaths || [], merged: mergedFilepath || '' };
    });
  }

  private listObjects(
    params: ListObjectsRequest,
    nextToken?: string
  ): Promise<string[] | void> {
    return new Promise((resolve, reject) => {
      const _params: ListObjectsRequest = nextToken
        ? { ...params, ContinuationToken: nextToken }
        : params;
      console.log('listObjects params:', _params);
      this.s3.listObjectsV2(_params, (err, data) => {
        if (err) {
          reject(err);
          return;
        }
        this.writeFile(data, params).then(filepaths => {
          if (data.NextContinuationToken) {
            this.listObjects(params, data.NextContinuationToken).then(() =>
              resolve(filepaths)
            );
          } else {
            resolve(filepaths);
          }
        });
      });
    });
  }

  private writeFile(
    data: ListObjectsOutput,
    params: ListObjectsRequest
  ): Promise<string[] | void> {
    this.keyCounter += data.KeyCount || 0;
    const contents =
      data.Contents && data.Contents.length > 0
        ? lodash.orderBy(data.Contents.filter(content => content.Key), 'Key')
        : [];
    if (contents && contents.length > 0) {
      const promises = contents.map((content, index) => {
        return new Promise<string>((resolve, reject) => {
          const shouldWrite: boolean =
            !!content.Key &&
            (!this.regexp || (this.regexp && this.regexp.test(content.Key)));
          if (shouldWrite) {
            this.filteredKeyCounter++;
            const filename =
              params.Bucket + '_' + content.Key!.replace(/\//g, '_');
            const downloadedFilepath = path.join(
              this.downloadedDirpath,
              filename
            );
            const ws2 = fs.createWriteStream(downloadedFilepath);
            const lineStream = new LineStream();
            const rs = this.s3
              .getObject({ Bucket: params.Bucket, Key: content.Key! })
              .createReadStream()
              .pipe(lineStream);
            rs.on('data', chunk => {
              const line = chunk + '\n';
              if (this.ws1) {
                this.ws1.write(line);
              }
              if (!ws2.write(line)) {
                rs.pause();
                ws2.once('drain', () => rs.resume());
              }
            });
            rs.on('error', reject);
            rs.on('end', () => {
              ws2.end();
              resolve(downloadedFilepath);
            });
          } else {
            resolve();
          }
        });
      });
      return Promise.all(promises).then(filepaths =>
        filepaths.filter(path => !!path)
      );
    } else {
      return Promise.resolve();
    }
  }
}
