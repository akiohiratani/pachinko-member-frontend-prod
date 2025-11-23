import { useEffect, useState } from "react";
import "./JankenAnimation.css";

type JankenIcon = {
  src: string;
  alt: string;
};

const JANKEN_ICONS: JankenIcon[] = [
  { src: "/Janken/Rock.png", alt: "グー" },
  { src: "/Janken/Scissors.png", alt: "チョキ" },
  { src: "/Janken/Paper.png", alt: "パー" },
];

function pickRandomIcon(): JankenIcon {
  const index = Math.floor(Math.random() * JANKEN_ICONS.length);
  return JANKEN_ICONS[index] ?? JANKEN_ICONS[0];
}

type JankenAnimationProps = {
  active: boolean;
};

export function JankenAnimation({ active }: JankenAnimationProps) {
  const [icon, setIcon] = useState<JankenIcon | null>(null);

  useEffect(() => {
    if (!active) {
      setIcon(null);
      return;
    }
    setIcon(pickRandomIcon());
  }, [active]);

  if (!active || !icon) {
    return null;
  }

  return (
    <div className="janken-animation" aria-hidden="true">
      <div className="janken-animation__trail" />
      <div className="janken-animation__orb">
        <div className="janken-animation__glow" />
        <img
          src={icon.src}
          alt={icon.alt}
          className="janken-animation__icon"
        />
        <div className="janken-animation__spark" />
      </div>
    </div>
  );
}
