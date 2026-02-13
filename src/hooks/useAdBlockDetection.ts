import { useState, useEffect, useCallback } from "react";

const TEST_AD_URL = "https://pl28696347.effectivegatecpm.com/bb84edf2d90786d814cdab867f67db1b/invoke.js";

export function useAdBlockDetection() {
  const [adBlocked, setAdBlocked] = useState(false);
  const [checking, setChecking] = useState(true);

  const detect = useCallback(async () => {
    setChecking(true);
    try {
      // Method 1: Try fetching the ad script
      const res = await fetch(TEST_AD_URL, {
        method: "HEAD",
        mode: "no-cors",
        cache: "no-store",
      });
      // no-cors fetch won't throw on success — opaque response is fine
    } catch {
      setAdBlocked(true);
      setChecking(false);
      return;
    }

    // Method 2: Create a bait element that ad blockers typically hide
    const bait = document.createElement("div");
    bait.className = "ad_unit ad-zone textAd banner-ad pub_300x250";
    bait.setAttribute("id", "ad-test-bait");
    bait.style.cssText =
      "position:absolute;left:-9999px;width:300px;height:250px;pointer-events:none;";
    document.body.appendChild(bait);

    // Give ad blockers a moment to act
    await new Promise((r) => setTimeout(r, 150));

    const hidden =
      bait.offsetHeight === 0 ||
      bait.clientHeight === 0 ||
      getComputedStyle(bait).display === "none" ||
      getComputedStyle(bait).visibility === "hidden";

    bait.remove();

    setAdBlocked(hidden);
    setChecking(false);
  }, []);

  useEffect(() => {
    detect();
  }, [detect]);

  return { adBlocked, checking, recheckAdBlock: detect };
}
