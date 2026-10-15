import path from "path";

// Never discover content in a parent directory. Private vaults require explicit opt-in.
export const VAULT_ROOT = process.env.VAULT_PATH
  ? path.resolve(process.env.VAULT_PATH)
  : path.resolve(process.cwd(), "../examples/vault");
