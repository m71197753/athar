import { useCallback, useEffect, useRef, useState, type SyntheticEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Download, FileText, Headphones, Video } from "lucide-react";
import {
  getGetSectionMediaProgressQueryKey,
  getListLearningItemsQueryKey,
  useSaveSectionMediaProgress,
  saveSectionMediaProgress,
} from "@workspace/api-client-react";
import type { SectionMediaProgress } from "@workspace/api-client-react";
import "./tracked-section-media.css";
import { playbackSeconds, resumePosition } from "./media-playback";

type TrackedSectionMediaProps = {
  sectionSlug: string;
  contextKey: string;
  mediaAssetId: string;
  mediaType: "audio" | "video" | "file";
  url: string;
  title: string;
  savedProgress?: SectionMediaProgress;
  progressReady?: boolean;
  progressError?: boolean;
  onRetryProgress?: () => void;
};

function formatTime(seconds: number) {
  const wholeSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(wholeSeconds / 60);
  const remainder = wholeSeconds % 60;
  return minutes ? `${minutes.toLocaleString("ar")} د ${remainder.toLocaleString("ar")} ث` : `${remainder.toLocaleString("ar")} ث`;
}

export function TrackedSectionMedia({
  sectionSlug, contextKey, mediaAssetId, mediaType, url, title, savedProgress, progressReady = true,
  progressError = false, onRetryProgress,
}: TrackedSectionMediaProps) {
  const queryClient = useQueryClient();
  const { mutate: saveMutation, isPending, isError } = useSaveSectionMediaProgress();
  const playerRef = useRef<HTMLMediaElement | null>(null);
  const sampleRef = useRef({ at: 0, position: 0 });
  const watchedRef = useRef(savedProgress?.watchedSeconds ?? 0);
  const durationRef = useRef(savedProgress?.durationSeconds ?? 0);
  const lastSentRef = useRef(savedProgress?.watchedSeconds ?? 0);
  const lastSentDurationRef = useRef(savedProgress?.durationSeconds ?? 0);
  const lastSentPositionRef = useRef(savedProgress?.resumePositionSeconds ?? -1);
  const resumeAppliedRef = useRef(false);
  const resumePositionRef = useRef(savedProgress?.resumePositionSeconds ?? 0);
  const restoredPositionRef = useRef(0);
  const [resumedAt, setResumedAt] = useState(0);
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

  const applyResumePosition = useCallback(() => {
    const player = playerRef.current;
    if (!progressReady || !player || player.readyState < 1 || resumeAppliedRef.current) return;
    resumeAppliedRef.current = true;
    if (Number.isFinite(player.duration)) {
      durationRef.current = Math.max(durationRef.current, Math.min(86400, Math.floor(player.duration)));
      setDurationSeconds(durationRef.current);
    }
    const position = resumePosition(savedProgress?.resumePositionSeconds ?? 0, player.duration);
    if (position > 0) {
      const restored = Number.isFinite(player.duration) ? Math.min(position, Math.max(0, player.duration - 0.1)) : position;
      player.currentTime = restored;
      resumePositionRef.current = restored;
      restoredPositionRef.current = restored;
      sampleRef.current = { at: Date.now(), position: restored };
      setResumedAt(restored);
    }
  }, [progressReady, savedProgress?.resumePositionSeconds]);

  useEffect(() => { applyResumePosition(); }, [applyResumePosition]);

  const progressPayload = useCallback(() => {
    const player = playerRef.current;
    if (player) {
      if (Number.isFinite(player.duration)) {
        durationRef.current = Math.max(durationRef.current, Math.min(86400, Math.floor(player.duration)));
      }
      resumePositionRef.current = player.ended ? 0 : resumePosition(player.currentTime, durationRef.current);
    }
    return {
      contextKey, mediaAssetId,
      watchedSeconds: Math.min(86400, Math.floor(watchedRef.current)),
      durationSeconds: Math.floor(durationRef.current),
      resumePositionSeconds: resumePositionRef.current,
    };
  }, [contextKey, mediaAssetId]);

  const saveProgress = useCallback(() => {
    if (!progressReady || mediaType === "file" || !resumeAppliedRef.current) return;
    const data = progressPayload();
    const { watchedSeconds: watched, durationSeconds: duration, resumePositionSeconds: position } = data;
    if (watched <= lastSentRef.current && duration <= lastSentDurationRef.current &&
      position === lastSentPositionRef.current) return;
    lastSentRef.current = Math.max(lastSentRef.current, watched);
    lastSentDurationRef.current = Math.max(lastSentDurationRef.current, duration);
    lastSentPositionRef.current = position;
    saveMutation({
      slug: sectionSlug,
      data,
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
      onError: () => { lastSentRef.current = 0; lastSentDurationRef.current = 0; lastSentPositionRef.current = -1; },
    });
  }, [contextKey, mediaAssetId, queryClient, saveMutation, sectionSlug, progressPayload, progressReady, mediaType]);

  const samplePlayback = useCallback(() => {
    const player = playerRef.current;
    const now = Date.now();
    if (player) resumePositionRef.current = player.ended ? 0 : resumePosition(player.currentTime, durationRef.current);
    if (!player || player.paused || player.seeking || document.visibilityState === "hidden" && mediaType === "video") {
      if (player) sampleRef.current = { at: now, position: player.currentTime };
      return;
    }
    const previous = sampleRef.current;
    const elapsed = Math.max(0, (now - previous.at) / 1000);
    const advanced = player.currentTime - previous.position;
    {
      const actualPlaybackTime = playbackSeconds(elapsed, advanced, player.playbackRate);
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
      if (watchedRef.current - lastSentRef.current >= 12) saveProgress();
    }, 1000);
    return () => window.clearInterval(interval);
  }, [isPlaying, samplePlayback, saveProgress]);

  useEffect(() => () => {
    saveProgress();
  }, [saveProgress]);

  useEffect(() => {
    const flush = () => {
      if (!progressReady || mediaType === "file" || !resumeAppliedRef.current) return;
      void saveSectionMediaProgress(sectionSlug, progressPayload(), { keepalive: true })
        .catch(error => console.warn("تعذّر حفظ موضع التشغيل عند مغادرة الصفحة", error));
    };
    window.addEventListener("pagehide", flush);
    return () => window.removeEventListener("pagehide", flush);
  }, [progressPayload, progressReady, sectionSlug, mediaType]);

  const handleMetadata = () => {
    const player = playerRef.current;
    if (!player) return;
    const duration = Number.isFinite(player.duration) ? Math.min(86400, Math.floor(player.duration)) : 0;
    durationRef.current = Math.max(durationRef.current, duration);
    setDurationSeconds(durationRef.current);
    sampleRef.current = { at: Date.now(), position: player.currentTime };
    applyResumePosition();
    saveProgress();
  };

  const playerEvents = {
    onPlay: (event: SyntheticEvent<HTMLMediaElement>) => {
      applyResumePosition();
      const player = event.currentTarget;
      sampleRef.current = { at: Date.now(), position: player.currentTime };
      setIsPlaying(true);
    },
    onPause: () => { samplePlayback(); setIsPlaying(false); saveProgress(); },
    onEnded: () => { resumePositionRef.current = 0; setIsPlaying(false); saveProgress(); },
    onSeeking: (event: SyntheticEvent<HTMLMediaElement>) => {
      sampleRef.current = { at: Date.now(), position: event.currentTarget.currentTime };
    },
    onSeeked: (event: SyntheticEvent<HTMLMediaElement>) => {
      sampleRef.current = { at: Date.now(), position: event.currentTarget.currentTime };
      if (Math.abs(event.currentTarget.currentTime - restoredPositionRef.current) > 0.5) setResumedAt(0);
      saveProgress();
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
      controls={progressReady}
      playsInline
      preload="metadata"
      aria-label={`مشاهدة ${title}`}
      {...playerEvents}
    />}
    {mediaType === "audio" && <audio
      ref={element => { playerRef.current = element; }}
      src={url}
      controls={progressReady}
      preload="metadata"
      aria-label={`الاستماع إلى ${title}`}
      {...playerEvents}
    />}
    {mediaType === "file" && <div className="tracked-section-document">
      <iframe src={`${url}?preview=1`} title={`معاينة ${title}`} loading="lazy" />
      <a href={url} download><Download size={15}/> تنزيل الملف</a>
    </div>}
    <div className="tracked-section-media-status" role="status" aria-live="polite">
      {!progressReady && mediaType !== "file" && (progressError
        ? <span>تعذّر تحميل موضعك السابق. {onRetryProgress && <button type="button" onClick={onRetryProgress}>إعادة المحاولة</button>}</span>
        : <span>جارٍ تحميل موضع التشغيل…</span>)}
      <span className="tracked-section-media-kind">{mediaIcon}{mediaType === "audio" ? "استماع" : mediaType === "video" ? "مشاهدة" : "مرفق"}</span>
      {mediaType !== "file" && <span>وقت التعلّم المسجل: {formatTime(watchedSeconds)}{durationSeconds > 0 ? ` من ${formatTime(durationSeconds)}` : ""}</span>}
      {resumedAt > 0 && <span data-testid={`media-resumed-${mediaAssetId}`}>استُعيد موضعك عند {formatTime(resumedAt)}</span>}
      {isPending && <span className="tracked-section-saving">جارٍ الحفظ…</span>}
      {isError && <button type="button" onClick={saveProgress} data-testid={`button-retry-media-progress-${mediaAssetId}`}>إعادة حفظ التقدّم</button>}
    </div>
  </div>;
}
