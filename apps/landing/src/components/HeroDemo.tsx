import { useEffect, useState } from "react";
import { heroDemoPoster, heroDemoSrc } from "../lib/copy";

export function HeroDemo(props: {
  demo: { youtubeId: string; title: string };
  id?: string;
}) {
  const [reduce, setReduce] = useState(false);

  useEffect(() => {
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduce(motion.matches);
    sync();
    motion.addEventListener("change", sync);
    return () => motion.removeEventListener("change", sync);
  }, []);

  return (
    <figure className="hero-demo" id={props.id}>
      <div className="hero-demo-window">
        <div className="hero-demo-stage">
          {reduce ? (
            <img src={heroDemoPoster(props.demo.youtubeId)} alt="" />
          ) : (
            <iframe
              className="hero-demo-frame"
              src={heroDemoSrc(props.demo.youtubeId, {
                autoplay: true,
                mute: true,
                loop: true,
              })}
              title={props.demo.title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          )}
        </div>
      </div>
    </figure>
  );
}
