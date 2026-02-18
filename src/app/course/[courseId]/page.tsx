"use client";

import { useState, useCallback } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useCourseSession } from "@/hooks/useCourseSession";
import CourseHeader from "@/components/CourseHeader";
import Sidebar from "@/components/Sidebar";
import Chat from "@/components/Chat";
import { useToast, ToastContainer } from "@/components/Toast";

export default function CoursePage() {
  const { courseId } = useParams<{ courseId: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { toasts, addToast, dismissToast } = useToast();

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
  } = useCourseSession(courseId, searchParams, router, addToast);

  // Sidebar width — persisted in localStorage
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    if (typeof window !== "undefined") {
      return parseInt(localStorage.getItem("sidebar-width") || "260", 10);
    }
    return 260;
  });

  const handleSidebarResize = useCallback((newWidth: number) => {
    const clamped = Math.max(200, Math.min(400, newWidth));
    setSidebarWidth(clamped);
    localStorage.setItem("sidebar-width", String(clamped));
  }, []);

  if (!course) {
    return (
      <div className="flex h-screen items-center justify-center text-sm text-faint">
        Loading...
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen">
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      <CourseHeader currentCourse={course} courses={allCourses} />
      <div className="flex flex-1 min-h-0">
        <Sidebar
          modules={modules}
          currentModuleId={currentModuleId}
          onSelectModule={handleSelectModule}
          courseTopic={course.title ?? course.topic}
          width={sidebarWidth}
          onResize={handleSidebarResize}
        />
        <div className="flex-1 flex flex-col min-h-0">
          {currentModule ? (
            <>
              <div className="px-6 py-3 shrink-0 border-b border-border-subtle">
                <h2 className="font-semibold text-sm text-foreground">
                  {currentModule.title}
                </h2>
                {currentModule.goal && (
                  <p className="text-xs mt-0.5 text-muted">
                    {currentModule.goal}
                  </p>
                )}
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
            <div className="flex-1 flex items-center justify-center text-sm text-faint">
              Select a module to start learning
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
