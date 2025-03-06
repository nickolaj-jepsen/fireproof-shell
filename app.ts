import { App } from "astal/gtk4";
import css from "./src/main.scss";
import { getMonitors } from "./src/utils/monitors";
import Launcher, { openLauncher } from "./src/launcher/Launcher";
import NotificationPopups from "./src/notification/NotificationPopups";
import Bar from "./src/bar/Bar";
import SecondaryBar from "./src/bar/SecondaryBar";
import { launcherPlugins } from "./src/launcher/plugins";

const HELP_TEXT = `fireproof-shell (over astal ipc)

Usage:
  astal [command]

Commands:
  launcher  Open the launcher
`;

App.start({
  css,
  icons: "./icons",
  main: () => {
    const { main, secondary } = getMonitors();

    NotificationPopups(main);
    Launcher();

    Bar(main);
    for (const monitor of secondary) {
      SecondaryBar(monitor, monitor.relation);
    }
  },
  requestHandler(request: string, res: (response: any) => void) {
    const args = request.split(" ");
    if (args[0] === "launcher") {
      const query = args.slice(1).join(" ");

      const launcherPlugin = launcherPlugins.find((p) => p.command === query);
      if (launcherPlugin) {
        openLauncher(`${launcherPlugin.command} `);
        return res(`launcher opened with plugin: ${launcherPlugin.name}`);
      }

      openLauncher(query);
      return res("launcher opened");
    }

    return res(HELP_TEXT);
  },
});
