/**
 * Local PostgREST Supabase-compatible Client
 * Replaces the Supabase cloud client with a client that calls the local PostgREST API.
 */

import type { Database } from './types';

const BASE_URL = '/rest/v1';

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem('auth_token');
  return {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
  };
}

// Query builder that translates supabase-js calls to PostgREST HTTP requests
class QueryBuilder {
  private _table: string;
  private _method: string = 'GET';
  private _body: any = null;
  private _params: Record<string, string> = {};
  private _headers: Record<string, string> = {};
  private _single: boolean = false;
  private _maybeSingle: boolean = false;
  private _returnData: boolean = false;

  constructor(table: string) {
    this._table = table;
  }

  private _clone(): QueryBuilder {
    const q = new QueryBuilder(this._table);
    q._method = this._method;
    q._body = this._body;
    q._params = { ...this._params };
    q._headers = { ...this._headers };
    q._single = this._single;
    q._maybeSingle = this._maybeSingle;
    q._returnData = this._returnData;
    return q;
  }

  private _buildUrl(): string {
    const params = new URLSearchParams(this._params);
    const str = params.toString();
    return str ? `${BASE_URL}/${this._table}?${str}` : `${BASE_URL}/${this._table}`;
  }

  private async _execute(): Promise<{ data: any; error: any }> {
    try {
      const headers = { ...getAuthHeaders(), ...this._headers };
      if (this._returnData) {
        // Append return=representation without overwriting resolution= set by upsert()
        const existing = headers['Prefer'];
        headers['Prefer'] = existing
          ? `${existing},return=representation`
          : 'return=representation';
      }
      if (this._single) headers['Accept'] = 'application/vnd.pgrst.object+json';

      const resp = await fetch(this._buildUrl(), {
        method: this._method,
        headers,
        body: this._body != null ? JSON.stringify(this._body) : undefined,
      });

      if (resp.status === 204) return { data: this._returnData ? [] : null, error: null };
      // PostgREST returns 406 when Accept: application/vnd.pgrst.object+json but 0 rows found
      if (resp.status === 406 && this._single) return { data: null, error: null };

      const text = await resp.text();
      let parsed: any = null;
      try { parsed = text ? JSON.parse(text) : null; } catch { parsed = text; }

      if (!resp.ok) return { data: null, error: parsed };
      // maybeSingle: limit(1) → unwrap first element or null (no 406)
      if (this._maybeSingle && Array.isArray(parsed)) return { data: parsed[0] ?? null, error: null };
      // single: unwrap array if PostgREST returns one
      if (this._single && Array.isArray(parsed)) return { data: parsed[0] ?? null, error: null };
      return { data: parsed, error: null };
    } catch (err: any) {
      return { data: null, error: { message: err.message } };
    }
  }

  // Make the builder thenable (await-able)
  then(resolve: (val: any) => any, reject?: (err: any) => any): Promise<any> {
    return this._execute().then(resolve, reject);
  }
  catch(reject: (err: any) => any): Promise<any> {
    return this._execute().catch(reject);
  }

  // SELECT
  select(cols: string = '*') {
    const q = this._clone();
    // PostgREST cannot parse whitespace (newlines/spaces) in the select parameter
    // when URL-encoded (e.g., %0A from template literals). Strip all whitespace.
    q._params['select'] = cols.replace(/\s+/g, '');
    return q;
  }

  // FILTERS
  eq(col: string, val: any) {
    const q = this._clone();
    q._params[col] = `eq.${val}`;
    return q;
  }
  neq(col: string, val: any) {
    const q = this._clone();
    q._params[col] = `neq.${val}`;
    return q;
  }
  gt(col: string, val: any) {
    const q = this._clone();
    q._params[col] = `gt.${val}`;
    return q;
  }
  gte(col: string, val: any) {
    const q = this._clone();
    q._params[col] = `gte.${val}`;
    return q;
  }
  lt(col: string, val: any) {
    const q = this._clone();
    q._params[col] = `lt.${val}`;
    return q;
  }
  lte(col: string, val: any) {
    const q = this._clone();
    q._params[col] = `lte.${val}`;
    return q;
  }
  is(col: string, val: any) {
    const q = this._clone();
    q._params[col] = `is.${val}`;
    return q;
  }
  in(col: string, vals: any[]) {
    const q = this._clone();
    q._params[col] = `in.(${vals.join(',')})`;
    return q;
  }
  contains(col: string, val: any) {
    const q = this._clone();
    q._params[col] = `cs.${JSON.stringify(val)}`;
    return q;
  }
  ilike(col: string, pattern: string) {
    const q = this._clone();
    q._params[col] = `ilike.${pattern}`;
    return q;
  }
  not(col: string, op: string, val: any) {
    const q = this._clone();
    q._params[col] = `not.${op}.${val}`;
    return q;
  }
  or(filters: string) {
    const q = this._clone();
    q._params['or'] = `(${filters})`;
    return q;
  }

