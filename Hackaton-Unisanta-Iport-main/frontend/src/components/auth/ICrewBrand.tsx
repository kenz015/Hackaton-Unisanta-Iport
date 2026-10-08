import { Link } from "@tanstack/react-router";

/** Marca usada na tela inicial e no rodapé. */
export function ICrewBrand() {
  return (
    <Link to="/" className="icrew-brand" aria-label="iCrew — início">
      <img src="/Logotipo_iC.ico" alt="Logo iCrew" className="icrew-mark icrew-mark--clean object-contain" />
      <span>
        iCrew<small>SEU TIME EM EQUILÍBRIO</small>
      </span>
    </Link>
  );
}
