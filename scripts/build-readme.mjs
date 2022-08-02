#!/usr/bin/env node
import { execa } from "execa";
import fs from "node:fs";
import { getBinPathSync } from 'get-bin-path';

execa(getBinPathSync(), ["--help"], {
    timeout: 30000,
    stripFinalNewline: false,
    detached: false,
}).then(
    (x) =>
        !x.failed &&
        x.exitCode === 0 &&
        fs.writeFileSync(
            "README.md",
            fs
                .readFileSync("README.md", "UTF-8")
                .replace(
                    /(^\s*<!--.*AUTO-GENERATED\s*USAGE.*$\n*^\s*```.*$)(?:.|\n)*?(^\s*```)/im,
                    `$1\n${x.stdout}$2`
                )
        )
);
