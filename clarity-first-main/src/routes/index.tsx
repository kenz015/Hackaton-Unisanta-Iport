import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, ArrowUpRight, Bell, CalendarDays, ChevronLeft, ChevronRight, Grid2X2, Pause, Play, RefreshCw, Shuffle, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { IportBrand } from "@/components/auth/IportBrand";
import { useAuth } from "@/components/auth/auth-provider";
import { portSlides } from "@/lib/port-slides";

/**
 * Tela inicial (pública). É a primeira coisa que abre.
 * Fluxo: Tela inicial → Login (/auth) → Sistema (/dashboard).
 */
export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "iCrew | Capacidade de equipes · Desafio iPORT" },
      { name: "description", content: "iCrew: dados do Azure DevOps, capacidade e IA para apoiar decisões de alocação antes que virem problema." },
      { property: "og:title", content: "iCrew | Capacidade de equipes · Desafio iPORT" },
      { property: "og:description", content: "Distribua tarefas, identifique sobrecarga e antecipe riscos sem substituir o Azure DevOps." },
      { property: "og:type", content: "website" },
    ],
  }),
  component: Home,
});

const features = [
  { icon: RefreshCw, title: "Sincronizar", text: "Reunir projetos, itens de trabalho, iterações e capacidade a partir do Azure DevOps." },
  { icon: Users, title: "Entender pessoas", text: "Considerar capacidade semanal, ausências e feriados para planejar uma carga viável." },
  { icon: CalendarDays, title: "Visualizar", text: "Acompanhar uma timeline por pessoa e período, com conflitos e ausências destacados." },
  { icon: Shuffle, title: "Realocar", text: "Mover atividades entre pessoas e ver o impacto antes de aplicar, gravando direto no Azure DevOps." },
  { icon: Grid2X2, title: "Identificar", text: "Enxergar utilização, sobrecarga e capacidade disponível em um mapa de calor da equipe." },
  { icon: Bell, title: "Alertar", text: "Antecipar conflitos, ausências, feriados e sobreposição de atividades, com explicação por IA." },
];

function Home() {
  const { user } = useAuth();
  const [slide, setSlide] = useState(0);
  const [paused, setPaused] = useState(false);
  const total = portSlides.length;
  const target = user ? "/dashboard" : "/auth";

  useEffect(() => {
    if (paused || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => setSlide((s) => (s + 1) % total), 6500);
    return () => window.clearInterval(timer);
  }, [paused, total]);

  return (
    <div className="iport-public">
      <header className="public-header">
        <IportBrand />
        <span className="public-motto">
          SUA EQUIPE, <strong>EM EQUILÍBRIO.</strong>
        </span>
        <Button asChild className="public-login">
          <Link to={target}>
            {user ? "Acessar sistema" : "Login"}
            <ArrowUpRight size={16} />
          </Link>
        </Button>
      </header>

      <section className="port-hero" aria-roledescription="carrossel" aria-label="Imagens do porto">
        {portSlides.map((item, i) => (
          <img
            key={item.image}
            className={`port-slide ${i === slide ? "visible" : ""}`}
            src={item.image}
            alt={item.alt}
            aria-hidden={i !== slide}
            width={1920}
            height={1088}
            loading={i === 0 ? "eager" : "lazy"}
          />
        ))}
        <div className="port-shade" />
        <div className="hero-copy">
          <span className="public-kicker">DESENVOLVIDO PARA O DESAFIO iPORT SOLUTIONS</span>
          <h1 className="icrew-title">iCrew</h1>
          <h2 className="icrew-promise">
            Pessoas certas.
            <br />
            Tarefas em equilíbrio.
          </h2>
          <p>Dados do Azure DevOps, capacidade e IA para distribuir tarefas, revelar sobrecargas e mostrar quem tem espaço para assumir mais.</p>
          <Button asChild size="lg" className="hero-cta">
            <Link to={target}>
              {user ? "Ir para o iCrew" : "Acessar o iCrew"}
              <ArrowRight />
            </Link>
          </Button>
        </div>
        <div className="hero-bottom">
          <span className="slide-caption">
            <span>
              0{slide + 1} / 0{total}
            </span>
            {portSlides[slide]?.label}
          </span>
          <div className="slide-controls">
            <Button variant="ghost" size="icon" aria-label="Imagem anterior" onClick={() => setSlide((s) => (s + total - 1) % total)}>
              <ChevronLeft />
            </Button>
            {portSlides.map((_, i) => (
              <Button key={i} variant="ghost" className={`slide-dot ${slide === i ? "current" : ""}`} aria-label={`Mostrar imagem ${i + 1}`} aria-pressed={slide === i} onClick={() => setSlide(i)}>
                <span />
              </Button>
            ))}
            <Button variant="ghost" size="icon" aria-label="Próxima imagem" onClick={() => setSlide((s) => (s + 1) % total)}>
              <ChevronRight />
            </Button>
            <Button variant="ghost" size="icon" aria-label={paused ? "Reproduzir imagens" : "Pausar imagens"} onClick={() => setPaused(!paused)}>
              {paused ? <Play /> : <Pause />}
            </Button>
          </div>
        </div>
      </section>

      <section className="company-intro">
        <div>
          <span className="public-kicker">O DESAFIO DA iPORT, NOSSO NORTE</span>
          <h2>
            Decidir antes de
            <br />
            <span>virar um problema.</span>
          </h2>
        </div>
        <div>
          <p>O Azure DevOps mostra o que precisa ser feito. O iCrew transforma esses dados em uma visão clara de quem pode assumir cada tarefa, quem está sobrecarregado e quais atividades precisam de atenção.</p>
          <p>Com análise de capacidade e IA, o gestor considera horas disponíveis, ausências e conflitos antes de redistribuir o trabalho. O iCrew complementa o Azure DevOps — não o substitui.</p>
        </div>
      </section>

      <section className="icrew-flow" aria-label="Como o iCrew funciona">
        <span>
          Azure DevOps<small>Dados dos projetos</small>
        </span>
        <ArrowRight aria-hidden="true" />
        <span>
          Capacidade + IA<small>Análise e alertas</small>
        </span>
        <ArrowRight aria-hidden="true" />
        <span>
          Visão da equipe<small>Apoio à decisão</small>
        </span>
      </section>

      <section className="company-values" aria-label="Funcionalidades do iCrew">
        {features.map(({ icon: Icon, title, text }) => (
          <div key={title}>
            <Icon />
            <h3>{title}</h3>
            <p>{text}</p>
          </div>
        ))}
      </section>

      <section className="icrew-status">
        <span className="public-kicker">PROTÓTIPO DO HACKATHON</span>
        <p>Entre com sua conta para explorar o iCrew. Com o Azure DevOps configurado, o painel lê o board real; sem ele, usa dados de demonstração.</p>
      </section>

      <footer className="public-footer">
        <IportBrand />
        <span>Uma equipe conectada. Um rumo em comum.</span>
        <span>iCrew · Desafio iPORT Solutions</span>
      </footer>
    </div>
  );
}
