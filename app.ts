import { App } from "astal/gtk4";
import css from "./src/main.scss";
import { getMonitors } from "./src/utils/monitors";
import Launcher, { openLauncher } from "./src/launcher/Launcher";
import NotificationPopups from "./src/notification/NotificationPopups";
import Bar from "./src/bar/Bar";
import SecondaryBar from "./src/bar/SecondaryBar";

const HELP_TEXT = `
fireproof-shell

Usage:
  fireproof-shell [command]

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
    if (request == "launcher") {
      openLauncher();
      res("launcher opened");
    } else {
      res(HELP_TEXT);
    }
  },
});
