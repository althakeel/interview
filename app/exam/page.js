"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function LegacyExam() {
  const router = useRouter();

  useEffect(() => {
    fetch("/api/candidate/session")
      .then((response) => response.json())
      .then((data) => {
        const role = data.candidate?.role || "gm";
        router.replace(data.candidate ? `/${role}/exam` : "/");
      })
      .catch(() => router.replace("/"));
  }, [router]);

  return <p className="center">Opening the examination…</p>;
}
