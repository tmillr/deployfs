# deployfs

Deploy/mount a local filesystem/directory onto a remote host.

deployfs is a npm/nodejs package that wraps the [sshfs command][sshfs]. sshfs is a simple command used for mounting a remote filesystem on the local host by utilizing sftp (ftp over ssh). deployfs is a command that wraps sshfs and allows you to do the inverse (i.e. mount a local filesystem on a remote host) without ever having to setup or allow ssh logins on the local host whose filesystem/directory is to be mounted. An ssh login from this local host to the remote host who is to receive the share is required however.

## Why

Unlike NFS which can have varying protocols and require non-trivial setup (look no further than [the samba manpage](sambaman)), sshfs is very simple to use and requires almost no setup. It is also portable across operating systems (the only dependency or requirement is ssh/sftp which often comes pre-installed on your os). This seems to make it a particularly good fit for when you just need to share some folder quickly (e.g. a quick one-time/on-the-spot share, running tests that involve a remote machine, transferring some files, etc.). sshfs however is meant for mounting from a remote machine onto the local machine and does not really provide a full-fledged solution for mounting in the inverse direction (for mounting a local dir/fs onto a remote machine). So that is why I decided to make deployfs.

## Prerequisites

1. Since this command uses ssh, `sshd` needs to be running and properly configured on the remote host to allow for user logins. Also, the shell presented after ssh login **must be a POSIX shell** (such as bash) at this time.

2. If `sshfs` is not already installed on the remote host, install `sshfs` on the remote host and make sure it is in the target user's `PATH` (for the user that needs the mount). Install `sshfs` using your preferred or operating system's package manager (recommended) (e.g. `sudo apt update && sudo apt install sshfs` on Linux, etc.). If this is not feasible, please refer to the following table:

<table>
  <tr>
    <th>OS</th>
    <th>Installation Instructions</th>
  </tr>
  <tr>
    <td align="center">Linux</td>
    <td>
      Install sshfs via your distribution's package manager, or manually install
      by following <a href="https://github.com/libfuse/sshfs#installation">these instructions</a>.
    </td>
  </tr>
  <tr>
    <td align="center">macOS</td>
    <td>
      HomeBrew has disabled sshfs for macOS, so you'll either need to use another package
      manager or manually install sshfs.
      <ol>
        <li>Download OSXFuse from http://osxfuse.github.io</li>
        <li>Open osxfuse.dmg and run the installer</li>
        <li>Download SSHFS from http://osxfuse.github.io</li>
        <li>Open and run the sshfs.pkg installer</li>
      </ol>
    </td>
  </tr>
  <tr>
    <td align="center">Windows</td>
    <td>
      <a href="https://github.com/winfsp/sshfs-win">sshfs-win</a> (<a href="#windows-caveat"
        >SEE CAVEAT BELOW</a
      >)
    </td>
  </tr>
</table>

3. Lastly, install deployfs via npm:

```sh
npm i -g deployfs
```

## Usage

```sh
${usage}
```

- It is recommended that you login as a regular `user` and not `root`.
- If the remote mountpoint exists, it must be owned by `user`, otherwise, the mountpoint will be created via `mkdir -p`.
- If `user` is omitted, the currently logged-in user who is invoking deployfs will be used.
- If directory is omitted, the local home directory will be shared.

<table>
<tr><th colspan="2">Unmounting the filesystem</th></tr>
<tr><td>Linux</td><td><code>fusermount -u mountpoint</code> on the remote host</td></tr>
<tr><td>BSD and macOS</td><td><code>umount mountpoint</code> on the remote host</td></tr>
</table>

## Windows Caveat

Currently, deployfs expects a POSIX shell (preferably bash) upon ssh login into the remote host. If ssh is configured on the remote host to use a non-POSIX shell (such as cmd.exe or PowerShell on Windows, which is probably the default) then deployfs is not going to work. You will need to have bash installed and then [change the default ssh-login shell](defaultshellwin) to use bash.

## License

deployfs is licensed under the [BSD 3-Clause "Revised" License](LICENSE).

[sshfs]: https://github.com/libfuse/sshfs
[sshfsinstall]: https://github.com/libfuse/sshfs#installation
[libfuse]: https://github.com/libfuse/libfuse
[defaultshellwin]: https://docs.microsoft.com/en-us/windows-server/administration/openssh/openssh_server_configuration#configuring-the-default-shell-for-openssh-in-windows
