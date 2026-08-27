import { useEffect, useRef } from 'react';
import { createVideoPlayer, type VideoPlayer, type VideoSource } from 'expo-video';

/**
 * How exercise clips get onto the device, and how they stop being downloaded
 * twice.
 *
 * Every clip is a remote `.mp4` in the public `exercise-clips` bucket — see
 * `ExerciseVideo` for where the URL comes from. Two things were making the
 * session runner wait on the network more than it had to:
 *
 *   1. **Nothing was cached.** A plain string source hands the URL straight to
 *      AVPlayer / ExoPlayer, which cache media according to HTTP headers they
 *      barely honour anyway. The same clip was pulled again for every set, every
 *      session and every day. `useCaching` puts expo-video's own disk cache in
 *      front of it — an LRU store (1GB by default, far more than the ~70MB whole
 *      library) that keys on the URL and ignores cache headers entirely. The
 *      second time she meets an exercise, in this session or next Tuesday's, the
 *      clip comes off the disk.
 *   2. **Nothing loaded ahead.** A clip only began downloading at the moment it
 *      became the current exercise — that is, at the moment she was already
 *      looking at an empty stage waiting for it. `useClipPrewarm` moves that
 *      download into the minute before, while she is reading the setup card or
 *      working the set in front of it.
 *
 * Neither needs a new native dependency, and both keep working — harder — once
 * the bucket serves the clips with a real `Cache-Control`.
 */

/**
 * Memoised so the same URL always yields the same object.
 *
 * `useVideoPlayer` re-creates the whole native player whenever its source
 * changes, and it decides that by stringifying what it is given. A fresh
 * `{ uri, useCaching: true }` literal every render is the same string, so it is
 * safe either way — but the map also makes the source cheap to compare in this
 * file's own effect dependencies.
 */
const sources = new Map<string, VideoSource>();

export function clipSource(uri: string): VideoSource {
  let source = sources.get(uri);
  if (!source) {
    source = { uri, useCaching: true };
    sources.set(uri, source);
  }
  return source;
}

/**
 * Seconds of clip a warming player is asked to hold in its buffer.
 *
 * Comfortably longer than any clip in the library (the longest is 16s), so
 * "buffer this far ahead" amounts to "fetch the whole file" — which is what we
 * want, since the point is to have it on disk before she gets there. Android's
 * default is 20s and iOS's is "decide for yourself"; neither is a promise.
 */
const PREWARM_BUFFER_SECONDS = 30;

/**
 * Hold open a muted, never-played player for each of `uris` so the clips
 * download now instead of when she arrives at them.
 *
 * A created player starts buffering immediately, with no surface attached and
 * no decoding — it is the download we are after, and the bytes land in the
 * shared cache above, so the player that eventually *shows* the clip reads them
 * off the disk rather than the network.
 *
 * Keep the list short — one or two ahead. This is her mobile data, and warming
 * a whole session at once would have every clip competing with the one actually
 * on screen for the same bandwidth.
 *
 * Players are released as soon as their URL drops out of the list, and on
 * unmount. Nothing here survives the screen.
 */
export function useClipPrewarm(uris: ReadonlyArray<string | null | undefined>) {
  const warming = useRef(new Map<string, VideoPlayer>());
  // A string, not the array: the caller rebuilds the list every render, and
  // re-running this effect on identity alone would release and re-create every
  // warming player once a second.
  const wantedKey = uris.filter((uri): uri is string => Boolean(uri)).join('\n');

  useEffect(() => {
    const wanted = wantedKey ? wantedKey.split('\n') : [];
    const players = warming.current;

    for (const [uri, player] of Array.from(players)) {
      if (wanted.includes(uri)) continue;
      players.delete(uri);
      player.release();
    }

    for (const uri of wanted) {
      if (players.has(uri)) continue;
      try {
        const player = createVideoPlayer(clipSource(uri));
        player.muted = true;
        player.bufferOptions = { preferredForwardBufferDuration: PREWARM_BUFFER_SECONDS };
        players.set(uri, player);
      } catch {
        // A clip that cannot be warmed is not a failure she should ever see:
        // the stage still loads it the ordinary way when she reaches it.
      }
    }
  }, [wantedKey]);

  useEffect(
    () => () => {
      warming.current.forEach((player) => player.release());
      warming.current.clear();
    },
    []
  );
}
