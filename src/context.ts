import { loadConfig, type AppConfig } from "./config/config.js";
import { AsepriteCli } from "./aseprite/cli.js";
import { AsepriteDiscovery } from "./aseprite/discovery.js";
import { LuaRunner } from "./aseprite/lua-runner.js";
import { PathSecurity } from "./security/path-security.js";
import { FileLockManager } from "./security/file-lock-manager.js";

export interface AppContext {
  config: AppConfig;
  paths: PathSecurity;
  discovery: AsepriteDiscovery;
  cli: AsepriteCli;
  lua: LuaRunner;
  locks: FileLockManager;
}

export async function createContext(): Promise<AppContext> {
  const config = await loadConfig();
  const paths = new PathSecurity(config);
  const discovery = new AsepriteDiscovery(config);
  const cli = new AsepriteCli(config, discovery);
  return {
    config,
    paths,
    discovery,
    cli,
    lua: new LuaRunner(config, cli),
    locks: new FileLockManager(),
  };
}
