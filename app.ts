import { App } from "astal/gtk4";
import main from "./src/main";
import css from "./src/main.scss";
import launcher from "./src/launcher";
import { getMonitors } from "./src/utils/monitors";

const monitors = getMonitors();

App.start({
  css,
  icons: "./icons",
  main: () => {
    main();
  },
  requestHandler(request: string, res: (response: any) => void) {
    if (request == "launch") {
      return launcher(monitors.main, () => res("launcher closed"));
    }
    res("unknown command");
  },
});
