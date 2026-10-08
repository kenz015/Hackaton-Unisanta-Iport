import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertTriangle, ArrowRight, ArrowUpRight, Bell, CalendarDays, ChevronLeft, ChevronRight, Grid2X2, LayoutDashboard, Pause, Play, RefreshCw, ShieldCheck, Shuffle, TrendingUp, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ICrewBrand } from "@/components/auth/ICrewBrand";
import { useAuth } from "@/components/auth/auth-provider";
import { portSlides } from "@/lib/port-slides";

/**
 * Tela inicial (pública). É a primeira coisa que abre.
 * Fluxo: Tela inicial → Login (/auth) → Sistema (/dashboard).
 */
export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "iCrew | Capacidade de equipes" },
      { name: "description", content: "iCrew: dados do Azure DevOps, capacidade e IA para apoiar decisões de alocação antes que virem problema." },
      { property: "og:title", content: "iCrew | Capacidade de equipes" },
      { property: "og:description", content: "Distribua tarefas, identifique sobrecarga e antecipe riscos sem substituir o Azure DevOps." },
      { property: "og:type", content: "website" },
    ],
  }),
  component: Home,
});

const features = [
  { icon: LayoutDashboard, title: "Visão real da equipe", text: "Reúne capacidade, feriados, ausências e sobreposição em uma leitura clara de quem pode assumir o próximo passo sem perder ritmo." },
  { icon: AlertTriangle, title: "Risco antecipado", text: "Destaca sinais de sobrecarga, conflitos e gargalos antes que eles se transformem em atrasos e retrabalho." },
  { icon: ShieldCheck, title: "Decisão com apoio", text: "Combina dados do Azure DevOps com IA para explicar o cenário e apoiar a realocação de forma mais objetiva e segura." },
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
  const [headerSolid, setHeaderSolid] = useState(false);
  const heroRef = useRef<HTMLElement | null>(null);
  const total = portSlides.length;
  const target = user ? "/dashboard" : "/auth";

  useEffect(() => {
    if (paused || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => setSlide((s) => (s + 1) % total), 6500);
    return () => window.clearInterval(timer);
  }, [paused, total]);

  useEffect(() => {
    const handleScroll = () => {
      const shift = Math.min(window.scrollY * 0.2, 90);
      if (heroRef.current) {
        heroRef.current.style.setProperty("--hero-shift", `${shift}px`);
      }

      const isPastHero = window.scrollY > window.innerHeight * 0.5;
      setHeaderSolid(isPastHero);
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div className="icrew-public">
      <header className={`public-header ${headerSolid ? "is-scrolled" : "is-hero"}`}>
        <ICrewBrand />
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

      <section ref={heroRef} className="port-hero" aria-roledescription="carrossel" aria-label="Imagens do porto">
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
          <span className="public-kicker">PLATAFORMA iCrew</span>
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
          <span className="public-kicker">O DESAFIO DA EQUIPE, NOSSO NORTE</span>
          <h2>
            Planejar com clareza.
            <br />
            <span>Antes que o risco apareça.</span>
          </h2>
        </div>
        <div>
          <p>O Azure DevOps traz a execução. O iCrew transforma esse contexto em uma visão prática de capacidade, sobrecarga e espaço para assumir mais trabalho com segurança.</p>
          <p>Com dados de pessoas, cronograma e IA, a liderança decide com mais precisão, reduz ruído operacional e redistribui prioridade antes que o problema se torne atraso.</p>
        </div>
      </section>

      <div className="wave-divider" aria-hidden="true">
        <svg className="wave-svg" viewBox="0 0 1200 90" preserveAspectRatio="none">
          <path className="wave wave-back" d="M0,52 C150,18 250,18 380,48 S660,84 800,52 S1050,18 1200,52 L1200,90 L0,90 Z" />
          <path className="wave wave-front" d="M0,54 C145,22 285,22 430,52 S710,90 860,54 S1050,18 1200,56" />
        </svg>
      </div>

      <section className="company-story" aria-label="Por que o iCrew">
        <div className="story-header">
          <span className="public-kicker">POR QUE O ICREW</span>
          <h2>Mais contexto. Menos improviso. Mais confiança para decidir.</h2>
        </div>
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
        <p>Entre com sua conta para explorar o iCrew. Com o Azure DevOps configurado, o painel lê o trabalho real da equipe; sem ele, usa dados de demonstração para validar o fluxo.</p>
      </section>

      <footer className="public-footer">
        <ICrewBrand />
        <span>Uma equipe conectada. Um rumo em comum.</span>
        <span>iCrew</span>
      </footer>
    </div>
  );
}
