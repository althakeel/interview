"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function LegacyDone() {
  const router = useRouter();

  useEffect(() => {
    fetch("/api/candidate/session")
      .then((response) => response.json())
      .then((data) => {
        const role = data.candidate?.role || "gm";
        router.replace(data.candidate ? `/${role}/done` : "/");
      })
      .catch(() => router.replace("/"));
  }, [router]);

  return <p className="center">Opening your submission…</p>;
}
