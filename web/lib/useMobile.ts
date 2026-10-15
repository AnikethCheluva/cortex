"use client";

import { useEffect, useState } from "react";

export const MOBILE_QUERY =
  "(max-width: 760px), (max-width: 1024px) and (max-height: 600px) and (pointer: coarse)";

export function useMobile() {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const query = window.matchMedia(MOBILE_QUERY);
    const update = () => setMobile(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return mobile;
}
