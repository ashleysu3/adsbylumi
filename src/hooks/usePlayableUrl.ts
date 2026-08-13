import { useEffect, useState } from "react";
import { resolvePlayableUrl } from "@/lib/storage-url";

/**
 * Returns a URL that a <video>/<img> tag can actually load: public-style links
 * into private storage buckets get swapped for signed URLs.
 */
export function usePlayableUrl(rawUrl: string | null | undefined): string {
  const [url, setUrl] = useState<string>(rawUrl || "");

  useEffect(() => {
    if (!rawUrl) {
      setUrl("");
      return;
    }
    let active = true;
    setUrl(rawUrl);
    resolvePlayableUrl(rawUrl).then((resolved) => {
      if (active) setUrl(resolved);
    });
    return () => {
      active = false;
    };
  }, [rawUrl]);

  return url;
}
