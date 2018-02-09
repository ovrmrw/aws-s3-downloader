import { S3 } from 'aws-sdk';

export type ListObjectsRequest = S3.ListObjectsV2Request;
export type ListObjectsOutput = S3.ListObjectsV2Output;

export interface Options {
  /** Bucket name */
  bucket: string;
  /** Prefix of Key name */
  prefix: string;
  /** regular-expression string for filtering */
  regexp?: string;
  /** file name of which merged all files */
  filename?: string;
}
