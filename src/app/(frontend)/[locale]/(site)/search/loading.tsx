import { Skeleton } from "@/components/ui/skeleton";

/**
 * Scoped deliberately to /search rather than sitting at the [locale] level.
 *
 * A loading.tsx creates a Suspense boundary, which makes Next flush the response
 * shell immediately — committing HTTP 200 before the page body runs. Any route
 * under that boundary therefore loses its ability to return a real 404, so every
 * missing article, category, tag, club, author and fixture answered "200 OK"
 * with a not-found page rendered inside it. Google reads that as "this URL is
 * alive and deliberately hidden" and keeps it in the crawl set forever.
 *
 * /search is safe: it is genuinely dynamic (worth a skeleton), it has no child
 * segments, and it never calls notFound(). Do not move this file up a level, and
 * do not add loading.tsx to a segment that has 404-capable children.
 */
export default function Loading() {
  return (
    <div className="container space-y-6 py-8">
      <Skeleton className="h-10 w-full max-w-md rounded-lg" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-48 w-full rounded-lg" />
        ))}
      </div>
    </div>
  );
}
