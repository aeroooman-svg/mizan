/**
 * Supabase REST API Client — اتصال مباشر بقاعدة بيانات Supabase
 * 
 * Uses native fetch (no SDK dependency) for lightweight Supabase PostgREST access.
 * This enables real wallet sharing across devices without needing an Express server.
 */

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://pykejhbazxzuqshjsfws.supabase.co';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_jCubdJRgn8gyF3k1bw3U-g_cXzkIQkZ';

const REST_URL = `${SUPABASE_URL}/rest/v1`;

function getHeaders(prefer?: string): Record<string, string> {
  const headers: Record<string, string> = {
    'apikey': SUPABASE_ANON_KEY,
    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    'Content-Type': 'application/json',
  };
  if (prefer) {
    headers['Prefer'] = prefer;
  }
  return headers;
}

/**
 * SELECT rows from a Supabase table.
 * @param table Table name (e.g. 'wallets', 'transactions', 'wallet_shares')
 * @param query PostgREST query string (e.g. 'share_code=eq.ABC123&select=*')
 */
export async function supabaseGet<T = any>(table: string, query: string = 'select=*'): Promise<T[]> {
  try {
    const url = `${REST_URL}/${table}?${query}`;
    const res = await fetch(url, {
      method: 'GET',
      headers: getHeaders(),
    });
    if (!res.ok) {
      const errText = await res.text();
      console.warn(`supabaseGet ${table} error:`, res.status, errText);
      return [];
    }
    return await res.json();
  } catch (e) {
    console.warn(`supabaseGet ${table} fetch error:`, e);
    return [];
  }
}

/**
 * UPSERT (insert or update on conflict) rows into a Supabase table.
 * @param table Table name
 * @param data Row data or array of rows
 * @param onConflict Column(s) to handle conflict (default: 'id')
 */
export async function supabaseUpsert<T = any>(table: string, data: any, onConflict: string = 'id'): Promise<T | null> {
  try {
    const url = `${REST_URL}/${table}?on_conflict=${onConflict}`;
    const body = Array.isArray(data) ? data : [data];
    const res = await fetch(url, {
      method: 'POST',
      headers: getHeaders('resolution=merge-duplicates,return=representation'),
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const errText = await res.text();
      console.warn(`supabaseUpsert ${table} error:`, res.status, errText);
      return null;
    }
    const result = await res.json();
    return Array.isArray(result) ? result[0] : result;
  } catch (e) {
    console.warn(`supabaseUpsert ${table} fetch error:`, e);
    return null;
  }
}

/**
 * INSERT rows into a Supabase table (no upsert).
 */
export async function supabaseInsert<T = any>(table: string, data: any): Promise<T | null> {
  try {
    const url = `${REST_URL}/${table}`;
    const body = Array.isArray(data) ? data : [data];
    const res = await fetch(url, {
      method: 'POST',
      headers: getHeaders('return=representation'),
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const errText = await res.text();
      console.warn(`supabaseInsert ${table} error:`, res.status, errText);
      return null;
    }
    const result = await res.json();
    return Array.isArray(result) ? result[0] : result;
  } catch (e) {
    console.warn(`supabaseInsert ${table} fetch error:`, e);
    return null;
  }
}

/**
 * DELETE rows from a Supabase table.
 * @param table Table name
 * @param query PostgREST filter (e.g. 'wallet_id=eq.abc&user_id=eq.xyz')
 */
export async function supabaseDelete(table: string, query: string): Promise<boolean> {
  try {
    const url = `${REST_URL}/${table}?${query}`;
    const res = await fetch(url, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    return res.ok;
  } catch (e) {
    console.warn(`supabaseDelete ${table} fetch error:`, e);
    return false;
  }
}

/**
 * UPDATE rows in a Supabase table.
 * @param table Table name
 * @param query PostgREST filter for which rows to update
 * @param data Fields to update
 */
export async function supabaseUpdate(table: string, query: string, data: any): Promise<boolean> {
  try {
    const url = `${REST_URL}/${table}?${query}`;
    const res = await fetch(url, {
      method: 'PATCH',
      headers: getHeaders('return=representation'),
      body: JSON.stringify(data),
    });
    return res.ok;
  } catch (e) {
    console.warn(`supabaseUpdate ${table} fetch error:`, e);
    return false;
  }
}
