#!/usr/bin/env node

/**
 * Copyright (c) 2022 Tyler Miller
 * Distributed under the BSD 3-Clause "Revised" License.
 * (See accompanying file LICENSE)
 * @license BSD-3-Clause
 */

import { execa } from "execa";
import fs from "node:fs";
const args = process.argv.slice(2);
const opt = Object.create(null);
const name = "deployfs";

/* sysexits(3) exit codes */
const EX_OK = 0;
const EX_USAGE = 64;

const SFTP_CMD = splitOnSpaces(
    process.env.SFTP_CMD || "/usr/libexec/sftp-server"
);

const SSH_CMD = splitOnSpaces(process.env.SSH_CMD || "ssh");

const SSHFS_CMD = splitOnSpaces(
    process.env.SSHFS_CMD?.replace(/-o\s*passive/g, "") || "sshfs"
);

const usage = `
usage: deployfs [options] [--] localsharedpath [user@]host:mountpoint
`.trim();

const helpMsg = `
${usage}

\`user' defaults to the current logged-in user (using root is discouraged). If
it already exists, \`mountpoint' must be owned by \`user' and have appropriate
permissions, otherwise, \`mountpoint' will be created via \`mkdir -p' (unless
the \`-M' option is given). If the \`-M' option is given and \`mountpoint' does
not already exist, the command will fail."

OPTIONS
    -M           do not create the mountpoint if it does not already exist

    --sftp-cmd   sftp server command/path to invoke on local host
                 default: /usr/libexec/sftp-server

    --ssh-cmd    ssh command/path to invoke on local host
                 default: ssh

    --sshfs-cmd  sshfs command/path to invoke on remote host
                 default: sshfs

    The following options take a variable number of (1 or more) arguments each.
    These arguments will be passed-on verbatim. You must use a semicolon to
    mark the end of the options (e.g. \`--ssh-opts -c -f \\; -M').

    --sftp-opts  options to pass on to sftp server

    --ssh-opts   extra options to pass on to ssh (do not pass -e or -t)
                 default: -T

    --sshfs-opts extra options to pass on to sshfs (don't use to pass ssh opts)
                 default: -o passive
`.trim();

/** split on unescaped spaces then strips backslashes before spaces */
function splitOnSpaces(str) {
    return str.split(/(?<!\\)\s/g).map((x) => x.replace(/\\(\s)/g, "$1"));
}

function argErr(msg) {
    console.error(`${name}: error: ${msg}\n${usage}`);
    process.exit(EX_USAGE);
}

function unrecognizedOpt(optStr) {
    console.error(`${name}: unrecognized option: ${optStr}`);
    process.exit(EX_USAGE);
}

function parseDestStr(str) {
    return str.split(/:/);
}

function escapeSingleQuotes(str) {
    return `'${str.replace(/'/g, "'\\''").replace(/^~/, "'~'")}'`;
}

function snakeToCamelCase(str) {
    return str.replace(/-(.)/g, (m, p1) => p1.toUpperCase());
}

async function main() {
    if (!args.length) printHelpMsg(EX_USAGE);
    let match,
        i = 0;

    for (; i < args.length; i++) {
        if (args[i] === "--") {
            i++;
            break;
        } else if (/^-[a-zA-Z0-9]/.test(args[i])) {
            // short option (doesn't handle opt-args)
            const opts = args[i].split("");
            for (let j = 1; j < opts.length; j++) {
                const o = opts[j];
                if (o === "M") opt.createMountPointIfNeeded = true;
                else if (o === "h") printHelpMsg(EX_OK);
                else unrecognizedOpt(o);
            }
        } else if (/^--[a-zA-Z0-9][-a-zA-Z0-9]+$/) {
            // long option
            if (args[i] === "--help") printHelpMsg(EX_OK);
            else if ((match = args[i].match(/^(?<=--)(?:sftp|ssh(?:fs))-cmd$/)))
                opt[snakeToCamelCase(match[0])] = args[++i];
            else if (
                (match = args[i].match(/^(?<=--)(?:sftp|ssh(?:fs)?)-opts$/))
            ) {
                i++;
                const opts = [];

                for (; i < args.length; i++) {
                    if (args[i] === ";") {
                        i++;
                        break;
                    }
                    opts.push(args[i]);
                }
                opt[snakeToCamelCase(match[0])] = opts;
            } else if (/^-/.test(args[i])) unrecognizedOpt(args[i]);
            else break;
        }
    }

    if (args.length - i !== 2)
        argErr(`expected 2 arguments, received ${args.length}`);

    const localSharedPath = args.shift();
    const [sshDest, mountPoint] = parseDestStr(args.shift());
    const { sftpCmd, sftpOpts, sshCmd, sshOpts, sshfsCmd, sshfsOpts } = opt;

    const remoteCmd = `
        IFS=' \t\n'

        if ! [ -e ${escapeSingleQuotes(mountPoint)} ]; then
    ${
        opt.createMountPointIfNeeded
            ? `mkdir -p ${escapeSingleQuotes(mountPoint)}
               chmod u+rwx ${escapeSingleQuotes(mountPoint)}\n`
            : ":\n"
    }
        fi

        ${escapeSingleQuotes(SSHFS_CMD.shift())} \\
            :${escapeSingleQuotes(localSharedPath)} \\
        ${escapeSingleQuotes(mountPoint)} \\
            -o passive \\
        ${SSHFS_CMD.map(escapeSingleQuotes).join(" ")}
`;

    function fixupSshOpts(optArray) {
        // disable pty allocation (also disables escape char)
        optArray.push("-T");
        return optArray;
    }

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

function printHelpMsg(exitCode) {
    console.log(helpMsg);
    if (typeof exitCode !== "undefined") process.exit(exitCode);
}

(async () => await main())();
