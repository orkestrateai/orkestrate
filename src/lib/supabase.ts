import { createClient } from "@supabase/supabase-js";

export function createServiceClient() {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error("Missing Supabase credentials. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  }

  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function isNotFound(error: any) {
  const message = String(error?.message || "").toLowerCase();
  return message.includes("not found") || message.includes("nosuchkey") || message.includes("not exist");
}

export async function ensureBucket(client: any, bucket: string) {
  const { data, error } = await client.storage.listBuckets();
  if (error) {
    throw new Error(`Supabase listBuckets failed: ${error.message}`);
  }

  if (Array.isArray(data) && data.some((entry) => entry.name === bucket)) {
    return;
  }

  const { error: createError } = await client.storage.createBucket(bucket, {
    public: false,
  });

  if (createError && !String(createError.message || "").toLowerCase().includes("already")) {
    throw new Error(`Supabase createBucket failed: ${createError.message}`);
  }
}

export async function readTextObject(client: any, bucket: string, path: string) {
  await ensureBucket(client, bucket);
  const store = client.storage.from(bucket);
  const { data, error } = await store.download(path);

  if (error) {
    if (isNotFound(error)) return null;
    throw new Error(`Supabase read ${bucket}/${path} failed: ${error.message}`);
  }

  return await data.text();
}

export async function writeTextObject(client: any, bucket: string, path: string, text: string, contentType = "text/plain; charset=utf-8") {
  await ensureBucket(client, bucket);
  const store = client.storage.from(bucket);
  const payload = new Blob([text], { type: contentType });
  const { error } = await store.upload(path, payload, {
    upsert: true,
    contentType,
  });

  if (error) {
    throw new Error(`Supabase write ${bucket}/${path} failed: ${error.message}`);
  }
}

export async function deleteObject(client: any, bucket: string, path: string) {
  await ensureBucket(client, bucket);
  const store = client.storage.from(bucket);
  const { error } = await store.remove([path]);
  if (error) {
    const message = String(error.message || "");
    if (message.toLowerCase().includes("not found")) return;
    throw new Error(`Supabase delete ${bucket}/${path} failed: ${error.message}`);
  }
}
