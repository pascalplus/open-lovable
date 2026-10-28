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

export interface CloneResultFile {
  path: string;
  content: string;
  type?: string;
}

export async function saveCloneResult(input: {
  url: string;
  model: string;
  files: CloneResultFile[];
  explanation?: string;
}) {
  const resultId = crypto.randomUUID();
  const safePath = (filePath: string) => {
    const normalized = filePath.replaceAll('\\\\', '/').replace(/^\/+/, '');
    const segments = normalized.split('/').filter((segment) => segment && segment !== '.' && segment !== '..');
    return segments.length > 0 ? segments.join('/') : 'unnamed-file';
  };
  const prefix = `clone-results/${resultId}`;
  const manifest = {
    id: resultId,
    createdAt: new Date().toISOString(),
    url: input.url,
    model: input.model,
    explanation: input.explanation,
    files: input.files.map(({ path, type }) => ({ path, type })),
  };
  const client = getClient();

  await Promise.all([
    client.send(new PutObjectCommand({
      Bucket: process.env.S3_BUCKET_NAME,
      Key: `${prefix}/manifest.json`,
      Body: JSON.stringify(manifest, null, 2),
      ContentType: 'application/json',
    })),
    ...input.files.map((file) => client.send(new PutObjectCommand({
      Bucket: process.env.S3_BUCKET_NAME,
      Key: `${prefix}/files/${safePath(file.path)}`,
      Body: file.content,
      ContentType: file.type === 'css' ? 'text/css' : file.type === 'json' ? 'application/json' : 'text/plain',
    }))),
  ]);

  return { resultId, prefix, fileCount: input.files.length };
}
