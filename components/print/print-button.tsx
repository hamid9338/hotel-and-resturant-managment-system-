"use client";

// Isolated client island — the print pages themselves are server components
// with zero other interactivity. Uses the .no-print rule already sitting in
// app/globals.css so this button vanishes in the printed/PDF output.
export function PrintButton() {
  return (
    <div className="no-print mx-auto mb-4 max-w-2xl text-right">
      <button
        onClick={() => window.print()}
        className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
      >
        Print / Save as PDF
      </button>
    </div>
  );
}
