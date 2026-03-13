import {
  CreateTableCommand,
  DescribeTableCommand,
  DynamoDBClient,
  ResourceInUseException,
  ResourceNotFoundException,
} from "@aws-sdk/client-dynamodb";
import {
  DeleteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  ScanCommand,
} from "@aws-sdk/lib-dynamodb";

export const PLAYLIST_TABLE_NAME =
  process.env.OLGOO_LIVE_PLAYLIST_TABLE || "RadioOlgooPlaylists";

export const SCHEDULE_TABLE_NAME =
  process.env.OLGOO_LIVE_SCHEDULE_TABLE || "RadioOlgooSchedules";

export const PLAYBACK_TABLE_NAME =
  process.env.OLGOO_LIVE_TABLE || "OlgooLivePlaybackState";

const client = new DynamoDBClient({
  region: process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "ca-central-1",
});

export const ddb = DynamoDBDocumentClient.from(client, {
  marshallOptions: {
    removeUndefinedValues: true,
    convertClassInstanceToMap: true,
  },
});

export function nowIso(): string {
  return new Date().toISOString();
}

export function slugifyName(value: string): string {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "") || "item"
  );
}

export async function tableExists(tableName: string): Promise<boolean> {
  try {
    await client.send(new DescribeTableCommand({ TableName: tableName }));
    return true;
  } catch (error) {
    if (error instanceof ResourceNotFoundException) {
      return false;
    }

    const message = error instanceof Error ? error.message : String(error);

    if (
      message.includes("ResourceNotFoundException") ||
      message.includes("Requested resource not found")
    ) {
      return false;
    }

    throw error;
  }
}

export async function ensurePkSkTable(tableName: string): Promise<void> {
  const exists = await tableExists(tableName);
  if (exists) return;

  try {
    await client.send(
      new CreateTableCommand({
        TableName: tableName,
        AttributeDefinitions: [
          { AttributeName: "PK", AttributeType: "S" },
          { AttributeName: "SK", AttributeType: "S" },
        ],
        KeySchema: [
          { AttributeName: "PK", KeyType: "HASH" },
          { AttributeName: "SK", KeyType: "RANGE" },
        ],
        BillingMode: "PAY_PER_REQUEST",
      })
    );
  } catch (error) {
    if (
      error instanceof ResourceInUseException ||
      (error instanceof Error && error.message.includes("ResourceInUseException"))
    ) {
      // Another request already created it or is creating it.
    } else {
      throw error;
    }
  }

  for (let i = 0; i < 30; i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    try {
      const out = await client.send(
        new DescribeTableCommand({ TableName: tableName })
      );
      if (out.Table?.TableStatus === "ACTIVE") {
        return;
      }
    } catch {
      // keep polling
    }
  }

  throw new Error(`Table ${tableName} did not become ACTIVE in time.`);
}

export async function queryByPk(tableName: string, pk: string) {
  const out = await ddb.send(
    new QueryCommand({
      TableName: tableName,
      KeyConditionExpression: "PK = :pk",
      ExpressionAttributeValues: { ":pk": pk },
      ScanIndexForward: true,
    })
  );

  return (out.Items || []) as Record<string, any>[];
}

export async function scanTable(tableName: string, limit = 2000) {
  const items: Record<string, any>[] = [];
  let exclusiveStartKey: Record<string, any> | undefined;

  do {
    const out = await ddb.send(
      new ScanCommand({
        TableName: tableName,
        ExclusiveStartKey: exclusiveStartKey,
        Limit: Math.min(200, limit - items.length),
      })
    );

    items.push(...(((out.Items as Record<string, any>[]) || [])));
    exclusiveStartKey = out.LastEvaluatedKey as Record<string, any> | undefined;
  } while (exclusiveStartKey && items.length < limit);

  return items;
}

export async function putItem(tableName: string, item: Record<string, any>) {
  await ddb.send(
    new PutCommand({
      TableName: tableName,
      Item: item,
    })
  );
}

export async function deleteItem(tableName: string, key: Record<string, any>) {
  await ddb.send(
    new DeleteCommand({
      TableName: tableName,
      Key: key,
    })
  );
}

export async function getItem(tableName: string, key: Record<string, any>) {
  const out = await ddb.send(
    new GetCommand({
      TableName: tableName,
      Key: key,
    })
  );

  return out.Item as Record<string, any> | undefined;
}

export type PlaybackState = {
  playState: "playing" | "stopped";
  mediaUrl?: string;
  title?: string;
  startedAt?: string;
  updatedAt?: string;
  sourceScheduleId?: string;
  sourcePlaylistId?: string;
};

const PLAYBACK_PK = "CHANNEL#OLGOO_LIVE";
const PLAYBACK_SK = "PLAYBACK";

export async function getPlaybackState(): Promise<PlaybackState> {
  await ensurePkSkTable(PLAYBACK_TABLE_NAME);

  const item = await getItem(PLAYBACK_TABLE_NAME, {
    PK: PLAYBACK_PK,
    SK: PLAYBACK_SK,
  });

  if (!item) {
    return {
      playState: "stopped",
    };
  }

  return {
    playState: item.playState === "playing" ? "playing" : "stopped",
    mediaUrl: item.mediaUrl ? String(item.mediaUrl) : undefined,
    title: item.title ? String(item.title) : undefined,
    startedAt: item.startedAt ? String(item.startedAt) : undefined,
    updatedAt: item.updatedAt ? String(item.updatedAt) : undefined,
    sourceScheduleId: item.sourceScheduleId ? String(item.sourceScheduleId) : undefined,
    sourcePlaylistId: item.sourcePlaylistId ? String(item.sourcePlaylistId) : undefined,
  };
}

export async function setPlaybackState(
  input: Partial<PlaybackState> & { playState: "playing" | "stopped" }
): Promise<PlaybackState> {
  await ensurePkSkTable(PLAYBACK_TABLE_NAME);

  const next: PlaybackState = {
    playState: input.playState,
    mediaUrl: input.mediaUrl,
    title: input.title,
    startedAt: input.startedAt,
    updatedAt: nowIso(),
    sourceScheduleId: input.sourceScheduleId,
    sourcePlaylistId: input.sourcePlaylistId,
  };

  await putItem(PLAYBACK_TABLE_NAME, {
    PK: PLAYBACK_PK,
    SK: PLAYBACK_SK,
    ...next,
  });

  return next;
}