import Notifd from "gi://AstalNotifd";
import { GLib, timeout } from "astal";
import { type Astal, Gtk } from "astal/gtk4";
import { hook } from "astal/gtk4";
import { Separator } from "../widgets";
import Pango from "gi://Pango?version=1.0";

const ANIMATION_DURATION = 500;

const fileExists = (path: string) => GLib.file_test(path, GLib.FileTest.EXISTS);
const time = (time: number, format = "%H:%M") =>
  // biome-ignore lint/style/noNonNullAssertion: <explanation>
  GLib.DateTime.new_from_unix_local(time).format(format)!;

const urgency = (urgency: Notifd.Urgency) => {
  if (urgency === Notifd.Urgency.LOW) return "low";
  if (urgency === Notifd.Urgency.CRITICAL) return "critical";
  return "normal";
};

type Props = {
  notification: Notifd.Notification;
};

const resolveImageProps = (image?: string) => {
  if (!image) {
    return { visible: false };
  }
  if (fileExists(image)) {
    return { file: image };
  }
  return { iconName: image };
};

export default function Notification({ notification: n }: Props) {
  const icon = n.appIcon || n.desktopEntry;
  return (
    <box
      cssClasses={["notification", urgency(n.urgency)]}
      onButtonReleased={(_, asdf) => {
        n.dismiss();
      }}
      spacing={10}
    >
      <image
        {...resolveImageProps(
          n.summary === "message"
            ? "/home/nickolaj/Downloads/billigvvs.dk.png"
            : n.image,
        )}
        pixelSize={160}
        halign={Gtk.Align.START}
        valign={Gtk.Align.START}
        cssClasses={["notification__image"]}
      />
      <box vertical spacing={10} cssClasses={["notification__content"]} hexpand>
        <box cssClasses={["header"]} spacing={10}>
          <image cssClasses={["app-icon"]} {...resolveImageProps(icon)} />
          <label
            cssClasses={["app-name"]}
            ellipsize={Pango.EllipsizeMode.END}
            label={n.appName || "Unknown"}
            hexpand
            halign={Gtk.Align.START}
          />
          <label
            cssClasses={["time"]}
            halign={Gtk.Align.END}
            label={time(n.time)}
          />
        </box>
        <Separator />
        <box cssClasses={["content"]} vertical spacing={10} hexpand>
          <label
            cssClasses={["notification__summary"]}
            label={n.summary}
            hexpand
            xalign={0}
            maxWidthChars={1}
            ellipsize={Pango.EllipsizeMode.END}
          />
          {n.body && (
            <label
              cssClasses={["body"]}
              useMarkup
              label={n.body}
              wrap
              wrapMode={Pango.WrapMode.WORD}
              hexpand
              lines={3}
              xalign={0}
              maxWidthChars={1}
              ellipsize={Pango.EllipsizeMode.END}
            />
          )}
          {n.get_actions().length > 0 && (
            <box
              cssClasses={["actions"]}
              halign={Gtk.Align.CENTER}
              spacing={10}
              vertical={n.get_actions().length > 2}
            >
              {n.get_actions().map(({ label, id }) => (
                <button
                  onClicked={(eve) => {
                    n.invoke(id);
                  }}
                  cssClasses={["large"]}
                >
                  <label label={label} maxWidthChars={20} wrap />
                </button>
              ))}
            </box>
          )}
        </box>
      </box>
    </box>
  );
}
