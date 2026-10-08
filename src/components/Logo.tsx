import mark from "../assets/zebra-z.svg";

function Logo({ className = "" }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block ${className}`}
      style={{
        WebkitMask: `url(${mark}) center / contain no-repeat`,
        mask: `url(${mark}) center / contain no-repeat`,
      }}
    />
  );
}

export default Logo;
