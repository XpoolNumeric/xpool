// TypeScript Shims for Supabase Edge Functions (Deno) in VS Code/Cursor

declare namespace Deno {
  export interface Env {
    get(key: string): string | undefined;
  }
  export const env: Env;

  export function serve(
    handler: (request: Request) => Response | Promise<Response> | any,
    options?: any
  ): any;
}

declare module "https://deno.land/std@0.168.0/http/server.ts" {
  export function serve(
    handler: (request: Request) => Response | Promise<Response> | any,
    options?: any
  ): any;
}

declare module "https://deno.land/std@0.203.0/encoding/hex.ts" {
  export function encodeHex(data: ArrayBuffer | Uint8Array): string;
}

declare module "https://esm.sh/@supabase/supabase-js@2.45.0" {
  export * from "@supabase/supabase-js";
}

declare module "https://esm.sh/@supabase/supabase-js@2.39.0" {
  export * from "@supabase/supabase-js";
}

declare module "https://esm.sh/@supabase/supabase-js@2" {
  export * from "@supabase/supabase-js";
}
