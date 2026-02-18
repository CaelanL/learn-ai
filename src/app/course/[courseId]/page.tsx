"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useCourseSession } from "@/hooks/useCourseSession";
import CourseHeader from "@/components/CourseHeader";
import Sidebar from "@/components/Sidebar";
import Chat from "@/components/Chat";

export default function CoursePage() {
  const { courseId } = useParams<{ courseId: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();

  const {
    course,
    allCourses,
    modules,
    currentModuleId,
    currentModule,
    messages,
    isLoading,
    streamingContent,
    sendMessage,
    handleSelectModule,
  } = useCourseSession(courseId, searchParams, router);

  if (!course) {
    return (
      <div className="flex h-screen items-center justify-center text-zinc-400 text-sm">
        Loading...
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen">
      <CourseHeader currentCourse={course} courses={allCourses} />
      <div className="flex flex-1 min-h-0">
        <Sidebar
          modules={modules}
          currentModuleId={currentModuleId}
          onSelectModule={handleSelectModule}
          courseTopic={course.topic}
        />
        <div className="flex-1 flex flex-col min-h-0">
          {currentModule ? (
            <>
              <div className="px-6 py-3 border-b border-zinc-200 dark:border-zinc-800 shrink-0">
                <h2 className="font-medium text-sm">{currentModule.title}</h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  {currentModule.goal || ""}
                </p>
              </div>
              <div className="flex-1 min-h-0">
                <Chat
                  key={currentModuleId}
                  messages={messages}
                  onSendMessage={sendMessage}
                  isLoading={isLoading}
                  streamingContent={streamingContent}
                  placeholder={
                    currentModule.is_course_setup
                      ? "Answer the questions to shape your curriculum..."
                      : "Type your response..."
                  }
                  welcome={
                    !currentModule.is_course_setup
                      ? { title: currentModule.title, goal: currentModule.goal }
                      : undefined
                  }
                />
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-zinc-400 text-sm">
              Select a module to start learning
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
