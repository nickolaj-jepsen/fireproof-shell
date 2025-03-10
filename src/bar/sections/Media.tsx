import Mpris from "gi://AstalMpris";
import Pango from "gi://Pango?version=1.0";
import { type Binding, Variable, bind } from "astal";
import type { Subscribable } from "astal/binding";
import { Gdk, Gtk } from "astal/gtk4";
import { hasIcon } from "../../utils/gtk";
import { Expander, Separator } from "../../widgets";
import { connectDropdown } from "./Dropdown";

const mpris = Mpris.get_default();
const MARQUEE_LENGTH = 30;

interface MprisStatus {
  status: Mpris.PlaybackStatus;
  lastPlayed: number;
  canControl: boolean;
  position: number;
  length: number;
}

class ActiveMediaDetector implements Subscribable {
  #userOverride: string | undefined;
  #players: { [busName: string]: MprisStatus } = {};
  #listenerSignal = new Map<Mpris.Player, number>();
  #active = Variable<Mpris.Player | undefined>(undefined);

  #updateActive() {
    const busName = Object.entries<MprisStatus>(this.#players)
      .filter(([, status]) => {
        // Don't consider players that are stopped or can't be controlled
        if (status.status === Mpris.PlaybackStatus.STOPPED) {
          return false;
        }
        // Most likely a live stream or something weird
        if (status.position >= status.length) {
          return false;
        }
        if (status.length <= 0 || status.position < 0) {
          return false;
        }
        // If the media is longer than an hour, it's probably not a song
        if (status.length > 60 * 60) {
          return false;
        }
        return status.canControl;
      })
      .sort(([aName, a], [bName, b]) => {
        if (aName === this.#userOverride) {
          return -1;
        }

        if (bName === this.#userOverride) {
          return 1;
        }

        if (
          a.status === Mpris.PlaybackStatus.PLAYING &&
          b.status !== Mpris.PlaybackStatus.PLAYING
        ) {
          return -1;
        }

        if (
          b.status === Mpris.PlaybackStatus.PLAYING &&
          a.status !== Mpris.PlaybackStatus.PLAYING
        ) {
          return 1;
        }

        return b.lastPlayed - a.lastPlayed;
      })[0]?.[0];
    const player = busName
      ? mpris.get_players().find((player) => player.bus_name === busName)
      : undefined;
    this.#active.set(player);
  }

  #handleUpdate(player: Mpris.Player) {
    const lastStatus = this.#players[player.bus_name]?.status;
    let lastPlayed = this.#players[player.bus_name]?.lastPlayed ?? -1;

    // If the player is playing (or was just playing), update the last played time
    if (
      player.playback_status === Mpris.PlaybackStatus.PLAYING ||
      lastStatus === Mpris.PlaybackStatus.PLAYING
    ) {
      lastPlayed = Date.now();
    }

    this.#players[player.bus_name] = {
      status: player.playback_status,
      lastPlayed: lastPlayed,
      canControl: player.can_control,
      position: player.position,
      length: player.length,
    };
    this.#updateActive();
  }

  #connect(player: Mpris.Player) {
    const signal = player.connect("notify::playback-status", () => {
      this.#handleUpdate(player);
    });

    this.#listenerSignal.set(player, signal);
  }

  #disconnect(player: Mpris.Player) {
    const signal = this.#listenerSignal.get(player);
    if (signal) {
      player.disconnect(signal);
      this.#listenerSignal.delete(player);
    }
  }

  constructor() {
    for (const player of mpris.players) {
      this.#handleUpdate(player);
      this.#connect(player);
    }

    mpris.connect("player-added", (_, player) => {
      this.#handleUpdate(player);
      this.#connect(player);
    });

    mpris.connect("player-closed", (_, player) => {
      delete this.#players[player.bus_name];
      this.#disconnect(player);
    });
  }

  get override() {
    return this.#userOverride;
  }
  set override(busName: string | undefined) {
    this.#userOverride = busName;
    this.#updateActive();
  }

  get(): Mpris.Player | undefined {
    return this.#active.get();
  }

  subscribe(callback: (value: Mpris.Player | undefined) => void): () => void {
    return this.#active.subscribe(callback);
  }
}

