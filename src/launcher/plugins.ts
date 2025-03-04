import Hyprland from "gi://AstalHyprland";
import Apps from "gi://AstalApps";
import config from "../config";
import { subprocess } from "astal";
import { sortByRelevancy } from "./sorter";

export interface LauncherEntry {
  iconName: string;
  name: string;
  description?: string;
  label?: string;
  keywords?: string[];
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

class Hypr implements LauncherPlugin {
  name = "Hypr";
  command = "!h";
  hypr = Hyprland.get_default();
  apps: {
    [key: string]: {
      name: string;
      icon: string;
    };
  };

  constructor() {
    const x = new Apps.Apps();
    this.apps = x.get_list().reduce<Hypr["apps"]>((acc, app) => {
      const entry = app.entry.replace(/.desktop$/, "");
      acc[entry] = { icon: app.iconName, name: app.name };
      return acc;
    }, {});
  }

  query(query: string): LauncherEntry[] {
    return sortByRelevancy(
      query,
      this.hypr.clients
        .sort((a, b) => a.get_focus_history_id() - b.get_focus_history_id())
        .map((client) => {
          const app = this.apps[client.get_class().toLowerCase()];
          const workspace = client.get_workspace();

          if (app) {
            return {
              iconName: app.icon,
              name: app.name,
              label: workspace.get_name(),
              description: client.get_title(),
              action: () => client.focus(),
            };
          } else {
            const title = client.get_title();
            const initTitle = client.get_initial_title() || title;
            const hasUpdatedTitle = initTitle !== title;

            return {
              iconName: "application-x-executable-symbolic",
              name: hasUpdatedTitle ? initTitle : title,
              label: workspace.get_name(),
              description: hasUpdatedTitle ? title : undefined,
              action: () => client.focus(),
            };
          }
        }),
    );
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
        keywords: ["logout"],
        action: () => subprocess("loginctl lock-session"),
      },
      {
        iconName: "system-shutdown-custom-symbolic",
        name: "Shutdown",
        keywords: ["poweroff"],
        action: () => subprocess("systemctl poweroff"),
      },
      {
        iconName: "system-reboot-custom-symbolic",
        name: "Reboot",
        keywords: ["restart"],
        action: () => subprocess("systemctl reboot"),
      },
      {
        iconName: "system-hibernate-custom-symbolic",
        name: "Hibernate",
        keywords: ["sleep"],
        action: () => subprocess("systemctl hibernate"),
      },
      {
        iconName: "system-suspend-custom-symbolic",
        name: "Suspend",
        keywords: ["sleep"],
        action: () => subprocess("systemctl suspend"),
      },
    ]);
  }
}

export const defaultPlugin = new AppLauncher();
export const launcherPlugins = [new Hypr(), new Power()];

export const parseQuery = (rawQuery: string): [LauncherPlugin, string] => {
  const query = rawQuery.split(" ");
  const plugin = launcherPlugins.find((p) => p.command === query[0]);
  if (!plugin) {
    return [defaultPlugin, rawQuery];
  }
  return [plugin, query.slice(1).join(" ")];
};
