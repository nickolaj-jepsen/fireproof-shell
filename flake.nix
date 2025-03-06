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
      }: let
        extraPackages = with ags.packages.${pkgs.system}; [
          pkgs.uwsm
          pkgs.wtype
          battery
          bluetooth
          hyprland
          network
          tray
          notifd
          cava
          mpris
          apps
          wireplumber
        ];
        agsPackage = ags.packages.${system}.ags.override {
          inherit extraPackages;
        };
        astalIoPackage = ags.packages.${system}.io;
      in {
        overlayAttrs = {
          inherit (config.packages) fireproof-shell;
        };

        packages.fireproof-shell = ags.lib.bundle {
          inherit pkgs extraPackages;
          src = ./.;
          name = "fireproof-shell";
          gtk4 = true;
          entry = "app.ts";
        };
        packages.fireproof-ipc = astalIoPackage;

        devShells.default = pkgs.mkShellNoCC {
          nativeBuildInputs = [
            pkgs.watchexec
            pkgs.just
            pkgs.libnotify
            pkgs.curl
            pkgs.jq
            agsPackage
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

            settings = {
              monitor.main = lib.mkOption {
                type = lib.types.str;
                default = "";
                example = "DP-1";
              };

              notification.ignore = lib.mkOption {
                type = lib.types.listOf lib.types.str;
                default = [];
                example = ["/^Spotify/"];
              };

              tray.ignore = lib.mkOption {
                type = lib.types.listOf lib.types.str;
                default = [];
                example = ["/spotify/"];
              };

              launcher.uwsm = lib.mkOption {
                type = lib.types.bool;
                default = false;
              };
            };
          };
          config = {
            environment.etc."fireproof-shell/config.json" = {
              text = builtins.toJSON cfg.settings;
            };
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
                  Slice = "app-graphical.slice";
                };

                wantedBy = ["graphical-session.target"];
              };
            };
          };
        };
      };
    };
}