const formatTime = (time: number) => {
  const hours = Math.floor(time / 3600);
  const minutes = Math.floor((time % 3600) / 60)
    .toString()
    .padStart(2, "0");
  const seconds = Math.floor(time % 60)
    .toString()
    .padStart(2, "0");
  return `${hours > 0 ? `${hours}:` : ""}${minutes}:${seconds}`;
};

interface MediaDropdownProps {
  activePlayer: Binding<Mpris.Player | undefined>;
  onOverride: (busName: string) => void;
}

function MediaDropdown({ activePlayer, onOverride }: MediaDropdownProps) {
  const allPlayers = bind(mpris, "players");

  return (
    <box cssClasses={["MediaDropdown"]} vertical spacing={5}>
      {activePlayer.as((player) => {
        if (!player) {
          return null;
        }

        return (
          <>
            <image
              file={bind(player, "coverArt")}
              visible={Boolean(bind(player, "coverArt"))}
              cssClasses={["MediaCover"]}
              pixelSize={220}
            />
            <label
              label={bind(player, "title")}
              ellipsize={Pango.EllipsizeMode.END}
              maxWidthChars={30}
              justify={Gtk.Justification.CENTER}
              lines={2}
              visible={Boolean(bind(player, "title"))}
              cssClasses={["MediaTitle"]}
            />
            <label
              label={bind(player, "artist")}
              ellipsize={Pango.EllipsizeMode.END}
              justify={Gtk.Justification.CENTER}
              maxWidthChars={30}
              visible={Boolean(bind(player, "artist"))}
              cssClasses={["MediaArtist"]}
            />
            <label
              label={bind(player, "album")}
              ellipsize={Pango.EllipsizeMode.END}
              justify={Gtk.Justification.CENTER}
              maxWidthChars={30}
              wrap={true}
              visible={Boolean(bind(player, "album"))}
              cssClasses={["MediaAlbum"]}
            />
            <slider
              cssClasses={["Slider"]}
              hexpand
              min={0}
              max={bind(player, "length")}
              onChangeValue={({ value }) => {
                player.position = value;
              }}
              value={bind(player, "position")}
            />
            <centerbox hexpand>
              <label
                halign={Gtk.Align.START}
                label={bind(player, "position").as(formatTime)}
              />
              <box
                cssClasses={["MediaControls"]}
                spacing={10}
                halign={Gtk.Align.CENTER}
              >
                <button
                  cssClasses={["button"]}
                  cursor={Gdk.Cursor.new_from_name("pointer", null)}
                  onClicked={() => player.previous()}
                >
                  <image iconName="media-skip-backward-symbolic" />
                </button>
                <button
                  cssClasses={["button"]}
                  cursor={Gdk.Cursor.new_from_name("pointer", null)}
                  onClicked={() => player.play_pause()}
                >
                  <image
                    iconName={bind(player, "playbackStatus").as((s) =>
                      s === Mpris.PlaybackStatus.PLAYING
                        ? "media-playback-pause-symbolic"
                        : "media-playback-start-symbolic",
                    )}
                  />
                </button>
                <button
                  cssClasses={["button"]}
                  cursor={Gdk.Cursor.new_from_name("pointer", null)}
                  onClicked={() => player.next()}
                >
                  <image iconName="media-skip-forward-symbolic" />
                </button>
              </box>
              <label
                halign={Gtk.Align.END}
                label={bind(player, "length").as(formatTime)}
              />
            </centerbox>
          </>
        );
      })}
      <Separator visible={allPlayers.as((players) => players.length > 1)} />
      <Expander
        label={"Other media players"}
        visible={allPlayers.as((players) => players.length > 1)}
      >
        <box vertical spacing={10} cssClasses={["MediaOther"]}>
          {allPlayers.as((players) => {
            return players.map((p) => (
              <button
                cursor={Gdk.Cursor.new_from_name("pointer", null)}
                onClicked={() => onOverride(p.bus_name)}
                cssClasses={activePlayer.as((player) => {
                  return p.bus_name === player?.bus_name
                    ? ["active", "button"]
                    : ["button"];
                })}
              >
                <label label={p.identity} />
              </button>
            ));
          })}
        </box>
      </Expander>
    </box>
  );
}

