{
  description = "Description for the project";

  inputs = {
    flake-parts.url = "github:hercules-ci/flake-parts";
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    # astal.url = "github:aylur/astal";
    # astal.inputs.nixpkgs.follows = "nixpkgs";
    ags.url = "github:aylur/ags";
    ags.inputs.nixpkgs.follows = "nixpkgs";
    treefmt-nix.url = "github:numtide/treefmt-nix";
  };

  outputs = inputs @ {
    flake-parts,
    ags,
    treefmt-nix,
    self,
    ...
  }:
    flake-parts.lib.mkFlake {inherit inputs;} {
      imports = [
        treefmt-nix.flakeModule
        flake-parts.flakeModules.easyOverlay
      ];

      systems = ["x86_64-linux" "aarch64-linux" "aarch64-darwin" "x86_64-darwin"];

      perSystem = {
        config,
        pkgs,
        system,
        ...
      }: {
        overlayAttrs = {
          inherit (config.packages) fireproof-shell;
        };

        packages.fireproof-shell = ags.lib.bundle {
          inherit pkgs;
          src = ./.;
          name = "fireproof-shell";
          gtk4 = true;
          entry = "app.ts";
          extraPackages = with ags.packages.${pkgs.system}; [
            battery
            bluetooth
            hyprland
            network
            tray
            notifd
            mpris
            wireplumber
          ];
        };

        treefmt = {
          projectRootFile = "flake.nix";
          programs = {
            deadnix.enable = true;
            alejandra.enable = true;
            statix.enable = true;
            just.enable = true;
            prettier.enable = true;
            fish_indent.enable = true;
          };
          settings.global.excludes = [
            "*.svg"
            "node_modules/*"
          ];
        };
        formatter = config.treefmt.build.wrapper;
      };

      flake = {
        nixosModules.default = {
          pkgs,
          lib,
          config,
          ...
        }: let
          cfg = config.programs.fireproof-shell;
        in {
          options.programs.fireproof-shell = {
            enable = lib.mkEnableOption "Enable fireproof-shell";
            systemd = lib.mkOption {
              type = lib.types.bool;
              default = false;
            };

            package = lib.mkOption {
              type = lib.types.package;
              default = self.packages.${pkgs.system}.fireproof-shell;
            };

            monitor.primary = lib.mkOption {
              type = lib.types.str;
              default = "";
              example = "DP-1";
            };

            notification.ignores = lib.mkOption {
              type = lib.types.listOf lib.types.str;
              default = [];
              example = ["/^Spotify/"];
            };

            tray.ignore = lib.mkOption {
              type = lib.types.listOf lib.types.str;
              default = [];
              example = ["/spotify/"];
            };
          };
          config = {
            systemd.user.services = lib.mkIf cfg.systemd {
              fireproof-shell = {
                unitConfig = {
                  Description = "fireproof-shell";
                  Documentation = "https://github.com/nickolaj-jepsen/fireproof-shell";
                  After = ["graphical-session.target"];
                };

                serviceConfig = {
                  ExecStart = "${cfg.package}/bin/fireproof-shell";
                  Restart = "on-failure";
                  KillMode = "mixed";
                  # Environment = [
                  #   "ASTRAL_PRIMARY_MONITOR=${cfg.monitors.primary}"
                  #   "ASTRAL_NOTIFICATION_IGNORE=${lib.concatStringsSep "," cfg.notification.ignores}"
                  #   "ASTRAL_TRAY_IGNORE=${lib.concatStringsSep "," cfg.tray.ignore}"
                  # ];
                };
                environment = {
                  ASTRAL_PRIMARY_MONITOR = cfg.monitor.primary;
                  ASTRAL_NOTIFICATION_IGNORE = lib.concatStringsSep "," cfg.notification.ignores;
                  ASTRAL_TRAY_IGNORE = lib.concatStringsSep "," cfg.tray.ignore;
                };
                wantedBy = ["graphical-session.target"];
              };
            };
          };
        };
      };
    };
}
