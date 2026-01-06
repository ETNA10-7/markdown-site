# Convex EXDEV Error: Detailed Technical Explanation

## What is the EXDEV Error?

**Error Message:**
```
EXDEV: cross-device link not permitted, rename '/tmp/.tmp4ywbis/build_deps/node_modules.zip' -> '/home/Arch/.convex/.../modules/xxx.blob'
```

**EXDEV** stands for "EXchange DEVice" - it's a Linux/Unix error code (errno 18) that occurs when you try to move/rename a file across different filesystems.

## Why This Happens

### 1. Filesystem Architecture on Your System

Your Linux system has multiple filesystems mounted:

```
/tmp          → tmpfs (in-memory filesystem, separate mount)
/home/Arch    → /dev/sda3 (disk filesystem, part of root filesystem)
```

**Key Facts:**
- `/tmp` is a **separate mount point** using `tmpfs` (temporary filesystem in RAM)
- `/home/Arch/.convex/...` is on the **main disk filesystem** (`/dev/sda3`)
- These are **two different filesystems** from the kernel's perspective

### 2. How Linux File Operations Work

When you "move" a file in Linux, the system uses the `rename()` system call:

```c
int rename(const char *oldpath, const char *newpath);
```

**The Critical Limitation:**
- `rename()` can only move files **within the same filesystem**
- It's an atomic operation that just updates directory entries
- It does NOT copy data - it just changes where the file is referenced

**Why this limitation exists:**
- Moving within the same filesystem is instant (just updates metadata)
- Moving across filesystems would require:
  1. Copying all file data (slow, uses I/O)
  2. Deleting the original (risky if copy fails)
  3. Not atomic (could fail halfway)

### 3. What Convex Does During Deployment

When you run `bunx convex dev`, Convex performs these steps:

1. **Build Phase:**
   - Reads your `convex/` directory
   - Bundles TypeScript/JavaScript files
   - Resolves dependencies
   - Creates a `node_modules.zip` file with external packages

2. **Temporary File Creation:**
   - Uses Node.js's `os.tmpdir()` which returns `/tmp` by default
   - Creates temp directory: `/tmp/.tmp4ywbis/`
   - Builds `node_modules.zip` in that temp directory

3. **Deployment Phase:**
   - Tries to move the zip file to Convex storage:
     ```
     /home/Arch/.convex/anonymous-convex-backend-state/.../modules/
     ```
   - Uses `fs.rename()` (which calls Linux `rename()` syscall)

4. **The Failure:**
   - `rename()` fails because source (`/tmp`) and destination (`/home/Arch/.convex/...`) are on different filesystems
   - Error: `EXDEV: cross-device link not permitted`

## Why This is a Convex-Specific Issue

### Convex's Build Process

Convex needs to:
1. Bundle your functions (TypeScript → JavaScript)
2. Package external dependencies (from `convex.json`)
3. Upload everything to the Convex backend

The bundling process creates temporary files, and Convex optimizes by:
- Creating temp files in the system temp directory (`/tmp`)
- Then moving them to Convex's storage directory

### Why Not All Tools Have This Issue

Most tools either:
- **Copy instead of rename** (slower but works across filesystems)
- **Use the same filesystem** for temp and final storage
- **Delete and recreate** instead of moving

Convex uses `rename()` for performance (atomic, fast) but assumes temp and storage are on the same filesystem.

## The Solution Explained

### Setting TMPDIR

By setting the `TMPDIR` environment variable, we tell Node.js (and Convex) to use a different directory for temporary files:

```bash
export TMPDIR="$(pwd)/.tmp"
```

**What this does:**
1. Creates `.tmp/` in your project directory (on `/dev/sda3`)
2. Node.js's `os.tmpdir()` now returns this directory instead of `/tmp`
3. Convex creates temp files in `.tmp/` (same filesystem as `.convex/`)
4. `rename()` now works because both source and destination are on `/dev/sda3`

### Why This Works

```
Before (FAILS):
/tmp/.tmpXXX/node_modules.zip  (tmpfs filesystem)
    ↓ rename() attempt
/home/Arch/.convex/.../modules/xxx.blob  (disk filesystem)
    ❌ EXDEV error - different filesystems

After (WORKS):
/home/Arch/.../markdown-site/.tmp/node_modules.zip  (disk filesystem)
    ↓ rename() attempt
/home/Arch/.convex/.../modules/xxx.blob  (disk filesystem)
    ✅ Success - same filesystem
```

## Technical Deep Dive

### Filesystem Types

**tmpfs:**
- Stored in RAM (volatile - lost on reboot)
- Fast access
- Limited by available RAM
- Separate mount point

**ext4 (or your disk filesystem):**
- Stored on disk (persistent)
- Slower than RAM but larger capacity
- Part of the root filesystem hierarchy

### System Call Behavior

```c
// What rename() does internally:
1. Check if oldpath and newpath are on same filesystem
2. If YES: Update directory entries (fast, atomic)
3. If NO: Return EXDEV error (don't attempt copy)
```

The kernel enforces this at the VFS (Virtual File System) layer - it's not something Convex can work around.

### Node.js File System API

```javascript
// Convex (or its dependencies) likely does:
const tmpDir = os.tmpdir();  // Returns /tmp by default
const tempFile = path.join(tmpDir, 'build_deps', 'node_modules.zip');
// ... create tempFile ...
fs.rename(tempFile, finalDestination);  // Fails with EXDEV
```

When `TMPDIR` is set:
```javascript
os.tmpdir();  // Returns value of TMPDIR environment variable
// Now tempFile is on same filesystem as finalDestination
fs.rename(tempFile, finalDestination);  // Success!
```

## Why This Affects Some Systems But Not Others

**Systems where this works:**
- `/tmp` is on the same filesystem as home directory
- `/tmp` is a symlink to a directory on the main filesystem
- TMPDIR is already set to a directory on the main filesystem

**Systems where this fails (like yours):**
- `/tmp` is a separate tmpfs mount (common on modern Linux)
- `/tmp` is on a different disk/partition
- System uses systemd's PrivateTmp (creates per-service tmpfs)

## Prevention and Best Practices

### For Convex Users

1. **Always set TMPDIR** when running Convex commands:
   ```bash
   TMPDIR="$(pwd)/.tmp" bunx convex dev
   ```

2. **Use the wrapper script** we created:
   ```bash
   ./convex-dev.sh
   ```

3. **Add to your shell profile** (optional, for all projects):
   ```bash
   # In ~/.bashrc or ~/.zshrc
   export TMPDIR="$HOME/.tmp"
   mkdir -p "$TMPDIR"
   ```

### For Tool Developers

If you're building tools that move files:
- Always use `fs.copyFile()` + `fs.unlink()` for cross-filesystem moves
- Or check filesystem first and choose the appropriate method
- Consider using libraries like `move-file` that handle this automatically

## Summary

**The Problem:**
- Convex creates temp files in `/tmp` (tmpfs - separate filesystem)
- Tries to move them to `.convex/` directory (disk filesystem)
- Linux `rename()` cannot move across filesystems
- Results in EXDEV error

**The Solution:**
- Set `TMPDIR` to a directory on the same filesystem as `.convex/`
- Now both temp files and destination are on the same filesystem
- `rename()` works correctly

**The Fix:**
- Use `./convex-dev.sh` wrapper script
- Or `npm run dev:convex` (which sets TMPDIR)
- Or manually: `TMPDIR="$(pwd)/.tmp" bunx convex dev`

This is a **system configuration issue**, not a bug in Convex. The fix is simple and works reliably.


