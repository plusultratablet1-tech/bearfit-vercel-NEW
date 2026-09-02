"use client";

import { useEffect } from "react";

export default function GlobalError({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => {
    console.error("🔥 Global client error caught:", error);
    alert("An unexpected error occurred: " + error.message);
  }, [error]);

  return (
    <div className="p-8 text-center text-red-600">
      <h1>Something went wrong!</h1>
      <p>{error?.message ?? "Unknown error"}</p>
      <button onClick={() => reset()}>Try again</button>
    </div>
  );
}
