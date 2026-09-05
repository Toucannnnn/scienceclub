import Link from "next/link";
import { requireApprovedProfile, hasRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { getCourses, getMyTutorCourses, type Course } from "@/lib/data/courses";
import { CourseRequestForm } from "./course-request-form";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata = { title: "My courses" };

export default async function TutorCoursesPage() {
  const profile = await requireApprovedProfile();

  if (!hasRole(profile, "tutor")) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Tutor courses</CardTitle>
          <CardDescription>
            Only tutors request course approval. Ask an admin if you think you
            should have the tutor role.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const supabase = await createClient();
  const [courses, myCourses] = await Promise.all([
    getCourses(supabase),
    getMyTutorCourses(supabase, profile.id),
  ]);

  // Group by subject, preserving the sort order getCourses established.
  const bySubject = new Map<string, Course[]>();
  for (const course of courses) {
    const list = bySubject.get(course.subjectName) ?? [];
    list.push(course);
    bySubject.set(course.subjectName, list);
  }

  const approved = courses.filter(
    (c) => myCourses.get(c.id)?.status === "approved"
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">My courses</h1>
          <p className="text-muted-foreground">
            You can only post availability for courses you&apos;re approved to
            tutor.
          </p>
        </div>
        <Link
          href="/availability"
          className={buttonVariants({ variant: "outline" })}
        >
          Tutor availability
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>What you&apos;re approved to tutor</CardTitle>
          <CardDescription>
            {approved.length === 0
              ? "Nothing yet — pick your courses below and an admin will review them."
              : "These are the courses you can post sessions for."}
          </CardDescription>
        </CardHeader>
        {approved.length > 0 && (
          <CardContent className="flex flex-wrap gap-2">
            {approved.map((course) => (
              <Badge key={course.id}>{course.name}</Badge>
            ))}
          </CardContent>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Request approval</CardTitle>
          <CardDescription>
            Check every course you&apos;re comfortable tutoring. Approved
            courses stay locked — ask an admin to remove one.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CourseRequestForm
            coursesBySubject={[...bySubject.entries()]}
            myCourses={[...myCourses.entries()]}
          />
        </CardContent>
      </Card>
    </div>
  );
}
