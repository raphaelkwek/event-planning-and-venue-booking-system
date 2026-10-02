import { required } from "../../shared/config.js";

/** Settings only the identity module reads: the Supabase Auth client's. */
export const identityConfig = {
  supabaseUrl: required("SUPABASE_URL"),
  supabaseAnonKey: required("SUPABASE_ANON_KEY"),
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
};
