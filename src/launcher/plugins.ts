import Hyprland from "gi://AstalHyprland";
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

class Hypr implements LauncherPlugin {
  name = "Hypr";
  command = "!h";
  hypr = Hyprland.get_default();

  // These calculate classes are a mess, but thats a problem for future me
  private calculateIconName(client: Hyprland.Client): string {
    const initial_title = client.get_initial_title();
    if (initial_title === "Visual Studio Code") return "com.visualstudio.code";

    return client.get_class();
  }

  private calculateName(client: Hyprland.Client): string {
    const className = client.get_class();
    const initial_class = client.get_initial_class();

    if (className === "com.mitchellh.ghostty") return "Ghostty";
    if (initial_class === "sublime_merge") return "Sublime Merge";

    return client.get_initial_title() || client.get_title();
  }

  private calculateDescription(client: Hyprland.Client): string {
    return client.get_title();
  }

  query(query: string): LauncherEntry[] {
    return sortByRelevancy(
      query,
      this.hypr.clients
        .sort((a, b) => a.get_focus_history_id() - b.get_focus_history_id())
        .map((client) => {
          const name = this.calculateName(client);
          const description = this.calculateDescription(client);

          return {
            iconName: this.calculateIconName(client),
            name,
            description: description === name ? undefined : description,
            action: () => client.focus(),
          };
        })
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
export const launcherPlugins = [new Hypr(), new Power()];

export const parseQuery = (rawQuery: string): [LauncherPlugin, string] => {
  const query = rawQuery.split(" ");
  const plugin = launcherPlugins.find((p) => p.command === query[0]);
  if (!plugin) {
    return [defaultPlugin, rawQuery];
  }
  return [plugin, query.slice(1).join(" ")];
};