  // ORDER / PAGINATION
  order(col: string, opts?: { ascending?: boolean; nullsFirst?: boolean }) {
    const q = this._clone();
    const dir = opts?.ascending === false ? 'desc' : 'asc';
    const nulls = opts?.nullsFirst ? '.nullsfirst' : '';
    q._params['order'] = `${col}.${dir}${nulls}`;
    return q;
  }
  limit(n: number) {
    const q = this._clone();
    q._params['limit'] = String(n);
    return q;
  }
  range(from: number, to: number) {
    const q = this._clone();
    q._headers['Range'] = `${from}-${to}`;
    return q;
  }

  // SINGLE ROW
  single() {
    const q = this._clone();
    q._single = true;
    return q;
  }
  maybeSingle() {
    const q = this._clone();
    q._maybeSingle = true;
    q._params['limit'] = '1';
    return q;
  }

  // MUTATIONS
  insert(data: any) {
    const q = this._clone();
    q._method = 'POST';
    q._body = data;
    q._returnData = true;
    return q;
  }
  upsert(data: any, opts?: { onConflict?: string; ignoreDuplicates?: boolean }) {
    const q = this._clone();
    q._method = 'POST';
    q._body = data;
    q._returnData = true;
    q._headers['Prefer'] = `resolution=${opts?.ignoreDuplicates ? 'ignore' : 'merge'}-duplicates`;
    if (opts?.onConflict) q._params['on_conflict'] = opts.onConflict;
    return q;
  }
  update(data: any) {
    const q = this._clone();
    q._method = 'PATCH';
    q._body = data;
    q._returnData = true;
    return q;
  }
  delete() {
    const q = this._clone();
    q._method = 'DELETE';
    q._returnData = false;
    return q;
  }
}

function decodeLocalUser(): { id: string; email: string } | null {
  try {
    const token = localStorage.getItem('auth_token');
    if (!token) return null;
    // JWT is base64url — decode the payload (second segment)
    const b64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(atob(b64));
    if (!payload?.sub) return null;
    return { id: payload.sub, email: payload.email || '' };
  } catch {
    return null;
  }
}

class LocalSupabaseClient {
  auth = {
    getUser: async () => {
      const user = decodeLocalUser();
      return { data: { user }, error: null };
    },
    signInWithPassword: async () => ({ data: null, error: new Error('Use local API') }),
    signUp: async () => ({ data: null, error: new Error('Use local API') }),
    signOut: async () => ({ data: null, error: null }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
  };

  from(table: string) {
    return new QueryBuilder(table);
  }

  // Local file storage via backend /api/sounds/* endpoints
  storage = {
    from: (_bucket: string) => ({
      upload: async (filePath: string, file: File | Blob) => {
        try {
          const token = localStorage.getItem('auth_token');
          const arrayBuffer = await (file as Blob).arrayBuffer();
          const bytes = new Uint8Array(arrayBuffer);
          let binary = '';
          for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
          const contentBase64 = btoa(binary);
          const mimeType = (file as File).type || 'audio/mpeg';
          const response = await fetch('/api/sounds/upload', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({ fileName: filePath, contentBase64, mimeType }),
          });
          const text = await response.text();
          let data: any = null;
          try { data = text ? JSON.parse(text) : null; } catch { /* non-JSON body */ }
          if (!response.ok) return { data: null, error: new Error(data?.error || `Upload falhou (${response.status})`) };
          return { data: { path: filePath }, error: null };
        } catch (err: any) {
          return { data: null, error: err };
        }
      },
      remove: async (paths: string[]) => {
        try {
          const token = localStorage.getItem('auth_token');
          for (const p of paths) {
            await fetch(`/api/sounds/file/${p}`, {
              method: 'DELETE',
              headers: token ? { Authorization: `Bearer ${token}` } : {},
            });
          }
          return { data: null, error: null };
        } catch (err: any) {
          return { data: null, error: err };
        }
      },
      getPublicUrl: (filePath: string) => ({ data: { publicUrl: `/api/sounds/file/${filePath}` } }),
    }),
  };

  rpc(name: string, params?: any) {
    const headers = { ...getAuthHeaders(), 'Content-Type': 'application/json' };
    return fetch(`/rest/v1/rpc/${name}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(params || {}),
    })
      .then(async r => {
        const data = await r.json().catch(() => null);
        return r.ok ? { data, error: null } : { data: null, error: data };
      })
      .catch(err => ({ data: null, error: { message: err.message } }));
  }

  // Realtime channels (no-op — realtime not supported locally)
  channel(name: string) {
    const ch: any = {
      on: () => ch,
      subscribe: () => ({ unsubscribe: () => {} }),
      unsubscribe: async () => ({}),
    };
    return ch;
  }
  removeChannel() {}
  removeAllChannels() {}

  // functions.invoke → local backend endpoint
  functions = {
    invoke: async (functionName: string, options?: { body?: any }) => {
      try {
        const token = localStorage.getItem('auth_token');
        const response = await fetch(`/api/functions/${functionName}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
          },
          body: JSON.stringify(options?.body || {}),
        });
        const data = await response.json();
        if (!response.ok) return { data: null, error: new Error(data.error || 'Function error') };
        return { data, error: null };
      } catch (err: any) {
        return { data: null, error: err };
      }
    },
  };
}

export const supabase = new LocalSupabaseClient() as unknown as ReturnType<typeof import('@supabase/supabase-js').createClient<Database>>;
