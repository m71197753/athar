import { useCallback, useEffect, useRef, useState, type SyntheticEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Download, FileText, Headphones, Video } from "lucide-react";
import {
  getGetSectionMediaProgressQueryKey,
  getListLearningItemsQueryKey,
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

function playbackErrorMessage(code: number, mediaType: "audio" | "video" | "file") {
  const mediaName = mediaType === "audio" ? "الصوت" : "الفيديو";
  if (code === 2) return `تعذّر تحميل ${mediaName}. تحقق من اتصال الإنترنت ثم أعد المحاولة.`;
  if (code === 3 || code === 4) return "المتصفح لم يتمكن من تشغيل صيغة الملف أو ترميزه. جرّب تنزيله أو رفعه بصيغة متوافقة.";
  return `تعذّر تشغيل ${mediaName}. أعد المحاولة أو نزّل الملف لمشاهدته على جهازك.`;
}

export function TrackedSectionMedia(props: TrackedSectionMediaProps) {
  // A replacement/reordered lesson must never inherit another file's counters.
  return <TrackedMediaSession
    key={JSON.stringify([props.sectionSlug, props.contextKey, props.mediaAssetId, props.url])}
    {...props}
  />;
}

function TrackedMediaSession({
  sectionSlug, contextKey, mediaAssetId, mediaType, url, title, savedProgress, progressReady = true,
  progressError = false, onRetryProgress,
}: TrackedSectionMediaProps) {
  const queryClient = useQueryClient();
  const [isPending, setIsPending] = useState(false);
  const [isError, setIsError] = useState(false);
  const playerRef = useRef<HTMLMediaElement | null>(null);
  const sampleRef = useRef({ at: 0, position: 0, rate: 1 });
  const trackingRef = useRef(false);
  const requestPendingRef = useRef(false);
  const queuedSaveRef = useRef(false);
  const saveProgressRef = useRef<() => void>(() => {});
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
  const [playbackError, setPlaybackError] = useState<number | null>(null);

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
      sampleRef.current = { at: performance.now(), position: restored, rate: player.playbackRate };
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
    // Snapshot even when another save is pending, before React detaches the
    // media ref on navigation.
    const data = progressPayload();
    if (requestPendingRef.current) {
      queuedSaveRef.current = true;
      return;
    }
    const { watchedSeconds: watched, durationSeconds: duration, resumePositionSeconds: position } = data;
    if (watched <= lastSentRef.current && duration <= lastSentDurationRef.current &&
      position === lastSentPositionRef.current) return;
    lastSentRef.current = Math.max(lastSentRef.current, watched);
    lastSentDurationRef.current = Math.max(lastSentDurationRef.current, duration);
    lastSentPositionRef.current = position;
    requestPendingRef.current = true;
    setIsPending(true);
    setIsError(false);
    let succeeded = false;
    // Use the request promise so a queued final position is still saved if
    // navigation unmounts this player while an earlier request is in flight.
    void saveSectionMediaProgress(sectionSlug, data).then(saved => {
        succeeded = true;
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
      }).catch(() => {
        setIsError(true);
        lastSentRef.current = 0; lastSentDurationRef.current = 0; lastSentPositionRef.current = -1;
      }).finally(() => {
        setIsPending(false);
        requestPendingRef.current = false;
        const queued = queuedSaveRef.current;
        queuedSaveRef.current = false;
        // Do not immediately loop on failures. Retry via the next interval,
        // reconnect, or the explicit retry button.
        if (succeeded && queued) saveProgressRef.current();
      });
  }, [contextKey, mediaAssetId, queryClient, sectionSlug, progressPayload, progressReady, mediaType]);
  saveProgressRef.current = saveProgress;

  const samplePlayback = useCallback(() => {
    const player = playerRef.current;
    const now = performance.now();
    if (player) resumePositionRef.current = player.ended ? 0 : resumePosition(player.currentTime, durationRef.current);
    if (!player || !trackingRef.current || player.seeking || document.visibilityState === "hidden" && mediaType === "video") {
      if (player) sampleRef.current = { at: now, position: player.currentTime, rate: player.playbackRate };
      return;
    }
    const previous = sampleRef.current;
    const elapsed = Math.max(0, (now - previous.at) / 1000);
    const advanced = player.currentTime - previous.position;
    {
      const actualPlaybackTime = playbackSeconds(elapsed, advanced, previous.rate);
      if (actualPlaybackTime > 0) {
        watchedRef.current += actualPlaybackTime;
        setWatchedSeconds(Math.floor(watchedRef.current));
      }
    }
    sampleRef.current = { at: now, position: player.currentTime, rate: player.playbackRate };
  }, [mediaType]);

  useEffect(() => {
    if (!isPlaying) return;
    const interval = window.setInterval(() => {
      samplePlayback();
      if (watchedRef.current - lastSentRef.current >= 12) saveProgress();
    }, 1000);
    return () => window.clearInterval(interval);
  }, [isPlaying, samplePlayback, saveProgress]);

  useEffect(() => {
    const visibilityChanged = () => {
      if (mediaType === "video" && playerRef.current) {
        const player = playerRef.current;
        // Do not credit the hidden interval when returning to this tab.
        sampleRef.current = { at: performance.now(), position: player.currentTime, rate: player.playbackRate };
      } else {
        samplePlayback();
      }
      if (document.visibilityState === "hidden") saveProgressRef.current();
    };
    const reconnect = () => saveProgressRef.current();
    document.addEventListener("visibilitychange", visibilityChanged);
    window.addEventListener("online", reconnect);
    return () => {
      document.removeEventListener("visibilitychange", visibilityChanged);
      window.removeEventListener("online", reconnect);
      saveProgressRef.current();
    };
  }, [samplePlayback, mediaType]);

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
    sampleRef.current = { at: performance.now(), position: player.currentTime, rate: player.playbackRate };
    applyResumePosition();
    saveProgress();
  };

  const playerEvents = {
    onError: (event: SyntheticEvent<HTMLMediaElement>) => {
      const player = event.currentTarget;
      trackingRef.current = false;
      setIsPlaying(false);
      setPlaybackError(player.error?.code ?? 0);
    },
    onCanPlay: () => setPlaybackError(null),
    onPlay: (event: SyntheticEvent<HTMLMediaElement>) => {
      applyResumePosition();
      const player = event.currentTarget;
      sampleRef.current = { at: performance.now(), position: player.currentTime, rate: player.playbackRate };
      trackingRef.current = true;
      setIsPlaying(true);
    },
    onPause: () => { samplePlayback(); trackingRef.current = false; setIsPlaying(false); saveProgress(); },
    onEnded: () => { samplePlayback(); trackingRef.current = false; resumePositionRef.current = 0; setIsPlaying(false); saveProgress(); },
    onRateChange: samplePlayback,
    onSeeking: (event: SyntheticEvent<HTMLMediaElement>) => {
      sampleRef.current = { at: performance.now(), position: event.currentTarget.currentTime, rate: event.currentTarget.playbackRate };
    },
    onSeeked: (event: SyntheticEvent<HTMLMediaElement>) => {
      sampleRef.current = { at: performance.now(), position: event.currentTarget.currentTime, rate: event.currentTarget.playbackRate };
      if (Math.abs(event.currentTarget.currentTime - restoredPositionRef.current) > 0.5) setResumedAt(0);
      saveProgress();
    },
    onTimeUpdate: samplePlayback,
    onLoadedMetadata: handleMetadata,
  };

  const mediaIcon = mediaType === "audio" ? <Headphones size={16} aria-hidden="true"/>
    : mediaType === "video" ? <Video size={16} aria-hidden="true"/>
      : <FileText size={16} aria-hidden="true"/>;

  const retryPlayback = () => {
    setPlaybackError(null);
    playerRef.current?.load();
  };

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
      {!progressReady && mediaType !== "file" && (progressError
        ? <span>تعذّر تحميل موضعك السابق. {onRetryProgress && <button type="button" onClick={onRetryProgress}>إعادة المحاولة</button>}</span>
        : <span>جارٍ تحميل موضع التشغيل…</span>)}
      {playbackError !== null && mediaType !== "file" && <span className="tracked-section-media-error" role="alert">
        {playbackErrorMessage(playbackError, mediaType)}
        <button type="button" onClick={retryPlayback}>إعادة المحاولة</button>
        <a href={url} download>تنزيل {mediaType === "audio" ? "الصوت" : "الفيديو"}</a>
      </span>}
      <span className="tracked-section-media-kind">{mediaIcon}{mediaType === "audio" ? "استماع" : mediaType === "video" ? "مشاهدة" : "مرفق"}</span>
      {mediaType !== "file" && <span>وقت التعلّم المسجل: {formatTime(watchedSeconds)}{durationSeconds > 0 ? ` من ${formatTime(durationSeconds)}` : ""}</span>}
      {resumedAt > 0 && <span data-testid={`media-resumed-${mediaAssetId}`}>استُعيد موضعك عند {formatTime(resumedAt)}</span>}
      {isPending && <span className="tracked-section-saving">جارٍ الحفظ…</span>}
      {isError && <button type="button" onClick={saveProgress} data-testid={`button-retry-media-progress-${mediaAssetId}`}>إعادة حفظ التقدّم</button>}
    </div>
  </div>;
}