interface MediaProps {
  monitor: Gdk.Monitor;
}

export default function Media({ monitor }: MediaProps) {
  const activeMedia = new ActiveMediaDetector();
  const activePlayer = bind(activeMedia);

  return (
    <box
      cssClasses={["Media"]}
      spacing={10}
      setup={(self) =>
        connectDropdown(
          self,
          <MediaDropdown
            activePlayer={activePlayer}
            onOverride={(busName) => {
              if (activeMedia.override === busName) {
                activeMedia.override = undefined;
              } else {
                activeMedia.override = busName;
              }
            }}
          />,
          monitor,
          { fullWidth: true },
        )
      }
      visible={activePlayer.as(Boolean)}
    >
      {activePlayer.as((player) => {
        if (!player) {
          return;
        }

        const icon = bind(player, "entry").as((e) =>
          hasIcon(e) ? e : "audio-x-generic-symbolic",
        );

        const marqueeOffset = Variable(0).poll(100, (offset) => {
          return offset + 1;
        });

        // show marquee for the first and last 10 seconds of a song
        const showMarquee = Variable.derive(
          [
            bind(player, "length"),
            bind(player, "position"),
            bind(player, "playbackStatus"),
          ],
          (length, position, status) => {
            if (status !== Mpris.PlaybackStatus.PLAYING) {
              return false;
            }
            return position < 10 || length - position < 10;
          },
        );
        showMarquee.subscribe((show) => {
          if (show) {
            marqueeOffset.poll(100, (offset) => {
              return offset + 1;
            });
          } else {
            marqueeOffset.stopPoll();
          }
        });
        bind(player, "title").subscribe(() => marqueeOffset.set(0));

        const marquee = Variable.derive(
          [bind(player, "title"), bind(player, "artist"), bind(marqueeOffset)],
          (title, artist, mo) => {
            const safeTitle = title || "Unknown Title";
            const safeArtist = artist || "Unknown Artist";
            const line = `${safeTitle} - ${safeArtist} `;

            if (line.length <= MARQUEE_LENGTH) {
              // Properly center short text
              const padding = Math.floor((MARQUEE_LENGTH - line.length) / 2);
              return (
                " ".repeat(padding) +
                line +
                " ".repeat(MARQUEE_LENGTH - line.length - padding)
              );
            }

            // Create a seamless loop by duplicating the text multiple times
            const repeatedText = line.repeat(3); // Repeat 3 times for a smoother loop
            const offset = mo % line.length;
            return repeatedText.slice(offset, offset + MARQUEE_LENGTH);
          },
        );

        return (
          <>
            <image iconName={icon} />
            <stack
              visibleChildName={bind(showMarquee).as((show) =>
                show ? "marquee" : "progress",
              )}
              transitionType={Gtk.StackTransitionType.CROSSFADE}
              transitionDuration={200}
            >
              <box name={"progress"} spacing={10}>
                <label label={bind(player, "position").as(formatTime)} />
                <slider
                  cssClasses={["Slider"]}
                  hexpand
                  min={0}
                  max={bind(player, "length")}
                  onChangeValue={({ value }) => {
                    const player = activePlayer.get();
                    if (player) {
                      player.position = value;
                    }
                  }}
                  value={bind(player, "position")}
                />
                <label label={bind(player, "length").as(formatTime)} />
              </box>
              <label
                name={"marquee"}
                label={bind(marquee)}
                maxWidthChars={MARQUEE_LENGTH}
              />
            </stack>
          </>
        );
      })}
    </box>
  );
}
