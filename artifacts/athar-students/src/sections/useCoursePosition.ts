import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getCoursePosition, saveCoursePosition, useGetCoursePosition, type SectionBlock, type SectionCourse } from "@workspace/api-client-react";
import { resolveCourseLesson } from "../lib/course-position";
import { enqueueCoursePosition, waitForCoursePosition } from "../lib/course-position-queue";

export function useCoursePosition(userId: string, slug: string, course: SectionCourse, firstLesson?: SectionBlock) {
  const queryClient = useQueryClient();
  const queryKey = ["course-position", userId, slug, course.id];
  const queueKey = JSON.stringify(queryKey);
  const restored = useGetCoursePosition(slug, course.id, {
    query: {
      queryKey, staleTime: 0, refetchOnMount: "always", refetchOnWindowFocus: false, refetchOnReconnect: false,
      queryFn: async ({ signal }) => {
        await waitForCoursePosition(queueKey);
        return getCoursePosition(slug, course.id, { signal });
      },
    },
  });
  const [chosen, setChosen] = useState<SectionBlock>();
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const sequence = useRef(0);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  const saved = chosen ?? (!restored.isFetching ? restored.data?.lesson ??
    (restored.isSuccess ? firstLesson : undefined) : undefined);
  const referenceIndex = saved ? course.materials.indexOf(saved) : -1;
  const index = referenceIndex >= 0 ? referenceIndex : saved ? resolveCourseLesson(course.materials, saved) : -1;

  const persist = (lesson: SectionBlock) => {
    const current = ++sequence.current;
    setSaveState("saving");
    void enqueueCoursePosition(queueKey, async () => {
      try {
        // Finish small saves across in-app navigation. The server checks this
        // expected account against the authenticated identity, never trusts it.
        const result = await saveCoursePosition(slug, course.id, { lesson }, {
          keepalive: true, headers: { "X-Athar-Expected-User": userId },
        });
        queryClient.setQueryData(queryKey, result);
        if (mounted.current && current === sequence.current) setSaveState("saved");
      } catch {
        if (mounted.current && current === sequence.current) setSaveState("error");
      }
    });
  };
  const choose = (lesson: SectionBlock) => { setChosen(lesson); persist(lesson); };
  useEffect(() => {
    if (restored.isSuccess && !restored.isFetching && !restored.data?.lesson && !chosen && firstLesson) {
      choose(firstLesson);
    }
  }, [restored.isSuccess, restored.isFetching, restored.data, chosen, firstLesson]);
  return {
    index, choose, saveState,
    loading: !chosen && (restored.isPending || restored.isFetching),
    loadError: !chosen && restored.isError,
    missing: Boolean(saved && index < 0),
    retryLoad: () => void restored.refetch(),
    retrySave: () => { if (index >= 0) persist(course.materials[index]); },
  };
}
