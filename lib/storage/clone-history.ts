import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { awsCredentialsProvider } from '@vercel/functions/oidc';

export type CloneActionResult = 'started' | 'success' | 'failed';

export interface CloneActionRecord {
  id: string;
  createdAt: string;
  url: string;
  model: string;
  result: CloneActionResult;
  error?: string;
  metadata?: Record<string, unknown>;
}

const historyKey = 'clone-history/actions.json';

function getClient() {
  return new S3Client({
    region: process.env.AWS_REGION,
    credentials: awsCredentialsProvider({
      roleArn: process.env.AWS_ROLE_ARN,
      clientConfig: { region: process.env.AWS_REGION },
    }),
  });
}

async function readHistory(): Promise<CloneActionRecord[]> {
  try {
    const response = await getClient().send(new GetObjectCommand({
      Bucket: process.env.S3_BUCKET_NAME,
      Key: historyKey,
    }));
    const body = await response.Body?.transformToString();
    return body ? (JSON.parse(body) as CloneActionRecord[]) : [];
  } catch (error: unknown) {
    if ((error as { name?: string }).name === 'NoSuchKey') return [];
    throw error;
  }
}

export async function recordCloneAction(record: CloneActionRecord) {
  const history = await readHistory();
  history.push(record);
  await getClient().send(new PutObjectCommand({
    Bucket: process.env.S3_BUCKET_NAME,
    Key: historyKey,
    Body: JSON.stringify(history.slice(-500), null, 2),
    ContentType: 'application/json',
  }));
}

export async function getCloneHistory() {
  return readHistory();
}
