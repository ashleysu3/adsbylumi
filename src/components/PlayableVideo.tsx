import { usePlayableUrl } from "@/hooks/usePlayableUrl";

/**
 * A <video> that works with private storage buckets: the src is signed before
 * playback. Drop-in replacement for <video src={clip.file_url} ... />.
 */
export function PlayableVideo({
  src,
  ...rest
}: React.VideoHTMLAttributes<HTMLVideoElement> & { src: string }) {
  const url = usePlayableUrl(src);
  return <video {...rest} src={url || undefined} />;
}
