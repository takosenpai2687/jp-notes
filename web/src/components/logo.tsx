export function Logo() {
  return (
    <span className="tako-logo" aria-label="tako-jp">
      <svg className="tako-mark" viewBox="0 0 48 48" fill="none" aria-hidden="true">
        <path d="M11 28v-8C11 10 17 5 25 5s14 6 14 15v8" fill="#bce9fa" />
        <path d="M11 26c-7 0-7 10-1 10 4 0 4-5 5-5 2 0 0 10 6 10 5 0 3-10 5-10s0 9 5 9c6 0 3-10 5-10 1 0 2 6 6 4 5-3 1-8-3-8V20C39 10 33 5 25 5S11 11 11 20v6Z"
          fill="#46b9e8" stroke="#1b89bf" strokeWidth="1.7" strokeLinejoin="round" />
        <path d="M16 17c0-5 4-8 8-8" stroke="#dff6ff" strokeWidth="2.8" strokeLinecap="round" />
        <path d="M20 22v2m11-2v2" stroke="#174c69" strokeWidth="2.8" strokeLinecap="round" />
        <path d="M24 28c1 1 2 1 3 0" stroke="#174c69" strokeWidth="1.7" strokeLinecap="round" />
        <ellipse cx="17.5" cy="27" rx="2.5" ry="1.5" fill="#ffb5ad" />
        <ellipse cx="34" cy="27" rx="2.5" ry="1.5" fill="#ffb5ad" />
        <path d="m41 7 1-3m2 6 3-1" stroke="#f6c66b" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <span className="tako-wordmark">tako<span className="logo-hyphen">-</span><span className="logo-jp">JP</span></span>
    </span>
  );
}
