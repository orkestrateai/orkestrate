"use client";

import Image from "next/image";

export function SandBackground() {
  return (
    <div className="absolute w-full h-full top-19">
      <Image
        src="/blackSand.png"
        layout="fill"
        objectFit="contain"
        alt="Black sand background"
      />
    </div>
  );
}
