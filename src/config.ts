import GLib from "gi://GLib";

type ignoreFn = (test: string) => boolean;

interface Config {
  monitor: {
    main: string;
  };
  notification: {
    ignore: ignoreFn[];
  };
  tray: {
    ignore: ignoreFn[];
  };
  launcher: {
    uwsm: boolean;
  };
}

const envArray = (name: string): string[] => {
  const value = GLib.getenv(name);
  if (!value) return [];
  return value.split(",");
};

const envIgnoreArray = (name: string): ignoreFn[] => {
  return envArray(name).map((r: string) => {
    if (r.startsWith("/")) {
      return new RegExp(r.slice(1, -1)).test;
    }
    return (test: string) => test === r;
  });
};

export default {
  monitor: {
    main: GLib.getenv("FIREPROOF_PRIMARY_MONITOR") || "",
  },
  notification: {
    ignore: envIgnoreArray("FIREPROOF_NOTIFICATION_IGNORE"),
  },
  tray: {
    ignore: envIgnoreArray("FIREPROOF_TRAY_IGNORE"),
  },
  launcher: {
    uwsm: GLib.getenv("FIREPROOF_LAUNCHER_UWSM") === "true",
  },
} as Config;
