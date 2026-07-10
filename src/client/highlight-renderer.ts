// Highlight navigation helpers.
//
// Highlights are rendered server-side as <mark class="llmd-highlight"> elements
// (see server.ts injectHighlightMarks). This module provides client-side
// navigation to those marks.

// Scroll to a highlight by its ID. Returns true if the highlight was found.
export const scrollToHighlight = (
  highlightId: string,
  behavior: ScrollBehavior = "smooth"
): boolean => {
  const marks = document.querySelectorAll(
    `mark.llmd-highlight[data-highlight-id="${highlightId}"]`
  );

  const firstMark = marks[0];
  if (!firstMark) {
    return false;
  }

  firstMark.scrollIntoView({ behavior, block: "center" });

  for (const mark of Array.from(marks)) {
    mark.classList.add("highlight-flash");
    setTimeout(() => {
      mark.classList.remove("highlight-flash");
    }, 1000);
  }

  return true;
};
