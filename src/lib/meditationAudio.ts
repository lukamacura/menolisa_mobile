import { Directory, File, Paths } from 'expo-file-system';
import { logger } from './logger';

/**
 * How the guided meditation gets onto the device, and why it is only fetched
 * once.
 *
 * The file is a 15MB MP3 in the public `relaxation-audio` bucket — the URL
 * arrives on the plan response and nothing here knows how it was built. Left to
 * stream, it would be pulled again every single time: `expo-audio` has no disk
 * cache of its own (unlike `expo-video`, which is why the exercise clips only
 * needed a `useCaching` flag), and ExoPlayer caches nothing at all without one.
 * A woman who meditates nightly would download the same fifteen megabytes fifty
 * times over an eight-week plan, most of it on cellular.
 *
 * So it is downloaded to disk on first play and played from there forever after.
 * Which buys the thing that actually matters for this feature: **it works with
 * no signal.** The most likely place she does an eleven-minute meditation is in
 * bed, and the second most likely is somewhere with no bars.
 *
 * ─── Why the cache directory, not documents ─────────────────────────────────
 * This file is re-downloadable, so it belongs where the OS is allowed to
 * reclaim it — and on iOS, `Paths.cache` is excluded from iCloud backup, which
 * a 15MB file that lives in a bucket has no business being in. Eviction costs
 * one re-download and nothing else.
 *
 * ─── Why a `.part` file ─────────────────────────────────────────────────────
 * A download that dies halfway leaves a truncated file behind, and a truncated
 * file still `exists`. Without the two-step it would be treated as cached from
 * then on, and she would get four minutes of meditation and silence — a failure
 * that never repairs itself and looks like the recording is broken. Bytes only
 * land under the real name once they are all there.
 */

const DIR_NAME = 'meditation';

/**
 * Smallest file we will accept as a meditation, in bytes.
 *
 * `downloadFileAsync` does not promise to throw on a non-2xx response, so a 404
 * or a Supabase error JSON can land on disk as a perfectly real file of about
 * two hundred bytes — which `exists` and has a non-zero `size`, and would
 * therefore be cached and handed to the player forever. No guided meditation is
 * under 64KB, and no error body is over it.
 */
const MIN_PLAUSIBLE_BYTES = 64 * 1024;

/** In flight, keyed by URL, so two mounts in a tick share one download. */
const downloads = new Map<string, Promise<string>>();

function cacheDir(): Directory {
  const dir = new Directory(Paths.cache, DIR_NAME);
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  return dir;
}

/**
 * The local filename for a remote URL — its last path segment, decoded, with
 * anything that is not a plain filename character flattened.
 *
 * Derived from the URL rather than from the meditation's id on purpose: the day
 * the recording is replaced with a differently-named file, this changes with it
 * and the new one is fetched. An id-based name would keep serving the old audio
 * from disk with no way to tell it had gone stale.
 */
function localNameFor(url: string): string {
  const segment = decodeURIComponent(url.split('?')[0].split('/').pop() ?? '');
  const safe = segment.replace(/[^A-Za-z0-9._-]/g, '_');
  return safe.length > 0 ? safe : 'meditation.mp3';
}

/**
 * The on-disk URI if the audio is already there, `null` if it is not.
 *
 * Synchronous so the player can open straight into its ready state on every
 * play after the first. Resolving the same thing through the promise below
 * would cost a render in the downloading state and flash a spinner at her for
 * a file that is sitting on the device.
 */
export function cachedMeditationUri(url: string): string | null {
  try {
    const file = new File(cacheDir(), localNameFor(url));
    return file.exists && file.size > 0 ? file.uri : null;
  } catch (error) {
    logger.warn('meditationAudio: cache probe failed', error);
    return null;
  }
}

/**
 * Everything in the meditation directory except the file we just wrote.
 *
 * Without this, replacing the recording leaves the old 15MB behind forever —
 * nothing else ever looks in this directory, so nothing else would ever clear
 * it. Failures are swallowed: an orphan is wasted space, not a broken player.
 */
function pruneExcept(keep: string): void {
  try {
    for (const entry of cacheDir().list()) {
      if (entry.name !== keep) entry.delete();
    }
  } catch (error) {
    logger.warn('meditationAudio: prune failed', error);
  }
}

/**
 * The local `file://` URI for the meditation, downloading it if this is the
 * first time.
 *
 * Resolves immediately when it is already on disk. Rejects if the download
 * fails, which the player renders as a retry rather than an error screen — the
 * likeliest cause is that she is somewhere with no signal, and that is not a
 * fault to report, it is a thing to try again later.
 */
export function ensureMeditationFile(url: string): Promise<string> {
  const existing = downloads.get(url);
  if (existing) return existing;

  const download = (async () => {
    const dir = cacheDir();
    const name = localNameFor(url);
    const target = new File(dir, name);
    if (target.exists && target.size > 0) return target.uri;

    const part = new File(dir, `${name}.part`);
    if (part.exists) part.delete();

    try {
      // `idempotent` covers the race where the same partial name survived a
      // crash between the check above and the write below.
      const downloaded = await File.downloadFileAsync(url, part, { idempotent: true });
      if (downloaded.size < MIN_PLAUSIBLE_BYTES) {
        throw new Error(`downloaded ${downloaded.size} bytes — not the meditation`);
      }

      // Only move when it did not already land on the final name. Passing a
      // `File` destination is meant to write to exactly that path, but a
      // download that resolved the name from the URL instead would put the
      // bytes straight on `target` — and the delete-then-move below would then
      // throw away the file it had just fetched.
      if (downloaded.uri !== target.uri) {
        // `move` will not overwrite, so clear whatever partial state is in the way.
        if (target.exists) target.delete();
        downloaded.move(target);
      }

      pruneExcept(name);
      return target.uri;
    } catch (error) {
      // Leave nothing half-written behind, or the next attempt inherits it.
      try {
        if (part.exists) part.delete();
      } catch {
        // Already gone, or unreadable. Either way there is nothing to clean.
      }
      throw error;
    }
  })();

  downloads.set(url, download);
  // Cleared either way: a success has nothing left to share, and a failure must
  // not hand the same rejection to the retry she is about to tap.
  download.catch(() => {}).finally(() => downloads.delete(url));

  return download;
}
