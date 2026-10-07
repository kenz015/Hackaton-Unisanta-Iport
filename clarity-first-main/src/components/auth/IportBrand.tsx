import { Link } from "@tanstack/react-router";

/** Marca usada na tela inicial e no rodapé. */
export function IportBrand() {
  return (
    <Link to="/" className="iport-brand" aria-label="iCrew — início">
      <img src="/logo.jpeg" alt="" className="iport-mark object-contain p-1" />
      <span>
        iCrew<small>DESAFIO iPORT SOLUTIONS</small>
      </span>
    </Link>
  );
}
