import Apps from "gi://AstalApps";
import config from "../config";
import { subprocess } from "astal";
import { sortByRelevancy } from "./sorter";

export interface LauncherEntry {
  iconName: string;
  name: string;
  description?: string;
  action: () => void;
}

export interface LauncherPlugin {
  name: string;
  command: "<default>" | string;
  query: (query: string) => LauncherEntry[];
}

class AppLauncher implements LauncherPlugin {
  apps = new Apps.Apps();
  name = "Apps";
  command = "<default>";

  private launchApp(app: Apps.Application) {
    if (config.launcher.uwsm) {
      // When not app.launch(), we need to increase the frequency manually
      app.set_frequency(app.get_frequency() + 1);
      subprocess("uwsm app -t service -- " + app.entry);
    } else {
      app.launch();
    }
  }

  query(query: string): LauncherEntry[] {
    return this.apps.exact_query(query).map((app) => ({
      iconName: app.iconName,
      name: app.name,
      description: app.description,
      action: () => this.launchApp(app),
    }));
  }
}

class Power implements LauncherPlugin {
  name = "Power";
  command = "!p";

  query(query: string): LauncherEntry[] {
    return sortByRelevancy(query, [
      {
        iconName: "system-log-out-custom-symbolic",
        name: "Lock",
        action: () => subprocess("loginctl lock-session"),
      },
      {
        iconName: "system-shutdown-custom-symbolic",
        name: "Shutdown",
        action: () => subprocess("systemctl poweroff"),
      },
      {
        iconName: "system-reboot-custom-symbolic",
        name: "Reboot",
        action: () => subprocess("systemctl reboot"),
      },
      {
        iconName: "system-suspend-custom-symbolic",
        name: "Suspend",
        action: () => subprocess("systemctl suspend"),
      },
      {
        iconName: "system-hibernate-custom-symbolic",
        name: "Hibernate",
        action: () => subprocess("systemctl hibernate"),
      },
    ]);
  }
}

export const defaultPlugin = new AppLauncher();
export const launcherPlugins = [new Power()];

export const parseQuery = (rawQuery: string): [LauncherPlugin, string] => {
  const query = rawQuery.split(" ");
  const plugin = launcherPlugins.find((p) => p.command === query[0]);
  if (!plugin) {
    return [defaultPlugin, rawQuery];
  }
  return [plugin, query.slice(1).join(" ")];
};
