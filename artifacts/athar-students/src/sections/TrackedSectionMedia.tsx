import { useCallback, useEffect, useRef, useState, type SyntheticEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Download, FileText, Headphones, Video } from "lucide-react";
import {
  getGetSectionMediaProgressQueryKey,
  getListLearningItemsQueryKey,
  useSaveSectionMediaProgress,
} from "@workspace/api-client-react";
import type { SectionMediaProgress } from "@workspace/api-client-react";
import "./tracked-section-media.css";

type TrackedSectionMediaProps = {
  sectionSlug: string;
  contextKey: string;
  mediaAssetId: string;
  mediaType: "audio" | "video" | "file";
  url: string;
  title: string;
  savedProgress?: SectionMediaProgress;
};

function formatTime(seconds: number) {
  const wholeSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(wholeSeconds / 60);
  const remainder = wholeSeconds % 60;
  return minutes ? `${minutes.toLocaleString("ar")} د ${remainder.toLocaleString("ar")} ث` : `${remainder.toLocaleString("ar")} ث`;
}

export function TrackedSectionMedia({
  sectionSlug, contextKey, mediaAssetId, mediaType, url, title, savedProgress,
}: TrackedSectionMediaProps) {
  const queryClient = useQueryClient();
  const { mutate: saveMutation, isPending, isError } = useSaveSectionMediaProgress();
  const playerRef = useRef<HTMLMediaElement | null>(null);
  const sampleRef = useRef({ at: 0, position: 0 });
  const watchedRef = useRef(savedProgress?.watchedSeconds ?? 0);
  const durationRef = useRef(savedProgress?.durationSeconds ?? 0);
  const lastSentRef = useRef(savedProgress?.watchedSeconds ?? 0);
  const lastSentDurationRef = useRef(savedProgress?.durationSeconds ?? 0);
  const [watchedSeconds, setWatchedSeconds] = useState(savedProgress?.watchedSeconds ?? 0);
  const [durationSeconds, setDurationSeconds] = useState(savedProgress?.durationSeconds ?? 0);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    if (savedProgress) {
      watchedRef.current = Math.max(watchedRef.current, savedProgress.watchedSeconds);
      durationRef.current = Math.max(durationRef.current, savedProgress.durationSeconds);
      lastSentRef.current = Math.max(lastSentRef.current, savedProgress.watchedSeconds);
      lastSentDurationRef.current = Math.max(lastSentDurationRef.current, savedProgress.durationSeconds);
      setWatchedSeconds(watchedRef.current);
      setDurationSeconds(durationRef.current);
    }
  }, [savedProgress]);

  const saveProgress = useCallback(() => {
    const watched = Math.floor(watchedRef.current);
    const duration = Math.floor(durationRef.current);
    if (watched <= lastSentRef.current && duration <= lastSentDurationRef.current) return;
    lastSentRef.current = Math.max(lastSentRef.current, watched);
    lastSentDurationRef.current = Math.max(lastSentDurationRef.current, duration);
    saveMutation({
      slug: sectionSlug,
      data: { contextKey, mediaAssetId, watchedSeconds: watched, durationSeconds: duration },
    }, {
      onSuccess: saved => {
        queryClient.setQueryData<SectionMediaProgress[]>(
          getGetSectionMediaProgressQueryKey(sectionSlug),
          current => [
            ...(current ?? []).filter(row => !(row.contextKey === saved.contextKey && row.mediaAssetId === saved.mediaAssetId)),
            saved,
          ],
        );
        watchedRef.current = Math.max(watchedRef.current, saved.watchedSeconds);
        durationRef.current = Math.max(durationRef.current, saved.durationSeconds);
        if (contextKey.startsWith("course:")) {
          void queryClient.invalidateQueries({ queryKey: getListLearningItemsQueryKey({ kind: "course" }) });
        }
      },
      onError: () => { lastSentRef.current = 0; lastSentDurationRef.current = 0; },
    });
  }, [contextKey, mediaAssetId, queryClient, saveMutation, sectionSlug]);

  const samplePlayback = useCallback(() => {
    const player = playerRef.current;
    const now = Date.now();
    if (!player || player.paused || player.seeking || document.visibilityState === "hidden" && mediaType === "video") {
      if (player) sampleRef.current = { at: now, position: player.currentTime };
      return;
    }
    const previous = sampleRef.current;
    const elapsed = Math.max(0, (now - previous.at) / 1000);
    const advanced = player.currentTime - previous.position;
    if (elapsed > 0 && elapsed <= 20 && advanced > 0.03 && advanced <= 30) {
      const rate = Math.max(player.playbackRate || 1, 0.25);
      const actualPlaybackTime = Math.min(elapsed, advanced / rate, 15);
      if (actualPlaybackTime > 0) {
        watchedRef.current += actualPlaybackTime;
        setWatchedSeconds(Math.floor(watchedRef.current));
      }
    }
    sampleRef.current = { at: now, position: player.currentTime };
  }, [mediaType]);

  useEffect(() => {
    if (!isPlaying) return;
    const interval = window.setInterval(() => {
      samplePlayback();
      if (Date.now() - sampleRef.current.at > 0 && watchedRef.current - lastSentRef.current >= 12) saveProgress();
    }, 1000);
    return () => window.clearInterval(interval);
  }, [isPlaying, samplePlayback, saveProgress]);

  useEffect(() => () => {
    saveProgress();
  }, [saveProgress]);

  const handleMetadata = () => {
    const player = playerRef.current;
    if (!player) return;
    const duration = Number.isFinite(player.duration) ? Math.min(86400, Math.floor(player.duration)) : 0;
    durationRef.current = Math.max(durationRef.current, duration);
    setDurationSeconds(durationRef.current);
    sampleRef.current = { at: Date.now(), position: player.currentTime };
    saveProgress();
  };

  const playerEvents = {
    onPlay: (event: SyntheticEvent<HTMLMediaElement>) => {
      const player = event.currentTarget;
      sampleRef.current = { at: Date.now(), position: player.currentTime };
      setIsPlaying(true);
    },
    onPause: () => { setIsPlaying(false); saveProgress(); },
    onEnded: () => { setIsPlaying(false); saveProgress(); },
    onSeeking: (event: SyntheticEvent<HTMLMediaElement>) => {
      sampleRef.current = { at: Date.now(), position: event.currentTarget.currentTime };
    },
    onSeeked: (event: SyntheticEvent<HTMLMediaElement>) => {
      sampleRef.current = { at: Date.now(), position: event.currentTarget.currentTime };
    },
    onTimeUpdate: samplePlayback,
    onLoadedMetadata: handleMetadata,
  };

  const mediaIcon = mediaType === "audio" ? <Headphones size={16} aria-hidden="true"/>
    : mediaType === "video" ? <Video size={16} aria-hidden="true"/>
      : <FileText size={16} aria-hidden="true"/>;

  return <div className="tracked-section-media" data-testid={`tracked-media-${mediaAssetId}`}>
    {mediaType === "video" && <video
      ref={element => { playerRef.current = element; }}
      src={url}
      controls
      playsInline
      preload="metadata"
      aria-label={`مشاهدة ${title}`}
      {...playerEvents}
    />}
    {mediaType === "audio" && <audio
      ref={element => { playerRef.current = element; }}
      src={url}
      controls
      preload="metadata"
      aria-label={`الاستماع إلى ${title}`}
      {...playerEvents}
    />}
    {mediaType === "file" && <div className="tracked-section-document">
      <iframe src={`${url}?preview=1`} title={`معاينة ${title}`} loading="lazy" />
      <a href={url} download><Download size={15}/> تنزيل الملف</a>
    </div>}
    <div className="tracked-section-media-status" role="status" aria-live="polite">
      <span className="tracked-section-media-kind">{mediaIcon}{mediaType === "audio" ? "استماع" : mediaType === "video" ? "مشاهدة" : "مرفق"}</span>
      {mediaType !== "file" && <span>وقت التعلّم المسجل: {formatTime(watchedSeconds)}{durationSeconds > 0 ? ` من ${formatTime(durationSeconds)}` : ""}</span>}
      {isPending && <span className="tracked-section-saving">جارٍ الحفظ…</span>}
      {isError && <button type="button" onClick={saveProgress} data-testid={`button-retry-media-progress-${mediaAssetId}`}>إعادة حفظ التقدّم</button>}
    </div>
  </div>;
}
