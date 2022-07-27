#!/usr/bin/env node

import { execa } from "execa";
const name = "deployfs";
const args = process.argv.slice(2);
const opt = Object.create(null);

const { SFTP_CMD } = process.env.SFTP_CMD || "/usr/libexec/sftp-server";

const SSH_CMD = (process.env.SSH_CMD || "ssh")
    .split(/(?<!\\)\s/g)
    .map((x) => x.replace(/\\(\s)/g, "$1"));

/* sysexits(3) exit codes */
const EX_USAGE = 64;

function errormsg(msg) {
    console.error(`deployfs: error: ${msg}`);
}

function argErr(msg) {
    console.error(`${name}: ${msg}`);
    process.exit(EX_USAGE);
}

function badOption(optStr) {
    console.error(`deployfs: bad option: ${optStr}`);
    process.exit(2);
}

function parseDestStr(str) {
    return str.split(/:/);
}

function escapeSingleQuotes(str) {
    return str.replace(/'/g, "'\\''");
}

async function main() {
    if (args.length < 2) argErr(`expected 2 args, received ${args.length}`);
    const [sshDest, mountPoint] = parseDestStr(args.shift());
    const localSharedPath = args.shift();
    let sshfsOpts;

    for (const arg of args) {
        if (arg === "--") {
            args.shift();
            sshfsOpts = args;
            break;
        }

        if (arg === "-M") {
            opt.createMountPointIfNeeded = true;
        }

        if (arg === "-D") {
            opt.keepMountPoint = true;
        }

        if (/^-/.test(arg)) {
            badOption(arg);
        }
    }

    // checkSshfsOpts(sshfsOpts);

    const disallowedSshfsOpts = [
        { disallowedOpt: /-o\s*passive/, suggestion: "" },
    ];

    // TODO: shell escape variables
    const remoteCmd = `
    if ! [ -e '${escapeSingleQuotes(mountPoint)}' ]; then
    ${
        opt.createMountPointIfNeeded
            ? `mkdir -p '${escapeSingleQuotes(mountPoint)}'
    ${
        opt.removeMountPointOnExit
            ? `trap rm\\ -d\\ \''${escapeSingleQuotes(mountPoint)}'\' EXIT`
            : ""
    }\n`
            : ":"
    }
    fi

    sshfs \"$local_dir_to_share\" \"$remote_mnt_point\" -o passive ${sshfsOpts}
`;

    const sftpProc = execaCommand(SFTP_CMD, {
        stderr: "inherit",
        stripFinalNewline: false,
        encoding: null,
    });

    const sshProc = await execa(SSH_CMD.shift(), [...SSH_CMD, remoteCmd], {
        stdin: sftpProc.stdout,
        stdout: sftpProc.stdin,
        stderr: "inherit",
        stripFinalNewline: false,
        encoding: null,
    });
}

function help() {
    console.log(
        `
deployfs [user@]host:mountpoint localsharedpath [options] [-- sshfs_opts...]

Deploy/mount a local filesystem/directory onto a remote host.

deployfs will first launch an sftp server on the local host. It will then ssh
into the remote host logging in to the provided user (or the current user if
one is not provided). After successful ssh login, sshfs will be invoked and
connected to the local sftp server. The mount point provided will be created if
it does not already exist (unless the \`-M' option was used). On exit, if a
mount point was created by deployfs, it will be cleaned up and removed (unless
the \`-D' option was used).

OPTIONS
  -M          don't create the mount point if it doesn't exist
  -D          don't remove a created mount point on exit
  -h, --help  display a help message

ENVIRONMENT VARIABLES
  The commands invoked by deployfs may be customized via environment variables.
  These will be parsed and invoked directly by the shell (so make sure to
  properly quote whitespace and shell meta-characters as needed if they are not
  to be interpreted) and may include options as well. These take precedence
  over their sshfs counterparts (e.g. \`SSH_CMD' over the \`-o ssh_command=CMD'
  option of sshfs).

  SFTP_CMD  sftp-server cmd & optional opts (default: /usr/libexec/sftp-server)
  SSH_CMD   ssh cmd & optional opts (don't incl args to ssh!) (default: ssh)
  `.trim()
    );
}

(async () => await main())();

/*
#!/usr/bin/env sh
#
# deployfs - Deploy/mount a local filesystem/directory onto a remote host.
#
# Copyright (C) 2022 Tyler Miller
#
# This program is free software; you can redistribute it and/or modify
# it under the terms of the GNU General Public License as published by
# the Free Software Foundation; either version 2 of the License, or
# (at your option) any later version.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU General Public License for more details.
#
# You should have received a copy of the GNU General Public License along
# with this program; if not, write to the Free Software Foundation, Inc.,
# 51 Franklin Street, Fifth Floor, Boston, MA 02110-1301 USA.

# Mount a local directory to a remote destination (give a remote host access
# to a local directory via sshfs via sftp). Requires mkfifo on local host.
# Requires sshfs to be installed in PATH on remote host. Might not work on
# Windows.

# Environment Variables
#   SSHFS_PATH    path to sshfs on remote host (optional)
#   SFTPSRV_PATH  path to sftp-server on local host (optional)

# Synopsis
#   deployfs desthost destmnt [localdir]

# localdir is optional and defaults to sharing the current directory.

if [ $# -eq 0 ]; then
  cat <<\EOF
Mount a local directory to a remote destination.
Give a remote host access to a local directory via sshfs via sftp.
EOF
  echo "usage: deployfs desthost destmnt [localdir]"
  exit 2
fi

sshfs="${SSHFS_PATH:-sshfs}"
sftp="${SFTPSRV_PATH:-"$(which sftp-server 2>/dev/null)"}"

case "$sftp" in
  *[![:space:]]*) : ;;
  *)
    sftp="$(find /usr -name 'sftp-server' -perm +u+x \( -type f -or -type l \) 2>/dev/null)"
    sftp="${sftp%%"$(printf '[\n\r]')"*}"
    [ -n "$sftp" ] || {
      echo 'could not find sftp-server bin, set SFTPSRV_PATH' >&2
      exit 1
    }
    ;;
esac

dest="$1"
remote_mnt_point="$2"
local_dir_to_share=":$3"
tmpd="$TMPDIR"
[ -d "$tmpd" ] || tmpd="$TMP"
[ -d "$tmpd" ] || tmpd="/tmp"

fifo=0
while [ -e "${tmpd}/${fifo}" ]; do
  : $((fifo++))
done

fifo="${tmpd}/${fifo}"

script="
  mkdir -p \"$remote_mnt_point\"
  trap 'rm -d \"$remote_mnt_point\"' EXIT
  \"$sshfs\" \"$local_dir_to_share\" \"$remote_mnt_point\" -o passive
"

mkfifo "$fifo"
trap "rm $fifo" EXIT
"$sftp" <"$fifo" | ssh "$dest" "$script" >"$fifo"
*/
