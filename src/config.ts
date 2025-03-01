import { readFile } from "astal";
import GLib from "gi://GLib";
import { mergeDeep } from "./utils/merge";

type ignoreFn = (test: string) => boolean;

interface Config {
  monitor: {
    main: string;
  };
  notification: {
    ignore: string[];
  };
  tray: {
    ignore: string[];
  };
  launcher: {
    uwsm: boolean;
  };
}

const DEFAULT: Config = {
  monitor: {
    main: "",
  },
  notification: {
    ignore: [],
  },
  tray: {
    ignore: [],
  },
  launcher: {
    uwsm: false,
  },
};

const parseConfig = (): Config => {
  const configs: Config[] = [];

  const systemConfig = readFile("/etc/fireproof-shell/config.json");
  if (systemConfig) {
    configs.push(JSON.parse(systemConfig));
  }

  const result = mergeDeep(DEFAULT, ...configs);
  console.log("Config:", result);
  return result;
};

export default parseConfig();
